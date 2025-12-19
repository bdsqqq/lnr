import { describe, test, expect, beforeAll } from "bun:test";
import { LinearClient } from "@linear/sdk";
import { getApiKey } from "./config";
import { listTeams, getTeam, getTeamMembers, getAvailableTeamKeys } from "./teams";

function getTestClient(): LinearClient {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("no api key configured - run: li auth <api-key>");
  }
  return new LinearClient({ apiKey });
}

const hasApiKey = !!getApiKey();

describe.skipIf(!hasApiKey)("teams core", () => {
  let client: LinearClient;
  let teamKey: string;

  beforeAll(async () => {
    client = getTestClient();
    const keys = await getAvailableTeamKeys(client);
    teamKey = keys.includes("BDSQ") ? "BDSQ" : keys[0] ?? "UNKNOWN";
  });

  test("listTeams returns team array", async () => {
    const teams = await listTeams(client);
    expect(Array.isArray(teams)).toBe(true);
    expect(teams.length).toBeGreaterThan(0);
    expect(teams[0]).toHaveProperty("id");
    expect(teams[0]).toHaveProperty("key");
    expect(teams[0]).toHaveProperty("name");
  });

  test("getTeam returns team by key", async () => {
    const team = await getTeam(client, teamKey);
    expect(team).not.toBeNull();
    expect(team?.key).toBe(teamKey);
  });

  test("getTeam returns null for invalid key", async () => {
    const team = await getTeam(client, "INVALID_KEY_XYZ");
    expect(team).toBeNull();
  });

  test("getTeamMembers returns members array", async () => {
    const members = await getTeamMembers(client, teamKey);
    expect(Array.isArray(members)).toBe(true);
    if (members.length > 0) {
      expect(members[0]).toHaveProperty("id");
      expect(members[0]).toHaveProperty("name");
      expect(members[0]).toHaveProperty("email");
    }
  });

  test("getAvailableTeamKeys returns string array", async () => {
    const keys = await getAvailableTeamKeys(client);
    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBeGreaterThan(0);
    expect(typeof keys[0]).toBe("string");
  });
});
