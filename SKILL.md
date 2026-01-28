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
lnr issues --team ENG --assignee @me   # scoped to team
lnr issues --label bug                 # filter by label
lnr issues --project "Q1 Launch"       # filter by project
lnr issues --verbose                   # show all columns
lnr issue ENG-123                      # show details
lnr issue ENG-123 --open               # open in browser
lnr issue ENG-123 --branch             # output git branch name
lnr issue ENG-123 --state "Done"       # update state
lnr issue ENG-123 --assignee @me       # assign
lnr issue ENG-123 --priority high      # set priority (urgent, high, medium, low, none)
lnr issue ENG-123 --comment "note"     # add comment
lnr issue ENG-123 --comments           # list comments
lnr issue ENG-123 --reply-to <id> --text "reply"  # reply to comment
lnr issue ENG-123 --edit-comment <id> --text "updated"
lnr issue ENG-123 --delete-comment <id>
lnr issue ENG-123 --react <id> --emoji "👍"
lnr issue ENG-123 --label +bug         # add label
lnr issue ENG-123 --label -bug         # remove label
lnr issue ENG-123 --project "Q1 Launch"  # add to project
lnr issue ENG-123 --blocks ENG-456     # add blocks relation
lnr issue ENG-123 --blocked-by ENG-456 # add blocked-by relation
lnr issue ENG-123 --relates-to ENG-456 # add relates-to relation
lnr issue ENG-123 --parent ENG-100     # set parent issue
lnr issue ENG-123 --sub-issues         # list sub-issues
lnr issue ENG-123 --pr "https://github.com/org/repo/pull/1"  # link PR
lnr issue ENG-123 --archive            # archive issue
lnr issue new --team ENG --title "title" --description "desc"
lnr issue new --team ENG --title "fix" --assignee @me --label bug --priority urgent
lnr search "query"                     # search issues
lnr search "query" --team ENG          # scoped search
```

## git workflow

```bash
git checkout -b $(lnr issue ENG-123 --branch)  # checkout branch for issue
```

## projects

```bash
lnr projects                           # list all
lnr projects --team ENG                # filter by team
lnr projects --status active           # filter by status
lnr projects --verbose                 # show all columns
lnr project "Project Name"             # show details
lnr project "Project Name" --issues    # list project issues
lnr project new --project-name "name" --team ENG --description "desc"
lnr project "Project Name" --delete    # archive project
```

## cycles

```bash
lnr cycles --team ENG                  # list team cycles
lnr cycle --team ENG --current         # current active cycle
lnr cycle --team ENG --current --issues  # issues in current cycle
```

## teams & user

```bash
lnr teams                              # list teams
lnr team ENG                           # team details
lnr team ENG --members                 # list team members
lnr me                                 # current user
lnr me --issues                        # issues assigned to me
lnr me --created                       # issues created by me
lnr me --activity                      # recent activity
```

## labels

```bash
lnr labels                             # list all labels
lnr labels --team ENG                  # filter by team
lnr label <id>                         # show label details
lnr label new --team ENG --name "bug" --color "#ff0000"
lnr label <id> --name "critical" --color "#ff0000"  # update
lnr label <id> --delete                # delete label
```

## documents

```bash
lnr docs                               # list documents
lnr docs --project <id>                # filter by project
lnr doc <id>                           # show document
lnr doc new --title "spec" --content "..."
lnr doc new --title "spec" --project <id>
lnr doc <id> --title "updated" --content "..."  # update
lnr doc <id> --delete                  # delete document
```

## aliases

```bash
lnr i         # lnr issues
lnr t         # lnr teams
lnr p         # lnr projects
lnr c         # lnr cycles
lnr s         # lnr search
```

## rules

- always specify `--team` when user context implies a specific team
- use `--json` or `--quiet` when parsing output programmatically
- issue IDs follow pattern `TEAM-####` (e.g., ENG-123)
- state names are case-sensitive strings from Linear (e.g., "In Progress", "Done", "Backlog")
