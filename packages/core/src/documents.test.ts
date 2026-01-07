import { describe, test, expect } from "bun:test";
import type { Document } from "./documents";
import {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
} from "./documents";

describe("documents", () => {
  test("Document interface has expected shape", () => {
    const doc: Document = {
      id: "doc-123",
      title: "Test Document",
      content: "Some content",
      createdAt: new Date(),
      updatedAt: new Date(),
      url: "https://linear.app/doc/123",
      project: null,
    };

    expect(doc.id).toBe("doc-123");
    expect(doc.title).toBe("Test Document");
    expect(doc.content).toBe("Some content");
    expect(doc.project).toBeNull();
  });

  test("exports API functions", () => {
    expect(typeof listDocuments).toBe("function");
    expect(typeof getDocument).toBe("function");
    expect(typeof createDocument).toBe("function");
    expect(typeof updateDocument).toBe("function");
    expect(typeof deleteDocument).toBe("function");
  });
});
