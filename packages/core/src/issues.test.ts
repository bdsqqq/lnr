import { describe, test, expect, beforeAll } from "bun:test";
import { LinearClient } from "@linear/sdk";
import { getApiKey } from "./config";
import { listIssues, getIssue, createIssue, priorityFromString } from "./issues";

const TEST_PREFIX = "[TEST-CLI]";

function getTestClient(): LinearClient {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("no api key configured - run: li auth <api-key>");
  }
  return new LinearClient({ apiKey });
}

async function getFirstTeamKey(): Promise<string> {
  const client = getTestClient();
  const teams = await client.teams();
  const bdsq = teams.nodes.find((t) => t.key === "BDSQ");
  if (bdsq) return bdsq.key;
  const first = teams.nodes[0];
  if (!first) throw new Error("no teams found");
  return first.key;
}

const hasApiKey = !!getApiKey();

describe("issues core", { skip: !hasApiKey }, () => {
  let client: LinearClient;
  let teamKey: string;

  beforeAll(async () => {
    client = getTestClient();
    teamKey = await getFirstTeamKey();
  });

  test("priorityFromString converts priority names", () => {
    expect(priorityFromString("urgent")).toBe(1);
    expect(priorityFromString("high")).toBe(2);
    expect(priorityFromString("medium")).toBe(3);
    expect(priorityFromString("low")).toBe(4);
    expect(priorityFromString("none")).toBe(0);
    expect(priorityFromString("unknown")).toBe(0);
  });

  test("listIssues returns issue array", async () => {
    const issues = await listIssues(client);
    expect(Array.isArray(issues)).toBe(true);
    if (issues.length > 0) {
      expect(issues[0]).toHaveProperty("id");
      expect(issues[0]).toHaveProperty("identifier");
      expect(issues[0]).toHaveProperty("title");
    }
  });

  test("listIssues filters by team", async () => {
    const issues = await listIssues(client, { team: teamKey });
    expect(Array.isArray(issues)).toBe(true);
    for (const issue of issues) {
      expect(issue.identifier.startsWith(teamKey + "-")).toBe(true);
    }
  });

  test("getIssue returns null for nonexistent issue", async () => {
    const issue = await getIssue(client, "NONEXISTENT-99999");
    expect(issue).toBeNull();
  });
});
