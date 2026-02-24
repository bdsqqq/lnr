---
name: linear
description: interact with Linear via lnr CLI
---
# lnr

query and update Linear from the terminal. covers issues, projects, cycles, teams, docs, and labels.

## issues

```bash
<!-- ISSUES_EXAMPLES -->
```

## projects

```bash
<!-- PROJECTS_EXAMPLES -->
```

## docs

```bash
<!-- DOCS_EXAMPLES -->
```

## labels

```bash
<!-- LABELS_EXAMPLES -->
```

## cycles

```bash
<!-- CYCLES_EXAMPLES -->
```

## teams

```bash
<!-- TEAMS_EXAMPLES -->
```

## rules

- always specify `--team` when user context implies a specific team
- use `--json` or `--quiet` when parsing output programmatically
- issue IDs follow pattern `TEAM-####` (e.g., AXM-1234)
- state names are case-sensitive strings from Linear (e.g., "In Progress", "Done", "Backlog")
- operation is inferred from flags: no flags → READ, mutation flags → UPDATE, `new` → CREATE, `--archive`/`--delete` → DELETE
