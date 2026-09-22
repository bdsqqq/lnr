import { devNull } from "node:os";

export function liveCredentials(env: Record<string, string | undefined>, mutations = false) {
  const key = env.LINEAR_API_KEY?.trim();
  if (!key) throw new Error("live tests require LINEAR_API_KEY");
  const confirmOrg = env.LNR_E2E_CONFIRM_ORG?.trim();
  if (mutations && !confirmOrg) throw new Error("mutation tests require LNR_E2E_CONFIRM_ORG");
  return { key, confirmOrg };
}

export function liveChildEnv(env: Record<string, string | undefined>, key: string) {
  return { ...env, LINEAR_API_KEY: key, LNR_CONFIG_PATH: devNull };
}

export interface OwnedFixture {
  name: string;
  id?: string;
  deleteAttempted?: boolean;
  deleted?: boolean;
  remove: (id: string) => Promise<unknown>;
}

/** unknown write outcomes require manual recovery, never a speculative retry. */
export async function cleanupOwned(fixtures: OwnedFixture[]): Promise<void> {
  const failures: Error[] = [];
  for (const fixture of [...fixtures].reverse()) {
    if (fixture.deleted) continue;
    const identity = `${fixture.name} (${fixture.id ?? "id unknown"})`;
    if (!fixture.id || fixture.deleteAttempted) {
      failures.push(new Error(`manual authorized recovery required: ${identity}`));
      continue;
    }
    fixture.deleteAttempted = true;
    try {
      const result = await fixture.remove(fixture.id);
      if (!result || typeof result !== "object" || !("success" in result) || result.success !== true) {
        throw new Error("delete did not report success");
      }
      fixture.deleted = true;
    } catch {
      failures.push(new Error(`manual authorized recovery required: ${identity}`));
    }
  }
  if (failures.length) throw new AggregateError(failures, failures.map((e) => e.message).join("\n"));
}
