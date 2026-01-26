# @bdsqqq/lnr-cli

## 1.2.0

### Minor Changes

- feat(cli): add flag descriptions for --help output

  Amp-Thread-ID: https://ampcode.com/threads/T-019b9a39-25c4-76db-99bc-777d8196b87c
  Co-authored-by: Amp <amp@ampcode.com>

- feat: api key configuration and env var support (#5)

  - feat(core): support LINEAR_API_KEY env var and api key override

  * getApiKey() checks LINEAR_API_KEY env var first, falls back to config
  * getClient() accepts optional apiKey parameter for explicit override
  * add listConfig() and getConfigPath() helpers

  precedence: explicit param > env var > config file

  - feat(cli): add global --api-key flag with proper precedence

  * add --api-key <key> global option to override config and env
  * create cli wrapper for getClient that extracts global option
  * update all commands to use cli wrapper instead of core getClient

  precedence: --api-key flag > LINEAR_API_KEY env > ~/.lnr/config.json

  - feat(cli): enhance lnr config command

  * show env vs config source for api_key
  * add --edit flag to open config in $EDITOR
  * import getConfigPath from core

  - test(core): add tests for getApiKey precedence and config helpers

  tests:

  - getApiKey returns config value when env not set
  - getApiKey returns env var when set (takes precedence)
  - getApiKey returns undefined when neither set
  - listConfig returns full config
  - getConfigPath returns correct path

- feat(cli): add 's' alias for search command (#11)
- feat: issue relation flags (blocks, blocked-by, relates-to) (#6)

  - feat(core): add createIssueRelation for blocks/related links

  adds createIssueRelation(client, issueId, relatedIssueId, type) function
  that wraps Linear SDK's createIssueRelation mutation.

  supports types: 'blocks' and 'related'

  - feat(core): export createIssueRelation from core package

  - feat(cli): add --blocks, --blocked-by, --relates-to flags

  allows creating issue relations from the command line:
  lnr issue AXM-123 --blocks AXM-456
  lnr issue AXM-123 --blocked-by AXM-456
  lnr issue AXM-123 --relates-to AXM-456

  --blocked-by swaps issueId/relatedIssueId to express inverse relationship

  - fix: correct option names for relation flags (blocks -> blocksIssue mismatch)

- feat: add feature parity with PR #7

  - comments: getIssueComments, updateComment, replyToComment, deleteComment
  - documents: full CRUD (lnr docs, lnr doc)
  - labels: full CRUD (lnr labels, lnr label)
  - reactions: createReaction, deleteReaction
  - issues: archiveIssue, getSubIssues, parentId support
  - cli flags: --comments, --edit-comment, --reply-to, --delete-comment
  - cli flags: --archive, --react, --unreact, --parent, --sub-issues
  - global --api-key flag with precedence (flag > env > config)

  Amp-Thread-ID: https://ampcode.com/threads/T-019b99e2-192e-7545-be0c-4b7ec9df12c5
  Co-authored-by: Amp <amp@ampcode.com>

- feat: add feature parity with PR #7 (trpc-cli architecture) (#9)
- feat(issue): show comments inline when viewing issue (#10)

  - feat(issue): show comments inline when viewing issue

  * extend Comment type with url, reactions, syncedWith, botActor, externalUser
  * add comment thread formatting with tree-style indentation (└)
  * show last 3 threads with last 3 replies each
  * display reactions, relative timestamps, external service info
  * include comments in json output

  Amp-Thread-ID: https://ampcode.com/threads/T-019bd659-8bfc-77be-90d9-9fae68275c32
  Co-authored-by: Amp <amp@ampcode.com>

  - fix(comments): typed sync metadata for all integrations, emoji conversion

  * add typed SyncMeta discriminated union for slack/github/jira
  * convert emoji shortcodes to unicode (falls back to :shortcode: for custom)
  * github shows owner/repo, jira shows issueKey in thread headers

  Amp-Thread-ID: https://ampcode.com/threads/T-019bd659-8bfc-77be-90d9-9fae68275c32
  Co-authored-by: Amp <amp@ampcode.com>

  - feat(emoji): add ~300 standard shortcodes

  covers github/slack standard set: smileys, gestures, hearts,
  celebration, symbols, animals, food, objects, arrows, numbers.
  custom org emojis still fall back to :shortcode: format.

  Amp-Thread-ID: https://ampcode.com/threads/T-019bd659-8bfc-77be-90d9-9fae68275c32
  Co-authored-by: Amp <amp@ampcode.com>

  - fix(comments): type guards, error handling, real tests

  * replace type assertions with in/typeof narrowing + satisfies
  * getIssueComments returns { comments, error? } for graceful degradation
  * narrow aggregateReactions input to { emoji: string }[] (no SDK dep in tests)
  * recursive threading for arbitrary depth
  * fix github channel format (no leading slash when owner missing)
  * delete slop tests (interface shapes, export checks)
  * add 43 behavior tests for pure functions

  Amp-Thread-ID: https://ampcode.com/threads/T-019bd6a6-93df-73a8-a436-fa9bc2f5ff20
  Co-authored-by: Amp <amp@ampcode.com>

  ***

  Co-authored-by: Amp <amp@ampcode.com>

### Patch Changes

- fix(security): use spawn with args array instead of exec for --open

  prevents command injection via malicious issue.url
  also adds cross-platform support (open/xdg-open/start)

  Amp-Thread-ID: https://ampcode.com/threads/T-019b99e2-192e-7545-be0c-4b7ec9df12c5
  Co-authored-by: Amp <amp@ampcode.com>

- refactor(cli): migrate from commander+arktype to trpc-cli+zod

  - replace commander with trpc-cli for CLI argument parsing
  - replace arktype with zod v4 for input validation
  - use zod .meta({positional: true}) for positional args
  - restructure commands/ → router/ with tRPC router pattern
  - optional positionals now work correctly (auth apiKey)

  Amp-Thread-ID: https://ampcode.com/threads/T-019b99be-3d13-702d-99cd-55543905568c
  Co-authored-by: Amp <amp@ampcode.com>

- chore: add changeset
- refactor(cli): migrate from commander+arktype to trpc-cli+zod (#8)
- fix: address round 3 review feedback

  - comments.ts: add try/catch to getIssueComments for consistency
  - docs.ts: refactor to single outer try-catch matching labels.ts pattern
  - docs.ts: error on failed create instead of silent fallback

  Amp-Thread-ID: https://ampcode.com/threads/T-019b99e2-192e-7545-be0c-4b7ec9df12c5
  Co-authored-by: Amp <amp@ampcode.com>

- fix: address round 2 review feedback

  - documents.ts: use server-side filtering via API filter param
  - documents.ts: add try/catch for consistency
  - labels.ts: hoist getClient() to single call at top of procedure
  - labels.ts: add ID column to table for quiet mode parity
  - labels.ts: error instead of silent fallback on failed create
  - relations.ts: return boolean success value
  - issues.ts: check return values from createReaction/deleteReaction
  - issues.ts: check return values from createIssueRelation

  Amp-Thread-ID: https://ampcode.com/threads/T-019b99e2-192e-7545-be0c-4b7ec9df12c5
  Co-authored-by: Amp <amp@ampcode.com>

- fix: address review feedback

  - labels.ts: add null check on team before accessing team.labels()
  - issues.ts: error when --edit-comment/--reply-to missing --text
  - issues.ts: error when --react missing --emoji
  - issues.ts: remove redundant --open handling in handleUpdateIssue

  Amp-Thread-ID: https://ampcode.com/threads/T-019b99e2-192e-7545-be0c-4b7ec9df12c5
  Co-authored-by: Amp <amp@ampcode.com>

- fix: address review findings from 9 rounds of agent review

  - fix labels router team key→id resolution using findTeamByKeyOrName()
  - fix getSubIssues to include parentId field for consistency
  - fix --unreact/--emoji flag descriptions to match behavior
  - add try/catch error handling to me.ts and cycles.ts routers
  - add cycles 'c' alias for consistency with other routers
  - implement lnr me --activity to show recent user activity
  - update SPEC.md: remove unimplemented features, add new commands
  - update SKILL.md: fix --name to --projectName
  - update README.md: add new commands documentation

  Amp-Thread-ID: https://ampcode.com/threads/T-019b9a3d-f7bc-74b5-b360-4fa4d12e1a8e
  Co-authored-by: Amp <amp@ampcode.com>

- chore(release): v1.1.2
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @bdsqqq/lnr-core@1.2.0

## 1.1.2

### Patch Changes

- 7adf23e: chore: gitignore dist folder

## 1.1.1

### Patch Changes

- 13547bd: docs: tighten tagline
- Updated dependencies [13547bd]
  - @bdsqqq/lnr-core@1.1.1

## 1.1.0

### Minor Changes

- c97852a: initial release of lnr - a fast, minimal linear cli

  - core: LinearClient wrapper, issues/projects/teams/cycles/search operations
  - cli: commands for issue, project, team, cycle, me, search, config

### Patch Changes

- Updated dependencies [c97852a]
  - @bdsqqq/lnr-core@1.1.0

## 1.0.0

### Major Changes

- Initial release of lnr with core functionality and CLI interface.

### Patch Changes

- Updated dependencies
  - @bdsqqq/lnr-core@1.0.0
