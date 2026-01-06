# lnr

command-line interface for Linear. ships as a single binary via bun.

## installation

### from github releases (recommended)

download the latest binary from [releases](https://github.com/bdsqqq/lnr/releases) and add to your PATH.

### via nix

```bash
# run directly
nix run github:bdsqqq/lnr

# install to profile
nix profile install github:bdsqqq/lnr

# in a flake (add to inputs)
inputs.lnr.url = "github:bdsqqq/lnr";
# then use: inputs.lnr.packages.${system}.default
```

### from source

```bash
bun install
bun run build
cp lnr /usr/local/bin/lnr
```

### agent skill

lnr includes an [Amp](https://ampcode.com) agent skill for AI-assisted issue management.

```bash
amp skill add bdsqqq/lnr/linear
```

then load with `linear` in any Amp session.

## usage

```bash
# authenticate
lnr auth <api-key>

# list your issues
lnr issues

# show a specific issue
lnr issue ENG-123

# create an issue
lnr issue new --team ENG --title "fix auth flow"

# update state
lnr issue ENG-123 --state "done"
```

api key from: https://linear.app/settings/account/security

## commands

- `lnr issues` - list issues
- `lnr issue <id>` - show/update issue
- `lnr issue new` - create issue
- `lnr teams` - list teams
- `lnr projects` - list projects
- `lnr cycles` - list cycles
- `lnr search <query>` - search issues
- `lnr me` - show my info

see SPEC.md for full command reference.

## development

```bash
# run in dev
bun run dev

# typecheck
bun run check
```
