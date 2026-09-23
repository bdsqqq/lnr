import { afterEach, beforeEach, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const secret = "fixture-webhook-secret";
const entrypoint = new URL("../cli.ts", import.meta.url).pathname;
let directory: string, file: string, raw: string, signature: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "lnr-webhook-"));
  file = join(directory, "body.json");
  raw = JSON.stringify({ type: "FutureEvent", webhookTimestamp: Date.now(), extra: ["é", null, false] }) + "\n";
  signature = createHmac("sha256", secret).update(raw).digest("hex");
  writeFileSync(file, raw);
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));
function spawn(args: string[], signingSecret = secret, blockOutput = false) {
  const argv = [entrypoint, "webhook", ...args];
  const command = blockOutput ? ["--eval", `
    const serve = Bun.serve.bind(Bun);
    Bun.serve = options => {
      const server = serve(options);
      return new Proxy(server, { get(target, key) {
        if (key === "stop") return force => {
          void target.stop(force);
          return new Promise(() => {});
        };
        return Reflect.get(target, key, target);
      } });
    };
    process.stdout.write = () => {
      process.stderr.write("test.stdout.pending\\n");
      return false;
    };
    process.argv = ["bun", ...${JSON.stringify(argv)}];
    await import(${JSON.stringify(entrypoint)});
  `] : argv;
  return Bun.spawn([process.execPath, ...command], {
    stdout: "pipe", stderr: "pipe",
    env: { ...process.env, LINEAR_WEBHOOK_SECRET: signingSecret, LINEAR_API_KEY: "",
      LNR_CONFIG_PATH: join(directory, "no-config") },
  });
}
async function complete(args: string[], signingSecret = secret) {
  const proc = spawn(args, signingSecret);
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited,
  ]);
  return { stdout, stderr, code };
}
async function line(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("missing process output")), 3000);
  });
  try {
    return await Promise.race([deadline, (async () => {
      let text = "";
      const decoder = new TextDecoder();
      for (;;) {
        const next = await reader.read();
        if (next.done) throw new Error("process output ended early");
        text += decoder.decode(next.value, { stream: true });
        if (text.includes("\n")) return text.slice(0, text.indexOf("\n"));
      }
    })()]);
  } finally { clearTimeout(timer!); reader.releaseLock(); }
}
test("verify argv preserves signed bytes and unknown fields without API credentials", async () => {
  const result = await complete(["verify", file, "--signature", signature]);
  expect({ code: result.code, stderr: result.stderr }).toEqual({ code: 0, stderr: "" });
  expect(JSON.parse(result.stdout)).toEqual({ ok: true, payload: JSON.parse(raw) });
  expect(result.stdout).not.toContain(secret);
});
test.each(["signature", "secret", "bytes"] as const)("invalid %s exits nonzero without payload or secret", async kind => {
  if (kind === "bytes") writeFileSync(file, raw.trim());
  const result = await complete(["verify", file, "--signature", kind === "signature" ? "invalid" : signature],
    kind === "secret" ? "" : secret);
  expect(result.code).toBe(1);
  expect(JSON.parse(result.stdout).ok).toBe(false);
  expect(result.stdout + result.stderr).not.toMatch(/fixture-webhook-secret|FutureEvent/);
});
test("serve preview needs no secret or listener", async () => {
  const result = await complete(["serve", "--port", "0"], "");
  expect(result.code).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, executed: false, port: 0 });
  expect(result.stderr).toBe("");
});
test("real CLI loopback receiver verifies delivery, rejects forgery and stops on SIGTERM", async () => {
  const proc = spawn(["serve", "--execute", "--port", "0"]);
  try {
    const ready = JSON.parse(await line(proc.stderr));
    expect(ready.event).toBe("webhook.listening");
    expect(new URL(ready.url).hostname).toBe("127.0.0.1");
    const response = await fetch(ready.url, {
      method: "POST", body: raw, headers: { "linear-signature": signature },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
    expect(JSON.parse(await line(proc.stdout))).toEqual(JSON.parse(raw));
    const forged = await fetch(ready.url, {
      method: "POST", body: raw, headers: { "linear-signature": "invalid" },
    });
    expect(forged.status).toBe(400);
    await forged.text();
    proc.kill("SIGTERM");
    expect(await proc.exited).toBe(0);
  } finally {
    if (proc.exitCode === null) proc.kill("SIGKILL");
    await proc.exited;
  }
}, 10000);

test("SIGTERM bounds pending output and platform stop waits without acknowledging delivery", async () => {
  // A partial pipe read does not prove backpressure: Bun may buffer the remainder.
  // Hold output and stop promises explicitly; the real server still closes sockets.
  // This guarantees the deadline branch independently of Bun's buffering/version.
  const proc = spawn(["serve", "--execute", "--port", "0"], secret, true);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ready = JSON.parse(await line(proc.stderr));
    let acknowledged = false;
    const delivery = fetch(ready.url, {
      method: "POST", body: raw, headers: { "linear-signature": signature },
    }).then(async response => {
      acknowledged = response.status === 200;
      await response.text();
    }).catch(() => {});
    expect(await line(proc.stderr)).toBe("test.stdout.pending");
    expect(acknowledged).toBe(false);
    const started = performance.now();
    proc.kill("SIGTERM");
    const exited = await Promise.race([
      proc.exited,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("shutdown did not finish")), 4000);
      }),
    ]);
    expect(exited).toBe(0);
    expect(performance.now() - started).toBeGreaterThanOrEqual(900);
    await delivery;
    expect(acknowledged).toBe(false);
  } finally {
    clearTimeout(timer);
    if (proc.exitCode === null) proc.kill("SIGKILL");
    await proc.exited;
  }
}, 10000);
