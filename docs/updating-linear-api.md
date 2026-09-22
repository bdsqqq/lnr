# updating the linear api

an sdk upgrade is not api parity. use this workflow for each refresh; track the
remaining parity work in [.todo.md, 0087–0098](../.todo.md).

## what counts as parity

every supported public server operation, argument, input field, and readable
output/relationship must be reachable through lnr and backed by tests. scoped
commands and composition count; a standalone command for every type is not required.
sdk helpers that do not represent server capabilities are outside this definition.

record sdk version, schema source/date, and auth/plan requirements with the inventory.
classify each capability as implemented, missing, intentionally excluded, blocked,
or upstream-unavailable, with source and test evidence. public exclusions and blocked
verification remain gaps, not credits toward completion. internal-only fields and
removed/unsupported operations are reported separately. deprecation alone does not
prove an operation has stopped working.

## refresh workflow

1. **establish the baseline.** read `AGENTS.md`, `.todo.md`, and relevant ADRs;
   inspect the worktree and run `bun run check` and `bun run test`. record the
   installed sdk and registry version. match ci's bun version when investigating
   differences in test discovery or mocking.
2. **compare contracts before editing.** compare the old/new sdk and upstream
   graphql schema, including root operations, arguments, input/output types,
   enums, nullability, and deprecations. review public non-graphql api methods too.
   the current introspector fetches selected entity/input types and enums, not the
   root operation definitions; until 0088 lands, this comparison is a manual gate.
3. **refresh dependencies and metadata.** update only `@linear/sdk` in
   `packages/core/package.json`, then:

   ```bash
   bun install
   # authenticated, read-only introspection; do not print credentials
   bun run packages/codegen/introspect-linear.ts
   bun run packages/codegen/extract-schema.ts
   ```

   inspect fetch failures, missing/null type results, and schema changes before
   accepting the snapshot. “0 failed” does not prove complete coverage. reconcile
   sdk/schema differences instead of assuming their publication times match.
4. **map every change to executable behavior.** trace schema → cli input → operation
   inference → resolver → core/sdk payload, and sdk response → output. inspect
   both generated and hand-written commands. fix `generate-commands.ts` /
   `entity-definitions.ts`, never generated files. only issue/project/label/doc
   are currently emitted by the consolidated generator. follow
   [ADR-0008](adr/0008-api-refresh-payload-coverage.md) for payload coverage; write
   an ADR before changing entity exposure or generator architecture.
5. **regenerate and test the contract.**

   ```bash
   bun run generate
   bun run check
   bun run test
   bun run build
   ```

   rerun generation and verify command/reference bytes are unchanged. test argv,
   dispatch, payloads, and output—not just schema acceptance. include explicit
   false, zero, null, empty arrays, unknown enums, and create-only/update-only
   arguments. verify rejected mutations and failed follow-up reads separately.
   smoke-test the compiled binary; compilation alone is not execution evidence.
6. **verify against linear without broadening authorization.** run read-only e2e
   separately. run mutations only with explicit approval and the confirmed sandbox
   identity. both suites require an explicit key; mutations also require an exact
   `LNR_E2E_CONFIRM_ORG`. teardown deletes only ids registered by this run, never
   prior fixtures matched by a name prefix. uncertain write outcomes require manual,
   separately authorized recovery. ci serializes its sandbox jobs; local runs still
   need coordination. persisted-effect coverage remains tracked in 0097.

   ```bash
   bun test --timeout 60000 packages/cli/src/e2e-readonly.test.ts
   # only with a sandbox key and LNR_E2E_CONFIRM_ORG set to that sandbox:
   bun test --timeout 60000 packages/cli/src/e2e-mutations.test.ts
   ```

   empty results are not equivalent to failed reads. inspect swallowed-error paths
   and verify effects by id. allow bounded waits for asynchronous fixtures, not
   unconditional retries of writes. ci retains a 10-minute job cap; explicit
   test timeouts override its 60s default.
7. **report and ship the actual scope.** update the changeset for public type/error
   changes, command docs, coverage gaps, and task status. review the diff. with
   commit/push authorization, wait for checks on the exact pr head, inspect failures,
   and reconcile the pr description. green tests demonstrate tested behavior,
   not coverage of untested api capabilities.

## blind spots from the sdk 95.1.0 refresh

verified in [pr #24](https://github.com/bdsqqq/lnr/pull/24);
[passing head run](https://github.com/bdsqqq/lnr/actions/runs/35779169636).

| blind spot | correction / remaining obligation |
|---|---|
| new schema flags were accepted but ignored | wired issue release/sharing and label group fields through dispatch and payloads; test every new flag the same way |
| router tests accepted `[]`, but argv could not express it | added and tested `--release-ids '[]'`; test actual cli parsing as well as router calls |
| sdk nullability changed | normalized nullable session/comment/preference fields and fixed session display; audit all affected consumers |
| sdk method/input presence was mistaken for availability | `cycleCreate` still exists but is unsupported; fixtures now use automatic cycles, and direct creation must reject |
| creation helpers swallowed mutation and relation-read errors | preserve those errors; a successful write followed by a failed read is not a safe reason to retry |
| a new team was assumed empty | remove only the disposable team's conflicting default automation, then verify creation/deletion by id |
| sdk mocks removed exports or leaked between suites | preserve real sdk exports and isolate cli suites; exercise previously failing file orders |
| e2e credential checks exited the unit process early | exclude live e2e from default discovery; 0097 still tracks honest failure behavior for explicit e2e runs |
| fixed unit budgets were used for live api latency | separate bounded live-test budgets; do not turn timeouts into passing results or mutation retries |

still open: complete root/type introspection, a source-derived coverage inventory,
missing fields such as agent-session summary and document owner, deferred entities,
and automated drift gates. `entity-config.ts` categories and exclusion reasons are
historical design choices, not proof of current upstream capabilities or cli coverage.
