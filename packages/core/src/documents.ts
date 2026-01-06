import type { LinearClient } from "@linear/sdk";
import type { Document, CreateDocumentInput, UpdateDocumentInput } from "./types";

export async function listDocuments(
  client: LinearClient,
  options: { project?: string } = {}
): Promise<Document[]> {
  if (options.project) {
    const projects = await client.projects();
    const project = projects.nodes.find(
      (p) =>
        p.name.toLowerCase() === options.project!.toLowerCase() ||
        p.id === options.project
    );
    if (!project) {
      return [];
    }
    const docs = await project.documents();
    return docs.nodes.map((d) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      slugId: d.slugId,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  }

  const docs = await client.documents();
  return docs.nodes.map((d) => ({
    id: d.id,
    title: d.title,
    content: d.content,
    slugId: d.slugId,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

export async function getDocument(
  client: LinearClient,
  id: string
): Promise<Document | null> {
  try {
    const doc = await client.document(id);
    if (!doc) {
      return null;
    }
    return {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      slugId: doc.slugId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function createDocument(
  client: LinearClient,
  input: CreateDocumentInput
): Promise<Document | null> {
  const result = await client.createDocument({
    title: input.title,
    content: input.content,
    projectId: input.projectId,
  });

  if (!result.success) {
    return null;
  }

  const doc = await result.document;
  if (!doc) {
    return null;
  }

  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    slugId: doc.slugId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function updateDocument(
  client: LinearClient,
  id: string,
  input: UpdateDocumentInput
): Promise<Document | null> {
  const result = await client.updateDocument(id, {
    title: input.title,
    content: input.content,
  });

  if (!result.success) {
    return null;
  }

  const doc = await result.document;
  if (!doc) {
    return null;
  }

  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    slugId: doc.slugId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function deleteDocument(
  client: LinearClient,
  id: string
): Promise<boolean> {
  try {
    const result = await client.deleteDocument(id);
    return result.success;
  } catch {
    return false;
  }
}
