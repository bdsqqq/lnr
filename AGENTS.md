# lnr

## commands

```bash
bun run check    # typecheck all packages
bun run test     # run tests
bun run dev      # run cli in dev mode
bun run build    # build binary
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

### before shipping
- run `bun run check` (typecheck)
- run `bun run test` (tests)
- update `.todo.md` with progress
- load `git` skill before commit

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
