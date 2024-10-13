import { Session, User } from "lucia";
import { getCookie, setCookie } from "h3";

export async function validateRequest(
  event,
  lucia: {
    sessionCookieName: string;
    validateSession: (arg0: string) => any;
    createSessionCookie: (arg0: any) => any;
    createBlankSessionCookie: () => any;
  }
): Promise<{ user: User; session: Session } | { user: null; session: null }> {
  const sessionId = getCookie(event, lucia.sessionCookieName) ?? null;
  if (!sessionId) {
    return {
      user: null,
      session: null,
    };
  }

  const result = await lucia.validateSession(sessionId);
  // next.js throws when you attempt to set cookie when rendering page
  try {
    if (result.session && result.session.fresh) {
      const sessionCookie = lucia.createSessionCookie(result.session.id);
      setCookie(
        event,
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes
      );
    }
    if (!result.session) {
      const sessionCookie = lucia.createBlankSessionCookie();
      setCookie(
        event,
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes
      );
    }
  } catch {}
  return result;
}
