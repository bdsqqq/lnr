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
  project: z.string().optional(),
  json: z.boolean().optional(),
  quiet: z.boolean().optional(),
  verbose: z.boolean().optional(),
});

const docInput = z.object({
  id: z.string().meta({ positional: true }),
  title: z.string().optional(),
  content: z.string().optional(),
  project: z.string().optional(),
  delete: z.boolean().optional(),
  json: z.boolean().optional(),
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
      const client = getClient();

      if (input.id === "new") {
        if (!input.title) {
          exitWithError("--title is required", "usage: lnr doc new --title \"...\"");
        }

        try {
          const doc = await createDocument(client, {
            title: input.title,
            content: input.content,
            projectId: input.project,
          });

          if (doc) {
            console.log(`created document: ${doc.title}`);
          } else {
            console.log("created document");
          }
        } catch (error) {
          handleApiError(error);
        }
        return;
      }

      if (input.delete) {
        try {
          const success = await deleteDocument(client, input.id);

          if (!success) {
            exitWithError(`document "${input.id}" not found`, undefined, EXIT_CODES.NOT_FOUND);
          }

          console.log(`deleted document: ${input.id}`);
        } catch (error) {
          handleApiError(error);
        }
        return;
      }

      if (input.title || input.content) {
        try {
          const success = await updateDocument(client, input.id, {
            title: input.title,
            content: input.content,
          });

          if (success) {
            console.log(`updated document: ${input.id}`);
          } else {
            exitWithError(`failed to update document "${input.id}"`);
          }
        } catch (error) {
          handleApiError(error);
        }
        return;
      }

      try {
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
