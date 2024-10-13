export {
  Scrypt,
  LegacyScrypt,
  generateId,
  generateIdFromEntropySize,
} from "./crypto";
export { TimeSpan } from "./date";
export { Cookie, CookieAttributes } from "./cookie";
export { verifyRequestOrigin } from "./request";

// FutureAuth
export { Kapiya } from "./Kapiya";

export type {
  User,
  Session,
  SessionCookieOptions,
  SessionCookieAttributesOptions,
} from "./core.js";
export type {
  DatabaseSession,
  DatabaseUser,
  DatabaseUserGitHub,
  Adapter,
} from "./database";

export { AppheadAdapter } from "./database";

export type { PasswordHashingAlgorithm } from "./crypto";

import type { KapiyaClient } from "./core";

export interface Register {}

export type UserId = Register extends {
  UserId: infer _UserId;
}
  ? _UserId
  : string;

export type RegisteredKapiya = Register extends {
  Kapiya: infer _Kapiya;
}
  ? _Kapiya extends KapiyaClient<any, any>
    ? _Kapiya
    : KapiyaClient
  : KapiyaClient;

export type RegisteredDatabaseUserAttributes = Register extends {
  DatabaseUserAttributes: infer _DatabaseUserAttributes;
}
  ? _DatabaseUserAttributes
  : {};

export type RegisteredDatabaseSessionAttributes = Register extends {
  DatabaseSessionAttributes: infer _DatabaseSessionAttributes;
}
  ? _DatabaseSessionAttributes
  : {};
