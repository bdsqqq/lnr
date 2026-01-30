import { z } from "zod";
import {
  getClient,
  listUsers,
  findUserByNameOrEmail,
  type User,
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

export const listUsersInput = z.object({
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output ids only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

export const userInput = z.object({
  nameOrEmail: z.string().meta({ positional: true }).describe("user name or email"),
  json: z.boolean().optional().describe("output as json"),
  quiet: z.boolean().optional().describe("output id only"),
  verbose: z.boolean().optional().describe("show all columns"),
});

const userColumns: TableColumn<User>[] = [
  { header: "NAME", value: (u) => u.name, width: 24 },
  { header: "EMAIL", value: (u) => u.email ?? "-", width: 32 },
  { header: "ACTIVE", value: (u) => (u.active ? "yes" : "no"), width: 8 },
  { header: "ADMIN", value: (u) => (u.admin ? "yes" : "no"), width: 8 },
];

const verboseUserColumns: TableColumn<User>[] = [
  ...userColumns,
  { header: "DISPLAY NAME", value: (u) => u.displayName ?? "-", width: 24 },
  { header: "ID", value: (u) => u.id, width: 36 },
];

export const usersRouter = router({
  users: procedure
    .meta({ aliases: { command: ["u"] }, description: "list users" })
    .input(listUsersInput)
    .query(async ({ input }) => {
      try {
        const client = getClient();
        const users = await listUsers(client);

        const outputOpts: OutputOptions = {
          format: input.json ? "json" : input.quiet ? "quiet" : undefined,
          verbose: input.verbose,
        };
        const format = getOutputFormat(outputOpts);

        if (format === "json") {
          outputJson(users);
          return;
        }

        if (format === "quiet") {
          outputQuiet(users.map((u) => u.id));
          return;
        }

        const columns = input.verbose ? verboseUserColumns : userColumns;
        outputTable(users, columns, outputOpts);
      } catch (error) {
        handleApiError(error);
      }
    }),

  user: procedure
    .meta({ description: "show user details" })
    .input(userInput)
    .query(async ({ input }) => {
      try {
        const client = getClient();
        const user = await findUserByNameOrEmail(client, input.nameOrEmail);

        if (!user) {
          exitWithError(
            `user "${input.nameOrEmail}" not found`,
            "try: lnr users",
            EXIT_CODES.NOT_FOUND
          );
        }

        const outputOpts: OutputOptions = {
          format: input.json ? "json" : input.quiet ? "quiet" : undefined,
          verbose: input.verbose,
        };
        const format = getOutputFormat(outputOpts);

        if (format === "json") {
          outputJson(user);
          return;
        }

        if (format === "quiet") {
          console.log(user.id);
          return;
        }

        console.log(`${user.name}`);
        if (user.email) {
          console.log(`email: ${user.email}`);
        }
        if (user.displayName) {
          console.log(`display name: ${user.displayName}`);
        }
        console.log(`active: ${user.active ? "yes" : "no"}`);
        console.log(`admin: ${user.admin ? "yes" : "no"}`);
        if (input.verbose) {
          console.log(`id: ${user.id}`);
        }
      } catch (error) {
        handleApiError(error);
      }
    }),
});
