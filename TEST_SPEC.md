# test spec

all tests MUST be non-destructive. any created resources MUST be cleaned up in afterEach/afterAll.

---

## test strategy

use bun's built-in test runner (`bun test`). tests should:
1. verify CLI commands work against the real Linear API
2. clean up after themselves (delete created issues, etc.)
3. use a dedicated test prefix for created resources: `[TEST-CLI]`

---

## test structure

```
src/
  __tests__/
    auth.test.ts
    issues.test.ts
    teams.test.ts
    projects.test.ts
    cycles.test.ts
    me.test.ts
    search.test.ts
    config.test.ts
    helpers.ts       # shared test utilities
```

---

## helpers.ts

```typescript
import { $ } from "bun";

export const TEST_PREFIX = "[TEST-CLI]";

export async function cli(...args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const result = await $`bun run src/cli.ts ${args}`.quiet().nothrow();
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode,
  };
}

export async function cleanupTestIssues(client: LinearClient): Promise<void> {
  const issues = await client.issues({ filter: { title: { startsWith: TEST_PREFIX } } });
  for (const issue of issues.nodes) {
    await issue.archive();
  }
}
```

---

## test cases

### auth.test.ts
- `li auth --whoami` returns current user info
- exit code 0 on success

### issues.test.ts (READ-ONLY first, then CREATE/DELETE)
- `li issues` lists issues (verify output format)
- `li issues --json` outputs valid JSON
- `li issues --quiet` outputs only IDs
- `li issue <existing-id>` shows issue details
- **CREATE/DELETE cycle:**
  - create issue with `[TEST-CLI]` prefix
  - verify it appears in list
  - update issue state
  - archive/delete issue in cleanup

### teams.test.ts (READ-ONLY)
- `li teams` lists teams
- `li team <key>` shows team details
- `li team <key> --members` shows members

### projects.test.ts (READ-ONLY)
- `li projects` lists projects
- `li project <name>` shows project details (if any exist)

### cycles.test.ts (READ-ONLY)
- `li cycles --team <key>` lists cycles
- `li cycle --current --team <key>` shows current cycle (if exists)

### me.test.ts (READ-ONLY)
- `li me` shows current user
- `li me --issues` shows assigned issues
- `li me --created` shows created issues

### search.test.ts (READ-ONLY)
- `li search <query>` returns results
- `li search <query> --json` outputs valid JSON

### config.test.ts (LOCAL-ONLY, restore after)
- `li config` shows config
- `li config set default_team X` then restore original value
- `li config get default_team` returns set value

---

## cleanup protocol

1. all created issues use `[TEST-CLI]` title prefix
2. afterAll runs cleanup to archive any leftover test issues
3. tests that modify config save/restore original values

---

## run tests

```bash
bun test
bun test src/__tests__/issues.test.ts  # single file
```
