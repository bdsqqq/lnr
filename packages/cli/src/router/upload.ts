import "../lib/arktype-config";
import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { type } from "arktype";
import { TRPCError } from "@trpc/server";
import { executeUpload, UploadExecutionError, type UploadResult } from "@bdsqqq/lnr-core";
import { writeStdout } from "../lib/stdout";
import { procedure, router } from "./trpc";

export const uploadInput = type({
  file: type("string").configure({ positional: true }).describe("file to upload; keep unchanged during transfer"),
  "filename?": type("string").describe("remote filename; defaults to local basename"),
  "contentType?": type("string").describe("mime type; defaults to detected type or application/octet-stream"),
  "metadata?": type("string").describe("json metadata file"),
  "public?": type("boolean").describe("explicitly request public asset visibility"),
  "execute?": type("boolean").describe("authorize descriptor allocation and one storage PUT"),
  "+": "reject",
});
class InputError extends Error {}

export function createUploadRouter(run: typeof executeUpload = executeUpload) {
  return router({
    upload: procedure.meta({ description: "validate an upload offline or explicitly transfer a file" })
      .input(uploadInput).mutation(async ({ input }) => {
        let result: UploadResult;
        try {
          try {
            if (!statSync(input.file).isFile()) throw new Error();
            accessSync(input.file, constants.R_OK);
          } catch { throw new InputError("cannot read upload file"); }
          const body = Bun.file(input.file);
          let metaData: Record<string, unknown> | null | undefined;
          if (input.metadata !== undefined) {
            try {
              const value: unknown = JSON.parse(readFileSync(input.metadata, "utf8"));
              if (value !== null && (typeof value !== "object" || Array.isArray(value))) throw new Error();
              metaData = value as Record<string, unknown> | null;
            }
            catch { throw new InputError("cannot read valid json metadata"); }
          }
          result = await run({
            body, filename: input.filename ?? basename(input.file),
            contentType: input.contentType ?? (body.type || "application/octet-stream"),
            metaData, makePublic: input.public, execute: input.execute === true,
          });
        } catch (error) {
          const message = error instanceof InputError || error instanceof UploadExecutionError
            ? error.message : "upload command failed";
          result = { ok: false, executed: false, stage: "descriptor", errors: [{ message }] };
        }
        // A stdout failure cannot retry or reclassify an already attempted upload.
        await writeStdout(`${JSON.stringify(result)}\n`);
        if (!result.ok) throw new TRPCError({ code: "BAD_REQUEST", message: "upload command failed" });
      }),
  });
}
export const uploadRouter = createUploadRouter();
