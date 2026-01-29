# schema-driven CLI generation

## why

every Linear API feature required manual CLI plumbing: zod schema, trpc router, handler logic. Linear already codegens their SDK from GraphQL — we do the same for the CLI layer.

the goal: when Linear adds a field to `IssueUpdateInput`, re-run codegen and the flag appears. no manual wiring.

## what's generated vs hand-crafted

### generated (packages/cli/src/generated/)

- zod input schemas with types + descriptions from GraphQL
- operation inference logic
- trpc router registration
- handler dispatch skeleton

regenerate when Linear's schema changes. files have `DO NOT EDIT` headers.

### hand-crafted (survives regeneration)

- **output formatting** — tables, colors, threaded comments
- **UX resolvers** — `@me` → user ID, `done` → state ID, `ENG-123` → UUID
- **error messages** — actionable, with fix suggestions
- **CLI-only features** — `--branch`, `--pr` (not in Linear schema)
- **core SDK logic** — all API calls live in `packages/core`

## operation inference

commands infer intent from flags. no subcommands required.

```bash
lnr ENG-123                     # no flags → READ
lnr ENG-123 --state done        # mutation flag → UPDATE
lnr ENG-123 --archive           # destructive flag → ARCHIVE
lnr issue new --team ENG ...    # positional 'new' → CREATE
```

each entity (issue, project, doc, label) follows the same pattern:
- `idOrNew === "new"` → CREATE
- `--archive` or `--delete` → ARCHIVE/DELETE
- any mutation flag present → UPDATE
- otherwise → READ

## CLI-only flags

flags that don't exist in Linear's schema. declared in `cli-spec.json`:

```json
{
  "name": "branch",
  "cliOnly": true,
  "handler": "handleBranch",
  "dispatchIn": "show"
}
```

generator reads these, emits import + dispatch. handlers live in `packages/cli/src/hand-crafted/` — never overwritten by codegen.

## resolvers

translate human-friendly inputs to Linear API IDs.

| input | resolver | output |
|-------|----------|--------|
| `@me` | `resolveAssignee` | current user UUID |
| `done` | `resolveStateName` | state UUID for team |
| `ENG-123` | `resolveIssueIdentifier` | issue UUID |
| `MyProject` | `resolveProjectByName` | project UUID |
| `ENG` | `resolveTeamByKey` | team UUID |
| `Sprint 1` | `resolveCycleByName` | cycle UUID |

resolvers live in `packages/core/src/resolvers.ts` and throw typed errors with actionable messages: `StateNotFoundError` lists available states.

### field resolver registry

`packages/codegen/field-resolvers.ts` maps Linear API fields to CLI handling:

- **resolved** — needs ID lookup via resolver (projectId, assigneeId, teamId, etc.)
- **passthrough** — direct value (title, description, priority, etc.)
- **excluded** — internal, not CLI-exposed (templateId, slaBreachesAt, etc.)

generators import resolvers from `@bdsqqq/lnr-core` and call them in handlers. see [ADR-0003](adr/0003-field-resolver-registry.md) for the rationale.

## regeneration

```bash
# regenerate all commands
bun run packages/codegen/generate-issue-commands.ts
bun run packages/codegen/generate-project-commands.ts
bun run packages/codegen/generate-doc-commands.ts
bun run packages/codegen/generate-label-commands.ts

# refresh schema from Linear API (requires LINEAR_API_KEY)
bun run packages/codegen/introspect-linear.ts
```

`schema.json` is committed so codegen works without auth. `extracted-schema.json` is gitignored (intermediate).

## tradeoffs

- requires API key for introspection (mitigated by committing schema.json)
- generated code is large but readable
- schema drift if introspection not re-run after Linear API changes
- CLI-only features must be re-added to cli-spec.json if lost
