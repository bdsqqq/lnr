# oauth protocol helpers

these are low-level bindings, not an automatic login flow. no browser, callback
listener, credential persistence, token rotation, or background refresh is started.

```sh
lnr oauth pkce --show-secrets
lnr oauth authorize authorization.json
lnr oauth request request.json                         # offline validation
lnr oauth request request.json --execute --show-secrets # token-producing operation
lnr oauth request revoke.json --execute
```

file arguments also accept `-` for stdin. keep secret-bearing files private.
execution must come from `--execute`, never a JSON field. token-producing requests
require `--show-secrets` before any network call, so a one-use code is not redeemed
without an explicit token destination. **stdout then contains credentials**.
protect it from logs. a broken pipe does not trigger a retry or config fallback.

## authorization and pkce

```json
{
  "client_id": "application-id",
  "redirect_uri": "http://localhost/callback",
  "scope": "read,write",
  "state": "independently-generated-random-state",
  "actor": "app"
}
```

`prompt: "consent"` is optional. PKCE uses `code_challenge` and optionally
`code_challenge_method` (default `S256`; explicit `plain` supported). keep the
verifier private; do not reuse it as state. plain PKCE puts the verifier in the URL,
so `authorize` also requires `--show-secrets` for that method. local URL generation requires state
even though Linear only recommends it. **retain it and reject callback mismatches
before exchanging the code**; these helpers do not handle or validate callbacks.

## request objects

| `operation` | fields |
| --- | --- |
| `exchange` | `client_id`, `code`, identical `redirect_uri`; `client_secret` unless `code_verifier` supplied |
| `refresh` | `client_id`, `refresh_token`; `client_secret` unless explicit `pkce: true` for a PKCE-origin grant |
| `client-credentials` | `client_id`, `client_secret`, comma-separated `scope` |
| `revoke` | `token`; optional `token_type_hint: "access_token"` or `"refresh_token"` |

credentials use form parameters, not ambient Linear CLI credentials. legacy
revocation aliases are rejected; use the documented canonical `token` field.
client-credentials issuance can revoke existing app-actor tokens when scopes
change. never test it against a production application without explicit permission.

results distinguish `preview`, `invalid`, `failed`, `tokens`, and `revoked`.
`attempted` means fetch was invoked, not that a grant persisted. token results
include validated documented fields; failure bodies and raw exceptions are not
echoed. redirects, retries, and implicit revocation are disabled. verify an
uncertain outcome before deciding whether to repeat the operation.

core exports `createOAuthAuthorizationUrl`, `createOAuthPkce`, `pkceChallenge`,
and `executeOAuth`. to consume returned tokens in the SDK, use its explicit
`accessToken` option; this workflow does not overwrite existing CLI authentication.

## evidence and remaining work

contracts follow [Linear's OAuth documentation](https://linear.app/developers/oauth-2-0-authentication),
reviewed 2026-09-23. offline tests cover encoded requests, PKCE, response checks,
secret-output consent, and failure boundaries. no real grants were issued,
refreshed or revoked. live proof requires an authorized OAuth application,
matching redirect registration/consent, and disposable credentials.
