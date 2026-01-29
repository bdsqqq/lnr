#!/usr/bin/env bun
/**
 * generate Issue commands from extracted-schema.json
 *
 * input: packages/codegen/extracted-schema.json, packages/codegen/cli-spec.json
 * output: packages/cli/src/generated/issue.ts
 *
 * generates:
 * - zod schemas for input validation
 * - default selection set for queries
 * - handlers with operation inference
 * - flag definitions matching schema fields
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

interface SchemaField {
  name: string;
  type: string;
  description: string;
  required: boolean;
  isList: boolean;
  enumType: string | null;
  isDeprecated: boolean;
  deprecationReason: string | null;
}

interface EntitySchema {
  name: string;
  description: string;
  operations: {
    create: boolean;
    update: boolean;
    read: boolean;
  };
  createInput: {
    fields: SchemaField[];
    requiredFields: string[];
  };
  updateInput: {
    fields: SchemaField[];
  };
  outputFields: SchemaField[];
}

interface ExtractedSchema {
  entities: {
    Issue: EntitySchema;
    Project: EntitySchema;
    Comment: EntitySchema;
  };
  enums: Record<string, string[]>;
}

interface CLIFlag {
  name: string;
  type: string;
  required: boolean;
  description: string;
  positional: boolean;
  cliOnly?: boolean;
  handler?: string;
  dispatchIn?: "show" | "update" | "create";
}

interface CLICommand {
  entity: string;
  command: string;
  description: string;
  aliases: string[];
  flags: CLIFlag[];
}

interface CLISpec {
  commands: CLICommand[];
}

const rootDir = join(import.meta.dir, "../..");
const schemaPath = join(import.meta.dir, "extracted-schema.json");
const cliSpecPath = join(import.meta.dir, "cli-spec.json");
const outputDir = join(rootDir, "packages/cli/src/generated");
const outputPath = join(outputDir, "issue.ts");

const schema: ExtractedSchema = JSON.parse(readFileSync(schemaPath, "utf-8"));
const cliSpec: CLISpec = JSON.parse(readFileSync(cliSpecPath, "utf-8"));

const issueEntity = schema.entities.Issue;
const issueCommand = cliSpec.commands.find(c => c.command === "issue");
const issuesCommand = cliSpec.commands.find(c => c.command === "issues");

if (!issueCommand || !issuesCommand) {
  throw new Error("issue/issues commands not found in cli-spec.json");
}

function graphqlTypeToZod(field: SchemaField): string {
  let zodType: string;
  switch (field.type) {
    case "String":
    case "ID":
    case "DateTime":
    case "TimelessDate":
    case "JSON":
      zodType = "z.string()";
      break;
    case "Int":
    case "Float":
      zodType = "z.number()";
      break;
    case "Boolean":
      zodType = "z.boolean()";
      break;
    default:
      if (field.enumType) {
        zodType = "z.string()";
      } else {
        zodType = "z.string()";
      }
  }
  if (field.isList) {
    zodType = `z.array(${zodType})`;
  }
  return zodType;
}

const cliOnlyFlags = [
  "idOrNew", "json", "open", "comments", "editComment", "text", "replyTo",
  "deleteComment", "react", "emoji", "unreact", "subIssues", "blocks",
  "blockedBy", "relatesTo", "comment", "archive"
];

const schemaToCliMapping: Record<string, string> = {
  stateId: "state",
  assigneeId: "assignee",
  parentId: "parent",
  labelIds: "label",
  teamId: "team",
  projectId: "project",
  cycleId: "cycle",
};

function getExpectedCliFlags(): Set<string> {
  const flags = new Set<string>();
  for (const f of issueCommand!.flags) {
    flags.add(f.name);
  }
  return flags;
}

function getMutationFlagNames(): string[] {
  return [
    "state", "assignee", "priority", "label", "comment",
    "editComment", "replyTo", "deleteComment", "react", "unreact",
    "parent", "blocks", "blockedBy", "relatesTo", "title", "description"
  ];
}

function generateIssueInputSchema(): string {
  const lines: string[] = [];
  lines.push("export const issueInput = z.object({");
  lines.push('  idOrNew: z.string().meta({ positional: true }).describe("issue identifier (e.g. ENG-123) or \'new\'"),');
  lines.push('  json: z.boolean().optional().describe("output as json"),');
  lines.push('  open: z.boolean().optional().describe("open issue in browser"),');

  const schemaFieldsUsed = new Set<string>();

  const updateFields = issueEntity.updateInput.fields
    .filter(f => !f.isDeprecated)
    .filter(f => !f.description.includes("[Internal]"))
    .filter(f => !f.name.includes("sortOrder"))
    .filter(f => !["id", "slaBreachesAt", "slaStartedAt", "snoozedUntilAt", "snoozedById", "slaType", "autoClosedByParentClosing", "descriptionData", "lastAppliedTemplateId", "addedLabelIds", "removedLabelIds", "subscriberIds", "projectMilestoneId", "trashed"].includes(f.name));

  for (const field of updateFields) {
    const cliName = schemaToCliMapping[field.name] || field.name;
    schemaFieldsUsed.add(cliName);

    let zodType: string;
    if (cliName === "priority") {
      zodType = 'z.string().optional().describe("set priority (urgent, high, medium, low, none)")';
    } else if (cliName === "state") {
      zodType = 'z.string().optional().describe("set workflow state")';
    } else if (cliName === "assignee") {
      zodType = 'z.string().optional().describe("set assignee by email or @me")';
    } else if (cliName === "label") {
      zodType = 'z.string().optional().describe("set label (+name to add, -name to remove)")';
    } else if (cliName === "parent") {
      zodType = 'z.string().optional().describe("set parent issue identifier")';
    } else if (cliName === "team") {
      zodType = 'z.string().optional().describe("team key (required for new)")';
    } else if (cliName === "project") {
      zodType = 'z.string().optional().describe("set project name")';
    } else if (cliName === "cycle") {
      zodType = 'z.string().optional().describe("set cycle")';
    } else if (cliName === "estimate") {
      zodType = 'z.number().optional().describe("set estimate points")';
    } else if (cliName === "dueDate") {
      zodType = 'z.string().optional().describe("set due date (YYYY-MM-DD)")';
    } else {
      const desc = field.description.replace(/"/g, '\\"');
      zodType = `${graphqlTypeToZod(field)}.optional().describe("${desc}")`;
    }

    lines.push(`  ${cliName}: ${zodType},`);
  }

  lines.push('  comment: z.string().optional().describe("add comment to issue"),');
  lines.push('  blocks: z.string().optional().describe("add blocks relation to issue"),');
  lines.push('  blockedBy: z.string().optional().describe("add blocked-by relation to issue"),');
  lines.push('  relatesTo: z.string().optional().describe("add relates-to relation to issue"),');
  lines.push('  comments: z.boolean().optional().describe("list comments on issue"),');
  lines.push('  editComment: z.string().optional().describe("comment id to edit (requires --text)"),');
  lines.push('  text: z.string().optional().describe("text for --edit-comment or --reply-to"),');
  lines.push('  replyTo: z.string().optional().describe("comment id to reply to (requires --text)"),');
  lines.push('  deleteComment: z.string().optional().describe("comment id to delete"),');
  lines.push('  archive: z.boolean().optional().describe("archive the issue"),');
  lines.push('  react: z.string().optional().describe("comment id to add reaction (requires --emoji)"),');
  lines.push('  emoji: z.string().optional().describe("emoji for --react"),');
  lines.push('  unreact: z.string().optional().describe("reaction id to remove"),');
  lines.push('  subIssues: z.boolean().optional().describe("list sub-issues"),');

  // CLI-only flags from cli-spec.json
  const cliOnlyFlags = issueCommand?.flags.filter(f => f.cliOnly) || [];
  for (const flag of cliOnlyFlags) {
    const zodType = flag.type === "boolean" ? "z.boolean()" : "z.string()";
    const desc = flag.description.replace(/"/g, '\\"');
    lines.push(`  ${flag.name}: ${zodType}.optional().describe("${desc}"),`);
  }

  lines.push("});");

  return lines.join("\n");
}

function generateCliOnlyShowDispatchers(): string {
  const cliOnlyFlags = issueCommand?.flags.filter(f => f.cliOnly && f.dispatchIn === "show") || [];
  if (cliOnlyFlags.length === 0) return "";

  const lines: string[] = [""];
  for (const flag of cliOnlyFlags) {
    lines.push(`    if (input.${flag.name}) {`);
    lines.push(`      ${flag.handler}(issue);`);
    lines.push(`      return;`);
    lines.push(`    }`);
    lines.push("");
  }
  return lines.join("\n");
}

function generateCliOnlyUpdateDispatchers(): string {
  const cliOnlyFlags = issueCommand?.flags.filter(f => f.cliOnly && f.dispatchIn === "update") || [];
  if (cliOnlyFlags.length === 0) return "";

  const lines: string[] = [""];
  for (const flag of cliOnlyFlags) {
    lines.push(`    if (input.${flag.name}) {`);
    lines.push(`      await ${flag.handler}(client, issue, input.${flag.name});`);
    lines.push(`    }`);
    lines.push("");
  }
  return lines.join("\n");
}

function generateListIssuesInputSchema(): string {
  return `export const listIssuesInput = z.object({
  team: z.string().optional().describe("filter by team key"),
  state: z.string().optional().describe("filter by workflow state name"),
  assignee: z.string().optional().describe("filter by assignee email or @me"),
  label: z.string().optional().describe("filter by label name"),
  project: z.string().optional().describe("filter by project name"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});`;
}

function generateOutput(): string {
  const timestamp = new Date().toISOString();
  const cliOnlyFlags = issueCommand?.flags.filter(f => f.cliOnly) || [];
  const handCraftedHandlers = cliOnlyFlags.map(f => f.handler).filter(Boolean);
  const handCraftedImport = handCraftedHandlers.length > 0
    ? `import { ${handCraftedHandlers.join(", ")} } from "../hand-crafted/issue";`
    : "";

  // Add CLI-only mutation flags to MUTATION_FLAGS
  const cliOnlyMutationFlags = cliOnlyFlags
    .filter(f => f.dispatchIn === "update")
    .map(f => `"${f.name}"`);

  return `/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from extracted-schema.json at ${timestamp}
 *
 * Regenerate with: bun run packages/codegen/generate-issue-commands.ts
 */

import { z } from "zod";
import chalk from "chalk";
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
  resolveProjectByName,
  resolveCycleByName,
  resolveStateName,
  resolveAssignee,
  resolveIssueIdentifier,
  type Issue,
  type ListIssuesFilter,
  type Comment,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "../router/trpc";
import { handleApiError, exitWithError, EXIT_CODES } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  formatDate,
  formatPriority,
  truncate,
  outputCommentThreads,
  type TableColumn,
} from "../lib/output";
${handCraftedImport ? handCraftedImport : ""}

${generateListIssuesInputSchema()}

${generateIssueInputSchema()}

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

/**
 * Mutation flags that trigger UPDATE operation when present
 */
const MUTATION_FLAGS = [
  "state", "assignee", "priority", "label", "comment",
  "editComment", "replyTo", "deleteComment", "react", "unreact",
  "parent", "blocks", "blockedBy", "relatesTo", "title", "description",
  "team", "project", "cycle", "estimate", "dueDate"${cliOnlyMutationFlags.length > 0 ? `, ${cliOnlyMutationFlags.join(", ")}` : ""}
] as const;

/**
 * Infer operation from input flags
 * - no identifier + required create fields → CREATE
 * - identifier + no mutation flags → READ
 * - identifier + mutation flags → UPDATE
 * - identifier + --archive → ARCHIVE
 */
function inferOperation(input: IssueInput): "create" | "read" | "update" | "archive" {
  if (input.idOrNew === "new") {
    return "create";
  }
  if (input.archive) {
    return "archive";
  }
  for (const flag of MUTATION_FLAGS) {
    if (input[flag] !== undefined) {
      return "update";
    }
  }
  return "read";
}

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
      exitWithError(\`issue \${identifier} not found\`, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (input.open) {
      const { spawn } = await import("child_process");
      const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      spawn(cmd, [issue.url], { detached: true, stdio: "ignore" }).unref();
      console.log(\`opened \${issue.url}\`);
      return;
    }
${generateCliOnlyShowDispatchers()}
    if (input.comments) {
      const { comments, error } = await getIssueComments(client, issue.id);
      if (error) {
        console.error(\`failed to fetch comments: \${error}\`);
        return;
      }
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
    const { comments, error: commentsError } = await getIssueComments(client, issue.id);

    if (format === "json") {
      outputJson({
        ...issue,
        priority: formatPriority(issue.priority),
        createdAt: formatDate(issue.createdAt),
        updatedAt: formatDate(issue.updatedAt),
        comments,
      });
      return;
    }

    console.log(\`\${issue.identifier}: \${issue.title}\`);
    console.log();
    console.log(\`state:    \${issue.state ?? "-"}\`);
    console.log(\`assignee: \${issue.assignee ?? "-"}\`);
    console.log(\`priority: \${formatPriority(issue.priority)}\`);
    if (issue.parentId) {
      console.log(\`parent:   \${issue.parentId}\`);
    }
    console.log(\`created:  \${formatDate(issue.createdAt)}\`);
    console.log(\`updated:  \${formatDate(issue.updatedAt)}\`);
    console.log(\`url:      \${issue.url}\`);

    if (issue.description) {
      console.log();
      console.log(issue.description);
    }

    if (commentsError) {
      console.log();
      console.log(chalk.dim(\`comments: failed to load (\${commentsError})\`));
    } else if (comments.length > 0) {
      console.log();
      console.log("─".repeat(40));
      console.log();
      outputCommentThreads(comments);
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
      exitWithError(\`issue \${identifier} not found\`, undefined, EXIT_CODES.NOT_FOUND);
    }

    // Upfront validation: required flags
    if (input.editComment && !input.text) {
      exitWithError("--text is required with --edit-comment");
    }
    if (input.replyTo && !input.text) {
      exitWithError("--text is required with --reply-to");
    }
    if (input.react && !input.emoji) {
      exitWithError("--emoji is required with --react");
    }

    // Upfront validation: mutual exclusivity for comment operations
    const commentOpCount = [input.comment, input.editComment, input.replyTo, input.deleteComment].filter(Boolean).length;
    if (commentOpCount > 1) {
      exitWithError("only one comment operation allowed per invocation", "use --comment, --edit-comment, --reply-to, or --delete-comment separately");
    }

    // Upfront validation: mutual exclusivity for reaction operations
    const reactionOpCount = [input.react, input.unreact].filter(Boolean).length;
    if (reactionOpCount > 1) {
      exitWithError("only one reaction operation allowed per invocation", "use --react or --unreact, not both");
    }

    const updatePayload: Record<string, unknown> = {};
    const rawIssue = await client.issue(issue.id);
    const teamRef = await rawIssue.team;
    if (!teamRef) {
      exitWithError(\`issue \${identifier} has no team\`);
    }

    if (input.title) {
      updatePayload.title = input.title;
    }

    if (input.description) {
      updatePayload.description = input.description;
    }

    if (input.state) {
      const states = await getTeamStates(client, teamRef.id);
      const targetState = states.find(
        (s) => s.name.toLowerCase() === input.state!.toLowerCase()
      );
      if (!targetState) {
        const available = states.map((s) => s.name).join(", ");
        exitWithError(\`state "\${input.state}" not found\`, \`available states: \${available}\`);
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
          exitWithError(\`user "\${input.assignee}" not found\`);
        }
        updatePayload.assigneeId = user.id;
      }
    }

    if (input.priority) {
      updatePayload.priority = priorityFromString(input.priority);
    }

    if (input.label) {
      const labelInput = input.label;
      const isRemove = labelInput.startsWith("-");
      const labelName = isRemove ? labelInput.slice(1) : labelInput.startsWith("+") ? labelInput.slice(1) : labelInput;

      if (!labelName) {
        exitWithError("label name cannot be empty");
      }

      const labels = await getTeamLabels(client, teamRef.id);
      const targetLabel = labels.find(
        (l) => l.name.toLowerCase() === labelName.toLowerCase()
      );
      if (!targetLabel) {
        const available = labels.map((l) => l.name).join(", ");
        exitWithError(\`label "\${labelName}" not found\`, \`available labels: \${available}\`);
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
        exitWithError(\`parent issue "\${input.parent}" not found\`);
      }
      updatePayload.parentId = parentIssue.id;
    }

    if (Object.keys(updatePayload).length > 0) {
      await updateIssue(client, issue.id, updatePayload);
      console.log(\`updated \${identifier}\`);
    }

    if (input.blocks) {
      const blockedIssue = await getIssue(client, input.blocks);
      if (!blockedIssue) {
        exitWithError(\`issue "\${input.blocks}" not found\`);
      }
      const success = await createIssueRelation(client, issue.id, blockedIssue.id, "blocks");
      if (!success) {
        exitWithError(\`failed to create blocks relation\`);
      }
      console.log(\`\${identifier} now blocks \${input.blocks}\`);
    }

    if (input.blockedBy) {
      const blockerIssue = await getIssue(client, input.blockedBy);
      if (!blockerIssue) {
        exitWithError(\`issue "\${input.blockedBy}" not found\`);
      }
      const success = await createIssueRelation(client, blockerIssue.id, issue.id, "blocks");
      if (!success) {
        exitWithError(\`failed to create blocked-by relation\`);
      }
      console.log(\`\${identifier} is now blocked by \${input.blockedBy}\`);
    }

    if (input.relatesTo) {
      const relatedIssue = await getIssue(client, input.relatesTo);
      if (!relatedIssue) {
        exitWithError(\`issue "\${input.relatesTo}" not found\`);
      }
      const success = await createIssueRelation(client, issue.id, relatedIssue.id, "related");
      if (!success) {
        exitWithError(\`failed to create relates-to relation\`);
      }
      console.log(\`\${identifier} now relates to \${input.relatesTo}\`);
    }

    // Comment operations (mutually exclusive, validated above)
    if (input.comment) {
      await addComment(client, issue.id, input.comment);
      console.log(\`commented on \${identifier}\`);
    }

    if (input.editComment) {
      await updateComment(client, input.editComment, input.text!);
      console.log(\`updated comment \${input.editComment.slice(0, 8)}\`);
    }

    if (input.replyTo) {
      await replyToComment(client, issue.id, input.replyTo, input.text!);
      console.log(\`replied to comment \${input.replyTo.slice(0, 8)}\`);
    }

    if (input.deleteComment) {
      await deleteComment(client, input.deleteComment);
      console.log(\`deleted comment \${input.deleteComment.slice(0, 8)}\`);
    }

    // Reaction operations (mutually exclusive, validated above)
    if (input.react) {
      const success = await createReaction(client, input.react, input.emoji!);
      if (!success) {
        exitWithError(\`failed to add reaction to comment \${input.react.slice(0, 8)}\`);
      }
      console.log(\`added reaction \${input.emoji} to comment \${input.react.slice(0, 8)}\`);
    }

    if (input.unreact) {
      const success = await deleteReaction(client, input.unreact);
      if (!success) {
        exitWithError(\`reaction \${input.unreact.slice(0, 8)} not found\`, undefined, EXIT_CODES.NOT_FOUND);
      }
      console.log(\`removed reaction \${input.unreact.slice(0, 8)}\`);
    }
${generateCliOnlyUpdateDispatchers()}  } catch (error) {
    handleApiError(error);
  }
}

async function handleArchiveIssue(
  identifier: string,
  input: IssueInput
): Promise<void> {
  try {
    const client = getClient();
    const issue = await getIssue(client, identifier);

    if (!issue) {
      exitWithError(\`issue \${identifier} not found\`, undefined, EXIT_CODES.NOT_FOUND);
    }

    await archiveIssue(client, issue.id);
    console.log(\`archived \${identifier}\`);
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
      exitWithError(\`team "\${input.team}" not found\`, \`available teams: \${available}\`);
    }

    const createPayload: {
      teamId: string;
      title: string;
      description?: string;
      assigneeId?: string;
      priority?: number;
      labelIds?: string[];
      parentId?: string;
      projectId?: string;
      cycleId?: string;
      stateId?: string;
      estimate?: number;
      dueDate?: string;
    } = {
      teamId: team.id,
      title: input.title,
    };

    if (input.description) {
      createPayload.description = input.description;
    }

    if (input.assignee) {
      createPayload.assigneeId = await resolveAssignee(client, input.assignee);
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
        exitWithError(\`label "\${input.label}" not found\`, \`available labels: \${available}\`);
      }
      createPayload.labelIds = [targetLabel.id];
    }

    if (input.parent) {
      createPayload.parentId = await resolveIssueIdentifier(client, input.parent);
    }

    if (input.project) {
      createPayload.projectId = await resolveProjectByName(client, input.project);
    }

    if (input.cycle) {
      createPayload.cycleId = await resolveCycleByName(client, team.id, input.cycle);
    }

    if (input.state) {
      createPayload.stateId = await resolveStateName(client, team.id, input.state);
    }

    if (input.estimate !== undefined) {
      createPayload.estimate = input.estimate;
    }

    if (input.dueDate) {
      createPayload.dueDate = input.dueDate;
    }

    const issue = await createIssue(client, createPayload);

    // handle post-create relations
    if (issue) {
      if (input.blocks) {
        const blockedIssueId = await resolveIssueIdentifier(client, input.blocks);
        await createIssueRelation(client, issue.id, blockedIssueId, "blocks");
        console.log(\`\${issue.identifier} now blocks \${input.blocks}\`);
      }

      if (input.blockedBy) {
        const blockerIssueId = await resolveIssueIdentifier(client, input.blockedBy);
        await createIssueRelation(client, blockerIssueId, issue.id, "blocks");
        console.log(\`\${issue.identifier} is now blocked by \${input.blockedBy}\`);
      }

      if (input.relatesTo) {
        const relatedIssueId = await resolveIssueIdentifier(client, input.relatesTo);
        await createIssueRelation(client, issue.id, relatedIssueId, "related");
        console.log(\`\${issue.identifier} now relates to \${input.relatesTo}\`);
      }

      console.log(\`created \${issue.identifier}: \${issue.title}\`);
    } else {
      console.log("created issue");
    }
  } catch (error) {
    handleApiError(error);
  }
}

export const generatedIssuesRouter = router({
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
      const operation = inferOperation(input);

      switch (operation) {
        case "create":
          await handleCreateIssue(input);
          break;
        case "archive":
          await handleArchiveIssue(input.idOrNew, input);
          break;
        case "update":
          await handleUpdateIssue(input.idOrNew, input);
          break;
        case "read":
        default:
          await handleShowIssue(input.idOrNew, input);
          break;
      }
    }),
});

`;
}

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

const output = generateOutput();
writeFileSync(outputPath, output);

console.log(`generated ${outputPath}`);

const expectedFlags = getExpectedCliFlags();
const generatedSchema = generateIssueInputSchema();
const generatedFlags = new Set<string>();
const flagRegex = /^\s+(\w+):/gm;
let match;
while ((match = flagRegex.exec(generatedSchema)) !== null) {
  generatedFlags.add(match[1]);
}

console.log(`\nparity check:`);
console.log(`  cli-spec.json issue flags: ${expectedFlags.size}`);
console.log(`  generated issue flags: ${generatedFlags.size}`);

const missing = [...expectedFlags].filter(f => !generatedFlags.has(f));
const extra = [...generatedFlags].filter(f => !expectedFlags.has(f));

if (missing.length > 0) {
  console.log(`  missing: ${missing.join(", ")}`);
}
if (extra.length > 0) {
  console.log(`  extra: ${extra.join(", ")}`);
}
if (missing.length === 0 && extra.length === 0) {
  console.log(`  ✓ flags match`);
}
