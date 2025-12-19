# linear-cli

a command-line interface for Linear. ships as a single binary via bun.

## installation

### from github releases (recommended)

download the latest binary from [releases](https://github.com/bdsqqq/linear-cli/releases) and add to your PATH.

### via nix

```bash
# run directly
nix run github:bdsqqq/linear-cli

# install to profile
nix profile install github:bdsqqq/linear-cli

# in a flake (add to inputs)
inputs.linear-cli.url = "github:bdsqqq/linear-cli";
# then use: inputs.linear-cli.packages.${system}.default
```

once published to nixpkgs:
```bash
nix-env -iA nixpkgs.lnr
# or in configuration.nix
environment.systemPackages = [ pkgs.lnr ];
```

### from source

```bash
bun install
bun run build
cp lnr /usr/local/bin/lnr
```

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
bun run src/cli.ts

# typecheck
bun run check
```
