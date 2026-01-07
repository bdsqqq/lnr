import { z } from "zod";
import {
  getClient,
  listIssues,
  getIssue,
  createIssue,
  updateIssue,
  addComment,
  priorityFromString,
  getTeamStates,
  getTeamLabels,
  findTeamByKeyOrName,
  getAvailableTeamKeys,
  getIssueComments,
  updateComment,
  replyToComment,
  deleteComment,
  archiveIssue,
  getSubIssues,
  createReaction,
  deleteReaction,
  createIssueRelation,
  type Issue,
  type ListIssuesFilter,
  type Comment,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "./trpc";
import { handleApiError, exitWithError, EXIT_CODES } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  formatDate,
  formatPriority,
  truncate,
  type TableColumn,
} from "../lib/output";

const listIssuesInput = z.object({
  team: z.string().optional(),
  state: z.string().optional(),
  assignee: z.string().optional(),
  label: z.string().optional(),
  project: z.string().optional(),
  json: z.boolean().optional(),
  quiet: z.boolean().optional(),
  verbose: z.boolean().optional(),
});

const issueInput = z.object({
  idOrNew: z.string().meta({ positional: true }),
  json: z.boolean().optional(),
  open: z.boolean().optional(),
  state: z.string().optional(),
  assignee: z.string().optional(),
  priority: z.string().optional(),
  label: z.string().optional(),
  comment: z.string().optional(),
  blocks: z.string().optional(),
  blockedBy: z.string().optional(),
  relatesTo: z.string().optional(),
  team: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  comments: z.boolean().optional(),
  editComment: z.string().optional(),
  text: z.string().optional(),
  replyTo: z.string().optional(),
  deleteComment: z.string().optional(),
  archive: z.boolean().optional(),
  react: z.string().optional(),
  emoji: z.string().optional(),
  unreact: z.string().optional(),
  parent: z.string().optional(),
  subIssues: z.boolean().optional(),
});

type IssueInput = z.infer<typeof issueInput>;

const issueColumns: TableColumn<Issue>[] = [
  { header: "ID", value: (i) => i.identifier, width: 10 },
  { header: "STATE", value: (i) => i.state ?? "-", width: 15 },
  { header: "TITLE", value: (i) => truncate(i.title, 50), width: 50 },
  { header: "ASSIGNEE", value: (i) => i.assignee ?? "-", width: 15 },
  { header: "PRIORITY", value: (i) => formatPriority(i.priority), width: 8 },
];

const commentColumns: TableColumn<Comment>[] = [
  { header: "ID", value: (c) => c.id.slice(0, 8), width: 10 },
  { header: "USER", value: (c) => c.user ?? "-", width: 15 },
  { header: "BODY", value: (c) => truncate(c.body, 50), width: 50 },
  { header: "CREATED", value: (c) => formatDate(c.createdAt), width: 12 },
];

async function handleListIssues(input: z.infer<typeof listIssuesInput>): Promise<void> {
  try {
    const client = getClient();
    const filter: ListIssuesFilter = {
      team: input.team,
      state: input.state,
      assignee: input.assignee,
      label: input.label,
      project: input.project,
    };

    const issues = await listIssues(client, filter);
    const format = input.json ? "json" : input.quiet ? "quiet" : getOutputFormat({});

    if (format === "json") {
      outputJson(issues);
      return;
    }

    if (format === "quiet") {
      outputQuiet(issues.map((i) => i.identifier));
      return;
    }

    outputTable(issues, issueColumns, { verbose: input.verbose });
  } catch (error) {
    handleApiError(error);
  }
}

async function handleShowIssue(
  identifier: string,
  input: IssueInput
): Promise<void> {
  try {
    const client = getClient();
    const issue = await getIssue(client, identifier);

    if (!issue) {
      exitWithError(`issue ${identifier} not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (input.open) {
      const { exec } = await import("child_process");
      exec(`open "${issue.url}"`);
      console.log(`opened ${issue.url}`);
      return;
    }

    if (input.comments) {
      const comments = await getIssueComments(client, issue.id);
      const format = input.json ? "json" : getOutputFormat({});
      if (format === "json") {
        outputJson(comments);
      } else {
        outputTable(comments, commentColumns);
      }
      return;
    }

    if (input.subIssues) {
      const subIssues = await getSubIssues(client, issue.id);
      const format = input.json ? "json" : getOutputFormat({});
      if (format === "json") {
        outputJson(subIssues);
      } else {
        outputTable(subIssues, issueColumns);
      }
      return;
    }

    const format = input.json ? "json" : getOutputFormat({});

    if (format === "json") {
      outputJson({
        ...issue,
        priority: formatPriority(issue.priority),
        createdAt: formatDate(issue.createdAt),
        updatedAt: formatDate(issue.updatedAt),
      });
      return;
    }

    console.log(`${issue.identifier}: ${issue.title}`);
    console.log();
    console.log(`state:    ${issue.state ?? "-"}`);
    console.log(`assignee: ${issue.assignee ?? "-"}`);
    console.log(`priority: ${formatPriority(issue.priority)}`);
    if (issue.parentId) {
      console.log(`parent:   ${issue.parentId}`);
    }
    console.log(`created:  ${formatDate(issue.createdAt)}`);
    console.log(`updated:  ${formatDate(issue.updatedAt)}`);
    console.log(`url:      ${issue.url}`);

    if (issue.description) {
      console.log();
      console.log(issue.description);
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleUpdateIssue(
  identifier: string,
  input: IssueInput
): Promise<void> {
  try {
    const client = getClient();
    const issue = await getIssue(client, identifier);

    if (!issue) {
      exitWithError(`issue ${identifier} not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (input.open) {
      const { exec } = await import("child_process");
      exec(`open "${issue.url}"`);
      console.log(`opened ${issue.url}`);
      return;
    }

    if (input.comment) {
      await addComment(client, issue.id, input.comment);
      console.log(`commented on ${identifier}`);
      return;
    }

    if (input.editComment && input.text) {
      await updateComment(client, input.editComment, input.text);
      console.log(`updated comment ${input.editComment.slice(0, 8)}`);
      return;
    }

    if (input.replyTo && input.text) {
      await replyToComment(client, issue.id, input.replyTo, input.text);
      console.log(`replied to comment ${input.replyTo.slice(0, 8)}`);
      return;
    }

    if (input.deleteComment) {
      await deleteComment(client, input.deleteComment);
      console.log(`deleted comment ${input.deleteComment.slice(0, 8)}`);
      return;
    }

    if (input.archive) {
      await archiveIssue(client, issue.id);
      console.log(`archived ${identifier}`);
      return;
    }

    if (input.react && input.emoji) {
      await createReaction(client, input.react, input.emoji);
      console.log(`added reaction ${input.emoji} to comment ${input.react.slice(0, 8)}`);
      return;
    }

    if (input.unreact) {
      await deleteReaction(client, input.unreact);
      console.log(`removed reaction ${input.unreact.slice(0, 8)}`);
      return;
    }

    const updatePayload: Record<string, unknown> = {};

    if (input.state) {
      const rawIssue = await (
        client as unknown as {
          issue: (id: string) => Promise<{ team?: { id: string } | null } | null>;
        }
      ).issue(identifier);
      const teamRef =
        rawIssue && "team" in rawIssue
          ? await (rawIssue as unknown as { team: Promise<{ id: string } | null> }).team
          : null;
      if (!teamRef) {
        exitWithError("could not determine team for issue");
      }
      const states = await getTeamStates(client, teamRef.id);
      const targetState = states.find(
        (s) => s.name.toLowerCase() === input.state!.toLowerCase()
      );
      if (!targetState) {
        const available = states.map((s) => s.name).join(", ");
        exitWithError(`state "${input.state}" not found`, `available states: ${available}`);
      }
      updatePayload.stateId = targetState.id;
    }

    if (input.assignee) {
      if (input.assignee === "@me") {
        const viewer = await client.viewer;
        updatePayload.assigneeId = viewer.id;
      } else {
        const users = await client.users({ filter: { email: { eq: input.assignee } } });
        const user = users.nodes[0];
        if (!user) {
          exitWithError(`user "${input.assignee}" not found`);
        }
        updatePayload.assigneeId = user.id;
      }
    }

    if (input.priority) {
      updatePayload.priority = priorityFromString(input.priority);
    }

    if (input.label) {
      const isAdd = input.label.startsWith("+");
      const isRemove = input.label.startsWith("-");
      const labelName = isAdd || isRemove ? input.label.slice(1) : input.label;

      const rawIssue = await (
        client as unknown as {
          issue: (
            id: string
          ) => Promise<{
            team?: { id: string } | null;
            labels: () => Promise<{ nodes: { id: string }[] }>;
          } | null>;
        }
      ).issue(identifier);
      const teamRef =
        rawIssue && "team" in rawIssue
          ? await (rawIssue as unknown as { team: Promise<{ id: string } | null> }).team
          : null;
      if (!teamRef) {
        exitWithError("could not determine team for issue");
      }

      const labels = await getTeamLabels(client, teamRef.id);
      const targetLabel = labels.find(
        (l) => l.name.toLowerCase() === labelName.toLowerCase()
      );
      if (!targetLabel) {
        const available = labels.map((l) => l.name).join(", ");
        exitWithError(`label "${labelName}" not found`, `available labels: ${available}`);
      }

      const currentLabelsData = rawIssue ? await rawIssue.labels() : { nodes: [] };
      const currentLabelIds = currentLabelsData.nodes.map((l) => l.id);

      if (isRemove) {
        updatePayload.labelIds = currentLabelIds.filter((id) => id !== targetLabel.id);
      } else {
        if (!currentLabelIds.includes(targetLabel.id)) {
          updatePayload.labelIds = [...currentLabelIds, targetLabel.id];
        }
      }
    }

    if (input.parent) {
      const parentIssue = await getIssue(client, input.parent);
      if (!parentIssue) {
        exitWithError(`parent issue "${input.parent}" not found`);
      }
      updatePayload.parentId = parentIssue.id;
    }

    if (Object.keys(updatePayload).length > 0) {
      await updateIssue(client, issue.id, updatePayload);
      console.log(`updated ${identifier}`);
    }

    if (input.blocks) {
      const blockedIssue = await getIssue(client, input.blocks);
      if (!blockedIssue) {
        exitWithError(`issue "${input.blocks}" not found`);
      }
      await createIssueRelation(client, issue.id, blockedIssue.id, "blocks");
      console.log(`${identifier} now blocks ${input.blocks}`);
    }

    if (input.blockedBy) {
      const blockerIssue = await getIssue(client, input.blockedBy);
      if (!blockerIssue) {
        exitWithError(`issue "${input.blockedBy}" not found`);
      }
      await createIssueRelation(client, blockerIssue.id, issue.id, "blocks");
      console.log(`${identifier} is now blocked by ${input.blockedBy}`);
    }

    if (input.relatesTo) {
      const relatedIssue = await getIssue(client, input.relatesTo);
      if (!relatedIssue) {
        exitWithError(`issue "${input.relatesTo}" not found`);
      }
      await createIssueRelation(client, issue.id, relatedIssue.id, "related");
      console.log(`${identifier} now relates to ${input.relatesTo}`);
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleCreateIssue(input: IssueInput): Promise<void> {
  if (!input.team) {
    exitWithError("--team is required", 'usage: lnr issue new --team ENG --title "..."');
  }

  if (!input.title) {
    exitWithError("--title is required", 'usage: lnr issue new --team ENG --title "..."');
  }

  try {
    const client = getClient();
    const team = await findTeamByKeyOrName(client, input.team);

    if (!team) {
      const available = (await getAvailableTeamKeys(client)).join(", ");
      exitWithError(`team "${input.team}" not found`, `available teams: ${available}`);
    }

    const createPayload: {
      teamId: string;
      title: string;
      description?: string;
      assigneeId?: string;
      priority?: number;
      labelIds?: string[];
      parentId?: string;
    } = {
      teamId: team.id,
      title: input.title,
    };

    if (input.description) {
      createPayload.description = input.description;
    }

    if (input.assignee) {
      if (input.assignee === "@me") {
        const viewer = await client.viewer;
        createPayload.assigneeId = viewer.id;
      } else {
        const users = await client.users({ filter: { email: { eq: input.assignee } } });
        const user = users.nodes[0];
        if (!user) {
          exitWithError(`user "${input.assignee}" not found`);
        }
        createPayload.assigneeId = user.id;
      }
    }

    if (input.priority) {
      createPayload.priority = priorityFromString(input.priority);
    }

    if (input.label) {
      const labels = await getTeamLabels(client, team.id);
      const targetLabel = labels.find(
        (l) => l.name.toLowerCase() === input.label!.toLowerCase()
      );
      if (!targetLabel) {
        const available = labels.map((l) => l.name).join(", ");
        exitWithError(`label "${input.label}" not found`, `available labels: ${available}`);
      }
      createPayload.labelIds = [targetLabel.id];
    }

    if (input.parent) {
      const parentIssue = await getIssue(client, input.parent);
      if (!parentIssue) {
        exitWithError(`parent issue "${input.parent}" not found`);
      }
      createPayload.parentId = parentIssue.id;
    }

    const issue = await createIssue(client, createPayload);
    if (issue) {
      console.log(`created ${issue.identifier}: ${issue.title}`);
    } else {
      console.log("created issue");
    }
  } catch (error) {
    handleApiError(error);
  }
}

export const issuesRouter = router({
  issues: procedure
    .meta({
      description: "list issues",
      aliases: { command: ["i"] },
    })
    .input(listIssuesInput)
    .query(async ({ input }) => {
      await handleListIssues(input);
    }),

  issue: procedure
    .meta({
      description: "show or update an issue, or create with 'new'",
    })
    .input(issueInput)
    .mutation(async ({ input }) => {
      if (input.idOrNew === "new") {
        await handleCreateIssue(input);
        return;
      }

      const hasUpdate =
        input.state ||
        input.assignee ||
        input.priority ||
        input.label ||
        input.comment ||
        input.editComment ||
        input.replyTo ||
        input.deleteComment ||
        input.archive ||
        input.react ||
        input.unreact ||
        input.parent ||
        input.blocks ||
        input.blockedBy ||
        input.relatesTo;

      if (hasUpdate) {
        await handleUpdateIssue(input.idOrNew, input);
      } else {
        await handleShowIssue(input.idOrNew, input);
      }
    }),
});
