# lnr

## commands

```bash
# typecheck all packages
bun run check

# run tests in all packages
bun run test

# run cli in dev mode
bun run dev

# build binary
bun run build

# run cli directly
bun run --cwd packages/cli src/cli.ts
```

## project structure

```
packages/
  core/                 # @bdsqqq/lnr-core - business logic
    src/
      index.ts          # exports all operations
      client.ts         # LinearClient wrapper
      config.ts         # config file management
      types.ts          # shared types
      issues.ts         # issue operations
      projects.ts       # project operations
      teams.ts          # team operations
      cycles.ts         # cycle operations
      me.ts             # user operations
      search.ts         # search operations
      *.test.ts         # colocated tests
  cli/                  # @bdsqqq/lnr-cli - presentation layer
    src/
      cli.ts            # entry point, commander setup
      commands/         # one file per command group
      lib/
        output.ts       # formatting (table, json, quiet)
        error.ts        # error handling
```

## conventions

- use @linear/sdk for all API calls
- error messages: lowercase, direct, include fix suggestion
- no emojis, minimal colors (red for errors, dim for secondary info)
- all commands async/await, handle errors at command level
- config stored in ~/.lnr/config.json
- business logic in @bdsqqq/lnr-core, CLI wrappers in @bdsqqq/lnr-cli
- tests colocated with source files (*.test.ts)

## spec

see SPEC.md for full CLI syntax and behavior
