#!/usr/bin/env bun
/**
 * generate Document commands from extracted-schema.json
 *
 * input: packages/codegen/extracted-schema.json, packages/codegen/cli-spec.json
 * output: packages/cli/src/generated/doc.ts
 *
 * generates:
 * - zod schemas for input validation
 * - handlers with operation inference
 * - flag definitions matching schema fields
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

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
const cliSpecPath = join(import.meta.dir, "cli-spec.json");
const outputDir = join(rootDir, "packages/cli/src/generated");
const outputPath = join(outputDir, "doc.ts");

const cliSpec: CLISpec = JSON.parse(readFileSync(cliSpecPath, "utf-8"));

const docsCommand = cliSpec.commands.find(c => c.command === "docs");
const docCommand = cliSpec.commands.find(c => c.command === "doc");

if (!docsCommand || !docCommand) {
  throw new Error("docs/doc commands not found in cli-spec.json");
}

function getExpectedCliFlags(): Set<string> {
  const flags = new Set<string>();
  for (const f of docCommand!.flags) {
    flags.add(f.name);
  }
  return flags;
}

function generateListDocsInputSchema(): string {
  return `export const listDocsInput = z.object({
  project: z.string().optional().describe("filter by project id"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});`;
}

function generateDocInputSchema(): string {
  return `export const docInput = z.object({
  id: z.string().meta({ positional: true }).describe("document id or 'new'"),
  title: z.string().optional().describe("document title (required for new)"),
  content: z.string().optional().describe("document content"),
  project: z.string().optional().describe("project id to attach document to"),
  delete: z.boolean().optional().describe("delete the document"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});`;
}

function generateOutput(): string {
  const timestamp = new Date().toISOString();

  return `/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from cli-spec.json at ${timestamp}
 *
 * Regenerate with: bun run packages/codegen/generate-doc-commands.ts
 */

import { z } from "zod";
import {
  getClient,
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  type Document,
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

${generateListDocsInputSchema()}

${generateDocInputSchema()}

type DocInput = z.infer<typeof docInput>;

type Operation = "new" | "read" | "update" | "delete";

function inferOperation(input: DocInput): Operation {
  if (input.id === "new") return "new";
  if (input.delete) return "delete";
  if (input.title !== undefined || input.content !== undefined) return "update";
  return "read";
}

const docColumns: TableColumn<Document>[] = [
  { header: "ID", value: (d) => d.id, width: 20 },
  { header: "TITLE", value: (d) => truncate(d.title, 50), width: 50 },
];

async function handleListDocs(
  input: z.infer<typeof listDocsInput>
): Promise<void> {
  try {
    const client = getClient();

    const outputOpts: OutputOptions = {
      format: input.json ? "json" : input.quiet ? "quiet" : undefined,
      verbose: input.verbose,
    };
    const format = getOutputFormat(outputOpts);

    const documents = await listDocuments(client, input.project);

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
}

async function handleShowDoc(id: string, input: DocInput): Promise<void> {
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
}

async function handleUpdateDoc(id: string, input: DocInput): Promise<void> {
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
}

async function handleCreateDoc(input: DocInput): Promise<void> {
  if (!input.title) {
    exitWithError("--title is required", 'usage: lnr doc new --title "..."');
  }

  try {
    const client = getClient();

    const doc = await createDocument(client, {
      title: input.title,
      content: input.content,
      projectId: input.project,
    });

    if (doc) {
      console.log(\`created document: \${doc.title}\`);
    } else {
      exitWithError("failed to create document");
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleDeleteDoc(id: string, _input: DocInput): Promise<void> {
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
}

export const generatedDocsRouter = router({
  docs: procedure
    .meta({
      description: "list documents",
    })
    .input(listDocsInput)
    .query(async ({ input }) => {
      await handleListDocs(input);
    }),

  doc: procedure
    .meta({
      description: "show document details, create with 'new', update, or delete with --delete",
    })
    .input(docInput)
    .mutation(async ({ input }) => {
      const operation = inferOperation(input);

      switch (operation) {
        case "new":
          await handleCreateDoc(input);
          break;
        case "delete":
          await handleDeleteDoc(input.id, input);
          break;
        case "update":
          await handleUpdateDoc(input.id, input);
          break;
        case "read":
        default:
          await handleShowDoc(input.id, input);
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
const generatedSchema = generateDocInputSchema();
const generatedFlags = new Set<string>();
const flagRegex = /^\s+(\w+):/gm;
let match;
while ((match = flagRegex.exec(generatedSchema)) !== null) {
  generatedFlags.add(match[1]);
}

console.log(`\nparity check:`);
console.log(`  cli-spec.json doc flags: ${expectedFlags.size}`);
console.log(`  generated doc flags: ${generatedFlags.size}`);

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
