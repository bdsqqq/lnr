import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSchema, introspectionFromSchema } from "graphql";
import { generateApiSchema, main } from "./generate-api-schema";
import { ENDPOINT, OPTIONS, serialize } from "./introspection";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
function fixture() {
  const { __schema } = introspectionFromSchema(buildSchema("type Query { z: String a: Int }"), OPTIONS);
  const schema = { ...__schema, queryType: { ...__schema.queryType, kind: "OBJECT" } };
  return {
    __schema: schema,
    provenance: {
      formatVersion: 1, endpoint: ENDPOINT, sdkVersion: "95.1.0",
      captureStartedAt: "2026-09-22T00:00:00.000Z",
      captureCompletedAt: "2026-09-22T00:01:00.000Z",
      consistency: "two-matching-passes; not an upstream atomic snapshot",
      schemaSha256: hash(serialize(schema)),
    },
  };
}

test("generates sorted live SDL and reproducible provenance", () => {
  const snapshot = fixture();
  const before = serialize(snapshot);
  const result = generateApiSchema(snapshot);
  expect(result.sdl).toBe("type Query {\n  a: Int\n  z: String\n}\n");
  expect(JSON.parse(result.metadata)).toEqual({
    source: "live-introspection", sdkVersion: "95.1.0", endpoint: ENDPOINT,
    captureStartedAt: snapshot.provenance.captureStartedAt,
    captureCompletedAt: snapshot.provenance.captureCompletedAt,
    consistency: snapshot.provenance.consistency,
    snapshotSha256: snapshot.provenance.schemaSha256, schemaSha256: hash(result.sdl),
  });
  expect(generateApiSchema(snapshot)).toEqual(result);
  expect(serialize(snapshot)).toBe(before);
});

test("rejects invalid provenance and incomplete introspection even with a matching hash", () => {
  for (const override of [
    { schemaSha256: "bad" }, { formatVersion: 2 }, { endpoint: "https://example.com" },
    { sdkVersion: "" }, { consistency: "" }, { captureStartedAt: "invalid" },
    { captureCompletedAt: "2026-09-21T00:00:00.000Z" },
  ]) {
    const snapshot = fixture();
    Object.assign(snapshot.provenance, override);
    expect(() => generateApiSchema(snapshot)).toThrow();
  }
  const snapshot = fixture();
  const schema: Record<string, unknown> = { ...snapshot.__schema };
  delete schema.directives;
  snapshot.provenance.schemaSha256 = hash(serialize(schema));
  expect(() => generateApiSchema({ ...snapshot, __schema: schema })).toThrow();
});

test("check preserves missing, stale and valid artifacts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lnr-api-schema-"));
  const paths = {
    schema: join(directory, "schema.json"), output: join(directory, "api.graphql"),
    provenance: join(directory, "api.json"),
  };
  try {
    await writeFile(paths.schema, serialize(fixture()));
    await expect(main(true, paths)).rejects.toThrow();
    await expect(stat(paths.output)).rejects.toThrow();
    await main(false, paths);
    const files = [paths.output, paths.provenance];
    const baseline = await Promise.all(files.map(file => readFile(file, "utf8")));
    const times = await Promise.all(files.map(async file => (await stat(file)).mtimeMs));
    await main(true, paths);
    expect(await Promise.all(files.map(async file => (await stat(file)).mtimeMs))).toEqual(times);
    for (const [index, file] of files.entries()) {
      await writeFile(file, `${baseline[index]} `);
      await expect(main(true, paths)).rejects.toThrow("stale");
      expect(await readFile(file, "utf8")).toBe(`${baseline[index]} `);
      await writeFile(file, baseline[index]!);
    }
    await main(false, paths);
    expect(await Promise.all(files.map(file => readFile(file, "utf8")))).toEqual(baseline);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
