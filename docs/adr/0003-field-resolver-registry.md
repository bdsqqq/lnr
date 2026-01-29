# 3. Field Resolver Registry

Date: 2026-01-29

## Status

Accepted

## Context

generators produced working commands but each had its own inline resolution logic:

```typescript
// in generate-project-commands.ts
if (input.lead === "@me") {
  const viewer = await client.viewer;
  updatePayload.leadId = viewer.id;
} else {
  const users = await client.users({ filter: { email: { eq: input.lead } } });
  // ...
}

// in generate-label-commands.ts (same pattern, duplicated)
const team = await findTeamByKeyOrName(client, input.team);
if (!team) {
  const available = (await getAvailableTeamKeys(client)).join(", ");
  exitWithError(`team "${input.team}" not found`, `available teams: ${available}`);
}
```

problems:
- same resolution logic duplicated across generators
- inconsistent error handling per generator
- adding a new resolved field required editing multiple generators
- easy to forget fields when copying patterns

## Decision

centralize field resolution in a registry (`packages/codegen/field-resolvers.ts`). generators consume this registry instead of hardcoding resolution logic.

### registry structure

```typescript
export const fieldResolvers: Record<string, FieldResolver> = {
  // resolved fields — need ID lookup
  projectId: {
    cliFlag: "project",
    resolve: "await resolveProjectByName(client, input.project)",
    import: "resolveProjectByName",
    from: "@bdsqqq/lnr-core",
  },
  
  // passthrough fields — direct values
  title: {
    cliFlag: "title",
    passthrough: true,
  },
  
  // excluded fields — internal, not CLI-exposed
  templateId: { exclude: true, reason: "template system" },
};
```

### resolver implementations

live in `packages/core/src/resolvers.ts`. each resolver:
- takes `(client, userInput)` and returns an ID
- throws a typed error on failure with available options
- is exported from `@bdsqqq/lnr-core`

```typescript
export class TeamNotFoundError extends Error {
  constructor(key: string, availableTeams: string[]) {
    super(`team not found: "${key}". available teams: ${availableTeams.join(", ")}`);
  }
}

export async function resolveTeamByKey(client, key): Promise<string> {
  const team = await findTeamByKeyOrName(client, key);
  if (!team) throw new TeamNotFoundError(key, await getAvailableTeamKeys(client));
  return team.id;
}
```

### generator pattern

all generators follow the same pattern:

```typescript
// import from registry
import { resolveAssignee, resolveTeamByKey } from "@bdsqqq/lnr-core";

// in handler
if (input.lead) {
  createPayload.leadId = await resolveAssignee(client, input.lead);
}
```

## Consequences

**gains:**
- single source of truth for field → CLI handling
- consistent error messages across entities
- adding new resolved field = add registry entry + resolver function
- generators stay simple — just import and call

**tradeoffs:**
- registry is another abstraction layer to understand
- some fields (like label parentId) have entity-specific semantics not captured by registry
- future: could fully automate payload construction from registry (not done yet)

## Future Work

`packages/codegen/generate-payload.ts` scaffolds generating payload construction code from the registry. not yet wired into generators — currently they use the registry pattern manually.
