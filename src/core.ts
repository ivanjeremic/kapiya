import { TimeSpan, createDate, isWithinExpirationDate } from "./date.js";
import { CookieController } from "./cookie.js";
import { generateIdFromEntropySize } from "./crypto.js";

import type {
  RegisteredDatabaseSessionAttributes,
  RegisteredDatabaseUserAttributes,
  RegisteredKapiya,
  UserId,
} from "./index.js";
import type { Cookie, CookieAttributes } from "./cookie.js";

type SessionAttributes = RegisteredKapiya extends KapiyaClient<
  infer _SessionAttributes,
  any
>
  ? _SessionAttributes
  : {};

type UserAttributes = RegisteredKapiya extends KapiyaClient<
  any,
  infer _UserAttributes
>
  ? _UserAttributes
  : {};

export interface Session extends SessionAttributes {
  id: string;
  expiresAt: Date;
  fresh: boolean;
  userId: UserId;
}

export interface User extends UserAttributes {
  id: UserId;
}

interface DatabaseSession {
  userId: UserId;
  expiresAt: Date;
  id: string;
  attributes: RegisteredDatabaseSessionAttributes;
}

interface DatabaseUser {
  id: UserId;
  attributes: RegisteredDatabaseUserAttributes;
}

type CookiesType = {
  get: (name: string) => any;
  set: (name: string, value: string, options: CookieAttributes) => any;
  remove: (name: string, value: string, options: CookieAttributes) => any;
};

type BASE<T> = T & {
  handleSignUp: (user: any) => void;
  handleSignIn(session: Session): Promise<void>;
  handleSignOut: (sessionId: string) => Promise<void>;
  fetchSession: (userId: UserId) => Promise<DatabaseSession[]>;
  updateSessionExpiry: (
    sessionId: string,
    updateExpiresAt: Date
  ) => Promise<void>;
};

type Options<T, U> = {
  prepare: () => Promise<void>;
  cookies?: (payload?: any) => CookiesType;
  sessionExpiresIn?: TimeSpan;
  sessionCookie?: SessionCookieOptions;
  getSessionAttributes?: (
    databaseSessionAttributes: RegisteredDatabaseSessionAttributes
  ) => T;
  getUserAttributes?: (
    databaseUserAttributes: RegisteredDatabaseUserAttributes
  ) => U;
  strategies: {
    github?: BASE<{
      clientId: string;
      clientSecret: string;
      enterpriseDomain?: string;
    }>;
  };
};

export class KapiyaClient<
  _SessionAttributes extends {} = Record<never, never>,
  _UserAttributes extends {} = Record<never, never>
> {
  private sessionExpiresIn: TimeSpan;
  private sessionCookieController: CookieController;

  private getSessionAttributes: (
    databaseSessionAttributes: RegisteredDatabaseSessionAttributes
  ) => _SessionAttributes;

  private getUserAttributes: (
    databaseUserAttributes: RegisteredDatabaseUserAttributes
  ) => _UserAttributes;

  public readonly sessionCookieName: string;

  strategies: {
    github?: BASE<{
      clientId: string;
      clientSecret: string;
      enterpriseDomain?: string;
    }>;
  };

  constructor(options: Options<_SessionAttributes, _UserAttributes>) {
    if (options && options.prepare) {
      options.prepare();
    }

    // we have to use `any` here since TS can't do conditional return types
    this.getUserAttributes = (databaseUserAttributes): any => {
      if (options && options.getUserAttributes) {
        return options.getUserAttributes(databaseUserAttributes);
      }
      return {};
    };

    this.getSessionAttributes = (databaseSessionAttributes): any => {
      if (options && options.getSessionAttributes) {
        return options.getSessionAttributes(databaseSessionAttributes);
      }
      return {};
    };

    this.sessionExpiresIn = options?.sessionExpiresIn ?? new TimeSpan(30, "d");
    this.sessionCookieName = options?.sessionCookie?.name ?? "auth_session";
    let sessionCookieExpiresIn = this.sessionExpiresIn;

    if (options?.sessionCookie?.expires === false) {
      sessionCookieExpiresIn = new TimeSpan(365 * 2, "d");
    }

    const baseSessionCookieAttributes: CookieAttributes = {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      ...options?.sessionCookie?.attributes,
    };

    this.sessionCookieController = new CookieController(
      this.sessionCookieName,
      baseSessionCookieAttributes,
      {
        expiresIn: sessionCookieExpiresIn,
      }
    );

    /**
     * client options
     */
    if (options && options.strategies) {
      this.strategies = options.strategies;
    }
  }

  // db
  private async getSessionAndUser(
    sessionId: string
  ): Promise<[session: DatabaseSession | null, user: DatabaseUser | null]> {
    return new Promise(() => {});
  }

  // db
  private async setSession(session: DatabaseSession): Promise<void> {}

  // db
  private async updateSessionExpiration(
    sessionId: string,
    expiresAt: Date
  ): Promise<void> {}

  // db
  private async deleteSession(sessionId: string): Promise<void> {}

  // db
  private async deleteUserSessions(userId: UserId): Promise<void> {}

  /**
   *
   * PUBLIC API
   */
  public async getUserSessions(userId: UserId): Promise<Session[]> {
    const databaseSessions = await this.strategies.github!.fetchSession(userId);
    const sessions: Session[] = [];
    for (const databaseSession of databaseSessions) {
      if (!isWithinExpirationDate(databaseSession.expiresAt)) {
        continue;
      }
      sessions.push({
        id: databaseSession.id,
        expiresAt: databaseSession.expiresAt,
        userId: databaseSession.userId,
        fresh: false,
        ...this.getSessionAttributes(databaseSession.attributes),
      });
    }
    return sessions;
  }

  public async validateSession(
    sessionId: string
  ): Promise<{ user: User; session: Session } | { user: null; session: null }> {
    const [databaseSession, databaseUser] = await this.getSessionAndUser(
      sessionId
    );
    if (!databaseSession) {
      return { session: null, user: null };
    }
    if (!databaseUser) {
      await this.deleteSession(databaseSession.id);
      return { session: null, user: null };
    }
    if (!isWithinExpirationDate(databaseSession.expiresAt)) {
      await this.deleteSession(databaseSession.id);
      return { session: null, user: null };
    }
    const activePeriodExpirationDate = new Date(
      databaseSession.expiresAt.getTime() -
        this.sessionExpiresIn.milliseconds() / 2
    );
    const session: Session = {
      ...this.getSessionAttributes(databaseSession.attributes),
      id: databaseSession.id,
      userId: databaseSession.userId,
      fresh: false,
      expiresAt: databaseSession.expiresAt,
    };
    if (!isWithinExpirationDate(activePeriodExpirationDate)) {
      session.fresh = true;
      session.expiresAt = createDate(this.sessionExpiresIn);
      await this.updateSessionExpiration(databaseSession.id, session.expiresAt);
    }
    const user: User = {
      ...this.getUserAttributes(databaseUser.attributes),
      id: databaseUser.id,
    };
    return { user, session };
  }

  public async createSession(
    userId: UserId,
    attributes: RegisteredDatabaseSessionAttributes,
    options?: {
      sessionId?: string;
    }
  ): Promise<Session> {
    const sessionId = options?.sessionId ?? generateIdFromEntropySize(25);
    const sessionExpiresAt = createDate(this.sessionExpiresIn);
    await this.setSession({
      id: sessionId,
      userId,
      expiresAt: sessionExpiresAt,
      attributes,
    });
    const session: Session = {
      id: sessionId,
      userId,
      fresh: true,
      expiresAt: sessionExpiresAt,
      ...this.getSessionAttributes(attributes),
    };
    return session;
  }

  public async invalidateSession(sessionId: string): Promise<void> {
    await this.deleteSession(sessionId);
  }

  public async invalidateUserSessions(userId: UserId): Promise<void> {
    await this.deleteUserSessions(userId);
  }

  public async deleteExpiredSessions(): Promise<void> {
    await this.deleteExpiredSessions();
  }

  public readSessionCookie(cookieHeader: string): string | null {
    const sessionId = this.sessionCookieController.parse(cookieHeader);
    return sessionId;
  }

  public readBearerToken(authorizationHeader: string): string | null {
    const [authScheme, token] = authorizationHeader.split(" ") as [
      string,
      string | undefined
    ];
    if (authScheme !== "Bearer") {
      return null;
    }
    return token ?? null;
  }

  public createSessionCookie(sessionId: string): Cookie {
    return this.sessionCookieController.createCookie(sessionId);
  }

  public createBlankSessionCookie(): Cookie {
    return this.sessionCookieController.createBlankCookie();
  }
}

export interface SessionCookieOptions {
  name?: string;
  expires?: boolean;
  attributes?: SessionCookieAttributesOptions;
}

export interface SessionCookieAttributesOptions {
  sameSite?: "lax" | "strict" | "none";
  domain?: string;
  path?: string;
  secure?: boolean;
}
