#!/usr/bin/env bun
/**
 * generate all entity commands from extracted-schema.json
 *
 * input: packages/codegen/extracted-schema.json
 * output: packages/cli/src/generated/{entity}.ts
 *
 * this is the consolidated generator - one file to generate all entity commands
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  type SchemaField,
  type ExtractedSchema,
  graphqlTypeToZod,
} from "./types";
import { getCliFlagForField } from "./field-resolvers";
import {
  ENTITY_DEFINITIONS,
  getFlagEntities,
  getScopedEntities,
} from "./entity-definitions";
import {
  type FlagEntity,
  type ScopedEntity,
  type FlagOperation,
  getFlagsForCommand,
  getScopedForCommand,
} from "./entity-schema";

const rootDir = join(import.meta.dir, "../..");
const schemaPath = join(import.meta.dir, "extracted-schema.json");
const outputDir = join(rootDir, "packages/cli/src/generated");

const schema: ExtractedSchema = JSON.parse(readFileSync(schemaPath, "utf-8"));

// === flag/scoped injection helpers ===

/**
 * generates zod field declarations for injected flag operations.
 * called by inputSchema functions to add flags from entity-definitions.
 */
function generateFlagZodFields(commandName: string): string[] {
  const flags = getFlagsForCommand(ENTITY_DEFINITIONS, commandName);
  const lines: string[] = [];

  for (const flagEntity of flags) {
    for (const op of flagEntity.flags.operations) {
      const zodType = op.inputType === "boolean" ? "z.boolean()" : "z.string()";
      const desc = op.description.replace(/"/g, '\\"');
      lines.push(`  ${op.flag}: ${zodType}.optional().describe("${desc}"),`);
    }
  }

  return lines;
}

/**
 * generates zod field declarations for scoped entities (accessed via flags).
 */
function generateScopedZodFields(commandName: string): string[] {
  const scoped = getScopedForCommand(ENTITY_DEFINITIONS, commandName);
  const lines: string[] = [];

  for (const s of scoped) {
    const desc = s.scoped.description.replace(/"/g, '\\"');
    lines.push(`  ${s.scoped.flag}: z.boolean().optional().describe("${desc}"),`);
  }

  return lines;
}

/**
 * collects imports needed for injected flags (handlers like createReaction, deleteReaction, etc).
 */
function getInjectedImports(commandName: string): string[] {
  const flags = getFlagsForCommand(ENTITY_DEFINITIONS, commandName);
  const imports = new Set<string>();

  for (const flagEntity of flags) {
    for (const op of flagEntity.flags.operations) {
      if (op.handler) {
        imports.add(op.handler);
      }
    }
    // special cases for subscription auto-find
    if (flagEntity.name === "NotificationSubscription") {
      imports.add("findUserSubscription");
    }
  }

  const scoped = getScopedForCommand(ENTITY_DEFINITIONS, commandName);
  for (const s of scoped) {
    if (s.scoped.listHandler) imports.add(s.scoped.listHandler);
    if (s.scoped.getHandler) imports.add(s.scoped.getHandler);
  }

  return Array.from(imports);
}

/**
 * collects mutation flag names for injected entities (used in inferOperation).
 */
function getInjectedMutationFlags(commandName: string): string[] {
  const flags = getFlagsForCommand(ENTITY_DEFINITIONS, commandName);
  const mutationFlags: string[] = [];

  for (const flagEntity of flags) {
    for (const op of flagEntity.flags.operations) {
      // all flag operations are mutations (create or delete)
      mutationFlags.push(op.flag);
    }
  }

  return mutationFlags;
}

interface EntityConfig {
  entityKey: string;
  singularCommand: string;
  pluralCommand: string;
  pluralAlias?: string[];
  outputFile: string;
  positionalArg: { name: string; description: string };
  fieldsToExclude: string[];
  imports: string[];
  coreTypes: string[];
  listInputSchema: () => string;
  inputSchema: (fields: SchemaField[]) => string;
  listHandler: string;
  showHandler: string;
  updateHandler: string;
  createHandler: string;
  deleteHandler?: string;
  archiveHandler?: string;
  columns: string;
  inferOperation: string;
  extraHandlers?: string;
  extraInputTypes?: string;
  hasDeleteFlag?: boolean;
  hasArchiveFlag?: boolean;
}

const issueConfig: EntityConfig = {
  entityKey: "Issue",
  singularCommand: "issue",
  pluralCommand: "issues",
  pluralAlias: ["i"],
  outputFile: "issue.ts",
  positionalArg: { name: "idOrNew", description: "issue identifier (e.g. ENG-123) or 'new'" },
  fieldsToExclude: [
    "id", "slaBreachesAt", "slaStartedAt", "snoozedUntilAt", "snoozedById", "slaType",
    "autoClosedByParentClosing", "descriptionData", "lastAppliedTemplateId",
    "addedLabelIds", "removedLabelIds", "subscriberIds", "trashed",
    "sortOrder", "subIssueSortOrder", "boardOrder", "previousIdentifiers", "delegateId",
    "labelIds",
  ],
  imports: [
    "getClient",
    "listIssues",
    "getIssue",
    "createIssue",
    "updateIssue",
    "archiveIssue",
    "findTeamByKeyOrName",
    "getAvailableTeamKeys",
    "getTeamLabels",
    "resolveAssignee",
    "priorityFromString",
    "resolveStateName",
    "resolveIssueIdentifier",
    "resolveProjectByName",
    "resolveCycleByName",
    "resolveMilestoneByName",
    "createIssueRelation",
    "addComment",
    "updateComment",
    "replyToComment",
    "deleteComment",
    "createCommentReaction",
    "deleteReaction",
    "getIssueComments",
    "getSubIssues",
    "getTeamStates",
  ],
  coreTypes: ["Issue", "ListIssuesFilter"],
  listInputSchema: () => `export const listIssuesInput = z.object({
  team: z.string().optional().describe("filter by team key"),
  project: z.string().optional().describe("filter by project name"),
  assignee: z.string().optional().describe("filter by assignee email or @me"),
  state: z.string().optional().describe("filter by state name"),
  priority: z.string().optional().describe("filter by priority"),
  label: z.string().optional().describe("filter by label name"),
  cycle: z.string().optional().describe("filter by cycle"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});`,
  inputSchema: (fields: SchemaField[]) => {
    const lines: string[] = [];
    lines.push("export const issueInput = z.object({");
    lines.push('  idOrNew: z.string().meta({ positional: true }).describe("issue identifier (e.g. ENG-123) or \'new\'"),');
    lines.push('  json: z.boolean().optional().describe("output as json"),');
    lines.push('  open: z.boolean().optional().describe("open issue in browser"),');

    const filteredFields = fields.filter(f => !f.isDeprecated && !issueConfig.fieldsToExclude.includes(f.name) && !f.description.includes("[Internal]"));

    for (const field of filteredFields) {
      const cliName = getCliFlagForField(field.name);
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
      } else if (field.name === "projectMilestoneId") {
        zodType = 'z.string().optional().describe("set milestone name (requires --project)")';
        lines.push(`  milestone: ${zodType},`);
        continue;
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

    lines.push('  label: z.string().optional().describe("set label (+name to add, -name to remove)"),');
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
    lines.push("});");

    return lines.join("\n");
  },
  columns: `const issueColumns: TableColumn<Issue>[] = [
  { header: "ID", value: (i) => i.identifier, width: 10 },
  { header: "STATE", value: (i) => i.state ?? "-", width: 15 },
  { header: "TITLE", value: (i) => truncate(i.title, 50), width: 50 },
  { header: "ASSIGNEE", value: (i) => i.assignee ?? "-", width: 15 },
  { header: "PRIORITY", value: (i) => formatPriority(i.priority), width: 8 },
];`,
  inferOperation: `type Operation = "create" | "read" | "update" | "archive";

function inferOperation(input: IssueInput): Operation {
  if (input.idOrNew === "new") return "create";
  if (input.archive) return "archive";

  const mutationFlags: (keyof IssueInput)[] = [
    "state", "assignee", "priority", "label", "comment",
    "editComment", "replyTo", "deleteComment", "react", "unreact",
    "parent", "blocks", "blockedBy", "relatesTo", "title", "description",
    "project", "cycle", "estimate", "dueDate", "milestone",
  ];
  for (const flag of mutationFlags) {
    if (input[flag] !== undefined) return "update";
  }

  return "read";
}`,
  listHandler: generateIssueListHandler(),
  showHandler: generateIssueShowHandler(),
  updateHandler: generateIssueUpdateHandler(),
  createHandler: generateIssueCreateHandler(),
  archiveHandler: generateIssueArchiveHandler(),
  hasArchiveFlag: true,
  extraHandlers: generateIssueExtraImports(),
};

const projectConfig: EntityConfig = {
  entityKey: "Project",
  singularCommand: "project",
  pluralCommand: "projects",
  pluralAlias: ["p"],
  outputFile: "project.ts",
  positionalArg: { name: "name", description: "project name or 'new'" },
  fieldsToExclude: [
    "id", "sortOrder", "prioritySortOrder", "trashed",
    "lastAppliedTemplateId", "convertedFromIssueId",
    "slackNewIssue", "slackIssueComments", "slackIssueStatuses",
    "projectUpdateRemindersPausedUntilAt", "updateReminderFrequencyInWeeks",
    "updateReminderFrequency", "frequencyResolution", "updateRemindersDay",
    "updateRemindersHour", "memberIds", "completedAt", "canceledAt",
    "startDateResolution", "targetDateResolution", "icon", "color", "labelIds",
  ],
  imports: [
    "getClient",
    "listProjects",
    "getProject",
    "getProjectIssues",
    "createProject",
    "deleteProject",
    "updateProject",
    "findTeamByKeyOrName",
    "getAvailableTeamKeys",
    "resolveAssignee",
    "resolveTeamByKey",
  ],
  coreTypes: ["Project"],
  listInputSchema: () => `export const listProjectsInput = z.object({
  team: z.string().optional().describe("filter by team key"),
  status: z.string().optional().describe("filter by status (planned, started, completed, etc)"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});`,
  inputSchema: (fields: SchemaField[]) => {
    const lines: string[] = [];
    lines.push("export const projectInput = z.object({");
    lines.push('  name: z.string().meta({ positional: true }).describe("project name or \'new\'"),');
    lines.push('  issues: z.boolean().optional().describe("list issues in project"),');
    lines.push('  json: z.boolean().optional().describe("output as json"),');
    lines.push('  quiet: z.boolean().optional().describe("output ids only"),');
    lines.push('  verbose: z.boolean().optional().describe("show all columns"),');
    lines.push('  delete: z.boolean().optional().describe("delete the project"),');

    const filteredFields = fields.filter(f => !f.isDeprecated && !projectConfig.fieldsToExclude.includes(f.name) && !f.description.includes("[Internal]"));

    for (const field of filteredFields) {
      const cliName = getCliFlagForField(field.name);

      let zodType: string;
      if (cliName === "status") {
        zodType = 'z.string().optional().describe("set project status")';
      } else if (cliName === "lead") {
        zodType = 'z.string().optional().describe("set lead by email or @me")';
      } else if (cliName === "team") {
        zodType = 'z.string().optional().describe("team key to associate project with")';
      } else if (cliName === "priority") {
        zodType = 'z.number().optional().describe("set priority (0=none, 1=urgent, 2=high, 3=normal, 4=low)")';
      } else if (cliName === "startDate") {
        zodType = 'z.string().optional().describe("set start date (YYYY-MM-DD)")';
      } else if (cliName === "targetDate") {
        zodType = 'z.string().optional().describe("set target date (YYYY-MM-DD)")';
      } else if (cliName === "content") {
        zodType = 'z.string().optional().describe("set project content as markdown")';
      } else if (cliName === "description") {
        zodType = 'z.string().optional().describe("project description")';
      } else if (field.name === "name") {
        zodType = 'z.string().optional().describe("new name for the project")';
        lines.push(`  newName: ${zodType},`);
        continue;
      } else {
        const desc = field.description.replace(/"/g, '\\"');
        zodType = `${graphqlTypeToZod(field)}.optional().describe("${desc}")`;
      }

      lines.push(`  ${cliName}: ${zodType},`);
    }

    // inject scoped entity flags (--updates, --labels, --showStatus, --milestones)
    lines.push(...generateScopedZodFields("project"));

    // inject flag entity fields (--react, --emoji, --unreact, --subscribe, --unsubscribe, --link)
    lines.push(...generateFlagZodFields("project"));

    lines.push("});");
    return lines.join("\n");
  },
  columns: `const projectColumns: TableColumn<Project>[] = [
  { header: "NAME", value: (p) => truncate(p.name, 30), width: 30 },
  { header: "STATE", value: (p) => p.state ?? "-", width: 12 },
  { header: "PROGRESS", value: (p) => \`\${Math.round((p.progress ?? 0) * 100)}%\`, width: 10 },
  { header: "TARGET", value: (p) => formatDate(p.targetDate), width: 12 },
];`,
  inferOperation: (() => {
    const baseMutationFlags = [
      "newName", "description", "content", "status", "startDate", "targetDate", "priority", "lead", "team"
    ];
    const injectedFlags = getInjectedMutationFlags("project");
    const allFlags = [...baseMutationFlags, ...injectedFlags];

    return `type Operation = "create" | "read" | "update" | "delete";

function inferOperation(input: ProjectInput): Operation {
  if (input.name === "new") return "create";
  if (input.delete) return "delete";

  const mutationFlags: (keyof ProjectInput)[] = [
    ${allFlags.map(f => `"${f}"`).join(", ")}
  ];
  for (const flag of mutationFlags) {
    if (input[flag] !== undefined) return "update";
  }

  return "read";
}`;
  })(),
  listHandler: generateProjectListHandler(),
  showHandler: generateProjectShowHandler(),
  updateHandler: generateProjectUpdateHandler(),
  createHandler: generateProjectCreateHandler(),
  deleteHandler: generateProjectDeleteHandler(),
  hasDeleteFlag: true,
};

const labelConfig: EntityConfig = {
  entityKey: "IssueLabel",
  singularCommand: "label",
  pluralCommand: "labels",
  outputFile: "label.ts",
  positionalArg: { name: "id", description: "label id or 'new'" },
  fieldsToExclude: ["id", "retiredAt", "isGroup", "parentId"],
  imports: [
    "getClient",
    "listLabels",
    "getLabel",
    "createLabel",
    "updateLabel",
    "deleteLabel",
    "resolveTeamByKey",
  ],
  coreTypes: ["Label"],
  listInputSchema: () => `export const listLabelsInput = z.object({
  team: z.string().optional().describe("filter by team key"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});`,
  inputSchema: (fields: SchemaField[]) => {
    const lines: string[] = [];
    lines.push("export const labelInput = z.object({");
    lines.push('  id: z.string().meta({ positional: true }).describe("label id or \'new\'"),');
    lines.push('  json: z.boolean().optional().describe("output as json"),');
    lines.push('  delete: z.boolean().optional().describe("delete the label"),');
    lines.push('  team: z.string().optional().describe("team key (required for new)"),');

    const filteredFields = fields.filter(f => !f.isDeprecated && !labelConfig.fieldsToExclude.includes(f.name));

    for (const field of filteredFields) {
      const cliName = getCliFlagForField(field.name);

      let zodType: string;
      if (cliName === "color") {
        zodType = 'z.string().optional().describe("hex color code")';
      } else if (cliName === "name") {
        zodType = 'z.string().optional().describe("label name (required for new)")';
      } else if (cliName === "description") {
        zodType = 'z.string().optional().describe("label description")';
      } else {
        const desc = field.description.replace(/"/g, '\\"');
        zodType = `${graphqlTypeToZod(field)}.optional().describe("${desc}")`;
      }

      lines.push(`  ${cliName}: ${zodType},`);
    }

    lines.push("});");
    return lines.join("\n");
  },
  columns: `const labelColumns: TableColumn<Label>[] = [
  { header: "ID", value: (l) => l.id.slice(0, 8), width: 10 },
  { header: "NAME", value: (l) => truncate(l.name, 30), width: 30 },
  { header: "COLOR", value: (l) => l.color ?? "-", width: 10 },
  { header: "DESCRIPTION", value: (l) => truncate(l.description ?? "-", 40), width: 40 },
];`,
  inferOperation: `type Operation = "create" | "read" | "update" | "delete";

function inferOperation(input: LabelInput): Operation {
  if (input.id === "new") return "create";
  if (input.delete) return "delete";

  const mutationFlags: (keyof LabelInput)[] = ["name", "color", "description"];
  for (const flag of mutationFlags) {
    if (input[flag] !== undefined) return "update";
  }

  return "read";
}`,
  listHandler: generateLabelListHandler(),
  showHandler: generateLabelShowHandler(),
  updateHandler: generateLabelUpdateHandler(),
  createHandler: generateLabelCreateHandler(),
  deleteHandler: generateLabelDeleteHandler(),
  hasDeleteFlag: true,
};

const docConfig: EntityConfig = {
  entityKey: "Document",
  singularCommand: "doc",
  pluralCommand: "docs",
  outputFile: "doc.ts",
  positionalArg: { name: "id", description: "document id or 'new'" },
  fieldsToExclude: [],
  imports: [
    "getClient",
    "listDocuments",
    "getDocument",
    "createDocument",
    "updateDocument",
    "deleteDocument",
    "resolveProjectByName",
  ],
  coreTypes: ["Document"],
  listInputSchema: () => `export const listDocsInput = z.object({
  project: z.string().optional().describe("filter by project id"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});`,
  inputSchema: () => `export const docInput = z.object({
  id: z.string().meta({ positional: true }).describe("document id or 'new'"),
  title: z.string().optional().describe("document title (required for new)"),
  content: z.string().optional().describe("document content"),
  project: z.string().optional().describe("project id to attach document to"),
  delete: z.boolean().optional().describe("delete the document"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});`,
  columns: `const docColumns: TableColumn<Document>[] = [
  { header: "ID", value: (d) => d.id, width: 20 },
  { header: "TITLE", value: (d) => truncate(d.title, 50), width: 50 },
];`,
  inferOperation: `type Operation = "create" | "read" | "update" | "delete";

function inferOperation(input: DocInput): Operation {
  if (input.id === "new") return "create";
  if (input.delete) return "delete";
  if (input.title !== undefined || input.content !== undefined) return "update";
  return "read";
}`,
  listHandler: generateDocListHandler(),
  showHandler: generateDocShowHandler(),
  updateHandler: generateDocUpdateHandler(),
  createHandler: generateDocCreateHandler(),
  deleteHandler: generateDocDeleteHandler(),
  hasDeleteFlag: true,
};

function generateMilestoneListHandler(): string {
  return `async function handleListMilestones(
  input: z.infer<typeof listMilestonesInput>
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    let projectId: string | undefined;
    if (input.project) {
      projectId = await resolveProjectByName(client, input.project);
    }

    const milestones = await listMilestones(client, projectId ? { projectId } : undefined);

    if (format === "json") {
      outputJson(milestones);
      return;
    }

    if (format === "quiet") {
      outputQuiet(milestones.map((m) => m.id));
      return;
    }

    outputTable(milestones, milestoneColumns, outputOpts);
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateMilestoneShowHandler(): string {
  return `async function handleShowMilestone(name: string, input: MilestoneInput): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    if (!input.project) {
      exitWithError("--project is required to find milestone", 'usage: lnr milestone "name" --project "..."');
    }

    const projectId = await resolveProjectByName(client, input.project);
    const milestoneId = await resolveMilestoneByName(client, projectId, name);
    const milestone = await getMilestone(client, milestoneId);

    if (!milestone) {
      exitWithError(\`milestone "\${name}" not found\`, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (format === "json") {
      outputJson(milestone);
      return;
    }

    if (format === "quiet") {
      console.log(milestone.id);
      return;
    }

    console.log(\`\${milestone.name}\`);
    console.log(\`id: \${milestone.id}\`);
    console.log(\`target date: \${milestone.targetDate ?? "-"}\`);
    if (milestone.description) {
      console.log(\`description: \${milestone.description}\`);
    }
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateMilestoneUpdateHandler(): string {
  return `async function handleUpdateMilestone(name: string, input: MilestoneInput): Promise<void> {
  try {
    const client = getClient();

    if (!input.project) {
      exitWithError("--project is required to find milestone", 'usage: lnr milestone "name" --project "..."');
    }

    const projectId = await resolveProjectByName(client, input.project);
    const milestoneId = await resolveMilestoneByName(client, projectId, name);

    const updatePayload: {
      name?: string;
      description?: string;
      targetDate?: string;
    } = {};

    if (input.newName !== undefined) updatePayload.name = input.newName;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.targetDate !== undefined) updatePayload.targetDate = input.targetDate;

    if (Object.keys(updatePayload).length > 0) {
      const result = await updateMilestone(client, milestoneId, updatePayload);
      if (!result) {
        exitWithError(\`milestone "\${name}" not found\`, undefined, EXIT_CODES.NOT_FOUND);
      }
      console.log(\`updated milestone: \${result.name}\`);
    }
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateMilestoneCreateHandler(): string {
  return `async function handleCreateMilestone(input: MilestoneInput): Promise<void> {
  if (!input.newName) {
    exitWithError("--new-name is required", 'usage: lnr milestone new --new-name "..." --project "..."');
  }

  if (!input.project) {
    exitWithError("--project is required", 'usage: lnr milestone new --new-name "..." --project "..."');
  }

  try {
    const client = getClient();

    const projectId = await resolveProjectByName(client, input.project);

    const milestone = await createMilestone(client, {
      name: input.newName,
      projectId,
      description: input.description,
      targetDate: input.targetDate,
    });

    if (milestone) {
      console.log(\`created milestone: \${milestone.name}\`);
    } else {
      exitWithError("failed to create milestone");
    }
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateMilestoneDeleteHandler(): string {
  return `async function handleDeleteMilestone(name: string, _input: MilestoneInput): Promise<void> {
  try {
    const client = getClient();

    if (!_input.project) {
      exitWithError("--project is required to find milestone", 'usage: lnr milestone "name" --project "..." --delete');
    }

    const projectId = await resolveProjectByName(client, _input.project);
    const milestoneId = await resolveMilestoneByName(client, projectId, name);
    const success = await deleteMilestone(client, milestoneId);

    if (!success) {
      exitWithError(\`milestone "\${name}" not found\`, undefined, EXIT_CODES.NOT_FOUND);
    }

    console.log(\`deleted milestone: \${name}\`);
  } catch (error) {
    handleApiError(error);
  }
}`;
}

const milestoneConfig: EntityConfig = {
  entityKey: "ProjectMilestone",
  singularCommand: "milestone",
  pluralCommand: "milestones",
  outputFile: "milestone.ts",
  positionalArg: { name: "name", description: "milestone name or 'new'" },
  fieldsToExclude: ["id", "sortOrder", "descriptionData"],
  imports: [
    "getClient",
    "listMilestones",
    "getMilestone",
    "createMilestone",
    "updateMilestone",
    "deleteMilestone",
    "resolveProjectByName",
    "resolveMilestoneByName",
  ],
  coreTypes: ["ProjectMilestone"],
  listInputSchema: () => `export const listMilestonesInput = z.object({
  project: z.string().optional().describe("filter by project name"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});`,
  inputSchema: () => `export const milestoneInput = z.object({
  name: z.string().meta({ positional: true }).describe("milestone name or 'new'"),
  project: z.string().optional().describe("project name (required for new)"),
  newName: z.string().optional().describe("new name for the milestone"),
  description: z.string().optional().describe("milestone description"),
  targetDate: z.string().optional().describe("target date (YYYY-MM-DD)"),
  delete: z.boolean().optional().describe("delete the milestone"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});`,
  columns: `const milestoneColumns: TableColumn<ProjectMilestone>[] = [
  { header: "ID", value: (m) => m.id.slice(0, 8), width: 10 },
  { header: "NAME", value: (m) => truncate(m.name, 30), width: 30 },
  { header: "TARGET_DATE", value: (m) => m.targetDate ? formatDate(m.targetDate) : "-", width: 12 },
];`,
  inferOperation: `type Operation = "create" | "read" | "update" | "delete";

function inferOperation(input: MilestoneInput): Operation {
  if (input.name === "new") return "create";
  if (input.delete) return "delete";

  const mutationFlags: (keyof MilestoneInput)[] = ["newName", "description", "targetDate"];
  for (const flag of mutationFlags) {
    if (input[flag] !== undefined) return "update";
  }

  return "read";
}`,
  listHandler: generateMilestoneListHandler(),
  showHandler: generateMilestoneShowHandler(),
  updateHandler: generateMilestoneUpdateHandler(),
  createHandler: generateMilestoneCreateHandler(),
  deleteHandler: generateMilestoneDeleteHandler(),
  hasDeleteFlag: true,
};

const entityConfigs: EntityConfig[] = [issueConfig, projectConfig, labelConfig, docConfig];

function generateEntityFile(config: EntityConfig): string {
  const timestamp = new Date().toISOString();
  const entitySchema = schema.entities[config.entityKey];
  const updateFields = entitySchema?.updateInput?.fields || [];
  
  const TypeName = config.singularCommand.charAt(0).toUpperCase() + config.singularCommand.slice(1);
  const inputType = `${TypeName}Input`;

  // merge base imports with injected imports from entity-definitions
  const injectedImports = getInjectedImports(config.singularCommand);
  const allImports = [...new Set([...config.imports, ...injectedImports])];

  return `/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from extracted-schema.json at ${timestamp}
 *
 * Regenerate with: bun run packages/codegen/generate-commands.ts
 */

import { z } from "zod";
import {
  ${allImports.join(",\n  ")},
  type ${config.coreTypes.join(",\n  type ")},
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
  type OutputOptions,
  type TableColumn,
} from "../lib/output";
${config.extraHandlers || ""}

${config.listInputSchema()}

${config.inputSchema(updateFields)}

type ${inputType} = z.infer<typeof ${config.singularCommand}Input>;

${config.columns}

${config.inferOperation}

${config.listHandler}

${config.showHandler}

${config.updateHandler}

${config.createHandler}

${config.deleteHandler || ""}

${config.archiveHandler || ""}

export const generated${TypeName}sRouter = router({
  ${config.pluralCommand}: procedure
    .meta({
      description: "list ${config.pluralCommand}",
      ${config.pluralAlias ? `aliases: { command: ${JSON.stringify(config.pluralAlias)} },` : ""}
    })
    .input(list${TypeName}sInput)
    .query(async ({ input }) => {
      await handleList${TypeName}s(input);
    }),

  ${config.singularCommand}: procedure
    .meta({
      description: "show or update a ${config.singularCommand}, or create with 'new'",
    })
    .input(${config.singularCommand}Input)
    .mutation(async ({ input }) => {
      const operation = inferOperation(input);

      switch (operation) {
        case "create":
          await handleCreate${TypeName}(input);
          break;
        ${config.hasDeleteFlag ? `case "delete":
          await handleDelete${TypeName}(input.${config.positionalArg.name}, input);
          break;` : ""}
        ${config.hasArchiveFlag ? `case "archive":
          await handleArchive${TypeName}(input.${config.positionalArg.name}, input);
          break;` : ""}
        case "update":
          await handleUpdate${TypeName}(input.${config.positionalArg.name}, input);
          break;
        case "read":
        default:
          await handleShow${TypeName}(input.${config.positionalArg.name}, input);
          break;
      }
    }),
});
`;
}

function generateIssueExtraImports(): string {
  return "";
}

function generateIssueListHandler(): string {
  return `async function handleListIssues(
  input: z.infer<typeof listIssuesInput>
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    const filters: ListIssuesFilter = {};
    
    if (input.team) {
      filters.team = input.team;
    }

    if (input.assignee) {
      filters.assignee = input.assignee;
    }

    if (input.state) {
      filters.state = input.state;
    }

    if (input.label) {
      filters.label = input.label;
    }

    if (input.project) {
      filters.project = input.project;
    }

    const issues = await listIssues(client, filters);

    if (format === "json") {
      outputJson(issues);
      return;
    }

    if (format === "quiet") {
      outputQuiet(issues.map((i) => i.identifier));
      return;
    }

    outputTable(issues, issueColumns, outputOpts);
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateIssueShowHandler(): string {
  return `async function handleShowIssue(
  identifier: string,
  input: IssueInput
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : undefined,
    };
    const format = getOutputFormat(outputOpts);

    const issue = await getIssue(client, identifier);

    if (!issue) {
      exitWithError(\`issue \${identifier} not found\`, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (input.comments) {
      const result = await getIssueComments(client, issue.id);
      if (format === "json") {
        outputJson(result.comments);
      } else {
        for (const c of result.comments) {
          console.log(\`[\${c.id.slice(0, 8)}] \${c.user ?? "unknown"}: \${c.body}\`);
        }
      }
      return;
    }

    if (input.subIssues) {
      const subIssues = await getSubIssues(client, issue.id);
      if (format === "json") {
        outputJson(subIssues);
      } else {
        outputTable(subIssues, issueColumns, outputOpts);
      }
      return;
    }

    if (format === "json") {
      outputJson(issue);
      return;
    }

    console.log(\`\${issue.identifier}: \${issue.title}\`);
    if (issue.description) {
      console.log(\`  \${truncate(issue.description, 80)}\`);
    }
    console.log();
    console.log(\`state:    \${issue.state ?? "-"}\`);
    console.log(\`assignee: \${issue.assignee ?? "-"}\`);
    console.log(\`priority: \${formatPriority(issue.priority)}\`);
    console.log(\`created:  \${formatDate(issue.createdAt)}\`);
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateIssueUpdateHandler(): string {
  return `async function handleUpdateIssue(
  identifier: string,
  input: IssueInput
): Promise<void> {
  try {
    const client = getClient();
    const issue = await getIssue(client, identifier);

    if (!issue) {
      exitWithError(\`issue \${identifier} not found\`, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (input.editComment && !input.text) {
      exitWithError("--text is required with --edit-comment");
    }
    if (input.replyTo && !input.text) {
      exitWithError("--text is required with --reply-to");
    }
    if (input.react && !input.emoji) {
      exitWithError("--emoji is required with --react");
    }

    const commentOpCount = [input.comment, input.editComment, input.replyTo, input.deleteComment].filter(Boolean).length;
    if (commentOpCount > 1) {
      exitWithError("only one comment operation allowed per invocation", "use --comment, --edit-comment, --reply-to, or --delete-comment separately");
    }

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

    if (input.milestone) {
      if (!input.project) {
        exitWithError("--project is required when using --milestone");
      }
      const projectId = await resolveProjectByName(client, input.project);
      updatePayload.projectMilestoneId = await resolveMilestoneByName(client, projectId, input.milestone);
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

    if (input.react) {
      const success = await createCommentReaction(client, input.react, input.emoji!);
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
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateIssueCreateHandler(): string {
  return `async function handleCreateIssue(input: IssueInput): Promise<void> {
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
      projectMilestoneId?: string;
      cycleId?: string;
      stateId?: string;
      estimate?: number;
      dueDate?: string;
    } = {
      teamId: team.id,
      title: input.title,
    };

    if (input.description) createPayload.description = input.description;
    if (input.assignee) createPayload.assigneeId = await resolveAssignee(client, input.assignee);
    if (input.priority) createPayload.priority = priorityFromString(input.priority);

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

    if (input.parent) createPayload.parentId = await resolveIssueIdentifier(client, input.parent);
    if (input.project) createPayload.projectId = await resolveProjectByName(client, input.project);
    if (input.milestone) {
      if (!createPayload.projectId) {
        exitWithError("--project is required when using --milestone");
      }
      createPayload.projectMilestoneId = await resolveMilestoneByName(client, createPayload.projectId, input.milestone);
    }
    if (input.cycle) createPayload.cycleId = await resolveCycleByName(client, team.id, input.cycle);
    if (input.state) createPayload.stateId = await resolveStateName(client, team.id, input.state);
    if (input.estimate !== undefined) createPayload.estimate = input.estimate;
    if (input.dueDate) createPayload.dueDate = input.dueDate;

    const issue = await createIssue(client, createPayload);

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
}`;
}

function generateIssueArchiveHandler(): string {
  return `async function handleArchiveIssue(
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
}`;
}

function generateProjectListHandler(): string {
  return `async function handleListProjects(
  input: z.infer<typeof listProjectsInput>
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    const projects = await listProjects(client);

    if (format === "json") {
      outputJson(projects);
      return;
    }

    if (format === "quiet") {
      outputQuiet(projects.map((p) => p.id));
      return;
    }

    outputTable(projects, projectColumns, outputOpts);
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateProjectShowHandler(): string {
  return `async function handleShowProject(
  name: string,
  input: ProjectInput
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    const project = await getProject(client, name);

    if (!project) {
      exitWithError(\`project "\${name}" not found\`, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (input.issues) {
      const issues = await getProjectIssues(client, project.id);
      if (format === "json") {
        outputJson(issues);
      } else if (format === "quiet") {
        outputQuiet(issues.map((i) => i.identifier));
      } else {
        for (const issue of issues) {
          console.log(\`\${issue.identifier}: \${issue.title}\`);
        }
      }
      return;
    }

    // scoped entity handlers (injected from entity-definitions)
    if (input.updates) {
      const updates = await getProjectUpdates(client, project.id);
      if (format === "json") {
        outputJson(updates);
      } else if (format === "quiet") {
        outputQuiet(updates.map((u) => u.id));
      } else {
        for (const u of updates) {
          console.log(\`[\${u.health}] \${formatDate(u.createdAt)} - \${truncate(u.body.replace(/\\n/g, " "), 60)}\`);
        }
      }
      return;
    }

    if (input.labels) {
      const labels = await getProjectLabels(client, project.id);
      if (format === "json") {
        outputJson(labels);
      } else if (format === "quiet") {
        outputQuiet(labels.map((l) => l.id));
      } else {
        for (const l of labels) {
          console.log(\`\${l.name} (\${l.color})\`);
        }
      }
      return;
    }

    if (input.showStatus) {
      const status = await getProjectStatus(client, project.id);
      if (!status) {
        console.log("no status set");
        return;
      }
      if (format === "json") {
        outputJson(status);
      } else if (format === "quiet") {
        console.log(status.id);
      } else {
        console.log(\`\${status.name} (\${status.type}) - \${status.color}\`);
      }
      return;
    }

    if (input.milestones) {
      const milestones = await listMilestones(client, { projectId: project.id });
      if (format === "json") {
        outputJson(milestones);
      } else if (format === "quiet") {
        outputQuiet(milestones.map((m) => m.id));
      } else {
        if (milestones.length === 0) {
          console.log("no milestones");
          return;
        }
        for (const m of milestones) {
          console.log(\`\${m.name}\${m.targetDate ? \` (target: \${formatDate(m.targetDate)})\` : ""}\`);
        }
      }
      return;
    }

    if (format === "json") {
      outputJson(project);
      return;
    }

    if (format === "quiet") {
      console.log(project.id);
      return;
    }

    console.log(\`\${project.name}\`);
    if (project.description) {
      console.log(\`  \${truncate(project.description, 80)}\`);
    }
    console.log();
    console.log(\`state:    \${project.state ?? "-"}\`);
    console.log(\`progress: \${Math.round((project.progress ?? 0) * 100)}%\`);
    console.log(\`target:   \${formatDate(project.targetDate)}\`);
    console.log(\`started:  \${formatDate(project.startDate)}\`);
    console.log(\`created:  \${formatDate(project.createdAt)}\`);
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateProjectUpdateHandler(): string {
  return `async function handleUpdateProject(
  name: string,
  input: ProjectInput
): Promise<void> {
  try {
    const client = getClient();
    const project = await getProject(client, name);

    if (!project) {
      exitWithError(\`project "\${name}" not found\`, undefined, EXIT_CODES.NOT_FOUND);
    }

    const updatePayload: {
      name?: string;
      description?: string;
      content?: string;
      statusId?: string;
      startDate?: string;
      targetDate?: string;
      priority?: number;
      leadId?: string;
      teamIds?: string[];
    } = {};

    if (input.newName) updatePayload.name = input.newName;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.content !== undefined) updatePayload.content = input.content;
    if (input.status !== undefined) updatePayload.statusId = input.status;
    if (input.startDate !== undefined) updatePayload.startDate = input.startDate;
    if (input.targetDate !== undefined) updatePayload.targetDate = input.targetDate;
    if (input.priority !== undefined) updatePayload.priority = input.priority;
    if (input.lead !== undefined) updatePayload.leadId = await resolveAssignee(client, input.lead);
    if (input.team !== undefined) updatePayload.teamIds = [await resolveTeamByKey(client, input.team)];

    if (Object.keys(updatePayload).length > 0) {
      await updateProject(client, project.id, updatePayload);
      console.log(\`updated \${name}\`);
    }

    // flag entity handlers (injected from entity-definitions)
    if (input.react) {
      if (!input.emoji) {
        exitWithError("--emoji is required when using --react");
      }
      const success = await createReaction(client, { type: "projectUpdate", id: input.react }, input.emoji);
      if (!success) {
        exitWithError(\`failed to add reaction to project update \${input.react.slice(0, 8)}\`);
      }
      console.log(\`added reaction \${input.emoji} to project update \${input.react.slice(0, 8)}\`);
    }

    if (input.unreact) {
      const success = await deleteReaction(client, input.unreact);
      if (!success) {
        exitWithError(\`reaction \${input.unreact.slice(0, 8)} not found\`, undefined, EXIT_CODES.NOT_FOUND);
      }
      console.log(\`removed reaction \${input.unreact.slice(0, 8)}\`);
    }

    if (input.subscribe) {
      const subscriptionId = await createSubscription(client, { type: "project", projectId: project.id });
      console.log(\`subscribed to \${name} (subscription: \${subscriptionId.slice(0, 8)})\`);
    }

    if (input.unsubscribe) {
      const subscriptionId = await findUserSubscription(client, { type: "project", projectId: project.id });
      if (!subscriptionId) {
        exitWithError(\`no subscription found for \${name}\`, "you may not be subscribed to this project");
      }
      const success = await deleteSubscription(client, subscriptionId);
      if (!success) {
        exitWithError(\`failed to remove subscription\`, undefined, EXIT_CODES.NOT_FOUND);
      }
      console.log(\`unsubscribed from \${name}\`);
    }
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateProjectCreateHandler(): string {
  return `async function handleCreateProject(input: ProjectInput): Promise<void> {
  if (!input.newName && !input.description) {
    exitWithError("--new-name is required", 'usage: lnr project new --new-name "..."');
  }

  const projectName = input.newName;
  if (!projectName) {
    exitWithError("--new-name is required", 'usage: lnr project new --new-name "..."');
  }

  try {
    const client = getClient();

    const createPayload: {
      name: string;
      description?: string;
      content?: string;
      teamIds?: string[];
      leadId?: string;
      startDate?: string;
      targetDate?: string;
      priority?: number;
    } = {
      name: projectName,
    };

    if (input.description) createPayload.description = input.description;
    if (input.content) createPayload.content = input.content;
    if (input.team) createPayload.teamIds = [await resolveTeamByKey(client, input.team)];
    if (input.lead) createPayload.leadId = await resolveAssignee(client, input.lead);
    if (input.startDate) createPayload.startDate = input.startDate;
    if (input.targetDate) createPayload.targetDate = input.targetDate;
    if (input.priority !== undefined) createPayload.priority = input.priority;

    const project = await createProject(client, createPayload);

    if (project) {
      console.log(\`created project: \${project.name}\`);
    } else {
      console.log("created project");
    }
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateProjectDeleteHandler(): string {
  return `async function handleDeleteProject(
  name: string,
  _input: ProjectInput
): Promise<void> {
  try {
    const client = getClient();
    const success = await deleteProject(client, name);

    if (!success) {
      exitWithError(\`project "\${name}" not found\`, undefined, EXIT_CODES.NOT_FOUND);
    }

    console.log(\`deleted project: \${name}\`);
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateLabelListHandler(): string {
  return `async function handleListLabels(
  input: z.infer<typeof listLabelsInput>
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    let teamId: string | undefined;
    if (input.team) {
      teamId = await resolveTeamByKey(client, input.team);
    }

    const labels = await listLabels(client, teamId);

    if (format === "json") {
      outputJson(labels);
      return;
    }

    if (format === "quiet") {
      outputQuiet(labels.map((l) => l.id));
      return;
    }

    outputTable(labels, labelColumns, outputOpts);
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateLabelShowHandler(): string {
  return `async function handleShowLabel(
  id: string,
  input: LabelInput
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : undefined,
    };
    const format = getOutputFormat(outputOpts);

    const label = await getLabel(client, id);

    if (!label) {
      exitWithError(\`label "\${id}" not found\`, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (format === "json") {
      outputJson(label);
      return;
    }

    console.log(\`\${label.name}\`);
    if (label.description) {
      console.log(\`  \${truncate(label.description, 80)}\`);
    }
    console.log();
    console.log(\`id:    \${label.id}\`);
    console.log(\`color: \${label.color ?? "-"}\`);
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateLabelUpdateHandler(): string {
  return `async function handleUpdateLabel(
  id: string,
  input: LabelInput
): Promise<void> {
  try {
    const client = getClient();

    const updatePayload: {
      name?: string;
      color?: string;
      description?: string;
    } = {};

    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.color !== undefined) updatePayload.color = input.color;
    if (input.description !== undefined) updatePayload.description = input.description;

    if (Object.keys(updatePayload).length > 0) {
      const success = await updateLabel(client, id, updatePayload);
      if (!success) {
        exitWithError(\`label "\${id}" not found\`, undefined, EXIT_CODES.NOT_FOUND);
      }
      console.log(\`updated label: \${id}\`);
    }
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateLabelCreateHandler(): string {
  return `async function handleCreateLabel(input: LabelInput): Promise<void> {
  if (!input.name) {
    exitWithError("--name is required", 'usage: lnr label new --name "..." --team <key>');
  }

  if (!input.team) {
    exitWithError("--team is required", 'usage: lnr label new --name "..." --team <key>');
  }

  try {
    const client = getClient();

    const teamId = await resolveTeamByKey(client, input.team);

    const label = await createLabel(client, {
      name: input.name,
      teamId,
      color: input.color,
      description: input.description,
    });

    if (label) {
      console.log(\`created label: \${label.name}\`);
    } else {
      exitWithError("failed to create label");
    }
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateLabelDeleteHandler(): string {
  return `async function handleDeleteLabel(
  id: string,
  _input: LabelInput
): Promise<void> {
  try {
    const client = getClient();
    const success = await deleteLabel(client, id);

    if (!success) {
      exitWithError(\`label "\${id}" not found\`, undefined, EXIT_CODES.NOT_FOUND);
    }

    console.log(\`deleted label: \${id}\`);
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateDocListHandler(): string {
  return `async function handleListDocs(
  input: z.infer<typeof listDocsInput>
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    let projectId: string | undefined;
    if (input.project) {
      projectId = await resolveProjectByName(client, input.project);
    }

    const documents = await listDocuments(client, projectId);

    if (format === "json") {
      outputJson(documents);
      return;
    }

    if (format === "quiet") {
      outputQuiet(documents.map((d) => d.id));
      return;
    }

    outputTable(documents, docColumns, outputOpts);
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateDocShowHandler(): string {
  return `async function handleShowDoc(id: string, input: DocInput): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    const doc = await getDocument(client, id);

    if (!doc) {
      exitWithError(\`document "\${id}" not found\`, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (format === "json") {
      outputJson(doc);
      return;
    }

    if (format === "quiet") {
      console.log(doc.id);
      return;
    }

    console.log(\`\${doc.title}\`);
    if (doc.content) {
      console.log();
      console.log(doc.content);
    }
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateDocUpdateHandler(): string {
  return `async function handleUpdateDoc(id: string, input: DocInput): Promise<void> {
  try {
    const client = getClient();

    const success = await updateDocument(client, id, {
      title: input.title,
      content: input.content,
    });

    if (!success) {
      exitWithError(\`document "\${id}" not found\`, undefined, EXIT_CODES.NOT_FOUND);
    }

    console.log(\`updated document: \${id}\`);
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateDocCreateHandler(): string {
  return `async function handleCreateDoc(input: DocInput): Promise<void> {
  if (!input.title) {
    exitWithError("--title is required", 'usage: lnr doc new --title "..."');
  }

  try {
    const client = getClient();

    const createPayload: {
      title: string;
      content?: string;
      projectId?: string;
    } = {
      title: input.title,
    };

    if (input.content) createPayload.content = input.content;
    if (input.project) createPayload.projectId = await resolveProjectByName(client, input.project);

    const doc = await createDocument(client, createPayload);

    if (doc) {
      console.log(\`created document: \${doc.title}\`);
    } else {
      exitWithError("failed to create document");
    }
  } catch (error) {
    handleApiError(error);
  }
}`;
}

function generateDocDeleteHandler(): string {
  return `async function handleDeleteDoc(id: string, _input: DocInput): Promise<void> {
  try {
    const client = getClient();

    const success = await deleteDocument(client, id);

    if (!success) {
      exitWithError(\`document "\${id}" not found\`, undefined, EXIT_CODES.NOT_FOUND);
    }

    console.log(\`deleted document: \${id}\`);
  } catch (error) {
    handleApiError(error);
  }
}`;
}

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

for (const config of entityConfigs) {
  const output = generateEntityFile(config);
  const outputPath = join(outputDir, config.outputFile);
  writeFileSync(outputPath, output);
  console.log(`generated ${outputPath}`);
}

console.log(`\ngenerated ${entityConfigs.length} entity files from consolidated generator`);
