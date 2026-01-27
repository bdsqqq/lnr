# implementation plan: schema-driven cli generation

## status: DRAFT — reviewed, updated with oracle feedback

---

## goal

generate lnr's CLI commands from Linear's GraphQL schema instead of hand-coding each one.

## why

hand-coding doesn't scale. adding a flag currently requires touching zod schema, trpc router, and handler logic. Linear already codegens their SDK from the schema — we should do the same for the CLI.

---

## phases

### phase 1: schema source + extraction

**objective:** establish authoritative schema source and extract metadata.

**decision needed first:** which schema source?
- OPTION A: graphql introspection query against Linear API
  - pros: authoritative, includes enums/descriptions/deprecations
  - cons: requires auth, may have rate limits
- OPTION B: vendored GraphQL SDL from Linear's repo
  - pros: no runtime dependency, full metadata
  - cons: manual updates, may drift
- OPTION C: parse `@linear/sdk` `.d.ts` files
  - pros: already a dependency
  - cons: may lack enums, descriptions, deprecations; can drift from actual API

**recommendation:** spike OPTION A first. fall back to B or C if blocked.

**extract for each entity:**
- operations (create, update, archive, delete, plus special ops like subscribe, move)
- input fields with types, nullability, required/optional
- enum values for autocomplete
- descriptions for help text
- deprecation status

**output:**  
JSON metadata file with full schema structure.

**VERIFIED constraint:** the SDK `.d.ts` does expose input types and enum-like unions (checked `index.d.mts`). but descriptions and deprecations are NOT present — only available via introspection.

### phase 2: query + mutation generation

**objective:** generate both queries (READ/LIST) and mutations (CREATE/UPDATE/DELETE/ARCHIVE).

**gap identified:** original plan focused on mutations. but `lnr ENG-123` requires a *query*. must generate:
- single-entity queries with defined selection sets
- list queries with pagination/filtering
- mutations with input validation

**for each entity, emit:**
- zod schema for input validation
- default selection set (id, identifier, title, state, assignee, url, ...)
- handler that infers operation from input shape
- `--json` escape hatch for full output

**operation inference rules:**
```
no identifier + required create fields → CREATE
identifier + no mutation flags        → READ
identifier + mutation flags           → UPDATE  
identifier + --delete                 → DELETE (requires --yes or confirmation)
identifier + --archive                → ARCHIVE
conflicting operation flags           → ERROR (not silent ignore)
```

**destructive operations:** `--delete`, `--archive` require explicit confirmation (`--yes` flag or interactive prompt). prevents accidental data loss.

**output:**  
generated TypeScript files in `packages/cli/src/generated/`.

**open questions:**
- QUESTION: curate "common flags" vs expose all fields? (avoid overwhelming autocompletion)
- QUESTION: how to express "clear field" vs "leave unchanged"? (`--assignee ""` or `--clear-assignee`?)

### phase 2.5: inference + conflict rules (NEW)

**objective:** define precedence and conflict handling before scaling.

**must define:**
- precedence when multiple operation-like flags present
- which combinations are errors vs which win
- confirmation requirements for destructive ops
- behavior when inference is ambiguous

**encode as tests first.** this prevents silent breaking changes later.

### phase 3: ux resolver layer

**objective:** transform human-friendly input into API-ready values.

**approach:**  
resolvers are functions that map shortcuts to IDs:
- `--state done` → lookup stateId via team workflow
- `--assignee @me` → viewer ID
- `ENG-123` → issue UUID

**interface (HUNCH — needs validation):**
```typescript
type Resolver<T> = (raw: string, ctx: Context) => Promise<T>
```

**critical addition: caching + batching.**  
a command like `lnr ENG-123 --state done --assignee alice` can trigger multiple lookups. without caching:
- slow (multiple round trips)
- rate limit risk
- flaky UX

resolvers should batch where possible and cache within a command invocation.

**disambiguation:** when resolver finds multiple matches (e.g., `alice` matches two users), options:
- fail with suggestions
- interactive picker (if TTY)
- require more specific input

**output:**  
`packages/cli/src/resolvers/` with composable, cached resolver functions.

**open questions:**
- QUESTION: should resolvers be per-field or per-entity?
- QUESTION: cache lifetime? (per-command, persistent, TTL?)

### phase 4: integration

**objective:** integrate generated code with existing CLI.

**approach:**  
- generate alongside existing hand-coded commands
- validate generated output matches current behavior
- migrate entity-by-entity
- deprecate hand-coded versions once generated equivalents work

**open questions:**
- QUESTION: how to test generated commands match hand-coded behavior?
- QUESTION: keep hand-coded as fallback or delete?

---

## risks and unknowns

1. **SDK types may not expose everything we need**  
   confidence: VERIFIED  
   checked `index.d.mts` — input types present, but descriptions/deprecations missing. introspection required for full metadata.

2. **operation inference may be ambiguous**  
   confidence: HUNCH  
   some flag combinations might not clearly map to one operation. mitigated by phase 2.5 (explicit rules + tests).

3. **UX layer complexity**  
   confidence: QUESTION  
   unclear how many resolvers we'll need and whether they compose cleanly.

4. **resolver lookups can hit rate limits** (NEW)  
   confidence: HUNCH  
   multiple lookups per command (team, state, user, issue) may cause latency or throttling. requires caching strategy.

5. **schema drift causes runtime failures** (NEW)  
   confidence: HUNCH  
   if we generate from stale schema source, commands may compile but fail at runtime. need pinned versions and update process.

6. **breaking CLI surface due to schema changes** (NEW)  
   confidence: QUESTION  
   users rely on scripts. if flags rename/disappear due to schema changes, scripts break silently. need deprecation warnings or stability policy.

---

## next steps

1. **spike schema source:** run introspection query against Linear API, verify we get enums/descriptions/deprecations
2. **spike extraction:** parse introspection result → JSON metadata for Issue entity
3. **spike generation:** generate Issue read + update commands, compare to hand-coded `issues.ts`
4. **define inference rules:** write tests encoding operation precedence + conflict behavior
5. if spikes succeed, flesh out remaining phases

---

## what stays manual

per the design doc, these remain hand-crafted:
- UX decisions (which shortcuts to support)
- output formatting (tables, json, quiet mode)
- composition rules (which flags conflict)
- curated "common flags" subset (avoid overwhelming autocompletion)
- deprecation/stability policy for CLI surface

---

## validation checklist

before declaring a phase complete:
- [ ] tested against 3+ entities (Issue, Project, Comment) to verify patterns hold
- [ ] inference rules encoded as tests
- [ ] generated output matches hand-coded behavior for covered cases
- [ ] resolver caching strategy defined and implemented
- [ ] destructive ops require confirmation
