import { describe, test, expect } from "bun:test";
import type { Comment } from "./comments";
import {
  getIssueComments,
  updateComment,
  replyToComment,
  deleteComment,
} from "./comments";

describe("comments", () => {
  test("Comment interface has expected shape", () => {
    const comment: Comment = {
      id: "comment-123",
      body: "test body",
      createdAt: new Date(),
      updatedAt: new Date(),
      user: "alice",
      parentId: null,
      url: "https://linear.app/test/issue/TEST-1#comment-123",
      reactions: [{ emoji: "👍", count: 2 }],
      syncedWith: [],
    };

    expect(comment.id).toBe("comment-123");
    expect(comment.body).toBe("test body");
    expect(comment.user).toBe("alice");
    expect(comment.parentId).toBeNull();
    expect(comment.url).toContain("linear.app");
    expect(comment.reactions).toHaveLength(1);
    expect(comment.syncedWith).toHaveLength(0);
  });

  test("exports API functions", () => {
    expect(typeof getIssueComments).toBe("function");
    expect(typeof updateComment).toBe("function");
    expect(typeof replyToComment).toBe("function");
    expect(typeof deleteComment).toBe("function");
  });
});
