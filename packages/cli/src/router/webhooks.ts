import "../lib/arktype-config";
import { statSync } from "node:fs";
import { type } from "arktype";
import { TRPCError } from "@trpc/server";
import { createWebhookReceiver, type WebhookPayload } from "@bdsqqq/lnr-core";
import { writeStdout } from "../lib/stdout";
import { procedure, router } from "./trpc";

const common = {
  "secretEnv?": type("string").describe("signing-secret environment variable; default LINEAR_WEBHOOK_SECRET"),
  "maxBodyBytes?": type("number").describe("accepted body limit; default 1048576 bytes"),
};
function limit(value?: number): number {
  const size = value ?? 1024 * 1024;
  if (!Number.isSafeInteger(size) || size < 1) throw new TRPCError({
    code: "BAD_REQUEST", message: "max-body-bytes must be a positive safe integer",
  });
  return size;
}
function secret(name = "LINEAR_WEBHOOK_SECRET"): string {
  const value = process.env[name];
  if (!value) throw new TRPCError({
    code: "BAD_REQUEST", message: "set the webhook signing-secret environment variable",
  });
  return value;
}
export const webhooksRouter = router({
  webhook: router({
    verify: procedure.meta({ description: "verify signed webhook bytes locally and print their payload" })
      .input(type({
        ...common,
        file: type("string").configure({ positional: true }).describe("unaltered webhook body file"),
        signature: type("string").describe("linear-signature header value"),
        "+": "reject",
      })).mutation(async ({ input }) => {
        let result: { ok: boolean; payload?: WebhookPayload; error?: string } = { ok: false };
        try {
          if (!statSync(input.file).isFile()) throw new Error();
          const receiver = createWebhookReceiver({
            secret: secret(input.secretEnv), maxBodyBytes: limit(input.maxBodyBytes),
            onPayload: payload => { result = { ok: true, payload }; },
          });
          // Streaming through the bounded receiver avoids reading an arbitrary file into memory.
          const response = await receiver.handler(new Request("http://localhost/verify", {
            method: "POST", headers: { "linear-signature": input.signature }, body: Bun.file(input.file),
          }));
          if (response.status !== 200) throw new Error();
        } catch {
          result = { ok: false, error: "invalid webhook; check file, signature, signed timestamp, limit and signing secret" };
        }
        await writeStdout(`${JSON.stringify(result)}\n`);
        if (!result.ok) throw new TRPCError({ code: "BAD_REQUEST", message: "webhook verification failed" });
      }),
    serve: procedure.meta({ description: "preview or explicitly start a signed webhook receiver" })
      .input(type({
        ...common,
        "host?": type("string").describe("bind address; default 127.0.0.1"),
        "port?": type("number").describe("bind port; default 8787; zero selects a free port"),
        "execute?": type("boolean").describe("explicitly authorize opening the listener"),
        "+": "reject",
      })).mutation(async ({ input }) => {
        const maxBodyBytes = limit(input.maxBodyBytes);
        const host = input.host ?? "127.0.0.1", port = input.port ?? 8787;
        if (!host.trim() || !Number.isInteger(port) || port < 0 || port > 65535) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "provide a bind address and integer port from 0 to 65535" });
        }
        if (!input.execute) {
          await writeStdout(`${JSON.stringify({ ok: true, executed: false, host, port, maxBodyBytes })}\n`);
          return;
        }
        const receiver = createWebhookReceiver({
          secret: secret(input.secretEnv), maxBodyBytes,
          // SDK acknowledgement follows this write; no durable queue or replay suppression.
          onPayload: payload => writeStdout(`${JSON.stringify(payload)}\n`),
        });
        let server: ReturnType<typeof Bun.serve>;
        try {
          server = Bun.serve({
            hostname: host, port, maxRequestBodySize: maxBodyBytes, fetch: receiver.handler,
          });
        } catch {
          throw new TRPCError({ code: "BAD_REQUEST", message: "cannot start webhook receiver; check bind address and port" });
        }
        let stop = () => {};
        try {
          await new Promise<void>(resolve => {
            stop = resolve;
            process.once("SIGINT", stop);
            process.once("SIGTERM", stop);
            process.stderr.write(`${JSON.stringify({ event: "webhook.listening", url: server.url.href })}\n`);
          });
        } finally {
          process.removeListener("SIGINT", stop);
          process.removeListener("SIGTERM", stop);
          // Bun waits for callbacks even after closing sockets. A stalled stdout
          // consumer must not prevent shutdown; interrupted deliveries remain unacknowledged.
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              server.stop(true),
              new Promise<void>(resolve => { timer = setTimeout(resolve, 1000); }),
            ]);
          } finally { clearTimeout(timer); }
        }
      }),
  }),
});
