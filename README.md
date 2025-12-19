# linear-cli

a command-line interface for Linear. ships as a single binary via bun.

## installation

```bash
# build the binary
bun install
bun build ./src/cli.ts --compile --outfile li

# optionally, install globally
cp li /usr/local/bin/li
```

## usage

```bash
# authenticate
li auth <api-key>

# list your issues
li issues

# show a specific issue
li issue ENG-123

# create an issue
li issue new --team ENG --title "fix auth flow"

# update state
li issue ENG-123 --state "done"
```

api key from: https://linear.app/settings/account/security

## commands

- `li issues` - list issues
- `li issue <id>` - show/update issue
- `li issue new` - create issue
- `li teams` - list teams
- `li projects` - list projects
- `li cycles` - list cycles
- `li search <query>` - search issues
- `li me` - show my info

see SPEC.md for full command reference.

## development

```bash
# run in dev
bun run src/cli.ts

# typecheck
bun run check
```
