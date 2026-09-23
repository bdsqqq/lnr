import { expect, spyOn, test } from "bun:test";
import { LinearClient } from "@linear/sdk";
import * as clients from "./client";
import { executeUpload, UploadExecutionError, type UploadOptions } from "./upload";

const options: UploadOptions = {
  body: new Blob([new Uint8Array([0, 255, 13, 10])]),
  filename: "sample.bin", contentType: "application/octet-stream",
  makePublic: true, metaData: { issueId: "fixture" }, execute: true,
};
function harness() {
  const state = { factories: 0, descriptors: 0, transfers: 0 };
  const payload = { success: true, uploadFile: {
    uploadUrl: "https://storage.example/object?signature=SECRET",
    assetUrl: "https://assets.example/object",
    headers: [{ key: "x-storage-token", value: "STORAGE" }],
  } };
  let args: unknown[] = [];
  let request: { url: string; init: RequestInit } | undefined;
  let fail: "factory" | "descriptor" | "transfer" | undefined;
  let response = { ok: true, redirected: false };
  const factory = () => {
    state.factories++;
    if (fail === "factory") throw new Error("SECRET");
    return {
      options: { headers: { Authorization: "SECRET", Cookie: "SECRET" } },
      async fileUpload(...input: unknown[]) {
        state.descriptors++;
        args = input;
        if (fail === "descriptor") throw new Error("SECRET");
        return payload;
      },
    };
  };
  const transfer = async (url: string, init: RequestInit) => {
    state.transfers++;
    request = { url, init };
    if (fail === "transfer") throw new Error("SECRET");
    return response;
  };
  return {
    state, payload, factory, transfer, args: () => args, request: () => request!,
    fail: (value: typeof fail) => { fail = value; },
    respond: (value: typeof response) => { response = value; },
  };
}
test("offline upload never acquires credentials or performs network calls", async () => {
  for (const execute of [undefined, false]) {
    const h = harness();
    expect(await executeUpload({ ...options, execute }, h.factory, h.transfer))
      .toEqual({ ok: true, executed: false, stage: "descriptor" });
    expect(h.state).toEqual({ factories: 0, descriptors: 0, transfers: 0 });
  }
});
test.each([
  { filename: "" }, { filename: "bad\nname" }, { contentType: "invalid" },
  { contentType: "text/plain\r\nsecret: value" }, { body: {} },
  { makePublic: "true" }, { execute: "true" }, { metaData: { value: undefined } },
  { metaData: { value: BigInt(1) } }, { metaData: { value: NaN } },
  { metaData: false }, { metaData: [] }, { metaData: "not an object" },
])("invalid upload rejected before credentials: %p", async patch => {
  const h = harness();
  await expect(executeUpload({ ...options, ...patch } as UploadOptions, h.factory, h.transfer))
    .rejects.toBeInstanceOf(UploadExecutionError);
  expect(h.state).toEqual({ factories: 0, descriptors: 0, transfers: 0 });
});
test("one descriptor and one PUT preserve bytes and isolate client credentials", async () => {
  const h = harness();
  expect(await executeUpload(options, h.factory, h.transfer)).toEqual({
    ok: true, executed: true, stage: "transfer", assetUrl: h.payload.uploadFile.assetUrl,
  });
  expect(h.args()).toEqual([
    options.contentType, options.filename, 4, { makePublic: true, metaData: options.metaData },
  ]);
  const { url, init } = h.request();
  expect(url).toBe(h.payload.uploadFile.uploadUrl);
  expect(init).toMatchObject({ method: "PUT", redirect: "error", credentials: "omit" });
  expect(init.body).toBe(options.body);
  expect(new Uint8Array(await (init.body as Blob).arrayBuffer())).toEqual(new Uint8Array([0, 255, 13, 10]));
  expect(Object.fromEntries(new Headers(init.headers))).toEqual({
    "content-type": options.contentType, "cache-control": "public, max-age=31536000",
    "x-storage-token": "STORAGE",
  });
  expect(h.state).toEqual({ factories: 1, descriptors: 1, transfers: 1 });
});
test.each([
  { uploadUrl: "http://storage.example/object" },
  { uploadUrl: "https://user:SECRET@storage.example/object" }, { uploadUrl: "invalid" },
  { assetUrl: "http://assets.example/object" },
  { headers: [{ key: "bad header", value: "SECRET" }] },
  { headers: [{ key: "x-test", value: "SECRET\r\ninjected: yes" }] },
  { headers: [{ key: "x-test", value: "a" }, { key: "X-Test", value: "b" }] },
])("invalid descriptor never reaches PUT: %j", async patch => {
  const h = harness();
  Object.assign(h.payload.uploadFile, patch);
  const result = await executeUpload(options, h.factory, h.transfer);
  expect(result).toMatchObject({ ok: false, executed: true, stage: "descriptor" });
  expect(JSON.stringify(result)).not.toMatch(/SECRET|signature|https:/);
  expect(h.state.transfers).toBe(0);
});
test.each(["factory", "descriptor", "transfer", "http", "redirect", "unsuccessful"] as const)(
  "upload failure is sanitized and never retried: %s", async failure => {
    const h = harness();
    if (failure === "http") h.respond({ ok: false, redirected: false });
    else if (failure === "redirect") h.respond({ ok: true, redirected: true });
    else if (failure === "unsuccessful") h.payload.success = false;
    else h.fail(failure);
    const result = await executeUpload(options, h.factory, h.transfer);
    expect(result).toMatchObject({ ok: false, executed: failure !== "factory",
      stage: ["transfer", "http", "redirect"].includes(failure) ? "transfer" : "descriptor" });
    expect(JSON.stringify(result)).not.toMatch(/SECRET|signature|https:/);
    expect(h.state.transfers).toBe(["transfer", "http", "redirect"].includes(failure) ? 1 : 0);
    expect(h.state.descriptors).toBe(failure === "factory" ? 0 : 1);
  },
);
test("omitted, null and false visibility survive without public defaults", async () => {
  for (const value of [undefined, null, false] as const) {
    const h = harness();
    const metaData = value === false ? { flag: false, count: 0, ids: [] } : value;
    await executeUpload({ ...options, makePublic: value, metaData }, h.factory, h.transfer);
    expect(h.args()[3]).toEqual({ makePublic: value, metaData });
  }
});
test("caller changes after allocation starts cannot switch the uploaded body", async () => {
  const h = harness(), input = { ...options };
  const pending = executeUpload(input, h.factory, h.transfer);
  input.body = new Blob(["different"]);
  input.contentType = "text/plain";
  expect((await pending).ok).toBe(true);
  expect(h.request().init.body).toBe(options.body);
  expect(new Headers(h.request().init.headers).get("Content-Type")).toBe(options.contentType);
});

test("real SDK serializes the descriptor request and returns immediate storage fields", async () => {
  const h = harness();
  const requests: Record<string, unknown>[] = [];
  const transport = spyOn(globalThis, "fetch").mockImplementation(Object.assign(
    async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));
      expect(new Headers(init?.headers).get("Authorization")).toBe("fixture-key");
      return Response.json({ data: { fileUpload: h.payload } });
    }, { preconnect() {} },
  ));
  try {
    const client = new LinearClient({ apiKey: "fixture-key", apiUrl: "http://localhost:1/graphql" });
    expect((await executeUpload(options, () => client, h.transfer)).ok).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.variables).toEqual({
      contentType: options.contentType, filename: options.filename, size: 4,
      makePublic: true, metaData: options.metaData,
    });
    expect(new Headers(h.request().init.headers).has("Authorization")).toBe(false);
  } finally { transport.mockRestore(); }
});

test("descriptor header overrides and zero-byte uploads reach storage", async () => {
  const h = harness();
  h.payload.uploadFile.headers = [{ key: "Cache-Control", value: "private" }];
  expect((await executeUpload({ ...options, body: new Blob([]) }, h.factory, h.transfer)).ok).toBe(true);
  expect(h.args()[2]).toBe(0);
  expect(new Headers(h.request().init.headers).get("Cache-Control")).toBe("private");
});

test("default upload factory selects an uncached redirect-rejecting SDK client", async () => {
  const h = harness();
  const factory = spyOn(clients, "getClient").mockImplementation(
    () => h.factory() as unknown as LinearClient,
  );
  try {
    expect((await executeUpload(options, undefined, h.transfer)).ok).toBe(true);
    expect(factory).toHaveBeenCalledWith(undefined, { redirect: "error" });
  } finally { factory.mockRestore(); }
});

test("real SDK redirect rejection prevents descriptor replay and storage PUT", async () => {
  let requests = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1", port: 0,
    fetch(request) {
      requests++;
      return new Response(null, { status: 307, headers: { Location: new URL("/second", request.url).href } });
    },
  });
  try {
    const h = harness();
    const client = new LinearClient({
      apiKey: "fixture-key", apiUrl: server.url.href, redirect: "error",
    });
    const result = await executeUpload(options, () => client, h.transfer);
    expect(result).toMatchObject({ ok: false, executed: true, stage: "descriptor" });
    expect(requests).toBe(1);
    expect(h.state.transfers).toBe(0);
  } finally { server.stop(true); }
});
