---
name: linear
description: interact with Linear via lnr CLI
---
# lnr

query and update Linear from the terminal. covers issues, projects, cycles, and teams.

## issues

```bash
lnr issues --assignee @me              # my issues
lnr issues --assignee @me --state "In Progress"
lnr issues --team AXM --assignee @me   # scoped to team
lnr issue AXM-1234                     # show details
lnr issue AXM-1234 --open              # open in browser
lnr issue AXM-1234 --state "Done"      # update state
lnr issue AXM-1234 --assignee @me      # assign
lnr issue AXM-1234 --priority high     # set priority (urgent, high, medium, low)
lnr issue AXM-1234 --comment "note"    # add comment
lnr issue AXM-1234 --label +bug        # add label
lnr issue AXM-1234 --label -bug        # remove label
lnr issue new --team AXM --title "title" --description "desc"
lnr search "query"                     # search issues
lnr search "query" --team AXM          # scoped search
```

## projects

```bash
lnr projects                           # list all
lnr project "Project Name"             # show details
lnr project "Project Name" --issues    # list project issues
lnr project new --name "name" --team AXM --description "desc"
lnr project "Project Name" --delete    # archive project
```

## cycles

```bash
lnr cycles --team AXM                  # list team cycles
lnr cycle --team AXM --current         # current active cycle
lnr cycle --team AXM --current --issues  # issues in current cycle
```

## teams

```bash
lnr teams                              # list teams
lnr team AXM                           # team details
lnr me                                 # current user
```

## rules

- always specify `--team` when user context implies a specific team
- use `--json` or `--quiet` when parsing output programmatically
- issue IDs follow pattern `TEAM-####` (e.g., AXM-1234)
- state names are case-sensitive strings from Linear (e.g., "In Progress", "Done", "Backlog")
