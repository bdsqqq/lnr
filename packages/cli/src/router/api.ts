import "../lib/arktype-config";
import { readFileSync } from "node:fs";
import { type } from "arktype";
import { TRPCError } from "@trpc/server";
import { ApiExecutionError, executeApi, type ApiResult } from "@bdsqqq/lnr-core";
import { procedure, router } from "./trpc";
import { writeStdout } from "../lib/stdout";

export const apiInput = type({
  file: type("string").configure({ positional: true }).describe("graphql file or - for stdin"),
  "variables?": type("string").describe("json variables file containing an object"),
  "execute?": type("boolean").describe("explicitly authorize network execution"),
  "validateOnly?": type("boolean").describe("validate offline; incompatible with --execute"),
});

class InputError extends Error {}

function readInput(file: string | number, message: string): string {
  try { return readFileSync(file, "utf8"); }
  catch { throw new InputError(message); }
}

export function createApiRouter(run: typeof executeApi = executeApi) {
  return router({
    api: procedure.meta({ description: "validate graphql offline or explicitly execute" })
      .input(apiInput).mutation(async ({ input }) => {
        let result: ApiResult | { ok: false; executed: false; errors: { message: string }[] };
        try {
          if (input.execute && input.validateOnly) {
            throw new InputError("--execute and --validate-only are mutually exclusive");
          }
          const document = readInput(input.file === "-" ? 0 : input.file, "cannot read graphql input");
          let variables: Record<string, unknown> | undefined;
          if (input.variables !== undefined) {
            const text = readInput(input.variables, "cannot read variables file");
            let value: unknown;
            try { value = JSON.parse(text); }
            catch { throw new InputError("variables file must contain valid json"); }
            if (value === null || typeof value !== "object" || Array.isArray(value)) {
              throw new InputError("variables file must contain a json object");
            }
            variables = value as Record<string, unknown>;
          }
          result = await run({ document, variables, execute: input.execute === true });
        } catch (error) {
          const message = error instanceof InputError || error instanceof ApiExecutionError
            ? error.message : "api command failed";
          result = { ok: false, executed: false, errors: [{ message }] };
        }
        // output failures must not turn an attempted write into an "executed: false" result.
        await writeStdout(`${JSON.stringify(result)}\n`);
        // trpc-cli exits with 0 after a resolved procedure, overriding process.exitCode.
        if (!result.ok || result.errors?.length) throw new TRPCError({ code: "BAD_REQUEST", message: "api command failed" });
      }),
  });
}

export const apiRouter = createApiRouter();
