# lnr

command-line interface for Linear. ships as a single binary via bun.

## installation

### from github releases (recommended)

download the latest binary from [releases](https://github.com/bdsqqq/lnr/releases) and add to your PATH.

### via nix

```bash
# run directly
nix run github:bdsqqq/lnr

# install to profile
nix profile install github:bdsqqq/lnr

# in a flake (add to inputs)
inputs.lnr.url = "github:bdsqqq/lnr";
# then use: inputs.lnr.packages.${system}.default
```

### from source

```bash
bun install
bun run build
cp lnr /usr/local/bin/lnr
```

### agent skill

lnr includes an [Amp](https://ampcode.com) agent skill for AI-assisted issue management.

```bash
amp skill add bdsqqq/lnr
```

then load with `linear` in any Amp session.

## usage

```bash
# authenticate
lnr auth <api-key>

# list your issues
lnr issues

# show a specific issue
lnr issue ENG-123

# create an issue
lnr issue new --team ENG --title "fix auth flow"

# update state
lnr issue ENG-123 --state "done"
```

api key from: https://linear.app/settings/account/security

## commands

| entity | list | show / mutate |
|--------|------|---------------|
| issues | `lnr issues` | `lnr issue <id>` · `lnr issue new` · `lnr issue batch` |
| projects | `lnr projects` | `lnr project <name>` · `lnr project milestone` |
| cycles | `lnr cycles` | `lnr cycle <n>` |
| views | `lnr views` | `lnr view <name>` |
| labels | `lnr labels` | `lnr label <id>` |
| docs | `lnr docs` | `lnr doc <id>` |
| teams | `lnr teams` | `lnr team <key>` |
| users | `lnr users` | `lnr user <name>` |
| initiatives | `lnr initiatives` | `lnr initiative <name>` |
| roadmaps | `lnr roadmaps` | `lnr roadmap <name>` |
| templates | `lnr templates` | `lnr template <name>` |
| notifications | `lnr notifications` | `lnr notification <id>` |
| git automations | `lnr git-automations` | `lnr git-automation <event>` · `lnr git-branch` |
| agent sessions | `lnr agent-sessions` | `lnr agent-session <id>` |

plus: `lnr auth`, `lnr config`, `lnr me`, `lnr search`.

every list command supports `--json`, `--quiet`, and `--verbose`. see the full [command reference](docs/command-reference.md) for all flags and invocations.

## architecture

lnr uses **schema-driven code generation** to stay in sync with Linear's API while keeping full control over CLI UX.

```
Linear GraphQL Schema
        ↓ introspect
   schema metadata
        ↓ codegen
  generated commands
        ↓ calls
  hand-crafted UX layer
```

### what's generated (from Linear's schema)

- **zod input schemas** — flags, types, descriptions
- **operation inference** — `new` → create, mutation flags → update, etc.
- **trpc router wiring** — command registration and dispatch
- **handler dispatch** — routes to the right function

when Linear adds a field to `IssueUpdateInput`, re-run codegen and the flag appears automatically.

### what's hand-crafted (full control)

- **output formatting** — tables, threaded comments, reactions, colors
- **UX resolvers** — `@me` → user ID, `done` → state ID, `ENG-123` → UUID
- **error messages** — actionable, lowercase, with fix suggestions
- **composition rules** — which flags work together vs. conflict
- **core business logic** — all SDK interactions in `packages/core`

this means the tedious plumbing (schema → zod → router) is automated, but the *experience* of using lnr stays yours.

### UX resolvers

translate human-friendly inputs to Linear API IDs:

| input | resolver | output |
|-------|----------|--------|
| `@me` | `resolveAssignee` | current user UUID |
| `done` | `resolveStateName` | state UUID for team |
| `ENG-123` | `resolveIssueIdentifier` | issue UUID |
| `MyProject` | `resolveProjectByName` | project UUID |
| `ENG` | `resolveTeamByKey` | team UUID |
| `Sprint 1` | `resolveCycleByName` | cycle UUID |
| `v1.0` | `resolveMilestoneByName` | milestone UUID |

resolvers live in `packages/core/src/resolvers.ts` and throw typed errors with available options.

### regenerating commands

```bash
# regenerate all entity commands (issue, project, label, doc)
bun run packages/codegen/generate-commands.ts

# refresh schema from Linear API (requires LINEAR_API_KEY)
bun run packages/codegen/introspect-linear.ts
bun run packages/codegen/extract-schema.ts
```

generated files live in `packages/cli/src/generated/`.

### CLI-only flags

flags not in Linear's schema (like `--branch`, `--pr`) are handled in `packages/cli/src/hand-crafted/`.

### ADRs

architecture decisions in [`docs/adr/`](docs/adr/):
- [0001-schema-driven-cli-generation](docs/adr/0001-schema-driven-cli-generation.md)
- [0002-introspection-over-sdk-types](docs/adr/0002-introspection-over-sdk-types.md)
- [0003-field-resolver-registry](docs/adr/0003-field-resolver-registry.md)
- [0004-milestones-scoped-to-projects](docs/adr/0004-milestones-scoped-to-projects.md)
- [0005-entity-expansion-roadmap](docs/adr/0005-entity-expansion-roadmap.md)
- [0006-todo-task-tracking](docs/adr/0006-todo-task-tracking.md)
- [0007-entity-config-v2-exploration](docs/adr/0007-entity-config-v2-exploration.md)

## development

```bash
# run in dev
bun run dev

# typecheck
bun run check

# run tests
bun run test
```
