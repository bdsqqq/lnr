import { createHash, randomBytes } from "node:crypto";

type Client = { client_id: string; client_secret?: string };
export type OAuthRequest =
  | (Client & { operation: "exchange"; code: string; redirect_uri: string; code_verifier?: string })
  | (Client & { operation: "refresh"; refresh_token: string; pkce?: boolean })
  | { operation: "client-credentials"; client_id: string; client_secret: string; scope: string }
  | { operation: "revoke"; token: string; token_type_hint?: "access_token" | "refresh_token" };
export type OAuthInput = OAuthRequest & { execute?: boolean };
export interface OAuthTokens {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string | string[];
  refresh_token?: string;
}
export type OAuthResult =
  | { kind: "preview" | "invalid"; attempted: false }
  | { kind: "failed"; attempted: true; reason: "transport" | "http" | "response" }
  | { kind: "revoked"; attempted: true }
  | { kind: "tokens"; attempted: true; tokens: OAuthTokens };
export type OAuthFetch = (
  url: string, init: RequestInit,
) => Promise<Pick<Response, "status" | "redirected" | "json">>;

const TOKEN = "https://api.linear.app/oauth/token";
const REVOKE = "https://api.linear.app/oauth/revoke";
const verifierPattern = /^[A-Za-z0-9._~-]{43,128}$/;
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && !/[\x00-\x1f\x7f]/.test(value);
const scopes = (value: unknown): value is string =>
  text(value) && /^[A-Za-z0-9:_-]+(?:,[A-Za-z0-9:_-]+)*$/.test(value);
function requireValue(valid: boolean): asserts valid {
  if (!valid) throw new Error("invalid oauth input; check required fields and combinations");
}
function keys(value: object, allowed: string): void {
  requireValue(Object.keys(value).every(key => allowed.split(" ").includes(key)));
}
function redirect(value: unknown): void {
  requireValue(text(value));
  try {
    const url = new URL(value);
    requireValue(!url.hash && !url.username && !url.password);
  } catch { requireValue(false); }
}

export function pkceChallenge(verifier: string, method: "S256" | "plain" = "S256"): string {
  requireValue(text(verifier) && verifierPattern.test(verifier));
  requireValue(method === "S256" || method === "plain");
  return method === "plain" ? verifier
    : createHash("sha256").update(verifier, "ascii").digest("base64url");
}
export function createOAuthPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: pkceChallenge(verifier) };
}
export interface OAuthAuthorizeInput {
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  actor?: "user" | "app";
  prompt?: "consent";
  code_challenge?: string;
  code_challenge_method?: "S256" | "plain";
}

/** Caller must retain state/verifier and validate returned state before exchange.
 * State is required locally even though Linear's endpoint only recommends it.
 */
export function createOAuthAuthorizationUrl(input: OAuthAuthorizeInput): string {
  const value = { ...input };
  keys(value, "client_id redirect_uri scope state actor prompt code_challenge code_challenge_method");
  requireValue(text(value.client_id) && text(value.state) && scopes(value.scope));
  redirect(value.redirect_uri);
  requireValue(value.actor === undefined || value.actor === "user" || value.actor === "app");
  requireValue(value.prompt === undefined || value.prompt === "consent");
  requireValue(value.code_challenge_method === undefined || value.code_challenge !== undefined);
  const query = new URLSearchParams({
    client_id: value.client_id, redirect_uri: value.redirect_uri,
    response_type: "code", scope: value.scope, state: value.state,
  });
  if (value.actor !== undefined) query.set("actor", value.actor);
  if (value.prompt !== undefined) query.set("prompt", value.prompt);
  if (value.code_challenge !== undefined) {
    const method = value.code_challenge_method ?? "S256";
    requireValue(method === "S256" || method === "plain");
    requireValue(text(value.code_challenge) && (method === "plain"
      ? verifierPattern.test(value.code_challenge) : /^[A-Za-z0-9_-]{43}$/.test(value.code_challenge)));
    query.set("code_challenge", value.code_challenge);
    query.set("code_challenge_method", method);
  }
  return `https://linear.app/oauth/authorize?${query}`;
}

function prepare(value: OAuthInput): {
  url: string; body: string; revoke: boolean; refreshRequired: boolean;
} {
  requireValue(value.execute === undefined || typeof value.execute === "boolean");
  const form = new URLSearchParams();
  const common = "operation execute ";
  if (value.operation === "revoke") {
    keys(value, common + "token token_type_hint");
    requireValue(text(value.token));
    requireValue(value.token_type_hint === undefined ||
      value.token_type_hint === "access_token" || value.token_type_hint === "refresh_token");
    form.set("token", value.token);
    if (value.token_type_hint !== undefined) form.set("token_type_hint", value.token_type_hint);
    return { url: REVOKE, body: form.toString(), revoke: true, refreshRequired: false };
  }
  requireValue(text(value.client_id));
  requireValue(value.client_secret === undefined || text(value.client_secret));
  if (value.operation === "exchange") {
    keys(value, common + "client_id client_secret code redirect_uri code_verifier");
    requireValue(text(value.code));
    redirect(value.redirect_uri);
    if (value.code_verifier !== undefined) pkceChallenge(value.code_verifier);
    else requireValue(text(value.client_secret));
    form.set("grant_type", "authorization_code");
    form.set("code", value.code);
    form.set("redirect_uri", value.redirect_uri);
    if (value.code_verifier !== undefined) form.set("code_verifier", value.code_verifier);
  } else if (value.operation === "refresh") {
    keys(value, common + "client_id client_secret refresh_token pkce");
    requireValue(text(value.refresh_token));
    requireValue(value.pkce === undefined || typeof value.pkce === "boolean");
    requireValue(value.pkce === true || text(value.client_secret));
    form.set("grant_type", "refresh_token");
    form.set("refresh_token", value.refresh_token);
  } else {
    requireValue(value.operation === "client-credentials");
    keys(value, common + "client_id client_secret scope");
    requireValue(text(value.client_secret) && scopes(value.scope));
    form.set("grant_type", "client_credentials");
    form.set("scope", value.scope);
  }
  form.set("client_id", value.client_id);
  if (value.client_secret !== undefined) form.set("client_secret", value.client_secret);
  return { url: TOKEN, body: form.toString(), revoke: false,
    refreshRequired: value.operation !== "client-credentials" };
}

function tokens(value: unknown, refreshRequired: boolean): OAuthTokens {
  requireValue(value !== null && typeof value === "object" && !Array.isArray(value));
  const data = value as Record<string, unknown>;
  requireValue(!Object.hasOwn(data, "error") && text(data.access_token));
  requireValue(typeof data.token_type === "string" && /^bearer$/i.test(data.token_type));
  requireValue(typeof data.expires_in === "number" &&
    Number.isSafeInteger(data.expires_in) && data.expires_in >= 0);
  requireValue(typeof data.scope === "string" ||
    (Array.isArray(data.scope) && data.scope.every(scope => typeof scope === "string")));
  requireValue(data.refresh_token === undefined ? !refreshRequired : text(data.refresh_token));
  return {
    access_token: data.access_token, token_type: "Bearer", expires_in: data.expires_in,
    scope: Array.isArray(data.scope) ? [...data.scope] : data.scope as string,
    ...(data.refresh_token === undefined ? {} : { refresh_token: data.refresh_token as string }),
  };
}

/** Attempted means fetch was invoked, not that the server accepted the operation.
 * Protocol source: https://linear.app/developers/oauth-2-0-authentication
 * No automatic refresh/retry: grants can rotate tokens or revoke other app tokens.
 */
export async function executeOAuth(
  input: OAuthInput, transfer: OAuthFetch = (url, init) => fetch(url, init),
): Promise<OAuthResult> {
  let request: ReturnType<typeof prepare>;
  let execute: boolean;
  try {
    const snapshot = { ...input };
    request = prepare(snapshot);
    execute = snapshot.execute === true;
  } catch { return { kind: "invalid", attempted: false }; }
  if (!execute) return { kind: "preview", attempted: false };
  let response: Awaited<ReturnType<OAuthFetch>>;
  try {
    response = await transfer(request.url, {
      method: "POST", body: request.body, redirect: "error", credentials: "omit",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  } catch { return { kind: "failed", attempted: true, reason: "transport" }; }
  try {
    if (response.redirected || response.status !== 200) {
      return { kind: "failed", attempted: true, reason: "http" };
    }
    if (request.revoke) return { kind: "revoked", attempted: true };
    return { kind: "tokens", attempted: true,
      tokens: tokens(await response.json(), request.refreshRequired) };
  } catch { return { kind: "failed", attempted: true, reason: "response" }; }
}
