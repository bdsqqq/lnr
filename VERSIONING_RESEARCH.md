# versioning research

## context

- bun workspaces: `packages/core` (@linear-cli/core) and `packages/cli` (@linear-cli/cli)
- cli depends on core via `workspace:*`
- both packages currently `private: true` at v0.1.0
- want: conventional commits, automated changelogs, dependent versioning (cli bumps when core bumps)

## prior art: opencode

opencode uses a **custom ~200-line publish script** that:
- queries npm for latest version
- calculates next version from env vars (`OPENCODE_BUMP`, `OPENCODE_VERSION`)
- updates all package.jsons atomically
- creates git tags and github releases
- handles preview/snapshot versions for non-main branches

verdict: flexible but high maintenance, not "set and forget"

---

## options comparison

### 1. changesets

| aspect | detail |
|--------|--------|
| stars | 11.1k |
| approach | explicit change files per PR, consumed at release time |
| monorepo | first-class, built for this |
| conventional commits | no (uses change files instead) |
| changelog | yes, per-package |
| dependent versioning | yes, automatic |
| bun support | yes, works with bun workspaces |
| ci integration | github action available |

**workflow:**
```bash
# on feature branch
bun changeset          # interactive prompt creates .changeset/*.md
git add . && git push

# on main (ci or manual)
bun changeset version  # bumps versions, updates changelogs
bun changeset publish  # publishes to npm
```

**config:** `.changeset/config.json`
```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [["@linear-cli/core", "@linear-cli/cli"]],
  "access": "public",
  "baseBranch": "main"
}
```

**pros:**
- mature, widely adopted (react, pnpm, solid, etc.)
- explicit change descriptions (better changelogs)
- handles dependent bumping automatically
- github bot for PR reminders

**cons:**
- requires manual changeset creation per PR
- not auto-derived from commits
- known issue with `workspace:*` in bun (may need workaround)

---

### 2. semantic-release

| aspect | detail |
|--------|--------|
| stars | 20k+ |
| approach | fully automated from commit messages |
| monorepo | weak, requires `semantic-release-monorepo` plugin |
| conventional commits | yes, primary mechanism |
| changelog | yes |
| dependent versioning | manual config, not native |
| bun support | untested |

**workflow:**
```bash
# commits must follow conventional format
git commit -m "feat(core): add search functionality"

# ci runs on main
npx semantic-release  # analyzes commits, bumps, publishes
```

**pros:**
- truly automated, zero manual steps
- conventional commits enforced

**cons:**
- monorepo support is bolted-on, not first-class
- complex config for multi-package repos
- dependent versioning requires custom plugins
- "magic" can be hard to debug

---

### 3. release-please (google)

| aspect | detail |
|--------|--------|
| stars | 6.2k |
| approach | creates release PRs based on conventional commits |
| monorepo | yes, via manifest config |
| conventional commits | yes |
| changelog | yes |
| dependent versioning | partial (same monorepo grouping) |
| bun support | node releaser works |

**workflow:**
```bash
# push conventional commits to main
# release-please github action creates/updates a Release PR
# merge PR → tags created, github release published
```

**config:** `release-please-config.json`
```json
{
  "packages": {
    "packages/core": { "release-type": "node" },
    "packages/cli": { "release-type": "node" }
  },
  "plugins": ["linked-versions"]
}
```

**pros:**
- automated from conventional commits
- release PR gives visibility before publishing
- well-maintained by google

**cons:**
- more config than changesets
- dependent versioning requires `linked-versions` plugin
- publishing step separate (need additional workflow)

---

### 4. beachball (microsoft)

| aspect | detail |
|--------|--------|
| stars | 804 |
| approach | change files (similar to changesets) |
| monorepo | yes |
| conventional commits | no (uses change files) |
| changelog | yes (json + md) |
| dependent versioning | yes |
| bun support | uses yarn/npm internally |

**workflow:**
```bash
beachball change  # create change file
beachball check   # ci validation
beachball publish # bump + publish + push tags
```

**pros:**
- integrated version+publish+tag in one command
- change file approach like changesets

**cons:**
- smaller community
- yarn-focused, bun support unclear
- less ecosystem tooling

---

### 5. custom bun script

| aspect | detail |
|--------|--------|
| approach | roll your own |
| flexibility | maximum |
| maintenance | high |

**example:** (similar to opencode)
```typescript
// scripts/release.ts
import { $ } from "bun";

const packages = ["packages/core", "packages/cli"];

async function release(bump: "patch" | "minor" | "major") {
  // 1. bump versions in package.json files
  // 2. update changelog from conventional commits
  // 3. git commit + tag
  // 4. publish to npm
}
```

**pros:**
- total control
- no external deps
- can tailor to exact needs

**cons:**
- 100-200 lines to write/maintain
- reinventing solved problems
- no community support

---

## recommendation

### **changesets** (recommended)

for a small monorepo with 2 packages and a clear dependency relationship, changesets is the best fit:

1. **explicit over implicit** — change files force authors to describe changes, producing better changelogs than auto-generated commit parsing
2. **dependent versioning** — `linked` config ensures cli bumps when core bumps
3. **mature & proven** — 11k+ stars, used by major projects
4. **minimal config** — single config file, works out of the box
5. **github action** — bot reminds PRs to add changesets

### setup steps

```bash
# install
bun add -D @changesets/cli

# init
bun changeset init

# configure .changeset/config.json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [["@linear-cli/core", "@linear-cli/cli"]],
  "access": "public",
  "baseBranch": "main"
}
```

### ci workflow

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - uses: changesets/action@v1
        with:
          publish: bun changeset publish
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### alternative: release-please

if you strongly prefer fully automated releases from conventional commits (no manual changeset step), release-please is the second choice. tradeoff: changelogs are auto-generated from commit messages, which are often less polished than explicit change descriptions.

---

## known issues

- **changesets + bun `workspace:*`**: there's a [reported issue](https://github.com/changesets/changesets/issues/1468) where workspace versions aren't replaced correctly. may need to use `workspace:^` or explicit versions.
- **bun publish --filter**: not yet supported ([issue #15246](https://github.com/oven-sh/bun/issues/15246)), so publishing needs to iterate packages manually or use changesets' built-in handling.

---

## summary table

| tool | effort | conventional commits | monorepo | dependent versioning | recommended |
|------|--------|---------------------|----------|---------------------|-------------|
| changesets | low | no (change files) | ✅ | ✅ linked | **✅ yes** |
| release-please | low | yes | ✅ | partial | maybe |
| semantic-release | medium | yes | weak | manual | no |
| beachball | medium | no | ✅ | ✅ | no |
| custom | high | optional | ✅ | manual | no |
