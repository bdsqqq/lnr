import { describe, test, expect, beforeAll } from "bun:test";
import { LinearClient } from "@linear/sdk";
import { getApiKey } from "./config";
import { getViewer, getMyIssues, getMyCreatedIssues } from "./me";

function getTestClient(): LinearClient {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("no api key configured - run: li auth <api-key>");
  }
  return new LinearClient({ apiKey });
}

const hasApiKey = !!getApiKey();

describe.skipIf(!hasApiKey)("me core", () => {
  let client: LinearClient;

  beforeAll(() => {
    client = getTestClient();
  });

  test("getViewer returns current user", async () => {
    const viewer = await getViewer(client);
    expect(viewer).toHaveProperty("id");
    expect(viewer).toHaveProperty("name");
    expect(viewer).toHaveProperty("email");
    expect(viewer).toHaveProperty("active");
    expect(viewer).toHaveProperty("admin");
  });

  test("getMyIssues returns issue array", async () => {
    const issues = await getMyIssues(client);
    expect(Array.isArray(issues)).toBe(true);
    if (issues.length > 0) {
      expect(issues[0]).toHaveProperty("id");
      expect(issues[0]).toHaveProperty("identifier");
      expect(issues[0]).toHaveProperty("title");
    }
  });

  test("getMyCreatedIssues returns issue array", async () => {
    const issues = await getMyCreatedIssues(client);
    expect(Array.isArray(issues)).toBe(true);
    if (issues.length > 0) {
      expect(issues[0]).toHaveProperty("id");
      expect(issues[0]).toHaveProperty("identifier");
      expect(issues[0]).toHaveProperty("title");
    }
  });
});
