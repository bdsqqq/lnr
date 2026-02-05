/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from extracted-schema.json at 2026-02-05T18:16:19.702Z
 *
 * Regenerate with: bun run packages/codegen/generate-commands.ts
 */

import { z } from "zod";
import {
  getClient,
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  resolveProjectByName,
  type Document,
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


export const listDocsInput = z.object({
  project: z.string().optional().describe("filter by project id"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

export const docInput = z.object({
  id: z.string().meta({ positional: true }).describe("document id or 'new'"),
  title: z.string().optional().describe("document title (required for new)"),
  content: z.string().optional().describe("document content"),
  project: z.string().optional().describe("project id to attach document to"),
  delete: z.boolean().optional().describe("delete the document"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

type DocInput = z.infer<typeof docInput>;



const docColumns: TableColumn<Document>[] = [
  { header: "ID", value: (d) => d.id, width: 20 },
  { header: "TITLE", value: (d) => truncate(d.title, 50), width: 50 },
];

type Operation = "create" | "read" | "update" | "delete";

function inferOperation(input: DocInput): Operation {
  if (input.id === "new") return "create";
  if (input.delete) return "delete";
  if (input.title !== undefined || input.content !== undefined) return "update";
  return "read";
}

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
      exitWithError(`document "${id}" not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (format === "json") {
      outputJson(doc);
      return;
    }

    if (format === "quiet") {
      console.log(doc.id);
      return;
    }

    console.log(`${doc.title}`);
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
      exitWithError(`document "${id}" not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    console.log(`updated document: ${id}`);
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
      console.log(`created document: ${doc.title}`);
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
      exitWithError(`document "${id}" not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    console.log(`deleted document: ${id}`);
  } catch (error) {
    handleApiError(error);
  }
}





export const generatedDocsRouter = router({
  docs: procedure
    .meta({
      description: "list docs",
      
    })
    .input(listDocsInput)
    .query(async ({ input }) => {
      await handleListDocs(input);
    }),

  doc: procedure
    .meta({
      description: "show or update a doc, or create with 'new'",
    })
    .input(docInput)
    .mutation(async ({ input }) => {
      const operation = inferOperation(input);

      switch (operation) {
        case "create":
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
