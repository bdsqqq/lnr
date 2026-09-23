import { LinearWebhookClient } from "@linear/sdk/webhooks";

export type WebhookPayload = Record<string, unknown>;
export interface WebhookOptions {
  secret: string;
  onPayload: (payload: WebhookPayload) => void | Promise<void>;
  maxBodyBytes?: number;
}

/** Reject ambiguous decoding without narrowing away future event fields. */
function decode(raw: Buffer): WebhookPayload {
  const value: unknown = JSON.parse(new TextDecoder("utf-8", {
    fatal: true, ignoreBOM: true,
  }).decode(raw));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error();
  const payload = value as WebhookPayload;
  // SDK wildcard dispatch invokes '*' twice for an event named '*'.
  if (typeof payload.type !== "string" || !payload.type.trim() || payload.type === "*") throw Error();
  return payload;
}

/** SDK owns HMAC, signed ±60s freshness, and awaited callback acknowledgement.
 * The byte limit bounds accepted input, not total memory across concurrent requests.
 */
export function createWebhookReceiver(options: WebhookOptions) {
  const maxBodyBytes = options.maxBodyBytes ?? 1024 * 1024;
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1) {
    throw new Error("maxBodyBytes must be a positive safe integer");
  }
  const onPayload = options.onPayload;
  if (typeof onPayload !== "function") throw new Error("onPayload must be a function");
  const sdk = new LinearWebhookClient(options.secret);
  const sdkHandler = sdk.createHandler();
  sdkHandler.on("*", payload => onPayload(payload as unknown as WebhookPayload));
  function parse(raw: Buffer, signature: string): WebhookPayload {
    try {
      if (raw.length > maxBodyBytes) throw Error();
      sdk.verify(raw, signature);
      return decode(raw);
    } catch {
      throw new Error("invalid webhook");
    }
  }
  async function handler(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
    const signature = request.headers.get("linear-signature");
    if (!signature) return new Response("invalid webhook", { status: 400 });
    let raw: Buffer;
    try {
      const reader = request.body?.getReader();
      const chunks: Buffer[] = [];
      let size = 0;
      if (reader) {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > maxBodyBytes) {
              void reader.cancel().catch(() => {});
              return new Response("webhook body too large", { status: 413 });
            }
            chunks.push(Buffer.from(value));
          }
        } finally { reader.releaseLock(); }
      }
      raw = Buffer.concat(chunks, size);
      decode(raw);
    } catch { return new Response("invalid webhook", { status: 400 }); }
    // Rebuild only transport: never normalize signed bytes or trust legacy timestamps.
    return sdkHandler(new Request(request.url, {
      method: "POST", headers: { "linear-signature": signature }, body: raw,
    }));
  }
  return { parse, handler };
}
