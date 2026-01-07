import { z } from "zod";
import {
  getClient,
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "./trpc";
import { exitWithError, handleApiError, EXIT_CODES } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  truncate,
  type OutputOptions,
} from "../lib/output";

const listDocsInput = z.object({
  project: z.string().optional().describe("filter by project id"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

const docInput = z.object({
  id: z.string().meta({ positional: true }).describe("document id or 'new'"),
  title: z.string().optional().describe("document title (required for new)"),
  content: z.string().optional().describe("document content"),
  project: z.string().optional().describe("project id to attach document to"),
  delete: z.boolean().optional().describe("delete the document"),
  json: z.boolean().optional().describe("output as json"),
});

export const docsRouter = router({
  docs: procedure
    .meta({
      description: "list documents",
    })
    .input(listDocsInput)
    .query(async ({ input }) => {
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

        outputTable(
          documents,
          [
            { header: "ID", value: (d) => d.id, width: 20 },
            { header: "TITLE", value: (d) => truncate(d.title, 50), width: 50 },
          ],
          outputOpts
        );
      } catch (error) {
        handleApiError(error);
      }
    }),

  doc: procedure
    .meta({
      description: "show document details, create with 'new', update, or delete with --delete",
    })
    .input(docInput)
    .query(async ({ input }) => {
      try {
        const client = getClient();

        if (input.id === "new") {
          if (!input.title) {
            exitWithError("--title is required", "usage: lnr doc new --title \"...\"");
          }

          const doc = await createDocument(client, {
            title: input.title,
            content: input.content,
            projectId: input.project,
          });

          if (doc) {
            console.log(`created document: ${doc.title}`);
          } else {
            exitWithError("failed to create document");
          }
          return;
        }

        if (input.delete) {
          const success = await deleteDocument(client, input.id);

          if (!success) {
            exitWithError(`document "${input.id}" not found`, undefined, EXIT_CODES.NOT_FOUND);
          }

          console.log(`deleted document: ${input.id}`);
          return;
        }

        if (input.title || input.content) {
          const success = await updateDocument(client, input.id, {
            title: input.title,
            content: input.content,
          });

          if (!success) {
            exitWithError(`document "${input.id}" not found`, undefined, EXIT_CODES.NOT_FOUND);
          }

          console.log(`updated document: ${input.id}`);
          return;
        }

        const format = input.json ? "json" : undefined;

        const doc = await getDocument(client, input.id);

        if (!doc) {
          exitWithError(`document "${input.id}" not found`, undefined, EXIT_CODES.NOT_FOUND);
        }

        if (format === "json") {
          outputJson(doc);
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
    }),
});
