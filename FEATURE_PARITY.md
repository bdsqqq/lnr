# lnr feature parity spec

this is the target spec for Linear API feature parity. agents should implement these capabilities.

---

## currently supported ✓

| domain | operations |
|--------|-----------|
| **issues** | list, get, create, update, addComment, getTeamStates, getTeamLabels |
| **projects** | list, get, getIssues, create, delete |
| **teams** | list, get, getMembers, findByKeyOrName |
| **cycles** | list, getCurrent, getCycleIssues |
| **me** | getViewer, getMyIssues, getMyCreatedIssues |
| **search** | searchIssues |
| **relations** | createIssueRelation (blocks/related) |

---

## HIGH PRIORITY - agent-critical gaps

these are blocking agent workflows and must be implemented first.

| feature | core function | CLI command | SDK method |
|---------|---------------|-------------|------------|
| edit comment | `updateComment(client, commentId, body)` | `lnr issue ENG-123 --edit-comment <id> "new text"` | `updateComment(id, {body})` |
| reply to comment | `replyToComment(client, parentCommentId, body)` | `lnr issue ENG-123 --reply-to <commentId> "reply text"` | `createComment({parentId, issueId, body})` |
| delete comment | `deleteComment(client, commentId)` | `lnr issue ENG-123 --delete-comment <id>` | `deleteComment(id)` |
| list comments | `getIssueComments(client, issueId)` | `lnr issue ENG-123 --comments` | `issue.comments()` |
| archive issue | `archiveIssue(client, issueId)` | `lnr issue ENG-123 --archive` | `archiveIssue(id)` |

---

## MEDIUM PRIORITY - power user features

| feature | core function | CLI command | SDK method |
|---------|---------------|-------------|------------|
| create attachment | `createAttachment(client, input)` | `lnr issue ENG-123 --attach <url>` | `createAttachment(input)` |
| delete attachment | `deleteAttachment(client, id)` | `lnr issue ENG-123 --delete-attachment <id>` | `deleteAttachment(id)` |
| create document | `createDocument(client, input)` | `lnr doc new --team ENG --title "spec"` | `createDocument(input)` |
| update document | `updateDocument(client, id, input)` | `lnr doc <id> --content "..."` | `updateDocument(id, input)` |
| delete document | `deleteDocument(client, id)` | `lnr doc <id> --delete` | `deleteDocument(id)` |
| list documents | `listDocuments(client, options)` | `lnr docs --team ENG` | `team.documents()` |
| create label | `createIssueLabel(client, input)` | `lnr label new --team ENG --name "bug"` | `createIssueLabel(input)` |
| update label | `updateIssueLabel(client, id, input)` | `lnr label <id> --name "new-name"` | `updateIssueLabel(id, input)` |
| delete label | `deleteIssueLabel(client, id)` | `lnr label <id> --delete` | `deleteIssueLabel(id)` |
| list labels | `listLabels(client, options)` | `lnr labels --team ENG` | `team.labels()` |
| add reaction | `createReaction(client, input)` | `lnr issue ENG-123 --react <commentId> "👍"` | `createReaction(input)` |
| delete reaction | `deleteReaction(client, id)` | `lnr issue ENG-123 --unreact <reactionId>` | `deleteReaction(id)` |
| project milestones | `createProjectMilestone(client, input)` | `lnr project "q1" --add-milestone "launch"` | `createProjectMilestone(input)` |
| project updates | `createProjectUpdate(client, input)` | `lnr project "q1" --update "on track"` | `createProjectUpdate(input)` |
| batch create issues | `createIssueBatch(client, input)` | `lnr issues new --batch <file.json>` | `createIssueBatch(input)` |
| batch update issues | `updateIssueBatch(client, ids, input)` | `lnr issues --batch-update <file.json>` | `updateIssueBatch(ids, input)` |
| delete issue relation | `deleteIssueRelation(client, id)` | `lnr issue ENG-123 --unrelate <relationId>` | `deleteIssueRelation(id)` |
| favorites | `createFavorite(client, input)` | `lnr favorite add ENG-123` | `createFavorite(input)` |

---

## LOW PRIORITY - admin/power-user

| feature | SDK method | notes |
|---------|-----------|-------|
| create/update/archive cycles | `createCycle`, `updateCycle`, `archiveCycle` | sprint management |
| create/update/archive workflow states | `createWorkflowState`, `updateWorkflowState` | custom states |
| templates | `createTemplate`, `updateTemplate`, `deleteTemplate` | issue templates |
| webhooks | `createWebhook`, `updateWebhook`, `deleteWebhook` | integrations |
| initiatives/roadmaps | full CRUD | strategic planning |
| team management | `createTeam`, `updateTeam`, `deleteTeam` | admin only |

---

## implementation notes

### core package (`@bdsqqq/lnr-core`)

each feature needs:
1. type definitions in `types.ts`
2. function implementation in appropriate module (e.g., `comments.ts`, `documents.ts`)
3. export from `index.ts`

### cli package (`@bdsqqq/lnr-cli`)

each feature needs:
1. command/flag added to appropriate command file
2. output formatting via `lib/output.ts`
3. error handling via `lib/error.ts`

### testing

- colocate tests with source: `comments.test.ts`
- mock LinearClient for unit tests
- run `bun run check` and `bun run test` before committing

---

## agent assignments

coordinate parallel work by domain:

1. **comments agent**: edit, reply, delete, list comments
2. **documents agent**: create, update, delete, list documents  
3. **labels agent**: create, update, delete, list labels
4. **attachments agent**: create, delete attachments
5. **archive agent**: archive issue, plus reactions and favorites
