# schema-driven cli generation

## the problem

lnr's current architecture requires hand-coding each command. adding a flag means touching:
1. zod schema for input validation
2. trpc-cli router definition
3. handler logic mapping flags to API calls

this compounds. every Linear API feature needs manual CLI plumbing. we're duplicating work the Linear SDK already did — they codegen their client from their GraphQL schema. we should do the same for the CLI.

## the insight

Linear's GraphQL schema follows rigid patterns:

```
entities:     Issue, Comment, Project, Cycle, ...
operations:   create, update, archive, delete, ...
inputs:       {Entity}{Operation}Input (IssueUpdateInput, CommentCreateInput, ...)
payloads:     { success: boolean, [entity]: Entity }
```

the SDK is generated from this. we can generate CLI commands the same way.

## proposed architecture

```
Linear GraphQL Schema
        ↓ introspect
mutation/input metadata
        ↓ codegen
CLI commands + flags + zod schemas
        ↓
trpc-cli wiring (or raw commander)
        ↓
UX resolvers (human shortcuts → IDs)
        ↓
final CLI
```

### layers

**1. schema introspection**

read Linear's GraphQL schema. extract:
- mutation names (issueUpdate, commentCreate, ...)
- input types and their fields
- required vs optional fields
- enum values (for autocomplete)

**2. codegen**

generate from metadata:
- zod schemas matching input types
- CLI command definitions (entity-first: `lnr issue update <id> --title ...`)
- flag types and validation

output is static code committed to the repo. re-run when Linear's API changes.

**3. UX resolvers**

the generated CLI is mechanical — it works with UUIDs and raw field names. the UX layer adds human shortcuts:

| shorthand | resolution |
|-----------|------------|
| `ENG-123` | issue UUID via identifier lookup |
| `@me` | viewer ID |
| `--state done` | stateId via team's workflow lookup |
| `--assignee alice@` | userId via email lookup |

these are composable functions that transform human input → API-ready values.

## entity-first, operation-inferred

the CLI infers intent from arguments:

```bash
lnr ENG-123                     # no flags → READ
lnr ENG-123 --title "new"       # has update flags → UPDATE
lnr ENG-123 --delete            # explicit destructive → DELETE
lnr issue new --team ENG ...    # explicit create → CREATE
```

this matches how users think: "do something to this thing" not "call this mutation".

## what we gain

1. **coverage parity** — every Linear API feature gets CLI support automatically
2. **consistency** — all commands follow the same patterns, generated from one source
3. **reduced maintenance** — API changes require re-running codegen, not manual updates
4. **correctness** — validation matches the schema exactly

## what stays manual

1. **UX decisions** — which shortcuts to support, how to name flags
2. **output formatting** — how to display results (tables, json, quiet mode)
3. **composition rules** — which flags compose vs conflict (like we just fixed for `--state` + `--comment`)

## open questions

### schema access

Linear's SDK repo has the schema. options:
- use `@linear/sdk`'s generated types as source
- fetch schema directly via introspection query
- vendor a copy of the schema

### codegen tooling

options:
- graphql-codegen with custom plugin
- raw TypeScript transformer reading AST
- template-based generation (mustache/handlebars)

lean toward graphql-codegen — it already handles schema parsing.

### incremental adoption

don't rewrite everything at once. approach:
1. generate for one entity (Issue) as proof of concept
2. verify output matches current hand-coded behavior
3. extend to remaining entities
4. deprecate hand-coded versions

## next steps

1. spike schema introspection — can we extract mutation/input metadata from `@linear/sdk`?
2. prototype Issue command generation — compare to current `issues.ts`
3. design UX resolver interface
4. integrate with build pipeline
