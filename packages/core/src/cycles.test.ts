import { describe, test, expect, beforeAll } from "bun:test";
import { LinearClient } from "@linear/sdk";
import { getApiKey } from "./config";
import { listCycles, getCurrentCycle } from "./cycles";
import { getAvailableTeamKeys } from "./teams";

function getTestClient(): LinearClient {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("no api key configured - run: li auth <api-key>");
  }
  return new LinearClient({ apiKey });
}

const hasApiKey = !!getApiKey();

describe("cycles core", { skip: !hasApiKey }, () => {
  let client: LinearClient;
  let teamKey: string;

  beforeAll(async () => {
    client = getTestClient();
    const keys = await getAvailableTeamKeys(client);
    teamKey = keys.includes("BDSQ") ? "BDSQ" : keys[0] ?? "UNKNOWN";
  });

  test("listCycles returns cycle array", async () => {
    const cycles = await listCycles(client, teamKey);
    expect(Array.isArray(cycles)).toBe(true);
    if (cycles.length > 0) {
      expect(cycles[0]).toHaveProperty("id");
      expect(cycles[0]).toHaveProperty("number");
      expect(cycles[0]).toHaveProperty("startsAt");
      expect(cycles[0]).toHaveProperty("endsAt");
    }
  });

  test("listCycles returns empty for invalid team", async () => {
    const cycles = await listCycles(client, "INVALID_KEY_XYZ");
    expect(cycles).toEqual([]);
  });

  test("getCurrentCycle returns null for invalid team", async () => {
    const cycle = await getCurrentCycle(client, "INVALID_KEY_XYZ");
    expect(cycle).toBeNull();
  });
});
