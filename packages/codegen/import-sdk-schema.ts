import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { assertValidSchema, buildSchema, lexicographicSortSchema, printSchema } from "graphql";

// npm's 95.1.0 provenance and the annotated release tag resolve to this commit.
const release = {
  sdkVersion: "95.1.0",
  commit: "3addb24bdf771700da1c050742e70e645cc7e36a",
  sourceSha256: "354098d4acd5859524f0f9a77e5b29691e4b4f186b5334e97125ef8c4a2719da",
};
const url = `https://raw.githubusercontent.com/linear/linear/${release.commit}/packages/sdk/src/schema.graphql`;
const output = new URL("../core/src/api-schema.graphql", import.meta.url);
const metadata = new URL("../core/src/api-schema.provenance.json", import.meta.url);
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const normalizedSha256 = "6f944e957c16e6d7fa485208d158cf13645bb90bd3bb9bf87d688be7b1e652dc";

export function verifyPinnedSchema(text: string, provenance: unknown): void {
  if (sha256(text) !== normalizedSha256) throw new Error("sdk schema differs from the pinned normalized release");
  const expected = { source: "sdk-release", ...release, url, schemaSha256: normalizedSha256 };
  if (JSON.stringify(provenance) !== JSON.stringify(expected)) throw new Error("sdk schema provenance is stale");
  assertValidSchema(buildSchema(text));
}

export async function main(check = process.argv.includes("--check")): Promise<void> {
  const require = createRequire(new URL("../core/package.json", import.meta.url));
  const { version } = require("@linear/sdk/package.json") as { version: string };
  if (version !== release.sdkVersion) throw new Error("sdk version changed; review and update the pinned schema source");
  if (check) {
    const text = await readFile(output, "utf8");
    const provenance = JSON.parse(await readFile(metadata, "utf8"));
    verifyPinnedSchema(text, provenance);
    return;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`sdk schema download failed: ${response.status}`);
  const source = await response.text();
  if (sha256(source) !== release.sourceSha256) throw new Error("sdk schema source digest mismatch");
  const schema = buildSchema(source);
  assertValidSchema(schema);
  const text = `${printSchema(lexicographicSortSchema(schema))}\n`;
  if (sha256(text) !== normalizedSha256) throw new Error("normalized sdk schema digest mismatch");
  await writeFile(output, text);
  await writeFile(metadata, `${JSON.stringify({
    source: "sdk-release", ...release, url, schemaSha256: sha256(text),
  }, null, 2)}\n`);
}

if (import.meta.main) main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "sdk schema import failed");
  process.exitCode = 1;
});
