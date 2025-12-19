# linear-cli

## commands

```bash
# typecheck
bun run check

# run dev
bun run src/cli.ts

# build binary
bun build ./src/cli.ts --compile --outfile li

# test (once tests exist)
bun test
```

## project structure

```
src/
  cli.ts          # entry point, commander setup
  commands/       # one file per command group
    auth.ts
    issues.ts
    teams.ts
    projects.ts
    cycles.ts
    me.ts
    search.ts
    config.ts
  lib/
    client.ts     # Linear SDK wrapper
    config.ts     # config file management
    output.ts     # formatting (table, json, quiet)
    error.ts      # error handling
```

## conventions

- use @linear/sdk for all API calls
- error messages: lowercase, direct, include fix suggestion
- no emojis, minimal colors (red for errors, dim for secondary info)
- all commands async/await, handle errors at command level
- config stored in ~/.linear-cli/config.json

## spec

see SPEC.md for full CLI syntax and behavior
