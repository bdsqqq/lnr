# ADR-0004: milestones scoped to projects

## status

accepted

## context

milestones in Linear are always associated with a project. they represent deliverables or checkpoints within a project's timeline.

initial implementation added standalone commands:
- `lnr milestones [--project <name>]` — list milestones
- `lnr milestone <name>` — show/update/delete milestone

this mirrors the pattern used for other entities (issues, projects, labels). however, milestones differ from these entities in a key way: they have no meaningful existence outside a project context.

asking "list all milestones" is like asking "list all table rows" — technically possible but not useful. milestones only make sense when scoped to their parent project.

## decision

remove standalone milestone commands. add `--milestones` flag to the project command instead.

before:
```bash
lnr milestones --project "axi agent"
lnr milestone "v1.0" --project "axi agent"
```

after:
```bash
lnr project "axi agent" --milestones
```

this follows the existing pattern for project-scoped data:
```bash
lnr project "axi agent" --issues   # list issues in project
lnr project "axi agent" --milestones  # list milestones in project
```

## consequences

### positive
- simpler mental model: milestones accessed through their parent project
- consistent with `--issues` pattern already in project command
- fewer top-level commands to remember
- no confusion about "which project's milestones?"

### negative
- individual milestone CRUD requires different approach (deferred)
- milestone creation/update needs separate design (could be `--add-milestone "name"` or nested command)

### deferred
- milestone mutations: will design when needed, likely via flags like `--add-milestone`, `--update-milestone`, or nested subcommand pattern

## alternatives considered

1. **keep standalone commands, require `--project`**: more verbose, adds commands that always need the same flag
2. **both approaches**: complexity without benefit — if project command works, standalone is redundant
