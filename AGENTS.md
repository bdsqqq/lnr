# lnr

## commands

```bash
bun run check    # typecheck all packages
bun run test     # offline unit tests; excludes live e2e
bun run dev      # run cli in dev mode
bun run build    # build binary
bun run generate # codegen + command reference (docs/command-reference.md)
```

## structure

```
packages/
  core/       # @bdsqqq/lnr-core - business logic, Linear SDK calls
  cli/        # @bdsqqq/lnr-cli - presentation, commands
  codegen/    # schema extraction and command generation
docs/
  adr/        # architectural decision records
.todo.md      # task tracking
```

## workflow

### before starting work
1. read `.todo.md` for current tasks and priorities
2. check `docs/adr/` for relevant architectural decisions
3. run `bun run check` to verify clean state

### task tracking
tasks tracked in `.todo.md` per [ADR-0006](docs/adr/0006-todo-task-tracking.md):
- `[ ]` not started, `[-]` in progress, `[x]` complete
- unique numerical IDs (0001, 0002, etc.)
- `--blocks <id>` for dependencies
- update checkbox state as you work

### architectural decisions
ADRs in `docs/adr/` — read before making structural changes. create new ADR when:
- adding new entity support
- changing command patterns
- modifying codegen behavior

### code generation
generated files in `packages/cli/src/generated/` — do not edit directly.
modify `packages/codegen/generate-commands.ts` then run:
```bash
bun run packages/codegen/generate-commands.ts
```

entity support configured in `packages/codegen/entity-config.ts`.

### updating linear

follow [the api update runbook](docs/updating-linear-api.md), including its
schema → dispatch → payload checks and sdk 95.1.0 blind spots. parity tasks are
0087–0098 in `.todo.md`. an sdk bump, generated flags, and green ci do not establish
full api coverage. `bun run api:check` checks the pinned sdk-release schema and
inventory, not live behavior or complete coverage evidence. live captures retain
their own provenance; unresolved capability classifications remain gaps.

### before shipping
- run `bun run check` (typecheck)
- run `bun run test` (tests)
- update `.todo.md` with progress
- load `git` skill before commit

### e2e tests

cli unit suites run with `--isolate` because their module mocks replace shared
core/output exports. keep live e2e excluded from the default test script:
their module-level credential checks can exit before unit suites execute.

two test files in `packages/cli/src/`:
- `e2e-readonly.test.ts` — safe with any API key, read-only operations
- `e2e-mutations.test.ts` — DANGER: creates/deletes data, sandbox org only

explicit live tests require `LINEAR_API_KEY`; mutation tests also require
`LNR_E2E_CONFIRM_ORG=<org-name>`. missing credentials fail without prompting.

mutation teardown deletes only ids registered by the current run. unknown creation
or deletion outcomes are reported for separately authorized recovery, never scavenged
by name. ci serializes the shared sandbox; coordinate local runs separately.

ci gives live e2e tests a 60s default per-test budget (`bun test --timeout 60000`)
inside a 10-minute job cap. external api latency has exceeded the 5s unit
default and 15s multi-command budget. do not automatically retry mutations:
an interrupted client does not prove that the server rejected the write.

### benchmarking

`packages/cli/src/bench-lnr-overhead.ts` measures per-call cost of the `lnr()`
subprocess helper used in e2e tests. run before optimizing e2e speed — it
decomposes time into subprocess startup, module loading, and API latency.

```bash
bun run packages/cli/src/bench-lnr-overhead.ts
```

baseline finding (2026-02-07): ~300ms module loading + ~300ms API per call.
compiling the binary saves only ~38ms/call. the bottleneck is sequential API
round-trips, not subprocess overhead. parallelizing independent test groups
is the only approach that meaningfully reduces total time.

### config isolation

`LNR_CONFIG_PATH` env var overrides all config resolution (nearest-wins, global,
legacy). both `loadConfig()` and `saveConfig()` honor it. used in tests to
prevent reading the project's `.lnr.json`.

## conventions

- @linear/sdk for all API calls
- error messages: lowercase, direct, include fix suggestion
- no emojis, minimal colors
- business logic in core, presentation in cli
- tests colocated (*.test.ts)

## approach

- make no unsupported claims; label hunches explicitly
- avoid sycophancy; express tradeoffs, not blind agreement
- instrument before iterating; measure, don't guess
- delegate to sub-agents to preserve context
- limit scope; ask before large refactors

## epistemics

- **validation at authorship**: catch errors where they originate. verify before shipping, not at runtime.
- **concision enables composition**: context length degrades performance. say what's needed, nothing more.
- **quality over length**: a clear 500-token explanation beats a vague 1500-token one.
- **structure for skimming**: critical info at beginning and end, not buried in middle.

## findings format

when reporting findings (bugs, issues, discoveries):

```
**confidence:** VERIFIED | HUNCH | QUESTION
**location:** file:line or range
**evidence:** what the code actually shows
```

VERIFIED = traced to code/data. HUNCH = pattern recognition, not traced. QUESTION = needs input.
