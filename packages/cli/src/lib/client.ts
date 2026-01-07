import { getClient as getCoreClient } from "@bdsqqq/lnr-core";
import { program } from "../cli";

export function getClient() {
  const opts = program.opts();
  return getCoreClient(opts.apiKey);
}
