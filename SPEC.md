# lnr spec

command-line interface for Linear. ships as a single binary via bun.

---

## voice and terminology

follows the [academish voice](https://inkandswitch.notion.site/Academish-Voice-0d8126b3be5545d2a21705ceedb5dd45) guidelines:

- terse, lowercase, no marketing speak
- direct commands, not suggestions ("create" not "would you like to create")
- honest error messages that describe what went wrong
- no emojis, minimal punctuation enthusiasm
- technical precision without condescension

Linear terminology preserved: issues, projects, teams, cycles, labels, milestones, states (not "statuses").

---

## authentication

```bash
# store api key (saved to ~/.lnr/config.json)
lnr auth <api-key>

# verify current auth
lnr auth --whoami

# clear stored credentials
lnr auth --logout
```

api key obtained from: https://linear.app/settings/account/security

---

## core commands

### issues

```bash
# list issues (defaults to assigned to me, open states)
lnr issues
lnr issues --team ENG
lnr issues --state "in progress"
lnr issues --assignee @me
lnr issues --label bug
lnr issues --project "q1 launch"

# show single issue (includes recent comments)
lnr issue ENG-123
lnr issue ENG-123 --json

# create issue
lnr issue new --team ENG --title "fix auth flow"
lnr issue new --team ENG --title "fix auth flow" --description "the thing is broken"
lnr issue new --team ENG --title "fix auth flow" --assignee @me --label bug --priority urgent

# update issue
lnr issue ENG-123 --state "done"
lnr issue ENG-123 --assignee alice@company.com
lnr issue ENG-123 --priority high
lnr issue ENG-123 --label +bug          # add label
lnr issue ENG-123 --label -wontfix      # remove label

# comment on issue
lnr issue ENG-123 --comment "looking into this now"

# list comments
lnr issue ENG-123 --comments

# reply to comment
lnr issue ENG-123 --reply-to <comment-id> --text "response"

# edit comment
lnr issue ENG-123 --edit-comment <comment-id> --text "updated"

# delete comment
lnr issue ENG-123 --delete-comment <comment-id>

# reactions
lnr issue ENG-123 --react <comment-id> --emoji "👍"
lnr issue ENG-123 --unreact <comment-id> --emoji "👍"

# relations
lnr issue ENG-123 --blocks ENG-456
lnr issue ENG-123 --blocked-by ENG-456
lnr issue ENG-123 --relates-to ENG-456

# sub-issues
lnr issue ENG-123 --sub-issues
lnr issue ENG-123 --parent ENG-100

# archive
lnr issue ENG-123 --archive

# open in browser
lnr issue ENG-123 --open
```

### teams

```bash
# list teams
lnr teams

# show team details
lnr team ENG
lnr team ENG --members
```

### projects

```bash
# list projects
lnr projects
lnr projects --team ENG
lnr projects --status active

# show project
lnr project "q1 launch"
lnr project "q1 launch" --issues
```

### cycles

```bash
# list cycles
lnr cycles --team ENG

# current cycle
lnr cycle --current --team ENG
lnr cycle --current --team ENG --issues
```

### me

```bash
# my assigned issues
lnr me
lnr me --issues
lnr me --created

# my activity
lnr me --activity
```

### labels

```bash
# list labels
lnr labels
lnr labels --team ENG

# show label
lnr label <id>

# create label
lnr label new --team ENG --name "bug" --color "#ff0000"

# update label
lnr label <id> --name "critical bug" --color "#ff0000"

# delete label
lnr label <id> --delete
```

### documents

```bash
# list documents
lnr docs
lnr docs --project <project-id>

# show document
lnr doc <id>

# create document
lnr doc new --title "design spec" --content "..."
lnr doc new --title "design spec" --project <project-id>

# update document
lnr doc <id> --title "updated title" --content "..."

# delete document
lnr doc <id> --delete
```

---

## output formats

```bash
# default: compact table
lnr issues

# detailed: full info per item
lnr issues --verbose

# json: machine-readable
lnr issues --json

# quiet: ids only
lnr issues --quiet
```

---

## filtering and search

```bash
# text search
lnr search "auth bug"
lnr search "auth bug" --team ENG

# filter combinations (AND logic)
lnr issues --team ENG --state "in progress" --assignee @me

```

---

## shortcuts

```bash
# aliases
lnr i           # lnr issues
lnr i new       # lnr issue new
lnr t           # lnr teams
lnr p           # lnr projects
lnr c           # lnr cycles
```

---

## configuration

stored in `~/.lnr/config.json`:

```json
{
  "api_key": "lin_api_...",
  "default_team": "ENG",
  "output_format": "table"
}
```

```bash
# set defaults
lnr config set default_team ENG
lnr config set output_format json

# view config
lnr config
lnr config get default_team
```

---

## error handling

errors are direct and actionable:

```
error: not authenticated
  run: lnr auth <api-key>

error: team "XYZ" not found
  available teams: ENG, DESIGN, OPS

error: issue ENG-999 not found

error: rate limited, retry in 30s
```

---

## exit codes

- 0: success
- 1: general error
- 2: auth error
- 3: not found
- 4: rate limited

---

## binary distribution

```bash
# build single binary
bun build ./packages/cli/src/cli.ts --compile --outfile lnr

# install globally
cp lnr /usr/local/bin/lnr
```

---

## implementation priorities

1. auth (store/verify api key)
2. issues list/show
3. issue create/update
4. teams list
5. projects list
6. cycles list
7. search

---

## dependencies

- `@linear/sdk` - official Linear TypeScript SDK
- `trpc-cli` - type-safe CLI from tRPC routers
- `@trpc/server` - tRPC server primitives
- `zod` - schema validation and CLI argument definitions
- `chalk` - terminal colors (minimal, for errors/emphasis only)

---

## non-goals (for now)

- webhooks management
- integrations setup
- organization admin operations
- oauth flow (api key only)
- tui/interactive browser (just cli commands)
