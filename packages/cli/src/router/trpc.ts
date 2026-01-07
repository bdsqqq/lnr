import { initTRPC } from "@trpc/server";
import type { TrpcCliMeta } from "trpc-cli";

export const t = initTRPC.meta<TrpcCliMeta>().create();

export const router = t.router;
export const procedure = t.procedure;
