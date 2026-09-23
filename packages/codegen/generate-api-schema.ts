import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildClientSchema, lexicographicSortSchema, printSchema } from "graphql";
import { ENDPOINT, serialize, validateSchema } from "./introspection";

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid snapshot object; recapture complete introspection");
  }
  return value as Record<string, unknown>;
}
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`${message}; recapture complete introspection`);
}
function timestamp(value: unknown): number {
  requireValue(typeof value === "string" && value.trim() !== "", "invalid capture timestamp");
  const time = Date.parse(value);
  requireValue(Number.isFinite(time), "invalid capture timestamp");
  return time;
}

export function generateApiSchema(snapshot: unknown) {
  const input = object(snapshot);
  const provenance = object(input.provenance);
  requireValue(provenance.formatVersion === 1, "unsupported snapshot format");
  requireValue(provenance.endpoint === ENDPOINT, "unknown snapshot endpoint");
  requireValue(typeof provenance.sdkVersion === "string" && provenance.sdkVersion.trim(), "missing sdk version");
  requireValue(typeof provenance.consistency === "string" && provenance.consistency.trim(), "missing consistency");
  const started = timestamp(provenance.captureStartedAt);
  const completed = timestamp(provenance.captureCompletedAt);
  requireValue(started <= completed, "capture timestamps out of order");
  validateSchema(input.__schema);
  const snapshotSha256 = sha256(serialize(input.__schema));
  requireValue(snapshotSha256 === provenance.schemaSha256, "snapshot digest mismatch");
  const sdl = `${printSchema(lexicographicSortSchema(buildClientSchema({ __schema: input.__schema })))}\n`;
  const metadata = `${JSON.stringify({
    source: "live-introspection",
    sdkVersion: provenance.sdkVersion,
    endpoint: provenance.endpoint,
    captureStartedAt: provenance.captureStartedAt,
    captureCompletedAt: provenance.captureCompletedAt,
    consistency: provenance.consistency,
    snapshotSha256,
    schemaSha256: sha256(sdl),
  }, null, 2)}\n`;
  return { sdl, metadata };
}

const defaults = {
  schema: new URL("./schema.json", import.meta.url),
  output: new URL("../core/src/api-schema.graphql", import.meta.url),
  provenance: new URL("../core/src/api-schema.provenance.json", import.meta.url),
};
type Paths = { [K in keyof typeof defaults]: string | URL };
export async function main(check = false, paths: Paths = defaults): Promise<void> {
  const { sdl, metadata } = generateApiSchema(JSON.parse(await readFile(paths.schema, "utf8")));
  if (check) {
    const actual = await Promise.all([readFile(paths.output, "utf8"), readFile(paths.provenance, "utf8")]);
    if (actual[0] !== sdl || actual[1] !== metadata) {
      throw new Error("api schema artifacts are stale; run generate-api-schema.ts");
    }
    return;
  }
  await writeFile(paths.output, sdl);
  await writeFile(paths.provenance, metadata);
}

if (import.meta.main) main(process.argv.includes("--check")).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "api schema generation failed");
  process.exitCode = 1;
});
