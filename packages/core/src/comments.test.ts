import { describe, test, expect } from "bun:test";
import { aggregateReactions, extractSyncMeta } from "./comments";

describe("aggregateReactions", () => {
  test("empty array → empty", () => {
    expect(aggregateReactions([])).toEqual([]);
  });

  test("single reaction → count 1", () => {
    expect(aggregateReactions([{ emoji: "👍" }])).toEqual([
      { emoji: "👍", count: 1 },
    ]);
  });

  test("duplicates aggregate", () => {
    const result = aggregateReactions([
      { emoji: "👍" },
      { emoji: "👍" },
      { emoji: "👍" },
    ]);
    expect(result).toEqual([{ emoji: "👍", count: 3 }]);
  });

  test("different emojis get separate entries", () => {
    const result = aggregateReactions([
      { emoji: "👍" },
      { emoji: "👎" },
      { emoji: "👍" },
    ]);
    expect(result).toContainEqual({ emoji: "👍", count: 2 });
    expect(result).toContainEqual({ emoji: "👎", count: 1 });
    expect(result).toHaveLength(2);
  });
});

describe("extractSyncMeta", () => {
  test("slack with valid metadata", () => {
    const result = extractSyncMeta("slack", {
      channelName: "frontend",
      messageUrl: "https://slack.com/msg/123",
    });
    expect(result).toEqual({
      type: "slack",
      channelName: "frontend",
      messageUrl: "https://slack.com/msg/123",
    });
  });

  test("slack with missing metadata", () => {
    expect(extractSyncMeta("slack", null)).toEqual({
      type: "slack",
      channelName: undefined,
      messageUrl: undefined,
    });
  });

  test("slack with partial metadata", () => {
    expect(extractSyncMeta("slack", { channelName: "general" })).toEqual({
      type: "slack",
      channelName: "general",
      messageUrl: undefined,
    });
  });

  test("github extracts owner/repo/number", () => {
    const result = extractSyncMeta("github", {
      owner: "bdsqqq",
      repo: "lnr",
      number: 42,
    });
    expect(result).toEqual({
      type: "github",
      owner: "bdsqqq",
      repo: "lnr",
      number: 42,
    });
  });

  test("github partial (only repo)", () => {
    expect(extractSyncMeta("github", { repo: "lnr" })).toEqual({
      type: "github",
      owner: undefined,
      repo: "lnr",
      number: undefined,
    });
  });

  test("jira extracts issueKey/projectId", () => {
    const result = extractSyncMeta("jira", {
      issueKey: "PROJ-123",
      projectId: "proj-id",
    });
    expect(result).toEqual({
      type: "jira",
      issueKey: "PROJ-123",
      projectId: "proj-id",
    });
  });

  test("unknown service → { type: 'unknown' }", () => {
    expect(extractSyncMeta("notion", { some: "data" })).toEqual({
      type: "unknown",
    });
  });

  test("case insensitive", () => {
    expect(extractSyncMeta("SLACK", { channelName: "test" })).toEqual({
      type: "slack",
      channelName: "test",
      messageUrl: undefined,
    });
    expect(extractSyncMeta("GitHub", { owner: "x" })).toEqual({
      type: "github",
      owner: "x",
      repo: undefined,
      number: undefined,
    });
  });
});
