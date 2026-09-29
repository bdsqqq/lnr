import { expect, mock, test } from "bun:test";
import type { LinearClient } from "@linear/sdk";
import { listDocuments } from "./documents";

for (const projectId of [undefined, "project-id"]) {
  for (const phase of ["connection", "project"]) {
    test(`documents ${projectId} ${phase} preserves error identity`, async () => {
      const error = new Error("network unavailable");
      const documents = mock(async (..._args: unknown[]) => {
        if (phase === "connection") throw error;
        return { nodes: [{ get project() { return Promise.reject(error); } }] };
      });
      await expect(listDocuments({ documents } as unknown as LinearClient, projectId)).rejects.toBe(error);
      expect(documents.mock.calls).toEqual([[{ filter: projectId ? { project: { id: { eq: projectId } } } : undefined }]]);
    });
  }
  test(`documents ${projectId} preserves empty and mapped payloads`, async () => {
    const fields = { id: "doc", title: "example", createdAt: new Date(0), updatedAt: new Date(0), url: "https://example.com" };
    for (const nodes of [[], [
      { ...fields, content: undefined, project: Promise.resolve(undefined) },
      { ...fields, content: "body", project: Promise.resolve({ name: "project" }) },
    ]]) {
      const documents = mock(async (..._args: unknown[]) => ({ nodes }));
      expect(await listDocuments({ documents } as unknown as LinearClient, projectId)).toEqual(
        nodes.length ? [{ ...fields, content: null, project: null }, { ...fields, content: "body", project: "project" }] : [],
      );
      expect(documents.mock.calls).toEqual([[{ filter: projectId ? { project: { id: { eq: projectId } } } : undefined }]]);
    }
  });
}
