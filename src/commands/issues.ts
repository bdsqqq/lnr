import type { Command } from "commander";
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

interface Issue {
  id: string;
  identifier: string;
  title: string;
  state?: { name: string } | null;
  assignee?: { name: string } | null;
  priority?: number;
  createdAt: Date;
  updatedAt: Date;
  description?: string | null;
  url: string;
}

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
}

interface UpdateOptions {
  state?: string;
  assignee?: string;
  priority?: string;
  label?: string;
  comment?: string;
  open?: boolean;
}

interface CreateOptions {
  team?: string;
  title?: string;
  description?: string;
  assignee?: string;
  label?: string;
  priority?: string;
}

const issueColumns: TableColumn<Issue>[] = [
  { header: "ID", value: (i) => i.identifier, width: 10 },
  { header: "STATE", value: (i) => i.state?.name ?? "-", width: 15 },
  { header: "TITLE", value: (i) => truncate(i.title, 50), width: 50 },
  { header: "ASSIGNEE", value: (i) => i.assignee?.name ?? "-", width: 15 },
  { header: "PRIORITY", value: (i) => formatPriority(i.priority), width: 8 },
];

function priorityFromString(priority: string): number {
  switch (priority.toLowerCase()) {
    case "urgent":
      return 1;
    case "high":
      return 2;
    case "medium":
      return 3;
    case "low":
      return 4;
    case "none":
      return 0;
    default:
      return 0;
  }
}

async function listIssues(options: ListOptions): Promise<void> {
  const client = getClient();

  try {
    const filter: Record<string, unknown> = {};

    if (options.team) {
      filter.team = { key: { eq: options.team } };
    }

    if (options.state) {
      filter.state = { name: { eqIgnoreCase: options.state } };
    }

    if (options.assignee) {
      if (options.assignee === "@me") {
        const viewer = await client.viewer;
        filter.assignee = { id: { eq: viewer.id } };
      } else {
        filter.assignee = { email: { eq: options.assignee } };
      }
    }

    if (options.label) {
      filter.labels = { some: { name: { eqIgnoreCase: options.label } } };
    }

    if (options.project) {
      filter.project = { name: { eqIgnoreCase: options.project } };
    }

    const issues = await client.issues({ filter });
    const nodes = issues.nodes;

    const format = options.json ? "json" : options.quiet ? "quiet" : getOutputFormat(options);

    if (format === "json") {
      outputJson(nodes.map((n) => ({ ...n })));
      return;
    }

    if (format === "quiet") {
      outputQuiet(nodes.map((n) => n.identifier));
      return;
    }

    const issuesWithState: Issue[] = await Promise.all(
      nodes.map(async (n) => ({
        id: n.id,
        identifier: n.identifier,
        title: n.title,
        state: await n.state,
        assignee: await n.assignee,
        priority: n.priority,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        description: n.description,
        url: n.url,
      }))
    );

    outputTable(issuesWithState, issueColumns, { verbose: options.verbose });
  } catch (error) {
    handleApiError(error);
  }
}

async function showIssue(identifier: string, options: ShowOptions): Promise<void> {
  const client = getClient();

  try {
    const issue = await client.issue(identifier);

    if (!issue) {
      exitWithError(`issue ${identifier} not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (options.open) {
      const { exec } = await import("child_process");
      exec(`open "${issue.url}"`);
      console.log(`opened ${issue.url}`);
      return;
    }

    const format = options.json ? "json" : getOutputFormat(options);

    if (format === "json") {
      const state = await issue.state;
      const assignee = await issue.assignee;
      outputJson({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        state: state?.name,
        assignee: assignee?.name,
        priority: formatPriority(issue.priority),
        createdAt: formatDate(issue.createdAt),
        updatedAt: formatDate(issue.updatedAt),
        url: issue.url,
      });
      return;
    }

    const state = await issue.state;
    const assignee = await issue.assignee;

    console.log(`${issue.identifier}: ${issue.title}`);
    console.log();
    console.log(`state:    ${state?.name ?? "-"}`);
    console.log(`assignee: ${assignee?.name ?? "-"}`);
    console.log(`priority: ${formatPriority(issue.priority)}`);
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

async function updateIssue(identifier: string, options: UpdateOptions): Promise<void> {
  const client = getClient();

  try {
    const issue = await client.issue(identifier);

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
      await client.createComment({ issueId: issue.id, body: options.comment });
      console.log(`commented on ${identifier}`);
      return;
    }

    const updatePayload: Record<string, unknown> = {};

    if (options.state) {
      const team = await issue.team;
      if (!team) {
        exitWithError("could not determine team for issue");
      }
      const states = await team.states();
      const targetState = states.nodes.find(
        (s) => s.name.toLowerCase() === options.state!.toLowerCase()
      );
      if (!targetState) {
        const available = states.nodes.map((s) => s.name).join(", ");
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

      const team = await issue.team;
      if (!team) {
        exitWithError("could not determine team for issue");
      }

      const labels = await team.labels();
      const targetLabel = labels.nodes.find(
        (l) => l.name.toLowerCase() === labelName.toLowerCase()
      );
      if (!targetLabel) {
        const available = labels.nodes.map((l) => l.name).join(", ");
        exitWithError(`label "${labelName}" not found`, `available labels: ${available}`);
      }

      const currentLabels = await issue.labels();
      const currentLabelIds = currentLabels.nodes.map((l) => l.id);

      if (isRemove) {
        updatePayload.labelIds = currentLabelIds.filter((id) => id !== targetLabel.id);
      } else {
        if (!currentLabelIds.includes(targetLabel.id)) {
          updatePayload.labelIds = [...currentLabelIds, targetLabel.id];
        }
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      await client.updateIssue(issue.id, updatePayload);
      console.log(`updated ${identifier}`);
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function createIssue(options: CreateOptions): Promise<void> {
  const client = getClient();

  if (!options.team) {
    exitWithError("--team is required", "usage: li issue new --team ENG --title \"...\"");
  }

  if (!options.title) {
    exitWithError("--title is required", "usage: li issue new --team ENG --title \"...\"");
  }

  try {
    const teams = await client.teams({ filter: { key: { eq: options.team } } });
    const team = teams.nodes[0];
    if (!team) {
      const allTeams = await client.teams();
      const available = allTeams.nodes.map((t) => t.key).join(", ");
      exitWithError(`team "${options.team}" not found`, `available teams: ${available}`);
    }

    const createPayload: {
      teamId: string;
      title: string;
      description?: string;
      assigneeId?: string;
      priority?: number;
      labelIds?: string[];
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
      const labels = await team.labels();
      const targetLabel = labels.nodes.find(
        (l) => l.name.toLowerCase() === options.label!.toLowerCase()
      );
      if (!targetLabel) {
        const available = labels.nodes.map((l) => l.name).join(", ");
        exitWithError(`label "${options.label}" not found`, `available labels: ${available}`);
      }
      createPayload.labelIds = [targetLabel.id];
    }

    const result = await client.createIssue(createPayload);
    if (result.success) {
      const issueData = (result as unknown as { _issue?: { id: string } })._issue;
      if (issueData?.id) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const createdIssue = await client.issue(issueData.id);
            if (createdIssue) {
              console.log(`created ${createdIssue.identifier}: ${createdIssue.title}`);
              return;
            }
          } catch {
            if (attempt < 2) await new Promise((r) => setTimeout(r, 300));
          }
        }
      }
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
      await listIssues(options);
    });

  const issueCmd = program
    .command("issue <id>")
    .description("show or update an issue, or create with 'new'")
    .option("--json", "output as JSON")
    .option("--open", "open issue in browser")
    .option("--state <state>", "update state")
    .option("--assignee <email>", "update assignee (@me for self)")
    .option("--priority <priority>", "update priority (urgent, high, medium, low)")
    .option("--label <label>", "add (+label) or remove (-label) a label")
    .option("--comment <text>", "add a comment")
    .option("--team <key>", "team for new issue")
    .option("--title <title>", "title for new issue")
    .option("--description <description>", "description for new issue")
    .action(async (id: string, options: ShowOptions & UpdateOptions & CreateOptions) => {
      if (id === "new") {
        await createIssue(options);
        return;
      }

      const hasUpdate =
        options.state || options.assignee || options.priority || options.label || options.comment;

      if (hasUpdate) {
        await updateIssue(id, options);
      } else {
        await showIssue(id, options);
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
        await createIssue(options);
        return;
      }
      await listIssues(options);
    });
}
