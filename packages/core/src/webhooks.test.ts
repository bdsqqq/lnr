import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { createHmac } from "node:crypto";
import { LinearWebhookClient } from "@linear/sdk/webhooks";
import { createWebhookReceiver } from "./webhooks";
const secret = "local-signing-fixture";
const now = 1_800_000_000_000;
const sign = (raw: Buffer) => createHmac("sha256", secret).update(raw).digest("hex");
const body = (ts = now) => Buffer.from(JSON.stringify({
  type: "FutureEvent", webhookTimestamp: ts, unknown: { nested: ["é", null, false] },
}) + "\n");
const request = (raw: Buffer, signature = sign(raw)) => new Request("http://localhost/hook", {
  method: "POST", headers: { "linear-signature": signature }, body: raw,
});
const clock = () => spyOn(Date, "now").mockReturnValue(now);
afterEach(() => mock.restore());

test("real SDK accepts signed ±60s boundaries and ignores legacy timestamp", () => {
  clock();
  const sdk = new LinearWebhookClient(secret);
  for (const ts of [now - 60_000, now, now + 60_000]) {
    const raw = body(ts);
    expect(sdk.verify(raw, sign(raw), 0)).toBe(true);
  }
});
test("timestamp bypasses fail closed locally and through the receiver", async () => {
  clock();
  const sdk = new LinearWebhookClient(secret);
  const callback = mock(() => {});
  const receiver = createWebhookReceiver({ secret, onPayload: callback });
  for (const token of [undefined, "null", '"1800000000000"', "1e400", "-1e400", "true",
    String(now - 60_001), String(now + 60_001)]) {
    const raw = Buffer.from(`{"type":"FutureEvent"${token === undefined ? "" : ',"webhookTimestamp":' + token}}`);
    expect(() => sdk.verify(raw, sign(raw), now)).toThrow();
    expect(() => receiver.parse(raw, sign(raw))).toThrow("invalid webhook");
    expect((await receiver.handler(request(raw))).status).toBe(400);
  }
  expect(callback).not.toHaveBeenCalled();
});
test("unknown fields survive; byte changes and wrong signatures fail", async () => {
  clock();
  const callback = mock(() => {});
  const receiver = createWebhookReceiver({ secret, onPayload: callback });
  const raw = body();
  expect(receiver.parse(raw, sign(raw))).toEqual(JSON.parse(raw.toString()));
  expect((await receiver.handler(request(raw))).status).toBe(200);
  expect(callback).toHaveBeenCalledWith(JSON.parse(raw.toString()));
  const normalized = Buffer.from(raw.toString().trim());
  expect(() => receiver.parse(normalized, sign(raw))).toThrow("invalid webhook");
  expect((await receiver.handler(request(normalized, sign(raw)))).status).toBe(400);
  expect((await receiver.handler(request(raw, "0".repeat(64)))).status).toBe(400);
  expect(callback).toHaveBeenCalledTimes(1);
});
test("malformed JSON, envelope, UTF-8, and wildcard type fail closed", async () => {
  clock();
  const callback = mock(() => {});
  const receiver = createWebhookReceiver({ secret, onPayload: callback });
  const invalidUtf8 = Buffer.concat([Buffer.from(`{"type":"x","webhookTimestamp":${now},"x":"`),
    Buffer.from([255]), Buffer.from('"}')]);
  for (const raw of ["null", "[]", "{}", "{", `{"type":"*","webhookTimestamp":${now}}`]
    .map(value => Buffer.from(value)).concat(invalidUtf8)) {
    expect(() => receiver.parse(raw, sign(raw))).toThrow("invalid webhook");
    expect((await receiver.handler(request(raw))).status).toBe(400);
  }
  expect(callback).not.toHaveBeenCalled();
});
test("limits count streamed bytes, not content-length; exact limit succeeds", async () => {
  clock();
  const raw = body();
  const callback = mock(() => {});
  const receiver = createWebhookReceiver({ secret, maxBodyBytes: raw.length, onPayload: callback });
  expect((await receiver.handler(request(raw))).status).toBe(200);
  const oversized = Buffer.concat([raw, Buffer.from(" ")]);
  expect(() => receiver.parse(oversized, sign(oversized))).toThrow("invalid webhook");
  expect((await receiver.handler(request(oversized))).status).toBe(413);
  const cancel = mock(() => {});
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(raw); controller.enqueue(Buffer.from(" ")); }, cancel,
  });
  const streamed = new Request("http://localhost/hook", {
    method: "POST", headers: { "linear-signature": sign(raw), "content-length": "1" }, body: stream,
  });
  expect((await receiver.handler(streamed)).status).toBe(413);
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledTimes(1);
  for (const maxBodyBytes of [0, -1, 1.5, Infinity]) {
    expect(() => createWebhookReceiver({ secret, maxBodyBytes, onPayload: callback })).toThrow();
  }
  expect(() => createWebhookReceiver({ secret: "", onPayload: callback })).toThrow();
});
test("callback finishes before acknowledgement; rejection is sanitized, never retried", async () => {
  clock();
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  const callback = mock(async () => { entered(); await gate; });
  const receiver = createWebhookReceiver({ secret, onPayload: callback });
  let settled = false;
  const pending = receiver.handler(request(body())).then(response => { settled = true; return response; });
  await started;
  await Promise.resolve();
  expect(settled).toBe(false);
  release();
  expect((await pending).status).toBe(200);
  expect(callback).toHaveBeenCalledTimes(1);
  const failure = mock(async () => { throw new Error(secret); });
  const failing = createWebhookReceiver({ secret, onPayload: failure });
  const response = await failing.handler(request(body()));
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain(secret);
  expect(failure).toHaveBeenCalledTimes(1);
});
