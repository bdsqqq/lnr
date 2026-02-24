import "../lib/arktype-config";
import { type } from "arktype";
import {
  setApiKey,
  clearApiKey,
  getApiKey,
  createClientWithKey,
  getViewer,
} from "@bdsqqq/lnr-core";
import { router, procedure } from "./trpc";
import { exitWithError, EXIT_CODES } from "../lib/error";

export const authInput = type({
  // "string | undefined" ensures trpc-cli's isOptional() sees the optional marker
  // in the value schema — arktype's "key?" syntax only marks it optional at the
  // object level (required array), which trpc-cli doesn't check for positionals
  "apiKey?": type("string | undefined").configure({ positional: true }).describe("Linear API key"),
  "whoami?": type("boolean").describe("show current authenticated user"),
  "logout?": type("boolean").describe("clear stored credentials"),
});

export const authRouter = router({
  auth: procedure
    .meta({
      description: "authenticate with Linear API",
    })
    .input(authInput)
    .mutation(async ({ input }) => {
      if (input.logout) {
        clearApiKey();
        console.log("logged out");
        return;
      }

      if (input.whoami) {
        const storedKey = getApiKey();
        if (!storedKey) {
          exitWithError("not authenticated", "run: lnr auth <api-key>", EXIT_CODES.AUTH_ERROR);
        }

        try {
          const client = createClientWithKey(storedKey);
          const viewer = await getViewer(client);
          console.log(`${viewer.name} <${viewer.email}>`);
        } catch {
          exitWithError("invalid api key", "run: lnr auth <api-key>", EXIT_CODES.AUTH_ERROR);
        }
        return;
      }

      if (!input.apiKey) {
        exitWithError("api key required", "usage: lnr auth <api-key>");
      }

      try {
        const client = createClientWithKey(input.apiKey);
        const viewer = await getViewer(client);
        setApiKey(input.apiKey);
        console.log(`authenticated as ${viewer.name}`);
      } catch {
        exitWithError("invalid api key", "get one from: https://linear.app/settings/account/security", EXIT_CODES.AUTH_ERROR);
      }
    }),
});
