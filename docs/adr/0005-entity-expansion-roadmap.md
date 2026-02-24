# ADR-0005: entity expansion roadmap

## status

proposed

## context

lnr currently supports 6 entities from Linear's API:
- Issue, Project, Document, IssueLabel (full CRUD commands)
- ProjectMilestone (scoped to project per ADR-0004)
- Comment (embedded in issue command)

Linear's API exposes 50+ mutable entities. schema introspection reveals many entities we don't categorize — they exist in the API but aren't in our supported or excluded lists.

this ADR defines which entities to add and how they should be exposed.

## decision

expand entity support in three tiers based on access pattern and complexity.

### tier 1: read-only entities

entities where mutations are admin-level or require elevated permissions, but read access is useful for CLI workflows.

| entity | command | notes |
|--------|---------|-------|
| User | `lnr users`, `lnr user <email>` | read-only, no mutations in Linear API |
| Team | `lnr teams`, `lnr team <key>` | read-only for members, includes `--members` flag |
| Notification | `lnr notifications` | read-only, mark-as-read could be added later |
| Roadmap | `lnr roadmaps`, `lnr roadmap <name>` | read-only for non-enterprise |

### tier 2: full CRUD entities

entities that follow the standard command pattern with list/show/create/update/delete.

| entity | command | notes |
|--------|---------|-------|
| Cycle | `lnr cycles`, `lnr cycle <name>` | scoped to team via `--team` |
| CustomView | `lnr views`, `lnr view <name>` | saved filters, important for workflow |
| Template | `lnr templates`, `lnr template <name>` | issue/project templates, high priority |
| ProjectUpdate | `lnr project <name> --updates` | scoped to project like milestones |
| ProjectLabel | `lnr project <name> --labels` | project-scoped labels |
| ProjectStatus | `lnr project <name> --statuses` | project workflow states |
| Initiative | `lnr initiatives`, `lnr initiative <name>` | enterprise, but useful read access |
| InitiativeUpdate | `lnr initiative <name> --updates` | scoped to initiative |
| RoadmapToProject | via `lnr roadmap <name> --projects` | roadmap-project linking |
| EntityExternalLink | `--link` flag on issue/project | external URL attachments |
| ViewPreferences | via `lnr view <name>` | view settings, embedded |

### tier 3: embedded operations

entities that don't warrant standalone commands but should be accessible through parent entities.

| entity | access pattern | notes |
|--------|----------------|-------|
| Reaction | `--react`, `--unreact` on comments AND updates | extend current issue pattern to all comment-like entities |
| NotificationSubscription | `--subscribe`, `--unsubscribe` flags | on issues, projects, etc. |
| IssueBatch | `lnr issue batch` subcommand | bulk operations |

### tier 4: automation entities

git and workflow automation, accessed through dedicated subcommands.

| entity | command | notes |
|--------|---------|-------|
| GitAutomationState | `lnr git-automation states` | state-based branch rules |
| GitAutomationTargetBranch | `lnr git-automation branches` | target branch config |

### tier 5: agent entities (experimental)

AI agent integration, may require special handling.

| entity | command | notes |
|--------|---------|-------|
| AgentSession | `lnr agent sessions` | AI agent sessions |
| AgentActivity | embedded in session | agent activity log |

## implementation order

1. **Template** — highest user value, enables `lnr issue new --template "bug report"`
2. **Cycle** — already has core module, straightforward
3. **CustomView** — saved filters, common workflow
4. **Team** (read-only) — foundation for team-scoped operations
5. **User** (read-only) — user lookup, mentions
6. **ProjectUpdate** — project status reporting
7. **Notification** — awareness without leaving terminal
8. remaining entities as needed

## consequences

### positive
- clear categorization of all known Linear entities
- prioritized implementation path
- consistent patterns: read-only entities get different treatment than full CRUD
- embedded operations reduce command sprawl

### negative
- large scope — 20+ entities to implement
- some entities may have undocumented quirks
- enterprise features (Initiative, Roadmap) may have access restrictions

### open questions
- should IssueBatch be a subcommand (`lnr issue batch`) or flag-based (`lnr issues --batch`)?
- how to handle enterprise-only entities when user doesn't have access?
- git automation entities may need team context — verify API requirements

## updates to entity-config.ts

after accepting this ADR, update entity-config.ts to move entities from "unknown" to either SUPPORTED_ENTITIES or EXCLUDED_ENTITIES with appropriate reasons.

entities NOT covered by this ADR remain excluded:
- Organization, OrganizationInvite, OrganizationDomain (admin-only)
- Webhook, Integration, IntegrationsSettings (admin config)
- PushSubscription (internal)
- TeamMembership (via Team read)
- EmailIntakeAddress (admin config)
- Contact, ContactSales, Customer* (enterprise CRM)
- Release, ReleasePipeline, ReleaseStage, IssueToRelease (ALPHA, defer)
