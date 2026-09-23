import { expect, test } from "bun:test";
import { createOAuthAuthorizationUrl, createOAuthPkce, executeOAuth, pkceChallenge,
  type OAuthFetch, type OAuthInput } from "./oauth";

const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const grant = { access_token: "secret", token_type: "Bearer" as const, expires_in: 0,
  scope: "", refresh_token: "refresh" };
const exchange: OAuthInput = { operation: "exchange", client_id: "id",
  code: "code&=", redirect_uri: "http://localhost/callback", code_verifier: verifier };
const refresh: OAuthInput = { operation: "refresh", client_id: "id",
  refresh_token: "refresh", pkce: true };
const client: OAuthInput = { operation: "client-credentials", client_id: "id",
  client_secret: "client-secret", scope: "read,write" };
const revoke: OAuthInput = { operation: "revoke", token: "token&=",
  token_type_hint: "refresh_token" };
const reply = (value: unknown = grant, status = 200): OAuthFetch =>
  async () => ({ status, redirected: false, json: async () => value });

test("PKCE vector and authorization encoding; S256 URL contains only the challenge", () => {
  expect(pkceChallenge(verifier)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  expect(pkceChallenge(verifier, "plain")).toBe(verifier);
  const generated = createOAuthPkce();
  expect(generated.challenge).toBe(pkceChallenge(generated.verifier));
  const url = new URL(createOAuthAuthorizationUrl({ client_id: "id&=", state: "state&=",
    redirect_uri: "http://localhost/callback", scope: "read,write",
    actor: "app", prompt: "consent", code_challenge: pkceChallenge(verifier) }));
  expect(url.origin + url.pathname).toBe("https://linear.app/oauth/authorize");
  expect(url.searchParams.get("client_id")).toBe("id&=");
  expect(url.searchParams.get("code_challenge")).toBe(pkceChallenge(verifier));
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.href).not.toContain(verifier);
});
test("authorization option omissions and invalid combinations", () => {
  const base = { client_id: "id", state: "state", redirect_uri: "http://localhost/callback", scope: "read" };
  const minimal = new URL(createOAuthAuthorizationUrl(base));
  for (const key of ["actor", "prompt", "code_challenge", "code_challenge_method"]) {
    expect(minimal.searchParams.has(key)).toBe(false);
  }
  expect(new URL(createOAuthAuthorizationUrl({ ...base, code_challenge: verifier,
    code_challenge_method: "plain" })).searchParams.get("code_challenge")).toBe(verifier);
  for (const patch of [{ state: "" }, { scope: "read write" }, { actor: "unknown" },
    { code_challenge_method: "S256" }, { code_challenge: "invalid" }, { client_secret: "secret" }]) {
    expect(() => createOAuthAuthorizationUrl({ ...base, ...patch } as Parameters<typeof createOAuthAuthorizationUrl>[0])).toThrow();
  }
});
test("all network operations default offline; invalid combinations never fetch", async () => {
  let calls = 0;
  const fetch: OAuthFetch = async () => { calls++; throw new Error("secret"); };
  for (const input of [exchange, refresh, client, revoke]) {
    expect(await executeOAuth(input, fetch)).toEqual({ kind: "preview", attempted: false });
  }
  for (const input of [
    { ...exchange, code_verifier: undefined }, { ...refresh, pkce: false },
    { ...client, scope: "" }, { ...revoke, access_token: "legacy" },
    { ...exchange, execute: "true" },
  ]) {
    expect(await executeOAuth(input as OAuthInput, fetch)).toEqual({ kind: "invalid", attempted: false });
  }
  expect(calls).toBe(0);
});
test("exact endpoints, forms, single attempts, no redirects or ambient credentials", async () => {
  const cases: [OAuthInput, Record<string, string>][] = [
    [exchange, { grant_type: "authorization_code", client_id: "id",
      code: "code&=", redirect_uri: "http://localhost/callback", code_verifier: verifier }],
    [refresh, { grant_type: "refresh_token", client_id: "id", refresh_token: "refresh" }],
    [client, { grant_type: "client_credentials", client_id: "id",
      client_secret: "client-secret", scope: "read,write" }],
    [revoke, { token: "token&=", token_type_hint: "refresh_token" }],
  ];
  for (const [input, expected] of cases) {
    let calls = 0;
    const result = await executeOAuth({ ...input, execute: true }, async (url, init) => {
      calls++;
      expect(url).toBe(`https://api.linear.app/oauth/${input.operation === "revoke" ? "revoke" : "token"}`);
      expect(init).toMatchObject({ method: "POST", redirect: "error", credentials: "omit" });
      expect(init.headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" });
      expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual(expected);
      return reply()("", {});
    });
    expect(result.kind).toBe(input.operation === "revoke" ? "revoked" : "tokens");
    expect(calls).toBe(1);
  }
});
test("confidential exchange and refresh forward form authentication", async () => {
  for (const input of [
    { ...exchange, code_verifier: undefined, client_secret: "secret" },
    { ...refresh, pkce: false, client_secret: "secret" },
  ]) {
    expect((await executeOAuth({ ...input, execute: true }, async (_url, init) => {
      const form = new URLSearchParams(String(init.body));
      expect(form.get("client_secret")).toBe("secret");
      expect(form.has("pkce")).toBe(false);
      expect(form.has("code_verifier")).toBe(false);
      return reply()("", {});
    })).kind).toBe("tokens");
  }
});
test("only valid successful grants return allowlisted tokens; zero and legacy scope arrays survive", async () => {
  const input = { ...exchange, execute: true };
  expect(await executeOAuth(input, reply({ ...grant, extra: "private" })))
    .toEqual({ kind: "tokens", attempted: true, tokens: grant });
  expect((await executeOAuth(input, reply({ ...grant, scope: ["read"] }))).kind).toBe("tokens");
  for (const value of [null, {}, { ...grant, error: "secret" },
    { ...grant, expires_in: -1 }, { ...grant, refresh_token: undefined }]) {
    expect(await executeOAuth(input, reply(value))).toEqual({ kind: "failed", attempted: true, reason: "response" });
  }
  expect((await executeOAuth({ ...client, execute: true },
    reply({ ...grant, refresh_token: undefined }))).kind).toBe("tokens");
});
test("errors do not expose provider content; revocation requires exactly 200 and no JSON", async () => {
  for (const status of [204, 302, 400, 401, 500]) {
    expect(await executeOAuth({ ...revoke, execute: true }, reply("secret", status)))
      .toEqual({ kind: "failed", attempted: true, reason: "http" });
  }
  let calls = 0;
  const broken: OAuthFetch = async () => { calls++; throw new Error("secret"); };
  expect(await executeOAuth({ ...exchange, execute: true }, broken))
    .toEqual({ kind: "failed", attempted: true, reason: "transport" });
  expect(calls).toBe(1);
  const noJSON: OAuthFetch = async () => ({
    status: 200, redirected: false, json: async () => { throw new Error("secret"); },
  });
  expect((await executeOAuth({ ...revoke, execute: true }, noJSON)).kind).toBe("revoked");
  expect((await executeOAuth({ ...exchange, execute: true }, noJSON)).kind).toBe("failed");
});
test("caller mutation after invocation cannot change response classification", async () => {
  const input: OAuthInput = { ...exchange, execute: true };
  const pending = executeOAuth(input, async () => {
    Object.assign(input, { operation: "revoke", token: "changed" });
    return reply()("", {});
  });
  expect((await pending).kind).toBe("tokens");
});
