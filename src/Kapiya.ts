import { Session, CookieAttributes } from "./index";
import { KapiyaClient } from "./core";
import { generateState, Apple, AppleCredentials, GitHub } from "arctic";

/**
 * @TUTORIAL https://www.youtube.com/watch?v=v8NJt5REvck
 */

type BASE<T> = T & {
  handleSignUp: (user: any) => void;
  handleSignIn(session: Session): Promise<void>;
  handleSignOut: (sessionId: string) => Promise<void>;
  fetchSession: (user: any) => void;
  updateSessionExpiry: (
    sessionId: string,
    updateExpiresAt: Date
  ) => Promise<void>;
  sessionConfig?: any;
  cookieConfig?: any;
  redirectURI?: string;
};

type CookiesType = {
  get: (name: string) => any;
  set: (name: string, value: string, options: CookieAttributes) => any;
  remove: (name: string, value: string, options: CookieAttributes) => any;
};

type Options = {
  prepare: () => Promise<void>;
  cookies?: (payload?: any) => CookiesType;
  strategies: {
    basic?: BASE<{}>;
    emailPassword?: BASE<{}>;
    github?: BASE<{
      clientId: string;
      clientSecret: string;
      enterpriseDomain?: string;
    }>;
    apple?: BASE<AppleCredentials>;
    google?: BASE<{}>;
  };
};

export class Kapiya {
  private strategies: {
    basic?: BASE<{}>;
    emailPassword?: BASE<{}>;
    github?: BASE<{
      clientId: string;
      clientSecret: string;
      enterpriseDomain?: string;
    }>;
    apple?: BASE<AppleCredentials>;
    google?: any;
  };

  private authClient: KapiyaClient<
    Record<never, never>,
    { githubId: number; username: string }
  >;

  private cookies: (payload?: any) => CookiesType;

  // oauth instances
  private github: GitHub;
  private apple: Apple;

  constructor({ prepare, strategies, cookies }: Options) {
    this.authClient = new KapiyaClient({
      sessionCookie: {
        attributes: {
          secure: process.env.NODE_ENV === "production",
        },
      },
      getUserAttributes: (attributes: any) => {
        return {
          githubId: attributes.github_id,
          username: attributes.username,
        };
      },
    });

    // prepare tables/collections other stuff...
    prepare()
      .then(() => {
        if (cookies) {
          this.cookies = cookies;
        }

        this.strategies = strategies;

        if (this.strategies.github) {
          this.github = new GitHub(
            this.strategies.github.clientId,
            this.strategies.github.clientSecret,
            {
              redirectURI: this.strategies.github.clientSecret,
              enterpriseDomain: this.strategies.github.enterpriseDomain,
            }
          );
        }

        if (this.strategies.apple) {
          this.apple = new Apple(
            {
              clientId: this.strategies.apple.clientId,
              teamId: this.strategies.apple.teamId,
              keyId: this.strategies.apple.keyId,
              certificate: this.strategies.apple.certificate,
            },
            this.strategies.apple.redirectURI
              ? this.strategies.apple.redirectURI
              : ""
          );
        }
      })
      .catch((error) => {
        throw new Error(
          `Something went wrong in 'async prepare() {...}' - ${error}`
        );
      });
  }

  signIn = {
    basic: async (username: string, password: string) => {
      // do
    },
    emailPassword: async (email: string, password: string) => {
      // do
    },
    github: async () => {
      const state = generateState();
      const url = await this.github.createAuthorizationURL(state);

      // setCookie
      /* setCookie(event, "github_oauth_state", state, {
        path: "/",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 60 * 10,
        sameSite: "lax",
      }); */
      return url;
    },
  };

  async signOut() {
    const { user, session } = await this.validateSession();

    if (session) {
      this.authClient.invalidateSession(session.id);
    }

    // handleSignOut method
  }

  async validateSession(payload?: any) {
    const cookie = this.cookies(payload);
    const sessionId = cookie.get(this.authClient.sessionCookieName) ?? null;

    if (!sessionId) {
      return {
        user: null,
        session: null,
        redirectURI: "",
      };
    }

    const result = await this.authClient.validateSession(sessionId);

    try {
      if (result.session && result.session.fresh) {
        const sessionCookie = this.authClient.createSessionCookie(
          result.session.id
        );

        cookie.set(
          sessionCookie.name,
          sessionCookie.value,
          sessionCookie.attributes
        );
      }

      if (!result.session) {
        //not sure about this line
        this.authClient.invalidateSession(sessionId);

        const sessionCookie = this.authClient.createBlankSessionCookie();
        cookie.remove(
          sessionCookie.name,
          sessionCookie.value,
          sessionCookie.attributes
        );
      }
    } catch (error) {
      throw new Error(error);
    }

    return { ...result, redirectURI: "" };
  }
}
