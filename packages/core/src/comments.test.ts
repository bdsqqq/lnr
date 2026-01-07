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
    };

    expect(comment.id).toBe("comment-123");
    expect(comment.body).toBe("test body");
    expect(comment.user).toBe("alice");
    expect(comment.parentId).toBeNull();
  });

  test("exports API functions", () => {
    expect(typeof getIssueComments).toBe("function");
    expect(typeof updateComment).toBe("function");
    expect(typeof replyToComment).toBe("function");
    expect(typeof deleteComment).toBe("function");
  });
});
