# ADR-0007: entity-config v2 exploration

## status

exploring

## context

after picking the project back up following a hiatus, an [agent thread investigation](https://ampcode.com/threads/T-019c2e72-60b1-73a3-b52a-edcfff839e92) uncovered a pattern problem in the schema-codegen branch.

### findings

**confidence:** VERIFIED  
**location:** git log analysis of `packages/cli/src/generated/*.ts`  
**evidence:** commits fall into two patterns:

1. **correct** (early commits): modify `generate-commands.ts`, output regenerated
2. **incorrect** (later commits): manually edit generated files

commits that manually edited generated files:
- `0603fcb`: `--milestones` flag on project
- `1ba817a`: project updates display  
- `39e4bbd`: reactions (`--react`, `--unreact`)
- `527d147`: subscriptions (`--subscribe`, `--unsubscribe`)
- `3c63808`: batch subcommand
- `19cf9fd`: auto-find subscription

**falsification attempted:** checked if these entities are in Linear's schema — they are. checked if `entity-config.ts` lists them — it does (as FLAG_ENTITIES). confirmed generator ignores FLAG_ENTITIES by reading `generate-commands.ts`.

### root cause

`entity-config.ts` categorizes entities but doesn't specify HOW they surface in the CLI. the generator only processes CORE_ENTITIES — it ignores FLAG_ENTITIES, SCOPED_ENTITIES entirely.

per ADR-0001, Reaction, NotificationSubscription, and EntityExternalLink are in Linear's schema. they should be codegen'd.

### consequences

1. re-running codegen overwrites flag features
2. no single source of truth for CLI surface
3. violates ADR-0001 architecture

## decision

explore a rich entity config DSL using arktype. each entity declares:

1. **exposure type**: command | flag | scoped | subcommand
2. **parent relationships**: which commands host this entity
3. **operations**: flags and handlers to generate
4. **imports**: core functions to wire

generator reads config, produces complete commands. no manual edits ever.

## proposed schema

see prototype at [`packages/codegen/entity-schema.ts`](../../packages/codegen/entity-schema.ts).

key types:

```typescript
// discriminated union — arktype auto-discriminates
const entityDefinition = type.or(
  commandEntity,   // exposure: 'command'
  flagEntity,      // exposure: 'flag'  
  scopedEntity,    // exposure: 'scoped'
  subcommandEntity // exposure: 'subcommand'
)
```

### command entity

standalone command with CRUD operations.

```typescript
{
  name: "Issue",
  exposure: "command",
  reason: "core entity",
  command: {
    singular: "issue",
    plural: "issues",
    aliases: ["i"],
    positional: { name: "idOrNew", description: "identifier or 'new'" },
    operations: { list: true, show: true, create: true, update: true, archive: true },
  },
}
```

### flag entity

flags injected into parent commands.

```typescript
{
  name: "Reaction",
  exposure: "flag",
  reason: "reactions via --react/--unreact",
  flags: {
    parents: ["issue", "project", "initiative"],
    operations: [
      { flag: "react", inputType: "string", operation: "create", handler: "createReaction", requires: ["emoji"] },
      { flag: "emoji", inputType: "string", operation: "create", handler: "" },
      { flag: "unreact", inputType: "string", operation: "delete", handler: "deleteReaction" },
    ],
  },
}
```

### scoped entity

accessed via flag on parent command.

```typescript
{
  name: "ProjectUpdate",
  exposure: "scoped",
  reason: "project updates via --updates",
  scoped: {
    parent: "project",
    flag: "updates",
    description: "list project updates",
    listHandler: "getProjectUpdates",
  },
}
```

### subcommand entity

nested command under parent.

```typescript
{
  name: "IssueBatch",
  exposure: "subcommand",
  reason: "bulk ops via 'issue batch'",
  subcommand: {
    parent: "issue",
    name: "batch",
  },
}
```

## generator changes

### phase 1: config validation
- parse definitions with arktype at codegen time
- fail fast on invalid config

### phase 2: flag injection
when generating a command entity:
1. find FLAG_ENTITIES where `parents.includes(commandName)`
2. inject their flags into zod schema
3. add to `inferOperation` mutation flags list

### phase 3: handler generation
- generate handler code from operation definitions
- wire imports automatically

### phase 4: cleanup
- regenerate all files
- verify no manual edits needed
- update ADR-0001

## tradeoffs

### gains
- single source of truth
- no manual edits ever
- type-safe config (arktype validates at codegen time)
- easy to add new flag entities or extend to new parents

### costs
- more complex config structure
- generator becomes more sophisticated
- some patterns may not fit cleanly

### open questions

1. **handler complexity**: reaction handlers differ by parent (comment reactions vs project update reactions). how to express context-dependent logic?

2. **target resolution**: `--react` needs entity type context. should config include resolution rules?

3. **mutation flag detection**: `inferOperation` needs to know which flags trigger "update". derive from config or explicit?

## alternatives considered

### composition via imports
generated files export base, hand-crafted files extend. simpler generator but two places to maintain.

### annotation layer
separate `cli-annotations.json` from schema. clean separation but sync burden.

## next steps

1. [x] install arktype
2. [ ] create entity-schema.ts prototype
3. [ ] validate current definitions parse correctly
4. [ ] implement flag injection in generator
5. [ ] regenerate and verify
