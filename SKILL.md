---
name: linear
description: interact with Linear via lnr CLI
---
# lnr

query and update Linear from the terminal. covers issues, projects, cycles, teams, docs, and labels.

## issues

```bash
lnr issues  # list all
lnr issues --team AXM  # filter by team
lnr issues --assignee @me  # my items
lnr issues --state "In Progress"  # filter by state
lnr issue AXM-1234  # show details
lnr issue AXM-1234 --open  # open in browser
lnr issue AXM-1234 --state "Done"  # update state
lnr issue AXM-1234 --assignee @me  # assign to self
lnr issue AXM-1234 --priority high  # set priority
lnr issue AXM-1234 --comment "note"  # add comment
lnr issue AXM-1234 --label +bug  # add label
lnr issue AXM-1234 --label -bug  # remove label
lnr issue AXM-1234 --branch  # git branch name
lnr issue AXM-1234 --pr "https://..."  # link PR
lnr issue new --team AXM --title "title" --description "desc"  # create
lnr issue AXM-1234 --archive  # archive
```

## projects

```bash
lnr projects  # list all
lnr projects --team AXM  # filter by team
lnr project "Project Name"  # show details
lnr project "Project Name" --issues  # list project issues
lnr project new --team AXM --projectName "name"  # create
lnr project "Project Name" --delete  # delete
```

## docs

```bash
lnr docs  # list all
lnr doc "Doc Title"  # show details
lnr doc new --title "title" --content "..."  # create
lnr doc "Doc Title" --delete  # delete
```

## labels

```bash
lnr labels  # list all
lnr labels --team AXM  # filter by team
lnr label "bug"  # show details
lnr label new --team AXM --name "label" --color "#ff0000"  # create
lnr label "bug" --delete  # delete
```

## cycles

```bash
lnr cycles --team AXM  # list team cycles
lnr cycle --team AXM --current  # current active cycle
lnr cycle --team AXM --current --issues  # issues in current cycle
```

## teams

```bash
lnr teams  # list teams
lnr team AXM  # team details
lnr me  # current user
```

## rules

- always specify `--team` when user context implies a specific team
- use `--json` or `--quiet` when parsing output programmatically
- issue IDs follow pattern `TEAM-####` (e.g., AXM-1234)
- state names are case-sensitive strings from Linear (e.g., "In Progress", "Done", "Backlog")
- operation is inferred from flags: no flags → READ, mutation flags → UPDATE, `new` → CREATE, `--archive`/`--delete` → DELETE
