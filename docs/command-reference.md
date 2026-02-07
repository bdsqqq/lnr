# lnr command reference

generated for UX review. each row = one valid invocation.

| command | description |
|---------|-------------|
| `lnr auth [apiKey]` | authenticate with Linear API |
| `lnr auth [apiKey] --logout` | clear stored credentials |
| `lnr auth [apiKey] --whoami` | show current authenticated user |
| `lnr config get <key>` | get a config value |
| `lnr config set <key> <value>` | set a config value |
| `lnr config list` | view and manage configuration |
| `lnr cycles` | list cycles for a team (alias: c) |
| `lnr cycles --team <string>` | team key |
| `lnr cycles --json` | output as json |
| `lnr cycles --quiet` | output ids only |
| `lnr cycles --verbose` | show all columns |
| `lnr cycle <nameOrNumber>` | show, create, update, or archive a cycle |
| `lnr cycle <nameOrNumber> --team <string>` | team key |
| `lnr cycle <nameOrNumber> --current` | show current active cycle |
| `lnr cycle <nameOrNumber> --delete` | archive the cycle |
| `lnr cycle <nameOrNumber> --description <string>` | cycle description |
| `lnr cycle <nameOrNumber> --ends-at <string>` | end date (ISO format) |
| `lnr cycle <nameOrNumber> --issues` | list issues in cycle |
| `lnr cycle <nameOrNumber> --json` | output as json |
| `lnr cycle <nameOrNumber> --name <string>` | cycle name |
| `lnr cycle <nameOrNumber> --quiet` | output ids only |
| `lnr cycle <nameOrNumber> --starts-at <string>` | start date (ISO format) |
| `lnr cycle <nameOrNumber> --verbose` | show all columns |
| `lnr views` | list custom views (alias: v) |
| `lnr views --json` | output as json |
| `lnr views --quiet` | output ids only |
| `lnr views --verbose` | show all columns |
| `lnr view <nameOrId>` | show, create, update, or delete a custom view |
| `lnr view <nameOrId> --color <string>` | view color |
| `lnr view <nameOrId> --delete` | delete the view |
| `lnr view <nameOrId> --description <string>` | view description |
| `lnr view <nameOrId> --icon <string>` | view icon |
| `lnr view <nameOrId> --json` | output as json |
| `lnr view <nameOrId> --name <string>` | view name |
| `lnr view <nameOrId> --preferences` | show view preferences |
| `lnr view <nameOrId> --quiet` | output ids only |
| `lnr view <nameOrId> --shared` | make view shared |
| `lnr view <nameOrId> --verbose` | show all columns |
| `lnr docs` | list docs |
| `lnr docs --json` | output as json |
| `lnr docs --project <string>` | filter by project id |
| `lnr docs --quiet` | output ids only |
| `lnr docs --verbose` | show all columns |
| `lnr doc <id>` | show or update a doc, or create with 'new' |
| `lnr doc <id> --content <string>` | document content |
| `lnr doc <id> --delete` | delete the document |
| `lnr doc <id> --json` | output as json |
| `lnr doc <id> --project <string>` | project id to attach document to |
| `lnr doc <id> --quiet` | output ids only |
| `lnr doc <id> --title <string>` | document title (required for new) |
| `lnr doc <id> --verbose` | show all columns |
| `lnr issues` | list issues (alias: i) |
| `lnr issues --assignee <string>` | filter by assignee email or @me |
| `lnr issues --cycle <string>` | filter by cycle |
| `lnr issues --json` | output as json |
| `lnr issues --label <string>` | filter by label name |
| `lnr issues --priority <string>` | filter by priority |
| `lnr issues --project <string>` | filter by project name |
| `lnr issues --quiet` | output ids only |
| `lnr issues --state <string>` | filter by state name |
| `lnr issues --team <string>` | filter by team key |
| `lnr issues --verbose` | show all columns |
| `lnr issue <idOrNew>` | show or update a issue, or create with 'new' |
| `lnr issue <idOrNew> --archive` | archive the issue |
| `lnr issue <idOrNew> --assignee <string>` | set assignee by email or @me |
| `lnr issue <idOrNew> --blocked-by <string>` | add blocked-by relation to issue |
| `lnr issue <idOrNew> --blocks <string>` | add blocks relation to issue |
| `lnr issue <idOrNew> --branch` | output a git-friendly branch name |
| `lnr issue <idOrNew> --comment <string>` | add comment to issue |
| `lnr issue <idOrNew> --comments` | list comments on issue |
| `lnr issue <idOrNew> --cycle <string>` | set cycle |
| `lnr issue <idOrNew> --delete-comment <string>` | comment id to delete |
| `lnr issue <idOrNew> --description <string>` | The issue description in markdown format. |
| `lnr issue <idOrNew> --due-date <string>` | set due date (YYYY-MM-DD) |
| `lnr issue <idOrNew> --edit-comment <string>` | comment id to edit (requires --text) |
| `lnr issue <idOrNew> --emoji <string>` | emoji for --react |
| `lnr issue <idOrNew> --estimate <number>` | set estimate points |
| `lnr issue <idOrNew> --json` | output as json |
| `lnr issue <idOrNew> --label <string>` | set label (+name to add, -name to remove) |
| `lnr issue <idOrNew> --milestone <string>` | set milestone name (requires --project) |
| `lnr issue <idOrNew> --open` | open issue in browser |
| `lnr issue <idOrNew> --parent <string>` | set parent issue identifier |
| `lnr issue <idOrNew> --pr <string>` | link a GitHub PR URL to the issue |
| `lnr issue <idOrNew> --priority <string>` | set priority (urgent, high, medium, low, none) |
| `lnr issue <idOrNew> --priority-sort-order <number>` | The position of the issue related to other issues, when ordered by priority. |
| `lnr issue <idOrNew> --project <string>` | set project name |
| `lnr issue <idOrNew> --react <string>` | entity id to add reaction (requires --emoji) |
| `lnr issue <idOrNew> --relates-to <string>` | add relates-to relation to issue |
| `lnr issue <idOrNew> --reply-to <string>` | comment id to reply to (requires --text) |
| `lnr issue <idOrNew> --state <string>` | set workflow state |
| `lnr issue <idOrNew> --sub-issues` | list sub-issues |
| `lnr issue <idOrNew> --subscribe` | subscribe to issue notifications |
| `lnr issue <idOrNew> --team <string>` | team key (required for new) |
| `lnr issue <idOrNew> --text <string>` | text for --edit-comment or --reply-to |
| `lnr issue <idOrNew> --title <string>` | The issue title. |
| `lnr issue <idOrNew> --unreact <string>` | reaction id to remove |
| `lnr issue <idOrNew> --unsubscribe` | unsubscribe from issue notifications |
| `lnr issue batch <issues>` | batch update multiple issues at once |
| `lnr issue batch <issues> --assignee <string>` | set assignee by email or @me for all issues |
| `lnr issue batch <issues> --json` | output as json |
| `lnr issue batch <issues> --label <string>` | set label for all issues (+name to add) |
| `lnr issue batch <issues> --priority <string>` | set priority for all issues (urgent, high, medium, low, none) |
| `lnr issue batch <issues> --quiet` | output ids only |
| `lnr issue batch <issues> --state <string>` | set workflow state for all issues |
| `lnr projects` | list projects (alias: p) |
| `lnr projects --json` | output as json |
| `lnr projects --quiet` | output ids only |
| `lnr projects --status <string>` | filter by status (planned, started, completed, etc) |
| `lnr projects --team <string>` | filter by team key |
| `lnr projects --verbose` | show all columns |
| `lnr project <name>` | show or update a project, or create with 'new' |
| `lnr project <name> --content <string>` | set project content as markdown |
| `lnr project <name> --delete` | delete the project |
| `lnr project <name> --description <string>` | project description |
| `lnr project <name> --emoji <string>` | emoji for --react |
| `lnr project <name> --issues` | list issues in project |
| `lnr project <name> --json` | output as json |
| `lnr project <name> --labels` | list project labels |
| `lnr project <name> --lead <string>` | set lead by email or @me |
| `lnr project <name> --links` | list project external links |
| `lnr project <name> --milestones` | list project milestones |
| `lnr project <name> --new-name <string>` | new name for the project |
| `lnr project <name> --priority <number>` | set priority (0=none, 1=urgent, 2=high, 3=normal, 4=low) |
| `lnr project <name> --quiet` | output ids only |
| `lnr project <name> --react <string>` | entity id to add reaction (requires --emoji) |
| `lnr project <name> --show-status` | show project status details |
| `lnr project <name> --start-date <string>` | set start date (YYYY-MM-DD) |
| `lnr project <name> --status <string>` | set project status |
| `lnr project <name> --subscribe` | subscribe to notifications |
| `lnr project <name> --target-date <string>` | set target date (YYYY-MM-DD) |
| `lnr project <name> --team <string>` | team key to associate project with |
| `lnr project <name> --unreact <string>` | reaction id to remove |
| `lnr project <name> --unsubscribe` | unsubscribe from notifications |
| `lnr project <name> --updates` | list project updates |
| `lnr project <name> --verbose` | show all columns |
| `lnr project milestone <nameOrNew>` | create, show, update, or delete a milestone |
| `lnr project milestone <nameOrNew> --project <string>` | project name (required) |
| `lnr project milestone <nameOrNew> --delete` | delete the milestone |
| `lnr project milestone <nameOrNew> --description <string>` | milestone description |
| `lnr project milestone <nameOrNew> --json` | output as json |
| `lnr project milestone <nameOrNew> --new-name <string>` | new name for the milestone |
| `lnr project milestone <nameOrNew> --target-date <string>` | target date (YYYY-MM-DD) |
| `lnr labels` | list labels |
| `lnr labels --json` | output as json |
| `lnr labels --quiet` | output ids only |
| `lnr labels --team <string>` | filter by team key |
| `lnr labels --verbose` | show all columns |
| `lnr label <id>` | show or update a label, or create with 'new' |
| `lnr label <id> --color <string>` | hex color code |
| `lnr label <id> --delete` | delete the label |
| `lnr label <id> --description <string>` | label description |
| `lnr label <id> --json` | output as json |
| `lnr label <id> --name <string>` | label name (required for new) |
| `lnr label <id> --team <string>` | team key (required for new) |
| `lnr templates` | list templates |
| `lnr templates --json` | output as json |
| `lnr templates --quiet` | output ids only |
| `lnr templates --team <string>` | filter by team key |
| `lnr templates --type <string>` | filter by template type (issue, project) |
| `lnr templates --verbose` | show all columns |
| `lnr template <name>` | show a template |
| `lnr template <name> --json` | output as json |
| `lnr template <name> --quiet` | output ids only |
| `lnr template <name> --team <string>` | team key to scope template lookup |
| `lnr template <name> --verbose` | show all columns |
| `lnr me` | show current user info |
| `lnr me --activity` | show recent activity |
| `lnr me --created` | list issues created by me |
| `lnr me --issues` | list issues assigned to me |
| `lnr me --json` | output as json |
| `lnr me --quiet` | output ids only |
| `lnr search <query>` | search issues (alias: s) |
| `lnr search <query> --json` | output as json |
| `lnr search <query> --quiet` | output ids only |
| `lnr search <query> --team <string>` | filter by team key |
| `lnr teams` | list teams (alias: t) |
| `lnr teams --json` | output as json |
| `lnr teams --quiet` | output keys only |
| `lnr teams --verbose` | show all columns |
| `lnr team <key>` | show team details |
| `lnr team <key> --json` | output as json |
| `lnr team <key> --members` | list team members |
| `lnr team <key> --quiet` | output id only |
| `lnr team <key> --verbose` | show all columns |
| `lnr users` | list users (alias: u) |
| `lnr users --json` | output as json |
| `lnr users --quiet` | output ids only |
| `lnr users --verbose` | show all columns |
| `lnr user <nameOrEmail>` | show user details |
| `lnr user <nameOrEmail> --json` | output as json |
| `lnr user <nameOrEmail> --quiet` | output id only |
| `lnr user <nameOrEmail> --verbose` | show all columns |
| `lnr notifications` | list notifications (alias: n) |
| `lnr notifications --json` | output as json |
| `lnr notifications --quiet` | output ids only |
| `lnr notifications --unread` | show unread only |
| `lnr notifications --verbose` | show all columns |
| `lnr notification <id>` | show notification details |
| `lnr notification <id> --archive` | archive notification |
| `lnr notification <id> --json` | output as json |
| `lnr notification <id> --quiet` | output id only |
| `lnr notification <id> --read` | mark as read |
| `lnr notification <id> --verbose` | show all fields |
| `lnr initiatives` | list initiatives (alias: init) |
| `lnr initiatives --json` | output as json |
| `lnr initiatives --quiet` | output ids only |
| `lnr initiatives --verbose` | show all columns |
| `lnr initiative <nameOrId>` | show or update initiative |
| `lnr initiative <nameOrId> --emoji <string>` | emoji for --react |
| `lnr initiative <nameOrId> --json` | output as json |
| `lnr initiative <nameOrId> --links` | show initiative external links |
| `lnr initiative <nameOrId> --quiet` | output id only |
| `lnr initiative <nameOrId> --react <string>` | initiative update id to add reaction (requires --emoji) |
| `lnr initiative <nameOrId> --subscribe` | subscribe to initiative notifications |
| `lnr initiative <nameOrId> --unreact <string>` | reaction id to remove |
| `lnr initiative <nameOrId> --unsubscribe` | unsubscribe from initiative notifications |
| `lnr initiative <nameOrId> --updates` | show initiative updates |
| `lnr initiative <nameOrId> --verbose` | show all columns |
| `lnr roadmaps` | list roadmaps (alias: rm) |
| `lnr roadmaps --json` | output as json |
| `lnr roadmaps --quiet` | output ids only |
| `lnr roadmaps --verbose` | show all columns |
| `lnr roadmap <nameOrId>` | show roadmap details |
| `lnr roadmap <nameOrId> --json` | output as json |
| `lnr roadmap <nameOrId> --projects` | show roadmap projects |
| `lnr roadmap <nameOrId> --quiet` | output id only |
| `lnr roadmap <nameOrId> --verbose` | show all columns |
| `lnr git-automations` | list git automation states for a team (alias: ga) |
| `lnr git-automations --team <string>` | team key |
| `lnr git-automations --json` | output as json |
| `lnr git-automations --quiet` | output ids only |
| `lnr git-automations --verbose` | show all columns |
| `lnr git-automation <idOrEvent>` | show, create, update, or delete a git automation state |
| `lnr git-automation <idOrEvent> --team <string>` | team key |
| `lnr git-automation <idOrEvent> --branch <string>` | target branch ID |
| `lnr git-automation <idOrEvent> --delete` | delete the automation |
| `lnr git-automation <idOrEvent> --event <string>` | git event: draft, merge, mergeable, review, start |
| `lnr git-automation <idOrEvent> --json` | output as json |
| `lnr git-automation <idOrEvent> --quiet` | output ids only |
| `lnr git-automation <idOrEvent> --state <string>` | workflow state name to transition to |
| `lnr git-automation <idOrEvent> --verbose` | show all columns |
| `lnr git-branches` | list git automation target branches for a team (alias: gb) |
| `lnr git-branches --team <string>` | team key |
| `lnr git-branches --json` | output as json |
| `lnr git-branches --quiet` | output ids only |
| `lnr git-branches --verbose` | show all columns |
| `lnr git-branch <patternOrId>` | show, create, update, or delete a git automation target branch |
| `lnr git-branch <patternOrId> --team <string>` | team key |
| `lnr git-branch <patternOrId> --delete` | delete the target branch |
| `lnr git-branch <patternOrId> --json` | output as json |
| `lnr git-branch <patternOrId> --pattern <string>` | branch pattern |
| `lnr git-branch <patternOrId> --quiet` | output ids only |
| `lnr git-branch <patternOrId> --regex` | treat pattern as regex |
| `lnr git-branch <patternOrId> --verbose` | show all columns |
| `lnr agent-sessions` | list agent sessions (experimental) (alias: as) |
| `lnr agent-sessions --json` | output as json |
| `lnr agent-sessions --quiet` | output ids only |
| `lnr agent-sessions --status <string>` | filter by status (active, pending, complete, error, stale) |
| `lnr agent-sessions --verbose` | show all columns |
| `lnr agent-session <id>` | show agent session details (experimental) |
| `lnr agent-session <id> --activities` | show session activities |
| `lnr agent-session <id> --external-link <string>` | set external link url |
| `lnr agent-session <id> --json` | output as json |
| `lnr agent-session <id> --quiet` | output id only |
| `lnr agent-session <id> --verbose` | show all fields |
