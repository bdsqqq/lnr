import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { verifyPinnedSchema } from "./import-sdk-schema";

test("release pin is independent of agreement between local artifacts", async () => {
  const sdl = await readFile(new URL("../core/src/api-schema.graphql", import.meta.url), "utf8");
  const provenance = JSON.parse(await readFile(new URL("../core/src/api-schema.provenance.json", import.meta.url), "utf8"));
  expect(() => verifyPinnedSchema(sdl, provenance)).not.toThrow();
  const changed = "type Query { unrelated: String }\n";
  const digest = createHash("sha256").update(changed).digest("hex");
  expect(() => verifyPinnedSchema(changed, { ...provenance, schemaSha256: digest })).toThrow("pinned");
  expect(() => verifyPinnedSchema(sdl, { ...provenance, commit: "different" })).toThrow("provenance");
});
