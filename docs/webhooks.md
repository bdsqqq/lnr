# webhooks

```sh
# signing secret comes from LINEAR_WEBHOOK_SECRET, never an argv value
lnr webhook verify ./original-body.json --signature "$signature"
lnr webhook serve                             # preview; no secret or listener needed
lnr webhook serve --execute                   # 127.0.0.1:8787
```

`--secret-env` selects another environment variable. `--host`, `--port` configure
the listener; port zero chooses a free port. no tunnel or remote webhook is created.
register an authorized public endpoint separately, with appropriate TLS/proxy rules.

SDK 95.1 verifies the HMAC over original bytes and requires a finite signed
`webhookTimestamp` within ±60 seconds of the local clock. the legacy timestamp
header is not trusted. altered whitespace, malformed UTF-8/envelopes, forged
signatures, and stale/future timestamps fail. the default body limit is 1 mib;
`--max-body-bytes` changes it. this is not a total concurrent-memory limit.

verification prints `{ok,payload}`. the receiver prints one authenticated payload
per stdout line; startup metadata goes to stderr. unknown fields survive ordinary
JSON parsing, not arbitrary-precision numbers or original JSON formatting.
protect stdout: payloads can contain private workspace content.

a 200 acknowledgement follows completion of the stdout write, not durable storage
or downstream processing. failures do not echo bodies, signatures or signing
secrets. SIGINT/SIGTERM close connections and allow at most one second for handlers
to finish; in-flight stdout records may be truncated and deliveries interrupted.
there is no durable queue, replay suppression, forwarding, or local redelivery.
operators must handle duplicate deliveries and recovery.

core exposes `createWebhookReceiver({secret,onPayload,maxBodyBytes?})` with local
`parse(Buffer, signature)` and Fetch-compatible `handler(Request)`. SDK verification
and callback acknowledgement remain authoritative; wrappers bound input and reject
ambiguous envelopes. see [ADR-0010](adr/0010-non-graphql-capabilities.md) and
[Linear's webhook documentation](https://linear.app/developers/webhooks).

local tests use the real SDK and a loopback receiver. actual Linear delivery,
registration permissions, proxy behavior, and recovery remain unverified.
