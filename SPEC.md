# linear-cli spec

a command-line interface for Linear. ships as a single binary via bun.

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
# store api key (saved to ~/.linear-cli/config.json)
li auth <api-key>

# verify current auth
li auth --whoami

# clear stored credentials
li auth --logout
```

api key obtained from: https://linear.app/settings/account/security

---

## core commands

### issues

```bash
# list issues (defaults to assigned to me, open states)
li issues
li issues --team ENG
li issues --state "in progress"
li issues --assignee @me
li issues --label bug
li issues --project "q1 launch"

# show single issue
li issue ENG-123
li issue ENG-123 --json

# create issue
li issue new --team ENG --title "fix auth flow"
li issue new --team ENG --title "fix auth flow" --description "the thing is broken"
li issue new --team ENG --title "fix auth flow" --assignee @me --label bug --priority urgent

# interactive create (prompts for required fields)
li issue new -i

# update issue
li issue ENG-123 --state "done"
li issue ENG-123 --assignee alice@company.com
li issue ENG-123 --priority high
li issue ENG-123 --label +bug          # add label
li issue ENG-123 --label -wontfix      # remove label

# comment on issue
li issue ENG-123 --comment "looking into this now"

# open in browser
li issue ENG-123 --open
```

### teams

```bash
# list teams
li teams

# show team details
li team ENG
li team ENG --members
```

### projects

```bash
# list projects
li projects
li projects --team ENG
li projects --status active

# show project
li project "q1 launch"
li project "q1 launch" --issues
```

### cycles

```bash
# list cycles
li cycles --team ENG

# current cycle
li cycle --current --team ENG
li cycle --current --team ENG --issues
```

### me

```bash
# my assigned issues
li me
li me --issues
li me --created

# my activity
li me --activity
```

---

## output formats

```bash
# default: compact table
li issues

# detailed: full info per item
li issues --verbose

# json: machine-readable
li issues --json

# quiet: ids only
li issues --quiet
```

---

## filtering and search

```bash
# text search
li search "auth bug"
li search "auth bug" --team ENG

# filter combinations (AND logic)
li issues --team ENG --state "in progress" --assignee @me

# date filters
li issues --created-after 2024-01-01
li issues --updated-after 7d    # relative: 7 days ago
```

---

## shortcuts

```bash
# aliases
li i           # li issues
li i new       # li issue new
li t           # li teams
li p           # li projects
li c           # li cycles

# quick access
li ENG-123     # li issue ENG-123 (if matches issue pattern)
```

---

## configuration

stored in `~/.linear-cli/config.json`:

```json
{
  "api_key": "lin_api_...",
  "default_team": "ENG",
  "output_format": "table"
}
```

```bash
# set defaults
li config set default_team ENG
li config set output_format json

# view config
li config
li config get default_team
```

---

## error handling

errors are direct and actionable:

```
error: not authenticated
  run: li auth <api-key>

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
bun build ./src/cli.ts --compile --outfile li

# install globally
cp li /usr/local/bin/li
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
8. interactive mode

---

## dependencies

- `@linear/sdk` - official Linear TypeScript SDK
- `commander` - CLI argument parsing
- `chalk` - terminal colors (minimal, for errors/emphasis only)

---

## non-goals (for now)

- webhooks management
- integrations setup
- organization admin operations
- oauth flow (api key only)
- tui/interactive browser (just cli commands)
