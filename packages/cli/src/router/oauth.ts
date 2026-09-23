import "../lib/arktype-config";
import { readFileSync } from "node:fs";
import { type } from "arktype";
import { TRPCError } from "@trpc/server";
import {
  createOAuthAuthorizationUrl, createOAuthPkce, executeOAuth,
  type OAuthAuthorizeInput, type OAuthInput, type OAuthResult,
} from "@bdsqqq/lnr-core";
import { writeStdout } from "../lib/stdout";
import { procedure, router } from "./trpc";

const file = type("string").configure({ positional: true }).describe("json input file or - for stdin");
const showSecrets = type("boolean").describe("explicitly allow token/verifier output on stdout");
function readObject(path: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(path === "-" ? 0 : path, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
  return value as Record<string, unknown>;
}
function invalid(): TRPCError {
  return new TRPCError({
    code: "BAD_REQUEST",
    message: "invalid oauth input; check fields, execution flag and secret-output consent",
  });
}

export function createOAuthRouter(run: typeof executeOAuth = executeOAuth) {
  return router({
    oauth: router({
      authorize: procedure.meta({ description: "build an authorization URL locally; caller must validate callback state" })
        .input(type({ file, "showSecrets?": showSecrets, "+": "reject" })).mutation(async ({ input }) => {
          let result: { kind: "authorization-url"; url: string } | { kind: "invalid"; attempted: false };
          try {
            const value = readObject(input.file);
            // Plain PKCE puts the verifier itself in the URL.
            if (value.code_challenge_method === "plain" && !input.showSecrets) throw new Error();
            result = { kind: "authorization-url",
              url: createOAuthAuthorizationUrl(value as unknown as OAuthAuthorizeInput) };
          } catch { result = { kind: "invalid", attempted: false }; }
          await writeStdout(`${JSON.stringify(result)}\n`);
          if (result.kind === "invalid") throw invalid();
        }),
      pkce: procedure.meta({ description: "generate a local PKCE verifier/challenge; verifier output requires consent" })
        .input(type({ "showSecrets?": showSecrets, "+": "reject" })).mutation(async ({ input }) => {
          if (!input.showSecrets) throw invalid();
          await writeStdout(`${JSON.stringify({ kind: "pkce", ...createOAuthPkce() })}\n`);
        }),
      request: procedure.meta({ description: "validate or explicitly execute an OAuth token/revocation request" })
        .input(type({
          file,
          "execute?": type("boolean").describe("explicitly authorize one OAuth request"),
          "showSecrets?": showSecrets,
          "+": "reject",
        })).mutation(async ({ input }) => {
          let request: OAuthInput;
          try {
            const value = readObject(input.file);
            // Neither embedded JSON flags nor ambient Linear credentials authorize execution.
            if (Object.hasOwn(value, "execute")
              || (input.execute && value.operation !== "revoke" && !input.showSecrets)) throw new Error();
            request = { ...value, execute: input.execute === true } as OAuthInput;
          } catch {
            await writeStdout(`${JSON.stringify({ kind: "invalid", attempted: false })}\n`);
            throw invalid();
          }
          const result: OAuthResult = await run(request);
          // Output errors must not redeem a grant twice or reclassify an attempted request.
          await writeStdout(`${JSON.stringify(result)}\n`);
          if (result.kind === "invalid") throw invalid();
          if (result.kind === "failed") throw new TRPCError({
            code: "BAD_REQUEST", message: "oauth request failed; verify the outcome before retrying",
          });
        }),
    }),
  });
}
export const oauthRouter = createOAuthRouter();
