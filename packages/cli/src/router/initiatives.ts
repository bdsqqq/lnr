import { z } from "zod";
import {
  getClient,
  listInitiatives,
  getInitiative,
  findInitiativeByName,
  getInitiativeUpdates,
  getInitiativeExternalLinks,
  createReaction,
  deleteReaction,
  createSubscription,
  deleteSubscription,
  type Initiative,
  type InitiativeUpdate,
  type EntityExternalLink,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "./trpc";
import { exitWithError, handleApiError, EXIT_CODES } from "../lib/error";
import {
  outputJson,
  outputQuiet,
  outputTable,
  getOutputFormat,
  type OutputOptions,
  type TableColumn,
} from "../lib/output";

export const listInitiativesInput = z.object({
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

export const initiativeInput = z.object({
  nameOrId: z.string().meta({ positional: true }).describe("initiative name, slugId, or id"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output id only"),
  verbose: z.boolean().optional().describe("show all columns"),
  updates: z.boolean().optional().describe("show initiative updates"),
  links: z.boolean().optional().describe("show initiative external links"),
  react: z.string().optional().describe("initiative update id to add reaction (requires --emoji)"),
  emoji: z.string().optional().describe("emoji for --react"),
  unreact: z.string().optional().describe("reaction id to remove"),
  subscribe: z.boolean().optional().describe("subscribe to initiative notifications"),
  unsubscribe: z.string().optional().describe("subscription id to unsubscribe from"),
});

const initiativeColumns: TableColumn<Initiative>[] = [
  { header: "NAME", value: (i) => i.name, width: 32 },
  { header: "STATUS", value: (i) => i.status, width: 12 },
  { header: "HEALTH", value: (i) => i.health ?? "-", width: 10 },
  { header: "TARGET", value: (i) => i.targetDate ?? "-", width: 12 },
];

const verboseInitiativeColumns: TableColumn<Initiative>[] = [
  ...initiativeColumns,
  { header: "SLUG", value: (i) => i.slugId, width: 16 },
  { header: "ID", value: (i) => i.id, width: 36 },
];

const updateColumns: TableColumn<InitiativeUpdate>[] = [
  { header: "DATE", value: (u) => u.createdAt.toISOString().slice(0, 10), width: 12 },
  { header: "HEALTH", value: (u) => u.health, width: 10 },
  { header: "AUTHOR", value: (u) => u.userName ?? "-", width: 20 },
  { header: "CONTENT", value: (u) => u.body.slice(0, 50).replace(/\n/g, " "), width: 52 },
];

const verboseUpdateColumns: TableColumn<InitiativeUpdate>[] = [
  ...updateColumns,
  { header: "ID", value: (u) => u.id, width: 36 },
];

const linkColumns: TableColumn<EntityExternalLink>[] = [
  { header: "LABEL", value: (l) => l.label.slice(0, 30), width: 30 },
  { header: "URL", value: (l) => l.url.slice(0, 50), width: 50 },
];

const verboseLinkColumns: TableColumn<EntityExternalLink>[] = [
  ...linkColumns,
  { header: "ID", value: (l) => l.id, width: 36 },
  { header: "CREATOR", value: (l) => l.creatorName ?? "-", width: 20 },
];

export const initiativesRouter = router({
  initiatives: procedure
    .meta({ aliases: { command: ["init"] }, description: "list initiatives" })
    .input(listInitiativesInput)
    .query(async ({ input }) => {
      try {
        const client = getClient();
        const initiatives = await listInitiatives(client);

        const outputOpts: OutputOptions = {
          format: input.json ? "json" : input.quiet ? "quiet" : undefined,
          verbose: input.verbose,
        };
        const format = getOutputFormat(outputOpts);

        if (format === "json") {
          outputJson(initiatives);
          return;
        }

        if (format === "quiet") {
          outputQuiet(initiatives.map((i) => i.id));
          return;
        }

        const columns = input.verbose ? verboseInitiativeColumns : initiativeColumns;
        outputTable(initiatives, columns, outputOpts);
      } catch (error) {
        handleApiError(error, "initiatives");
      }
    }),

  initiative: procedure
    .meta({ description: "show or update initiative" })
    .input(initiativeInput)
    .mutation(async ({ input }) => {
      try {
        const client = getClient();
        let initiative = await getInitiative(client, input.nameOrId);

        if (!initiative) {
          initiative = await findInitiativeByName(client, input.nameOrId);
        }

        if (!initiative) {
          exitWithError(
            `initiative "${input.nameOrId}" not found`,
            "try: lnr initiatives",
            EXIT_CODES.NOT_FOUND
          );
        }

        const outputOpts: OutputOptions = {
          format: input.json ? "json" : input.quiet ? "quiet" : undefined,
          verbose: input.verbose,
        };
        const format = getOutputFormat(outputOpts);

        if (input.react) {
          if (!input.emoji) {
            exitWithError("--emoji is required when using --react");
          }
          const success = await createReaction(client, { type: "initiativeUpdate", id: input.react }, input.emoji);
          if (!success) {
            exitWithError(`failed to add reaction to initiative update ${input.react.slice(0, 8)}`);
          }
          console.log(`added reaction ${input.emoji} to initiative update ${input.react.slice(0, 8)}`);
          return;
        }

        if (input.unreact) {
          const success = await deleteReaction(client, input.unreact);
          if (!success) {
            exitWithError(`reaction ${input.unreact.slice(0, 8)} not found`, undefined, EXIT_CODES.NOT_FOUND);
          }
          console.log(`removed reaction ${input.unreact.slice(0, 8)}`);
          return;
        }

        if (input.subscribe) {
          const subscriptionId = await createSubscription(client, { type: "initiative", initiativeId: initiative.id });
          console.log(`subscribed to ${initiative.name} (subscription: ${subscriptionId.slice(0, 8)})`);
          return;
        }

        if (input.unsubscribe) {
          const success = await deleteSubscription(client, input.unsubscribe);
          if (!success) {
            exitWithError(`subscription ${input.unsubscribe.slice(0, 8)} not found`, undefined, EXIT_CODES.NOT_FOUND);
          }
          console.log(`unsubscribed (removed subscription ${input.unsubscribe.slice(0, 8)})`);
          return;
        }

        if (input.updates) {
          const updates = await getInitiativeUpdates(client, initiative.id);

          if (format === "json") {
            outputJson(updates);
            return;
          }

          if (format === "quiet") {
            outputQuiet(updates.map((u) => u.id));
            return;
          }

          if (updates.length === 0) {
            console.log("no updates");
            return;
          }

          const columns = input.verbose ? verboseUpdateColumns : updateColumns;
          outputTable(updates, columns, outputOpts);
          return;
        }

        if (input.links) {
          const links = await getInitiativeExternalLinks(client, initiative.id);

          if (format === "json") {
            outputJson(links);
            return;
          }

          if (format === "quiet") {
            outputQuiet(links.map((l) => l.id));
            return;
          }

          if (links.length === 0) {
            console.log("no external links");
            return;
          }

          const columns = input.verbose ? verboseLinkColumns : linkColumns;
          outputTable(links, columns, outputOpts);
          return;
        }

        if (format === "json") {
          outputJson(initiative);
          return;
        }

        if (format === "quiet") {
          console.log(initiative.id);
          return;
        }

        console.log(`${initiative.name}`);
        console.log(`status: ${initiative.status}`);
        if (initiative.health) {
          console.log(`health: ${initiative.health}`);
        }
        if (initiative.description) {
          console.log(`description: ${initiative.description}`);
        }
        if (initiative.targetDate) {
          console.log(`target: ${initiative.targetDate}`);
        }
        console.log(`url: ${initiative.url}`);
        if (input.verbose) {
          console.log(`slugId: ${initiative.slugId}`);
          console.log(`id: ${initiative.id}`);
        }
      } catch (error) {
        handleApiError(error, "initiatives");
      }
    }),
});
