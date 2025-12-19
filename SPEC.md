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

# show single issue
lnr issue ENG-123
lnr issue ENG-123 --json

# create issue
lnr issue new --team ENG --title "fix auth flow"
lnr issue new --team ENG --title "fix auth flow" --description "the thing is broken"
lnr issue new --team ENG --title "fix auth flow" --assignee @me --label bug --priority urgent

# interactive create (prompts for required fields)
lnr issue new -i

# update issue
lnr issue ENG-123 --state "done"
lnr issue ENG-123 --assignee alice@company.com
lnr issue ENG-123 --priority high
lnr issue ENG-123 --label +bug          # add label
lnr issue ENG-123 --label -wontfix      # remove label

# comment on issue
lnr issue ENG-123 --comment "looking into this now"

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

# date filters
lnr issues --created-after 2024-01-01
lnr issues --updated-after 7d    # relative: 7 days ago
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

# quick access
lnr ENG-123     # lnr issue ENG-123 (if matches issue pattern)
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
bun build ./src/cli.ts --compile --outfile lnr

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
