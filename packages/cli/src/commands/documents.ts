import type { Command } from "commander";
import {
  getClient,
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
} from "@bdsqqq/lnr-core";
import { handleApiError, exitWithError, EXIT_CODES } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  formatDate,
  truncate,
  type OutputOptions,
} from "../lib/output";

interface CreateDocumentOptions {
  title?: string;
  project?: string;
  content?: string;
}

async function handleCreateDocument(options: CreateDocumentOptions): Promise<void> {
  if (!options.title) {
    exitWithError("--title is required", "usage: lnr doc new --title \"...\"");
  }

  try {
    const client = getClient();

    const doc = await createDocument(client, {
      title: options.title,
      content: options.content,
      projectId: options.project,
    });

    if (doc) {
      console.log(`created document: ${doc.title} (${doc.id})`);
    } else {
      console.log("created document");
    }
  } catch (error) {
    handleApiError(error);
  }
}

async function handleDeleteDocument(id: string): Promise<void> {
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

async function handleUpdateDocument(id: string, content: string): Promise<void> {
  try {
    const client = getClient();
    const doc = await updateDocument(client, id, { content });

    if (!doc) {
      exitWithError(`document "${id}" not found`, undefined, EXIT_CODES.NOT_FOUND);
    }

    console.log(`updated document: ${doc.title}`);
  } catch (error) {
    handleApiError(error);
  }
}

export function registerDocumentsCommand(program: Command): void {
  program
    .command("docs")
    .description("list documents")
    .option("--project <project>", "filter by project")
    .option("--json", "output as json")
    .option("--quiet", "output ids only")
    .option("--verbose", "show detailed output")
    .action(async (options: { project?: string; json?: boolean; quiet?: boolean; verbose?: boolean }) => {
      try {
        const client = getClient();

        const outputOpts: OutputOptions = {
          format: options.json ? "json" : options.quiet ? "quiet" : undefined,
          verbose: options.verbose,
        };
        const format = getOutputFormat(outputOpts);

        const docs = await listDocuments(client, { project: options.project });

        if (format === "json") {
          outputJson(docs);
          return;
        }

        if (format === "quiet") {
          outputQuiet(docs.map((d) => d.id));
          return;
        }

        outputTable(docs, [
          { header: "ID", value: (d) => truncate(d.slugId ?? d.id, 20), width: 20 },
          { header: "TITLE", value: (d) => truncate(d.title, 40), width: 40 },
          { header: "UPDATED", value: (d) => formatDate(d.updatedAt), width: 12 },
        ], outputOpts);
      } catch (error) {
        handleApiError(error);
      }
    });

  program
    .command("doc <id>")
    .description("show document details, create with 'new', update with --content, or delete with --delete")
    .option("--json", "output as json")
    .option("--quiet", "output id only")
    .option("--verbose", "show detailed output")
    .option("--delete", "delete the document")
    .option("--content <content>", "update document content")
    .option("--title <title>", "title for new document")
    .option("--project <project>", "project for new document")
    .action(async (id: string, options: { json?: boolean; quiet?: boolean; verbose?: boolean; delete?: boolean; content?: string; title?: string; project?: string }) => {
      if (id === "new") {
        await handleCreateDocument(options);
        return;
      }

      if (options.delete) {
        await handleDeleteDocument(id);
        return;
      }

      if (options.content) {
        await handleUpdateDocument(id, options.content);
        return;
      }

      try {
        const client = getClient();

        const outputOpts: OutputOptions = {
          format: options.json ? "json" : options.quiet ? "quiet" : undefined,
          verbose: options.verbose,
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
        console.log();
        if (doc.content) {
          console.log(doc.content);
          console.log();
        }
        console.log(`id:      ${doc.id}`);
        console.log(`slugId:  ${doc.slugId}`);
        console.log(`created: ${formatDate(doc.createdAt)}`);
        console.log(`updated: ${formatDate(doc.updatedAt)}`);
      } catch (error) {
        handleApiError(error);
      }
    });
}
