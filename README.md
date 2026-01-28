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

- `lnr issues` - list issues
- `lnr issue <id>` - show/update issue
- `lnr issue new` - create issue
- `lnr teams` - list teams
- `lnr projects` - list projects
- `lnr cycles` - list cycles
- `lnr search <query>` - search issues
- `lnr me` - show my info
- `lnr labels` - list labels
- `lnr docs` - list documents

see SPEC.md for full command reference.

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

### regenerating commands

```bash
# regenerate issue commands
bun run packages/codegen/generate-issue-commands.ts

# regenerate project commands
bun run packages/codegen/generate-project-commands.ts

# refresh schema from Linear API (requires LINEAR_API_KEY)
bun run packages/codegen/introspect-linear.ts
bun run packages/codegen/extract-schema.ts
```

generated files live in `packages/cli/src/generated/`.

## development

```bash
# run in dev
bun run dev

# typecheck
bun run check

# run tests
bun run test
```
