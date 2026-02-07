/**
 * GENERATED FILE - DO NOT EDIT
 * Generated from extracted-schema.json at 2026-02-07T23:30:13.472Z
 *
 * Regenerate with: bun run packages/codegen/generate-commands.ts
 */

import "../lib/arktype-config";
import { type } from "arktype";
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
import { outputCommentThreads } from "../lib/renderers/comments";
import { outputDetail } from "../lib/renderers/detail";
import { docToDetail } from "../lib/adapters";


export const listDocsInput = type({
  "project?": type("string").describe("filter by project id"),
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output ids only"),
  "verbose?": type("boolean").describe("show all columns"),
});

export const docInput = type({
  id: type("string").configure({ positional: true }).describe("document id or 'new'"),
  "title?": type("string").describe("document title (required for new)"),
  "content?": type("string").describe("document content"),
  "project?": type("string").describe("project id to attach document to"),
  "delete?": type("boolean").describe("delete the document"),
  "json?": type("boolean").describe("output as json"),
  "quiet?": type("boolean").describe("output ids only"),
  "verbose?": type("boolean").describe("show all columns"),
});

type DocInput = typeof docInput.infer;



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
  input: typeof listDocsInput.infer
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

    outputDetail(docToDetail(doc));
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
