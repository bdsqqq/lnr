#!/usr/bin/env bun
/**
 * generate Label commands from extracted-schema.json
 *
 * input: packages/codegen/extracted-schema.json, packages/codegen/cli-spec.json
 * output: packages/cli/src/generated/label.ts
 *
 * generates:
 * - zod schemas for input validation
 * - handlers with operation inference
 * - flag definitions matching schema fields
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

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
    IssueLabel: EntitySchema;
  };
  enums: Record<string, string[]>;
}

interface CLIFlag {
  name: string;
  type: string;
  required: boolean;
  description: string;
  positional: boolean;
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
const outputPath = join(outputDir, "label.ts");

const schema: ExtractedSchema = JSON.parse(readFileSync(schemaPath, "utf-8"));
const cliSpec: CLISpec = JSON.parse(readFileSync(cliSpecPath, "utf-8"));

const labelEntity = schema.entities.IssueLabel;
const labelCommand = cliSpec.commands.find(c => c.command === "label");
const labelsCommand = cliSpec.commands.find(c => c.command === "labels");

if (!labelCommand || !labelsCommand) {
  throw new Error("label/labels commands not found in cli-spec.json");
}

const schemaToCliMapping: Record<string, string> = {
  teamId: "team",
  parentId: "parent",
};

const fieldsToExclude = ["id", "retiredAt", "isGroup", "parentId"];

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
      zodType = "z.string()";
  }
  if (field.isList) {
    zodType = `z.array(${zodType})`;
  }
  return zodType;
}

function getExpectedCliFlags(): Set<string> {
  const flags = new Set<string>();
  for (const f of labelCommand!.flags) {
    flags.add(f.name);
  }
  return flags;
}

function generateListLabelsInputSchema(): string {
  return `export const listLabelsInput = z.object({
  team: z.string().optional().describe("filter by team key"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});`;
}

function generateLabelInputSchema(): string {
  const lines: string[] = [];
  lines.push("export const labelInput = z.object({");
  lines.push('  id: z.string().meta({ positional: true }).describe("label id or \'new\'"),');
  lines.push('  json: z.boolean().optional().describe("output as json"),');
  lines.push('  delete: z.boolean().optional().describe("delete the label"),');
  lines.push('  team: z.string().optional().describe("team key (required for new)"),');

  const updateFields = labelEntity.updateInput.fields
    .filter(f => !f.isDeprecated)
    .filter(f => !fieldsToExclude.includes(f.name));

  for (const field of updateFields) {
    const cliName = schemaToCliMapping[field.name] || field.name;

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
}

function generateOutput(): string {
  const timestamp = new Date().toISOString();

  return `/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from extracted-schema.json at ${timestamp}
 *
 * Regenerate with: bun run packages/codegen/generate-label-commands.ts
 */

import { z } from "zod";
import {
  getClient,
  listLabels,
  getLabel,
  createLabel,
  updateLabel,
  deleteLabel,
  resolveTeamByKey,
  type Label,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "../router/trpc";
import { handleApiError, exitWithError, EXIT_CODES } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  truncate,
  type OutputOptions,
  type TableColumn,
} from "../lib/output";

${generateListLabelsInputSchema()}

${generateLabelInputSchema()}

type LabelInput = z.infer<typeof labelInput>;

const labelColumns: TableColumn<Label>[] = [
  { header: "ID", value: (l) => l.id.slice(0, 8), width: 10 },
  { header: "NAME", value: (l) => truncate(l.name, 30), width: 30 },
  { header: "COLOR", value: (l) => l.color ?? "-", width: 10 },
  { header: "DESCRIPTION", value: (l) => truncate(l.description ?? "-", 40), width: 40 },
];

type Operation = "create" | "read" | "update" | "delete";

function inferOperation(input: LabelInput): Operation {
  if (input.id === "new") return "create";
  if (input.delete) return "delete";

  const mutationFlags: (keyof LabelInput)[] = ["name", "color", "description"];
  for (const flag of mutationFlags) {
    if (input[flag] !== undefined) return "update";
  }

  return "read";
}

async function handleListLabels(
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
}

async function handleShowLabel(
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
}

async function handleUpdateLabel(
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

    if (input.name !== undefined) {
      updatePayload.name = input.name;
    }

    if (input.color !== undefined) {
      updatePayload.color = input.color;
    }

    if (input.description !== undefined) {
      updatePayload.description = input.description;
    }

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
}

async function handleCreateLabel(input: LabelInput): Promise<void> {
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
}

async function handleDeleteLabel(
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
}

export const generatedLabelsRouter = router({
  labels: procedure
    .meta({
      description: "list labels",
    })
    .input(listLabelsInput)
    .query(async ({ input }) => {
      await handleListLabels(input);
    }),

  label: procedure
    .meta({
      description: "show label details, create with 'new', update, or delete with --delete",
    })
    .input(labelInput)
    .mutation(async ({ input }) => {
      const operation = inferOperation(input);

      switch (operation) {
        case "create":
          await handleCreateLabel(input);
          break;
        case "delete":
          await handleDeleteLabel(input.id, input);
          break;
        case "update":
          await handleUpdateLabel(input.id, input);
          break;
        case "read":
        default:
          await handleShowLabel(input.id, input);
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
const generatedSchema = generateLabelInputSchema();
const generatedFlags = new Set<string>();
const flagRegex = /^\s+(\w+):/gm;
let match;
while ((match = flagRegex.exec(generatedSchema)) !== null) {
  generatedFlags.add(match[1]);
}

console.log(`\nparity check:`);
console.log(`  cli-spec.json label flags: ${expectedFlags.size}`);
console.log(`  generated label flags: ${generatedFlags.size}`);

const missing = [...expectedFlags].filter(f => !generatedFlags.has(f));
const extra = [...generatedFlags].filter(f => !expectedFlags.has(f));

if (missing.length > 0) {
  console.log(`  missing from cli-spec: ${missing.join(", ")}`);
}
if (extra.length > 0) {
  console.log(`  extra (from schema): ${extra.join(", ")}`);
}
if (missing.length === 0 && extra.length === 0) {
  console.log(`  ✓ flags match`);
}
