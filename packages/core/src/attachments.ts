import type { LinearClient } from "@linear/sdk";

export interface Attachment {
  id: string;
  url: string;
  title?: string | null;
  subtitle?: string | null;
  createdAt: Date;
}

export interface CreateAttachmentInput {
  issueId: string;
  url: string;
  title: string;
  subtitle?: string;
}

export async function createAttachment(
  client: LinearClient,
  input: CreateAttachmentInput
): Promise<Attachment | null> {
  const result = await client.createAttachment(input);

  if (!result.success) {
    return null;
  }

  const attachment = await result.attachment;
  if (!attachment) {
    return null;
  }

  return {
    id: attachment.id,
    url: attachment.url,
    title: attachment.title,
    subtitle: attachment.subtitle,
    createdAt: attachment.createdAt,
  };
}

export async function linkGitHubPR(
  client: LinearClient,
  issueId: string,
  url: string
): Promise<boolean> {
  const result = await client.attachmentLinkGitHubPR(issueId, url);
  return result.success;
}

export async function getIssueAttachments(
  client: LinearClient,
  issueId: string
): Promise<Attachment[]> {
  const issue = await client.issue(issueId);
  if (!issue) return [];

  const attachments = await issue.attachments();
  return attachments.nodes.map((a) => ({
    id: a.id,
    url: a.url,
    title: a.title,
    subtitle: a.subtitle,
    createdAt: a.createdAt,
  }));
}
