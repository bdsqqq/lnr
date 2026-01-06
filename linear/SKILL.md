---
name: linear
description: interact with Linear issues via lnr CLI
---
# lnr

query and update Linear issues from the terminal.

## common workflows

### list my issues
```bash
lnr issues --assignee @me              # all my issues
lnr issues --assignee @me --state "In Progress"
lnr issues --team AXM --assignee @me   # scoped to team
```

### view issue
```bash
lnr issue AXM-1234                     # show details
lnr issue AXM-1234 --open              # open in browser
```

### update issue
```bash
lnr issue AXM-1234 --state "In Progress"
lnr issue AXM-1234 --state "Done"
lnr issue AXM-1234 --assignee @me
lnr issue AXM-1234 --priority 2
lnr issue AXM-1234 --comment "note"
lnr issue AXM-1234 --label +bug        # add label
lnr issue AXM-1234 --label -bug        # remove label
```

### create issue
```bash
lnr issue new --team AXM --title "title" --description "desc"
```

### search
```bash
lnr search "query"                     # search all
lnr search "query" --team AXM          # scoped to team
lnr search "query" --json              # machine-readable
```

### discovery
```bash
lnr teams                              # list teams
lnr team AXM                           # team details
lnr projects                           # list projects
lnr cycles                             # list cycles
lnr me                                 # current user
```

## rules

- always specify `--team` when the user's context implies a specific team
- use `--json` or `--quiet` when parsing output programmatically
- issue IDs follow pattern `TEAM-####` (e.g., AXM-1234)
- state names are case-sensitive strings from Linear (e.g., "In Progress", "Done", "Backlog")
