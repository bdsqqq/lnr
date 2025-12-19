import { describe, test, expect, beforeAll } from "bun:test";
import { LinearClient } from "@linear/sdk";
import { getApiKey } from "./config";
import { searchIssues } from "./search";

function getTestClient(): LinearClient {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("no api key configured - run: li auth <api-key>");
  }
  return new LinearClient({ apiKey });
}

const hasApiKey = !!getApiKey();

describe.skipIf(!hasApiKey)("search core", () => {
  let client: LinearClient;

  beforeAll(() => {
    client = getTestClient();
  });

  test("searchIssues returns issue array", async () => {
    const issues = await searchIssues(client, "issue");
    expect(Array.isArray(issues)).toBe(true);
    if (issues.length > 0) {
      expect(issues[0]).toHaveProperty("id");
      expect(issues[0]).toHaveProperty("identifier");
      expect(issues[0]).toHaveProperty("title");
    }
  });

  test("searchIssues filters by team", async () => {
    const issues = await searchIssues(client, "issue", { team: "BDSQ" });
    expect(Array.isArray(issues)).toBe(true);
    for (const issue of issues) {
      expect(issue.identifier.startsWith("BDSQ-")).toBe(true);
    }
  });
});
