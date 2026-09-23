import type { LinearClient } from "@linear/sdk";
import { getClient } from "./client";

export interface UploadOptions {
  body: Blob;
  filename: string;
  contentType: string;
  makePublic?: boolean | null;
  metaData?: Record<string, unknown> | null;
  execute?: boolean;
}

interface UploadClient {
  fileUpload(...args: Parameters<LinearClient["fileUpload"]>): Promise<{
    success: boolean;
    uploadFile?: {
      uploadUrl: string;
      assetUrl: string;
      headers: readonly { key: string; value: string }[];
    } | null;
  }>;
}
type Transfer = (url: string, init: RequestInit) => Promise<Pick<Response, "ok" | "redirected">>;

export interface UploadResult {
  ok: boolean;
  executed: boolean;
  stage: "descriptor" | "transfer";
  assetUrl?: string;
  errors?: { message: string }[];
}
export class UploadExecutionError extends Error {
  constructor() {
    super("invalid upload input; provide a blob, filename, mime type, and json metadata");
    this.name = "UploadExecutionError";
  }
}

function inspect(options: UploadOptions): Record<string, unknown> | null | undefined {
  try {
    if (!(options.body instanceof Blob) || options.body.size > 2147483647
      || typeof options.filename !== "string" || !options.filename.trim()
      || /[\x00-\x1f\x7f]/.test(options.filename)
      || typeof options.contentType !== "string"
      || !/^[!#$%&'*+.^_`|~\w-]+\/[!#$%&'*+.^_`|~\w-]+(?:;[^\r\n]+)?$/.test(options.contentType)
      || /[\x00-\x1f\x7f]/.test(options.contentType)
      || (options.execute !== undefined && typeof options.execute !== "boolean")
      || (options.makePublic != null && typeof options.makePublic !== "boolean")) {
      throw new UploadExecutionError();
    }
    new Headers({ "Content-Type": options.contentType });
    if (options.metaData === undefined) return undefined;
    // Snapshot serializable metadata before credentials or asynchronous work.
    const metadata: unknown = JSON.parse(JSON.stringify(options.metaData, (_key, value) => {
      if (["undefined", "function", "symbol", "bigint"].includes(typeof value)
        || (typeof value === "number" && !Number.isFinite(value))) throw new UploadExecutionError();
      return value;
    }));
    if (metadata === null) return null;
    if (typeof metadata !== "object" || Array.isArray(metadata)) throw new UploadExecutionError();
    return metadata as Record<string, unknown>;
  } catch {
    throw new UploadExecutionError();
  }
}
function checkUrl(value: string): void {
  if (typeof value !== "string") throw new Error();
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error();
}

/** A failed transfer may leave an allocated upload; never retry or delete implicitly. */
export async function executeUpload(
  input: UploadOptions,
  clientFactory: () => UploadClient = () => getClient(undefined, { redirect: "error" }),
  transfer: Transfer = (url, init) => fetch(url, init),
): Promise<UploadResult> {
  const options = { ...input };
  const metaData = inspect(options);
  let stage: UploadResult["stage"] = "descriptor";
  let executed = false;
  if (options.execute !== true) return { ok: true, executed, stage };
  try {
    const client = clientFactory();
    executed = true;
    const payload = await client.fileUpload(
      options.contentType, options.filename, options.body.size,
      { makePublic: options.makePublic, metaData },
    );
    const file = payload.uploadFile;
    if (payload.success !== true || !file || !Array.isArray(file.headers)) throw new Error();
    const { uploadUrl, assetUrl } = file;
    checkUrl(uploadUrl);
    checkUrl(assetUrl);
    // Defaults from the pinned SDK upload example; descriptor values take precedence.
    const headers = new Headers({
      "Content-Type": options.contentType, "Cache-Control": "public, max-age=31536000",
    });
    const seen = new Set<string>();
    for (const { key, value } of file.headers) {
      if (typeof key !== "string" || typeof value !== "string"
        || /[\x00-\x08\x0a-\x1f\x7f]/.test(value) || seen.has(key.toLowerCase())) throw new Error();
      headers.set(key, value);
      seen.add(key.toLowerCase());
    }
    stage = "transfer";
    const response = await transfer(uploadUrl, {
      method: "PUT", body: options.body, headers, redirect: "error", credentials: "omit",
    });
    if (!response.ok || response.redirected) throw new Error();
    return { ok: true, executed, stage, assetUrl };
  } catch {
    return { ok: false, executed, stage, errors: [{
      message: "upload failed; verify the outcome before retrying; check authentication, permissions, inputs and service status",
    }] };
  }
}
