# @bdsqqq/lnr-cli

## 2.0.2

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @bdsqqq/lnr-core@2.0.2

## 2.0.1

### Patch Changes

- fix(auth): make apiKey positional arg optional for --whoami/--logout (#21)

  trpc-cli's isOptional() checks the property value schema for optional
  markers, but arktype's "key?" syntax only encodes optionality at the
  object level (required array). using "string | undefined" embeds the
  optional signal where trpc-cli expects it.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c90c6-c261-75dd-be9e-48cc2e28ccdb

  Co-authored-by: Amp <amp@ampcode.com>

## 2.0.0

### Major Changes

- feat!: schema-driven CLI generation (#20)

### Minor Changes

- feat(codegen): issue subscriptions and project links

  0048: issue --subscribe/--unsubscribe now uses subscribeToIssue/unsubscribeFromIssue

  - issue removed from NotificationSubscription parents (uses subscriberIds API)
  - handler logic added inline in generateIssueUpdateHandler
  - flags added manually to issueConfig since not injected via entity-definitions

  0049: project --links added as read-only scoped entity

  - ProjectExternalLink added to entity-definitions.ts
  - handler in generateProjectShowHandler uses getProjectExternalLinks
  - createEntityExternalLink still missing in core (future enhancement)

  Amp-Thread-ID: https://ampcode.com/threads/T-019c2f01-0fcd-700e-bc98-fd17d5a287da
  Co-authored-by: Amp <amp@ampcode.com>

- feat(agents): add AgentActivity embedded in session

  Amp-Thread-ID: https://ampcode.com/threads/T-019c1131-10bb-73fe-a5cb-03b1c14561c8
  Co-authored-by: Amp <amp@ampcode.com>

- feat(projects): add --show-status flag for project status

  Amp-Thread-ID: https://ampcode.com/threads/T-019c1113-baac-71d9-bc01-4ab05d43010b
  Co-authored-by: Amp <amp@ampcode.com>

- feat(reactions): extend reactions to all comment-like entities

  Amp-Thread-ID: https://ampcode.com/threads/T-019c111b-9884-728f-b86c-a3383dde459c
  Co-authored-by: Amp <amp@ampcode.com>

- feat(notifications): add notification read-only support

  Amp-Thread-ID: https://ampcode.com/threads/T-019c1105-c34a-7234-a7db-0332401fd16e
  Co-authored-by: Amp <amp@ampcode.com>

- feat(codegen): support CLI-only flags via hand-crafted handlers

  - Add cliOnly, handler, dispatchIn fields to cli-spec.json flag schema
  - Generator reads CLI-only flags and includes them in generated zod schema
  - Generator imports hand-crafted handlers and dispatches to them
  - Create packages/cli/src/hand-crafted/ for CLI-only handler implementations
  - Add --branch and --pr as CLI-only flags with handlers

  Regeneration no longer clobbers hand-crafted code.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c062e-1179-72dd-ab35-7f44cb6f8e11
  Co-authored-by: Amp <amp@ampcode.com>

- feat(git-automation): add GitAutomationState support

  Amp-Thread-ID: https://ampcode.com/threads/T-019c1127-93e5-76ff-8b9e-a0e6c95c3b9c
  Co-authored-by: Amp <amp@ampcode.com>

- feat(cli): add --milestones flag to project command

  Amp-Thread-ID: https://ampcode.com/threads/T-019c10a3-2aad-709a-a9f8-54f4abb1a51e
  Co-authored-by: Amp <amp@ampcode.com>

- feat(ci): add e2e tests to CI, require org name confirmation for mutations

  - e2e readonly + mutation tests run in CI against sandbox
  - mutation tests accept --operating-on-this-org-do-not-put-an-org-you-care-about-or-youll-be-fired=<name>
  - locally: interactive prompt requires typing org name
  - bump batch test timeout to 15s

  Amp-Thread-ID: https://ampcode.com/threads/T-019c2fe3-854e-720f-823c-61084b29c969
  Co-authored-by: Amp <amp@ampcode.com>

- feat: regen schema; --project flags now accept both id and name
- feat(initiatives): add initiative updates support

  Amp-Thread-ID: https://ampcode.com/threads/T-019c110a-b0a6-702c-826d-41072e7ebdc8
  Co-authored-by: Amp <amp@ampcode.com>

- feat(entity): add --links flag for external links on projects and initiatives

  Amp-Thread-ID: https://ampcode.com/threads/T-019c1116-47b4-73e3-a26d-f7d38b2da836
  Co-authored-by: Amp <amp@ampcode.com>

- feat(codegen): add field resolver registry and wire missing create fields

  - add resolveTeamByKey, resolveProjectByName, resolveCycleByName to core
  - create field-resolvers.ts registry mapping API fields to CLI handling
  - create generate-payload.ts for shared payload construction
  - wire --project, --cycle, --state, --estimate, --dueDate to issue create
  - wire --blocks, --blockedBy, --relatesTo as post-create operations

  issue create now supports all fields that issue update supports.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c0649-4de7-75a4-a9e3-41d27762f791
  Co-authored-by: Amp <amp@ampcode.com>

- feat(projects): add --labels flag for project labels

  Amp-Thread-ID: https://ampcode.com/threads/T-019c1111-4df2-75eb-8cbf-f095d5c9b125
  Co-authored-by: Amp <amp@ampcode.com>

- feat(template): add template entity support

  - add Template to SUPPORTED_ENTITIES and priorityTypes
  - run introspection to fetch Template type from Linear API
  - create core module with list/get/find template functions
  - add CLI commands: lnr templates, lnr template <name>
  - wire up generatedTemplatesRouter

  template is read-only (no mutations in Linear API).
  enables 'lnr issue new --template' in future PR.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c10f1-6955-7429-8eff-45f24c78e5fc
  Co-authored-by: Amp <amp@ampcode.com>

- feat(cycle): add full CRUD support to cycle entity CLI

  Amp-Thread-ID: https://ampcode.com/threads/T-019c10f6-01f3-7113-a0c6-1f775409c22d
  Co-authored-by: Amp <amp@ampcode.com>

- feat(cli): add milestone commands

  milestones/milestone commands for list/show/create/update/delete.
  generator config added, CLI generated.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c0a99-51c8-7128-b3c9-16e991924210
  Co-authored-by: Amp <amp@ampcode.com>

- feat(project): add project updates display

  Amp-Thread-ID: https://ampcode.com/threads/T-019c1101-51a2-74ad-87df-ea68f5789d2c
  Co-authored-by: Amp <amp@ampcode.com>

- feat(config): directory-scoped .lnr.json with nearest-wins resolution

  - replace ~/.lnr/config.json with .lnr.json at any directory level
  - walk up from cwd, first .lnr.json wins
  - precedence: nearest config > legacy ~/.lnr/config.json > LINEAR_API_KEY env
  - e2e readonly tests show org name at top of report
  - e2e mutation tests require typing org name to confirm
  - add .lnr.json to .gitignore (contains secrets)

  Amp-Thread-ID: https://ampcode.com/threads/T-019c2fe3-854e-720f-823c-61084b29c969
  Co-authored-by: Amp <amp@ampcode.com>

- feat(issue): add --milestone flag for issue create/update

  Amp-Thread-ID: https://ampcode.com/threads/T-019c10aa-b662-751f-a9d3-5340f71dc0d2
  Co-authored-by: Amp <amp@ampcode.com>

- feat(subscriptions): add notification subscription flags

  Amp-Thread-ID: https://ampcode.com/threads/T-019c111f-037d-7257-93b9-df79a09f67aa
  Co-authored-by: Amp <amp@ampcode.com>

- feat(user): add user entity CLI support

  Amp-Thread-ID: https://ampcode.com/threads/T-019c10ff-5e15-7129-bd2e-f7f26dbaca69
  Co-authored-by: Amp <amp@ampcode.com>

- feat(errors): graceful handling for enterprise-only entities

  Amp-Thread-ID: https://ampcode.com/threads/T-019c1140-f2d3-73bb-9a54-d6d6602764f8
  Co-authored-by: Amp <amp@ampcode.com>

- feat(batch): add issue batch subcommand

  Amp-Thread-ID: https://ampcode.com/threads/T-019c1122-f5dd-7742-89e7-2eea4d52fda6
  Co-authored-by: Amp <amp@ampcode.com>

- feat(cli): command enumeration + reference docs

  add scripts/enumerate-commands.ts that introspects the trpc router
  at import time to produce structured command metadata. extract
  reusable introspection into lib/command-introspection.ts.

  generates docs/command-reference.md (38 commands, 265 permutations).
  CI enforces generated files stay in sync via git diff --exit-code.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c3a42-917f-71b8-b4d2-f6889accd4ef
  Co-authored-by: Amp <amp@ampcode.com>

- feat(roadmaps): add --projects flag for roadmap-to-project mapping

  Amp-Thread-ID: https://ampcode.com/threads/T-019c110e-e440-74ae-b5b2-3348a836aa05
  Co-authored-by: Amp <amp@ampcode.com>

- feat(codegen): implement subcommand injection for entity-config v2

  - add subcommand injection to generate-commands.ts
  - add IssueBatch subcommand (issue batch) for bulk updates
  - add ProjectMilestoneCRUD subcommand (project milestone) for CRUD
  - update issue config to use generateFlagZodFields/generateScopedZodFields
  - remove hardcoded react/emoji/unreact/comments/subIssues from issue config
  - now all flag and scoped entities inject from entity-definitions

  tasks completed: 0045, 0045.1, 0046, 0047

  Amp-Thread-ID: https://ampcode.com/threads/T-019c2ef7-174b-764b-8db8-b7e722af82b6
  Co-authored-by: Amp <amp@ampcode.com>

- feat(view): add customview entity CLI support

  Amp-Thread-ID: https://ampcode.com/threads/T-019c10fa-7fc0-728d-8bb3-57c81be9bc58
  Co-authored-by: Amp <amp@ampcode.com>

- feat(agents): add AgentSession support

  Amp-Thread-ID: https://ampcode.com/threads/T-019c112e-5336-775b-920e-de056bff62a8
  Co-authored-by: Amp <amp@ampcode.com>

- feat(codegen): emit arktype schemas instead of zod

  - renamed graphqlTypeToZod → graphqlTypeToArktype in types.ts
  - updated generate-commands.ts to emit arktype syntax
  - created arktype-config.ts to extend ArkEnv.meta with positional
  - updated contract.test.ts with safeParse helper for migration
  - regenerated all CLI entity files with arktype schemas

  task 0050.1, 0050.2 complete

  Amp-Thread-ID: https://ampcode.com/threads/T-019c2f24-4a56-76ae-95fd-1b4d4fbc0ca0
  Co-authored-by: Amp <amp@ampcode.com>

- feat(initiatives): add initiative read-only support

  Amp-Thread-ID: https://ampcode.com/threads/T-019c1108-671b-710f-9ed0-080b637abf78
  Co-authored-by: Amp <amp@ampcode.com>

- feat(roadmaps): add roadmap read-only support

  Amp-Thread-ID: https://ampcode.com/threads/T-019c110c-db5a-7036-b0ce-0a0ebe0440c6
  Co-authored-by: Amp <amp@ampcode.com>

- feat(view): add --preferences flag for view preferences

  Amp-Thread-ID: https://ampcode.com/threads/T-019c1119-5cce-7063-af5d-45f7bdb63063
  Co-authored-by: Amp <amp@ampcode.com>

- feat(git-automation): add GitAutomationTargetBranch support

  Amp-Thread-ID: https://ampcode.com/threads/T-019c112b-50c6-712d-94a4-52248737d592
  Co-authored-by: Amp <amp@ampcode.com>

- feat(team): enhance team entity CLI with verbose mode

  Amp-Thread-ID: https://ampcode.com/threads/T-019c10fd-9020-775d-a058-745d20e6fa91
  Co-authored-by: Amp <amp@ampcode.com>

### Patch Changes

- refactor(cli): remove zod dependency, migrate remaining routers to arktype

  - migrate 8 hand-crafted routers from zod to arktype:
    users, notifications, agent-sessions, roadmaps,
    initiatives, views, git-automation-states, git-automation-target-branches
  - remove zod from packages/cli/package.json
  - flatten .merge(outputOptions) to inline fields in arktype schemas
  - all typecheck and tests pass

  task 0050.4 complete

  Amp-Thread-ID: https://ampcode.com/threads/T-019c2fe3-854e-720f-823c-61084b29c969
  Co-authored-by: Amp <amp@ampcode.com>

- refactor(codegen): use shared resolvers in project generator

  update handleCreateProject and handleUpdateProject to use resolveAssignee
  and resolveTeamByKey from @bdsqqq/lnr-core instead of inline resolution.

  adds support for --lead, --startDate, --targetDate, --content, --priority
  in project create command.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c0a11-048c-71cf-9832-4d1122c05fb9
  Co-authored-by: Amp <amp@ampcode.com>

- refactor(codegen): use shared resolvers in doc generator

  update handleListDocs and handleCreateDoc to use resolveProjectByName
  from @bdsqqq/lnr-core instead of passing project name directly as ID.

  users can now filter docs by project name: lnr docs --project MyProject

  Amp-Thread-ID: https://ampcode.com/threads/T-019c0a11-048c-71cf-9832-4d1122c05fb9
  Co-authored-by: Amp <amp@ampcode.com>

- docs: add e2e bench script and document test infrastructure

  bench-lnr-overhead.ts decomposes per-call cost into subprocess startup,
  module loading, and API latency. baseline: ~300ms module loading + ~300ms
  API per call. compiling saves only ~38ms/call — the bottleneck is
  sequential API round-trips, not subprocess overhead.

  AGENTS.md updated with e2e test docs, benchmarking section, and
  LNR_CONFIG_PATH config isolation docs.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c3849-f59d-72bc-82ec-90719cbe6994
  Co-authored-by: Amp <amp@ampcode.com>

- fix(ci): add missing zod dep, isolate config tests, cleanup sandbox org

  - add zod to cli deps (peer dep of trpc-cli, imported by generated code)
  - add LNR_CONFIG_PATH env override for test isolation
  - add cleanupPreviousRuns() to e2e mutations (deletes leftover teams/projects/views)

  Amp-Thread-ID: https://ampcode.com/threads/T-019c3849-f59d-72bc-82ec-90719cbe6994
  Co-authored-by: Amp <amp@ampcode.com>

- fix(notifications): use mutation for notification command

  The notification singular command has mutation operations (--read,
  --archive) and a positional arg. Using .query() meant trpc-cli might
  not route the positional arg correctly.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c666c-2268-775e-970f-dd3a221d8527
  Co-authored-by: Amp <amp@ampcode.com>

- refactor(cli): remove dead handleBranch from hand-crafted

  Amp-Thread-ID: https://ampcode.com/threads/T-019c4482-ebe0-71cc-940c-8fa2256f639f
  Co-authored-by: Amp <amp@ampcode.com>

- fix: procedure can be fn too
- chore: merge origin/main into schema-codegen

  Amp-Thread-ID: https://ampcode.com/threads/T-019c062e-1179-72dd-ab35-7f44cb6f8e11
  Co-authored-by: Amp <amp@ampcode.com>

- fix(cycles): remove unused outputOptions variable

  Amp-Thread-ID: https://ampcode.com/threads/T-019c666c-2268-775e-970f-dd3a221d8527
  Co-authored-by: Amp <amp@ampcode.com>

- refactor(codegen): consolidate generators into single file

  replaced 4 entity-specific generators with unified generate-commands.ts.
  shared types extracted to types.ts. entity configs drive generation
  instead of duplicated logic per file.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c0a99-51c8-7128-b3c9-16e991924210
  Co-authored-by: Amp <amp@ampcode.com>

- fix(subscriptions): auto-find user subscription for --unsubscribe

  task 0038: --unsubscribe now auto-finds user's existing subscription for
  the target entity instead of requiring subscription id as argument.

  - add findUserSubscription() to core - queries notificationSubscriptions
    and matches by entity type/id
  - update project and initiative commands to use auto-find
  - change --unsubscribe from string to boolean flag
  - add e2e test for project unsubscribe

  Amp-Thread-ID: https://ampcode.com/threads/T-019c2e5f-df5d-713c-bbe0-b6ff8cadfe80
  Co-authored-by: Amp <amp@ampcode.com>

- fix(codegen): regenerate with renderer imports, restore missing flags

  codegen now emits adapter/renderer imports for show handlers.
  restores --branch, --pr, --prioritySortOrder flags for issue.
  wires --priority and --cycle list filters. migrates template.ts
  from zod to arktype. passes listProjects team/status filters.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c3a42-917f-71b8-b4d2-f6889accd4ef
  Co-authored-by: Amp <amp@ampcode.com>

- fix(codegen): restore ProjectMilestone scoped entity

  uses listMilestones (which exists in core) instead of getProjectMilestones.
  adds --milestones flag handler to generateProjectShowHandler.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c2edb-6bdb-7358-a556-fa0042d39805
  Co-authored-by: Amp <amp@ampcode.com>

- refactor(cli): migrate hand-crafted routers from zod to arktype

  - auth, config, search, teams, cycles, me routers now use arktype
  - updated contract.test.ts to use safeParse() helper for all schemas
  - task 0050.3 complete

  Amp-Thread-ID: https://ampcode.com/threads/T-019c2fdf-faee-77ba-af88-cb4891da376b
  Co-authored-by: Amp <amp@ampcode.com>

- refactor(codegen): use shared resolvers in label generator

  update handleListLabels and handleCreateLabel to use resolveTeamByKey
  from @bdsqqq/lnr-core instead of inline team resolution.

  resolver throws TeamNotFoundError with available teams on failure.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c0a11-048c-71cf-9832-4d1122c05fb9
  Co-authored-by: Amp <amp@ampcode.com>

- fix(subscriptions): use camelCase for notification types, split e2e tests

  - notificationSubscriptionTypes must use camelCase (issueCreated not issuecreated)
  - Linear API validates case-sensitively
  - split e2e tests: e2e-readonly.test.ts (safe), e2e-mutations.test.ts (sandbox only)
  - fix dev script to load .env from workspace root
  - task 0037 complete

  Amp-Thread-ID: https://ampcode.com/threads/T-019c2e43-70aa-701b-9a7e-9dafc7cd3897
  Co-authored-by: Amp <amp@ampcode.com>

- fix(codegen): archive runs after updates, doc --project accepts name or id, prune unused imports

  - inferOperation: archive + mutation flags routes to update (archive at end)
  - doc --project: try resolveProjectByName, fall back to raw id
  - generator builds import lists dynamically from handler code usage

  Amp-Thread-ID: https://ampcode.com/threads/T-019c4482-ebe0-71cc-940c-8fa2256f639f
  Co-authored-by: Amp <amp@ampcode.com>

- refactor(cli): replace as unknown cast with runtime type guard in command introspection

  Amp-Thread-ID: https://ampcode.com/threads/T-019c4482-ebe0-71cc-940c-8fa2256f639f
  Co-authored-by: Amp <amp@ampcode.com>

- test(cli): property-based tests for inferOperation dispatch (A/B/C)

  property A: dispatch determinism — inferOperation returns valid operation
  for 200 random inputs across all 8 commands, deterministically
  property B: precedence under contradictory flags — create > delete/archive

  > mutation > read. cycle --current has highest precedence (above new).
  > view --preferences is below delete, not highest.
  > property C: mutation flag completeness — every mutationFlags entry triggers
  > 'update' when set alone, non-mutation flags don't

  65 tests, 4150 assertions, seeded PRNG (mulberry32, PROP_TEST_SEED env var)

  tasks 0070, 0071, 0072

  Amp-Thread-ID: https://ampcode.com/threads/T-019c3a76-7c6c-73ff-9c5d-eb4b0fc87ea0
  Co-authored-by: Amp <amp@ampcode.com>

- fix(cli): empty lists output gracefully instead of exiting non-zero

  Remove exitWithError checks for empty list results in views, cycles,
  git-automation-states, and git-automation-target-branches. The existing
  output functions already handle empty arrays (table prints 'no results',
  json outputs [], quiet outputs nothing).

  Amp-Thread-ID: https://ampcode.com/threads/T-019c6683-6425-7703-907e-7295a4179893
  Co-authored-by: Amp <amp@ampcode.com>

- chore: cleanup after merge - add --branch/--pr, convert docs to ADRs, remove ralph files

  Amp-Thread-ID: https://ampcode.com/threads/T-019c062e-1179-72dd-ab35-7f44cb6f8e11
  Co-authored-by: Amp <amp@ampcode.com>

- test(cli): property tests D/E/F with mock.module (dispatch effects)

  property D: flag→payload effect — title, description, priority, state
  flags map to correct updateIssue payload fields
  property E: resolver call discipline — each flag calls only its own
  resolver (getTeamStates for state, getTeamLabels for label, etc.)
  property F: output-format equivalence — json/quiet/table all receive
  same entity set from listIssues

  uses bun mock.module() to intercept @bdsqqq/lnr-core + output modules.
  no DI refactor needed.

  tasks 0073, 0074, 0075

  Amp-Thread-ID: https://ampcode.com/threads/T-019c3a76-7c6c-73ff-9c5d-eb4b0fc87ea0
  Co-authored-by: Amp <amp@ampcode.com>

- docs(bench): add verified CI timing data

  mutation tests: 42s for 32 tests (range 575ms-4000ms per test).
  local bench only measured per-call overhead — CI timing captures
  the full picture including API latency variance by endpoint.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c3849-f59d-72bc-82ec-90719cbe6994
  Co-authored-by: Amp <amp@ampcode.com>

- chore(codegen): remove obsolete cli-spec and contract-test scripts

  scripts referenced deleted router files from pre-migration.
  extract-cli-spec.ts and generate-contract-tests.ts no longer needed
  since generated commands replaced hand-coded routers.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c0a99-51c8-7128-b3c9-16e991924210
  Co-authored-by: Amp <amp@ampcode.com>

- fix(cli): update branch name limit to 244 chars with validation

  github limits refs to 255 bytes (244 after refs/heads/). was truncating
  at 50 chars — now uses full allowance. exits with clear error if branch
  name exceeds limit instead of silent truncation.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c0a99-51c8-7128-b3c9-16e991924210
  Co-authored-by: Amp <amp@ampcode.com>

- refactor(codegen): update issue generator to use shared resolvers

  Amp-Thread-ID: https://ampcode.com/threads/T-019c0649-4de7-75a4-a9e3-41d27762f791
  Co-authored-by: Amp <amp@ampcode.com>

- docs(adr): add ADR-0007 entity-config v2 exploration

  documents the pattern problem found during hiatus recovery:

  - flag entities were manually edited into generated files
  - this violated ADR-0001 architecture

  proposes arktype-based DSL for entity definitions with four exposure types:

  - command: standalone CRUD commands
  - flag: injected flags (--react, --subscribe)
  - scoped: parent-accessed entities (--updates, --labels)
  - subcommand: nested commands (issue batch)

  also regenerates output files with new generator.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c2edb-6bdb-7358-a556-fa0042d39805
  Co-authored-by: Amp <amp@ampcode.com>

- refactor(cli): output rendering architecture with adapters and renderers

  extract comment rendering into renderers/comments.ts, add generic
  detail renderer in renderers/detail.ts, create entity adapters for
  issue/project/label/doc. restores full issue show UX with threaded
  comments, descriptions, and graceful error handling.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c3a42-917f-71b8-b4d2-f6889accd4ef
  Co-authored-by: Amp <amp@ampcode.com>

- fix(ci): use env var for e2e org confirmation, add timeout

  bun test strips unknown CLI flags from process.argv, so the
  --operating-on-this-org flag never reached the test file. the test
  fell through to the interactive readline prompt and hung for 6 hours.

  switched to LNR_E2E_CONFIRM_ORG env var. added 10-minute timeout to
  the e2e job as a safety net.

  Amp-Thread-ID: https://ampcode.com/threads/T-019c3849-f59d-72bc-82ec-90719cbe6994
  Co-authored-by: Amp <amp@ampcode.com>

- refactor(codegen): export operationSpec from all command files

  export inferOperation, mutationFlags, operations, and operationSpec from
  generated (issue, project, label, doc) and hand-crafted (cycles, views,
  git-automation-states, git-automation-target-branches) command files.

  adds OperationSpec<Input, Op> type and AnyOperationSpec for the registry.
  allOperationSpecs in operation-specs.ts collects all 8 specs for tests.

  task 0068

  Amp-Thread-ID: https://ampcode.com/threads/T-019c3a76-7c6c-73ff-9c5d-eb4b0fc87ea0
  Co-authored-by: Amp <amp@ampcode.com>

- chore(cli): remove standalone milestone command

  Amp-Thread-ID: https://ampcode.com/threads/T-019c10a3-2aad-709a-a9f8-54f4abb1a51e
  Co-authored-by: Amp <amp@ampcode.com>

- test(e2e): add e2e tests for entity expansion (37 pass, 1 skip)

  - creates sandbox team, exercises all CRUD operations, deletes team
  - skipped: project --subscribe (notificationSubscriptionTypes needs schema derivation)
  - added bugs 0037, 0038 to todo

  Amp-Thread-ID: https://ampcode.com/threads/T-019c1144-4c4d-73c8-9c41-93e55f73bc4b
  Co-authored-by: Amp <amp@ampcode.com>

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
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @bdsqqq/lnr-core@2.0.0

## 1.6.0

### Minor Changes

- feat(cli): add --branch flag to get git branch name for issues (#17)

### Patch Changes

- Updated dependencies
  - @bdsqqq/lnr-core@1.6.0

## 1.5.0

### Minor Changes

- feat(cli): add --pr flag to link github prs to issues

  Amp-Thread-ID: https://ampcode.com/threads/T-019c0090-a552-74b8-9fab-76e806e9bc3a
  Co-authored-by: Amp <amp@ampcode.com>

- feat(cli): add --pr flag to link github prs to issues (#16)

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @bdsqqq/lnr-core@1.5.0

## 1.4.0

### Minor Changes

- feat(cli): add --project flag to issue new command (#15)
- feat(cli): add --project flag to issue new command

  Allows assigning issues to a project when creating them:
  lnr issue new --team ENG --title "fix auth" --project "Frontend Support"

  Amp-Thread-ID: https://ampcode.com/threads/T-019c0086-59f7-750c-a784-d96f90fc91a2
  Co-authored-by: Amp <amp@ampcode.com>

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @bdsqqq/lnr-core@1.4.0

## 1.3.1

### Patch Changes

- fix(cli): allow composing comment/reaction ops with field updates (#14)

  refactor handleUpdateIssue from early-return to collect-then-execute pattern:

  - move validation for required flags (--text, --emoji) to top
  - add mutual exclusivity checks for comment and reaction operations
  - execute in order: field updates → relations → comments → reactions → archive
  - archive runs last since it restricts further edits

  fixes #13

  Amp-Thread-ID: https://ampcode.com/threads/T-019bfb89-3044-714a-9ac5-0abf94274059

  Co-authored-by: Amp <amp@ampcode.com>

## 1.3.0

### Minor Changes

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
- feat(cli): add flag descriptions for --help output

  Amp-Thread-ID: https://ampcode.com/threads/T-019b9a39-25c4-76db-99bc-777d8196b87c
  Co-authored-by: Amp <amp@ampcode.com>

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

- feat(cli): add 's' alias for search command (#11)

### Patch Changes

- fix: address review feedback

  - labels.ts: add null check on team before accessing team.labels()
  - issues.ts: error when --edit-comment/--reply-to missing --text
  - issues.ts: error when --react missing --emoji
  - issues.ts: remove redundant --open handling in handleUpdateIssue

  Amp-Thread-ID: https://ampcode.com/threads/T-019b99e2-192e-7545-be0c-4b7ec9df12c5
  Co-authored-by: Amp <amp@ampcode.com>

- refactor(cli): migrate from commander+arktype to trpc-cli+zod (#8)
- chore: add changeset
- refactor(cli): migrate from commander+arktype to trpc-cli+zod

  - replace commander with trpc-cli for CLI argument parsing
  - replace arktype with zod v4 for input validation
  - use zod .meta({positional: true}) for positional args
  - restructure commands/ → router/ with tRPC router pattern
  - optional positionals now work correctly (auth apiKey)

  Amp-Thread-ID: https://ampcode.com/threads/T-019b99be-3d13-702d-99cd-55543905568c
  Co-authored-by: Amp <amp@ampcode.com>

- chore(release): version packages
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
- fix(security): use spawn with args array instead of exec for --open

  prevents command injection via malicious issue.url
  also adds cross-platform support (open/xdg-open/start)

  Amp-Thread-ID: https://ampcode.com/threads/T-019b99e2-192e-7545-be0c-4b7ec9df12c5
  Co-authored-by: Amp <amp@ampcode.com>

- fix: address round 3 review feedback

  - comments.ts: add try/catch to getIssueComments for consistency
  - docs.ts: refactor to single outer try-catch matching labels.ts pattern
  - docs.ts: error on failed create instead of silent fallback

  Amp-Thread-ID: https://ampcode.com/threads/T-019b99e2-192e-7545-be0c-4b7ec9df12c5
  Co-authored-by: Amp <amp@ampcode.com>

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
- Updated dependencies
  - @bdsqqq/lnr-core@1.3.0

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
