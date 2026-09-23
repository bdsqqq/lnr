# graphql access

`lnr api` validates a document offline by default. **every network call requires
`--execute`, including queries**: some query-shaped operations have effects.

```sh
printf 'query { viewer { id } }\n' | lnr api -
lnr api request.graphql --variables variables.json --validate-only
lnr api request.graphql --variables variables.json --execute
```

use one query or mutation, with optional fragments. variables must be a json object.
`--execute` and `--validate-only` cannot be combined. documents are limited to
1 mib; custom scalar semantics and permissions remain server-validated.

## results

stdout is a json envelope:

```json
{"ok":true,"executed":false,"operation":"query"}
```

executed responses include caller-selected `data`. `ok` means validation or
graphql transport success—not that a mutation's business-level `success` field
is true. select and inspect that field where the operation exposes it.
`executed` records a transport attempt, not proof of a server-side effect.

graphql/network failures exit nonzero, including responses with partial data.
partial data is retained. raw upstream messages, extensions, query bodies, and
variables are not echoed in errors; safe response paths are retained.

documents and supplied variables pass unchanged to the sdk's public
`client.rawRequest`. there is no automatic pagination, id resolution, or retry.
after an interrupted write, verify its effects before deciding whether to repeat it.

## source and limits

validation uses [`api-schema.graphql`](../packages/core/src/api-schema.graphql),
generated from the complete captured schema, with
[`provenance`](../packages/core/src/api-schema.provenance.json).
the sdk-release schema is retained separately for comparison; it can lag live
fields and visibility annotations even when the sdk version is current.

- explicitly `[Internal]` members and `_dummy` are rejected.
- `cycleCreate` is rejected because its exact deprecation declares it unavailable.
- other deprecations are not automatically treated as unavailable.
- subscriptions have no transport implementation.
- three candidate mutations return an internal-marked response type and remain
  blocked: organization onboarding create/join and `leaveOrganization`.

[`api-surface.test.ts`](../packages/core/src/api-surface.test.ts) proves offline,
lossless fake-transport access for 152 query and 328 mutation roots. it separately
checks the unavailable, blocked, and subscription cases. these are NOT 480 live
verification results, nor complete optional-field, auth, upload, or lifecycle coverage.
full parity remains tracked in [.todo.md](../.todo.md).
