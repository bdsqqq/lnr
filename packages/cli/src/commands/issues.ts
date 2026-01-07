import type { Command } from "commander";
import {
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
  createIssueRelation,
  getIssueComments,
  updateComment,
  replyToComment,
  deleteComment,
  archiveIssue,
  createReaction,
  deleteReaction,
  getSubIssues,
  type Issue,
  type Comment,
  type ListIssuesFilter,
} from "@bdsqqq/lnr-core";
import { getClient } from "../lib/client";
import { handleApiError, exitWithError, EXIT_CODES } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  formatDate,
  formatPriority,
  truncate,
  type OutputOptions,
  type TableColumn,
} from "../lib/output";

interface ListOptions extends OutputOptions {
  team?: string;
  state?: string;
  assignee?: string;
  label?: string;
  project?: string;
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

interface ShowOptions extends OutputOptions {
  json?: boolean;
  open?: boolean;
  subIssues?: boolean;
}

interface UpdateOptions {
  state?: string;
  assignee?: string;
  priority?: string;
  label?: string;
  comment?: string;
  open?: boolean;
  blocks?: string;
  blockedBy?: string;
  relatesTo?: string;
  comments?: boolean;
  editComment?: string;
  replyTo?: string;
  text?: string;
  deleteComment?: string;
  archive?: boolean;
  react?: string;
  emoji?: string;
  unreact?: string;
  json?: boolean;
  parent?: string;
}

interface CreateOptions {
  team?: string;
  title?: string;
  description?: string;
  assignee?: string;
  label?: string;
  priority?: string;
  parent?: string;
}

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
  { header: "BODY", value: (c) => truncate(c.body.replace(/\n/g, " "), 50), width: 50 },
  { header: "CREATED", value: (c) => formatDate(c.createdAt), width: 12 },
];

async function handleListIssues(options: ListOptions): Promise<void> {
  try {
    const client = getClient();
    const filter: ListIssuesFilter = {
      team: options.team,
      state: options.state,
      assignee: options.assignee,
      label: options.label,
      project: options.project,
    };

    const issues = await listIssues(client, filter);
    const format = options.json ? "json" : options.quiet ? "quiet" : getOutputFormat(options);

    if (format === "json") {
      outputJson(issues);
      return;
    }

    if (format === "quiet") {
      outputQuiet(issues.map((i) => i.identifier));
      return;
    }

    outputTable(issues, issueColumns, { verbose: options.verbose });
  } catch (error) {
    handleApiError(error);
  }
}

async function handleShowIssue(identifier: string, options: ShowOptions): Promise<void> {
  try {
    const client = getClient();
    const issue = await getIssue(client, identifier);

    if (!issue) {
      exitWithError(`issue ${identifier} not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (options.open) {
      const { exec } = await import("child_process");
      exec(`open "${issue.url}"`);
      console.log(`opened ${issue.url}`);
      return;
    }

    if (options.subIssues) {
      const subIssues = await getSubIssues(client, issue.id);
      const format = options.json ? "json" : getOutputFormat(options);
      if (format === "json") {
        outputJson(subIssues);
        return;
      }
      if (subIssues.length === 0) {
        console.log(`${identifier} has no sub-issues`);
        return;
      }
      outputTable(subIssues, issueColumns);
      return;
    }

    const format = options.json ? "json" : getOutputFormat(options);

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
    if (issue.parent) {
      console.log(`parent:   ${issue.parent}`);
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

async function handleUpdateIssue(identifier: string, options: UpdateOptions): Promise<void> {
  try {
    const client = getClient();
    const issue = await getIssue(client, identifier);

    if (!issue) {
      exitWithError(`issue ${identifier} not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (options.open) {
      const { exec } = await import("child_process");
      exec(`open "${issue.url}"`);
      console.log(`opened ${issue.url}`);
      return;
    }

    if (options.comment) {
      await addComment(client, issue.id, options.comment);
      console.log(`commented on ${identifier}`);
      return;
    }

    if (options.comments) {
      const comments = await getIssueComments(client, issue.id);
      if (options.json) {
        outputJson(comments);
        return;
      }
      outputTable(comments, commentColumns, { verbose: true });
      return;
    }

    if (options.editComment) {
      if (!options.text) {
        exitWithError("--edit-comment requires --text");
      }
      const success = await updateComment(client, options.editComment, options.text);
      if (success) {
        console.log(`updated comment ${options.editComment.slice(0, 8)}`);
      } else {
        exitWithError("failed to update comment");
      }
      return;
    }

    if (options.replyTo) {
      if (!options.text) {
        exitWithError("--reply-to requires --text");
      }
      const success = await replyToComment(client, options.replyTo, issue.id, options.text);
      if (success) {
        console.log(`replied to comment ${options.replyTo.slice(0, 8)}`);
      } else {
        exitWithError("failed to reply to comment");
      }
      return;
    }

    if (options.deleteComment) {
      const success = await deleteComment(client, options.deleteComment);
      if (success) {
        console.log(`deleted comment ${options.deleteComment.slice(0, 8)}`);
      } else {
        exitWithError("failed to delete comment");
      }
      return;
    }

    if (options.archive) {
      const success = await archiveIssue(client, issue.id);
      if (success) {
        console.log(`archived ${identifier}`);
      } else {
        exitWithError("failed to archive issue");
      }
      return;
    }

    if (options.react && options.emoji) {
      const reaction = await createReaction(client, {
        commentId: options.react,
        emoji: options.emoji,
      });
      if (reaction) {
        console.log(`added ${reaction.emoji} to comment ${options.react.slice(0, 8)}`);
      } else {
        exitWithError("failed to add reaction");
      }
      return;
    }

    if (options.unreact) {
      const success = await deleteReaction(client, options.unreact);
      if (success) {
        console.log(`removed reaction ${options.unreact.slice(0, 8)}`);
      } else {
        exitWithError("failed to remove reaction");
      }
      return;
    }

    const updatePayload: Record<string, unknown> = {};

    if (options.state) {
      const rawIssue = await (client as unknown as { issue: (id: string) => Promise<{ team?: { id: string } | null } | null> }).issue(identifier);
      const teamRef = rawIssue && 'team' in rawIssue ? await (rawIssue as unknown as { team: Promise<{ id: string } | null> }).team : null;
      if (!teamRef) {
        exitWithError("could not determine team for issue");
      }
      const states = await getTeamStates(client, teamRef.id);
      const targetState = states.find(
        (s) => s.name.toLowerCase() === options.state!.toLowerCase()
      );
      if (!targetState) {
        const available = states.map((s) => s.name).join(", ");
        exitWithError(
          `state "${options.state}" not found`,
          `available states: ${available}`
        );
      }
      updatePayload.stateId = targetState.id;
    }

    if (options.assignee) {
      if (options.assignee === "@me") {
        const viewer = await client.viewer;
        updatePayload.assigneeId = viewer.id;
      } else {
        const users = await client.users({ filter: { email: { eq: options.assignee } } });
        const user = users.nodes[0];
        if (!user) {
          exitWithError(`user "${options.assignee}" not found`);
        }
        updatePayload.assigneeId = user.id;
      }
    }

    if (options.priority) {
      updatePayload.priority = priorityFromString(options.priority);
    }

    if (options.label) {
      const isAdd = options.label.startsWith("+");
      const isRemove = options.label.startsWith("-");
      const labelName = isAdd || isRemove ? options.label.slice(1) : options.label;

      const rawIssue = await (client as unknown as { issue: (id: string) => Promise<{ team?: { id: string } | null; labels: () => Promise<{ nodes: { id: string }[] }> } | null> }).issue(identifier);
      const teamRef = rawIssue && 'team' in rawIssue ? await (rawIssue as unknown as { team: Promise<{ id: string } | null> }).team : null;
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

    if (options.parent) {
      const parentIssue = await getIssue(client, options.parent);
      if (!parentIssue) {
        exitWithError(`parent issue "${options.parent}" not found`);
      }
      updatePayload.parentId = parentIssue.id;
    }

    if (Object.keys(updatePayload).length > 0) {
      await updateIssue(client, issue.id, updatePayload);
      console.log(`updated ${identifier}`);
    }

    if (options.blocks) {
      await createIssueRelation(client, issue.id, options.blocks, "blocks");
      console.log(`${identifier} now blocks ${options.blocks}`);
    }

    if (options.blockedBy) {
      await createIssueRelation(client, options.blockedBy, issue.id, "blocks");
      console.log(`${identifier} now blocked by ${options.blockedBy}`);
    }

    if (options.relatesTo) {
      await createIssueRelation(client, issue.id, options.relatesTo, "related");
      console.log(`${identifier} now relates to ${options.relatesTo}`);
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleCreateIssue(options: CreateOptions): Promise<void> {
  if (!options.team) {
    exitWithError("--team is required", "usage: lnr issue new --team ENG --title \"...\"");
  }

  if (!options.title) {
    exitWithError("--title is required", "usage: lnr issue new --team ENG --title \"...\"");
  }

  try {
    const client = getClient();
    const team = await findTeamByKeyOrName(client, options.team);

    if (!team) {
      const available = (await getAvailableTeamKeys(client)).join(", ");
      exitWithError(`team "${options.team}" not found`, `available teams: ${available}`);
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
      title: options.title,
    };

    if (options.description) {
      createPayload.description = options.description;
    }

    if (options.assignee) {
      if (options.assignee === "@me") {
        const viewer = await client.viewer;
        createPayload.assigneeId = viewer.id;
      } else {
        const users = await client.users({ filter: { email: { eq: options.assignee } } });
        const user = users.nodes[0];
        if (!user) {
          exitWithError(`user "${options.assignee}" not found`);
        }
        createPayload.assigneeId = user.id;
      }
    }

    if (options.priority) {
      createPayload.priority = priorityFromString(options.priority);
    }

    if (options.label) {
      const labels = await getTeamLabels(client, team.id);
      const targetLabel = labels.find(
        (l) => l.name.toLowerCase() === options.label!.toLowerCase()
      );
      if (!targetLabel) {
        const available = labels.map((l) => l.name).join(", ");
        exitWithError(`label "${options.label}" not found`, `available labels: ${available}`);
      }
      createPayload.labelIds = [targetLabel.id];
    }

    if (options.parent) {
      const parentIssue = await getIssue(client, options.parent);
      if (!parentIssue) {
        exitWithError(`parent issue "${options.parent}" not found`);
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

export function registerIssuesCommand(program: Command): void {
  program
    .command("issues")
    .description("list issues")
    .option("--team <key>", "filter by team key")
    .option("--state <state>", "filter by state name")
    .option("--assignee <email>", "filter by assignee (@me for self)")
    .option("--label <label>", "filter by label")
    .option("--project <project>", "filter by project name")
    .option("--json", "output as JSON")
    .option("--quiet", "output issue IDs only")
    .option("--verbose", "show table headers")
    .action(async (options: ListOptions) => {
      await handleListIssues(options);
    });

  program
    .command("issue <id>")
    .description("show or update an issue, or create with 'new'")
    .option("--json", "output as JSON")
    .option("--open", "open issue in browser")
    .option("--state <state>", "update state")
    .option("--assignee <email>", "update assignee (@me for self)")
    .option("--priority <priority>", "update priority (urgent, high, medium, low)")
    .option("--label <label>", "add (+label) or remove (-label) a label")
    .option("--comment <text>", "add a comment")
    .option("--comments", "list comments on this issue")
    .option("--edit-comment <id>", "edit a comment (use with --text)")
    .option("--reply-to <commentId>", "reply to a comment (use with --text)")
    .option("--text <text>", "text for --edit-comment or --reply-to")
    .option("--delete-comment <id>", "delete a comment")
    .option("--archive", "archive this issue")
    .option("--react <commentId>", "add reaction to a comment (use with --emoji)")
    .option("--emoji <emoji>", "emoji for --react")
    .option("--unreact <reactionId>", "remove a reaction")
    .option("--blocks <issue>", "mark this issue as blocking another issue")
    .option("--blocked-by <issue>", "mark this issue as blocked by another issue")
    .option("--relates-to <issue>", "link this issue as related to another issue")
    .option("--parent <issue>", "set parent issue (make this a sub-issue)")
    .option("--sub-issues", "list sub-issues of this issue")
    .option("--team <key>", "team for new issue")
    .option("--title <title>", "title for new issue")
    .option("--description <description>", "description for new issue")
    .action(async (id: string, options: ShowOptions & UpdateOptions & CreateOptions) => {
      if (id === "new") {
        await handleCreateIssue(options);
        return;
      }

      const hasUpdate =
        options.state || options.assignee || options.priority || options.label || options.comment ||
        options.blocks || options.blockedBy || options.relatesTo || options.parent ||
        options.comments || options.editComment || options.replyTo || options.deleteComment ||
        options.archive || (options.react && options.emoji) || options.unreact;

      if (hasUpdate) {
        await handleUpdateIssue(id, options);
      } else {
        await handleShowIssue(id, options);
      }
    });

  program
    .command("i")
    .description("alias for issues")
    .option("--team <key>", "filter by team key")
    .option("--state <state>", "filter by state name")
    .option("--assignee <email>", "filter by assignee (@me for self)")
    .option("--label <label>", "filter by label")
    .option("--project <project>", "filter by project name")
    .option("--json", "output as JSON")
    .option("--quiet", "output issue IDs only")
    .option("--verbose", "show table headers")
    .argument("[subcommand]", "subcommand (new)")
    .action(async (subcommand: string | undefined, options: ListOptions & CreateOptions) => {
      if (subcommand === "new") {
        await handleCreateIssue(options);
        return;
      }
      await handleListIssues(options);
    });
}
