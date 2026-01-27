import { describe, it, expect, mock } from "bun:test";
import { resolveIssueIdentifier, IssueNotFoundError } from "./resolvers";
import type { LinearClient } from "@linear/sdk";

describe("resolveIssueIdentifier", () => {
  it("returns UUID for valid identifier", async () => {
    const mockClient = {
      issue: mock(() => Promise.resolve({ id: "uuid-123-abc" })),
    } as unknown as LinearClient;

    const result = await resolveIssueIdentifier(mockClient, "ENG-123");

    expect(result).toBe("uuid-123-abc");
    expect(mockClient.issue).toHaveBeenCalledWith("ENG-123");
  });

  it("throws IssueNotFoundError when issue returns null", async () => {
    const mockClient = {
      issue: mock(() => Promise.resolve(null)),
    } as unknown as LinearClient;

    await expect(resolveIssueIdentifier(mockClient, "ENG-999")).rejects.toThrow(
      IssueNotFoundError
    );
  });

  it("throws IssueNotFoundError when API throws", async () => {
    const mockClient = {
      issue: mock(() => Promise.reject(new Error("API error"))),
    } as unknown as LinearClient;

    await expect(
      resolveIssueIdentifier(mockClient, "INVALID-123")
    ).rejects.toThrow(IssueNotFoundError);
  });

  it("error message includes the identifier", async () => {
    const mockClient = {
      issue: mock(() => Promise.resolve(null)),
    } as unknown as LinearClient;

    try {
      await resolveIssueIdentifier(mockClient, "ENG-404");
      expect(true).toBe(false);
    } catch (error) {
      expect(error instanceof IssueNotFoundError).toBe(true);
      expect((error as Error).message).toBe("issue not found: ENG-404");
    }
  });
});
