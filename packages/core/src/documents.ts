import type { LinearClient } from "@linear/sdk";

export interface Document {
  id: string;
  title: string;
  content: string | null;
  createdAt: Date;
  updatedAt: Date;
  url: string;
  project: string | null;
}

export async function listDocuments(
  client: LinearClient,
  projectId?: string
): Promise<Document[]> {
  try {
    const filter = projectId
      ? { project: { id: { eq: projectId } } }
      : undefined;

    const documentsConnection = await client.documents({ filter });
    const nodes = documentsConnection.nodes;

    return Promise.all(
      nodes.map(async (d) => ({
        id: d.id,
        title: d.title,
        content: d.content ?? null,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        url: d.url,
        project: (await d.project)?.name ?? null,
      }))
    );
  } catch {
    return [];
  }
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
      content: doc.content ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      url: doc.url,
      project: (await doc.project)?.name ?? null,
    };
  } catch {
    return null;
  }
}

export async function createDocument(
  client: LinearClient,
  input: { title: string; content?: string; projectId?: string }
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
    content: doc.content ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    url: doc.url,
    project: (await doc.project)?.name ?? null,
  };
}

export async function updateDocument(
  client: LinearClient,
  id: string,
  input: { title?: string; content?: string }
): Promise<boolean> {
  const result = await client.updateDocument(id, input);
  return result.success;
}

export async function deleteDocument(
  client: LinearClient,
  id: string
): Promise<boolean> {
  const result = await client.deleteDocument(id);
  return result.success;
}
