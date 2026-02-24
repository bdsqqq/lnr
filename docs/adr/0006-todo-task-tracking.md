# ADR-0006: todo task tracking

## status

accepted

## context

we need a way to track planned work, implementation order, and task dependencies within the repository. this should be:
- human-readable
- version-controlled
- usable by both humans and agents
- simple enough to edit by hand

## decision

maintain a `.todo.md` file at repository root that serves as the canonical record of planned and in-progress work.

### format

```markdown
# lnr todo

- [-] 0001 - in progress task
  - [ ] 0002 - sub-task not started
  - [x] 0003 - completed sub-task
- [ ] 0004 - future task --blocks 0005
- [ ] 0005 - task with dependency
- [x] 0006 - completed task
```

### rules

1. **unique numerical IDs**: every task has a unique auto-incrementing ID (0001, 0002, etc.). IDs are never reused.

2. **checkbox states**:
   - `- [ ]` — not started
   - `- [-]` — in progress (indeterminate)
   - `- [x]` — complete

3. **sub-tasks via indentation**: indent with 2 spaces for hierarchy.

4. **dependencies**: use `--blocks <id>` suffix to indicate a task blocks another.

5. **ADR references**: link to ADRs with relative markdown links when a task relates to an architectural decision.
   ```markdown
   - [ ] 0007 - implement cycle support per [ADR-0005](docs/adr/0005-entity-expansion-roadmap.md)
   ```

6. **no sections**: status is tracked via checkbox state, not headings.

### ID allocation

- check highest existing ID in file
- increment by 1 for new tasks
- agents MUST scan file before adding tasks to avoid ID collision

## consequences

### positive
- single source of truth for planned work
- git history shows task evolution
- agents can parse and update programmatically
- dependencies are explicit and traceable

### negative
- manual ID management (no database)
- potential merge conflicts if multiple people add tasks

### mitigations
- IDs are cheap — skip numbers if uncertain about conflicts
- keep descriptions short to reduce merge conflict surface
