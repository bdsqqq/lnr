import type { Command } from "commander";
import {
  setApiKey,
  clearApiKey,
  getApiKey,
  createClientWithKey,
  getViewer,
} from "@bdsqqq/lnr-core";
import { exitWithError, EXIT_CODES } from "../lib/error";

export function registerAuthCommand(program: Command): void {
  program
    .command("auth [api-key]")
    .description("authenticate with Linear API")
    .option("--whoami", "show current authenticated user")
    .option("--logout", "clear stored credentials")
    .action(async (apiKey: string | undefined, options: { whoami?: boolean; logout?: boolean }) => {
      if (options.logout) {
        clearApiKey();
        console.log("logged out");
        return;
      }

      if (options.whoami) {
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

      if (!apiKey) {
        exitWithError("api key required", "usage: lnr auth <api-key>");
      }

      try {
        const client = createClientWithKey(apiKey);
        const viewer = await getViewer(client);
        setApiKey(apiKey);
        console.log(`authenticated as ${viewer.name}`);
      } catch {
        exitWithError("invalid api key", "get one from: https://linear.app/settings/account/security", EXIT_CODES.AUTH_ERROR);
      }
    });
}
