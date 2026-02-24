# 1. Schema-Driven CLI Generation

Date: 2026-01-27

## Status

Accepted

## Context

lnr's architecture required hand-coding each command. adding a flag meant touching:
1. zod schema for input validation
2. trpc-cli router definition
3. handler logic mapping flags to API calls

every Linear API feature needed manual CLI plumbing. Linear already codegens their SDK from their GraphQL schema — we should do the same for the CLI.

## Decision

generate CLI commands from Linear's GraphQL schema using introspection.

### architecture

```
Linear GraphQL Schema
        ↓ introspect
mutation/input metadata
        ↓ codegen
CLI commands + flags + zod schemas
        ↓
trpc-cli wiring
        ↓
UX resolvers (human shortcuts → IDs)
        ↓
final CLI
```

### what's generated (packages/cli/src/generated/)

- zod schemas matching input types
- CLI command definitions with flags
- operation inference (READ/UPDATE/CREATE/ARCHIVE)
- handler dispatch

### what stays manual

- UX decisions — which shortcuts to support, how to name flags
- output formatting — tables, json, quiet mode
- composition rules — which flags compose vs conflict
- resolvers — @me, state names, issue identifiers
- CLI-only features — --branch, --pr (not in Linear schema)

### entity-first, operation-inferred

the CLI infers intent from arguments:

```bash
lnr ENG-123                     # no flags → READ
lnr ENG-123 --title "new"       # has update flags → UPDATE
lnr ENG-123 --archive           # explicit destructive → ARCHIVE
lnr issue new --team ENG ...    # explicit create → CREATE
```

## Consequences

**gains:**
- coverage parity — every Linear API feature gets CLI support automatically
- consistency — all commands follow the same patterns
- reduced maintenance — API changes require re-running codegen, not manual updates
- correctness — validation matches the schema exactly

**tradeoffs:**
- requires API key for introspection (mitigated by committing schema.json)
- generated code is large but readable
- schema drift risk if introspection not re-run after Linear API changes
- CLI-only features (--branch, --pr) must be added manually after regeneration
