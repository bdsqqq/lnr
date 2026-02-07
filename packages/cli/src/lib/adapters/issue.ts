import type { Issue } from "@bdsqqq/lnr-core";
import { formatDate, formatPriority } from "../output";
import type { DetailSection } from "../renderers/detail";

export function issueToDetail(issue: Issue): DetailSection[] {
  const fields: { label: string; value: string }[] = [
    { label: "state", value: issue.state ?? "-" },
    { label: "assignee", value: issue.assignee ?? "-" },
    { label: "priority", value: formatPriority(issue.priority) },
  ];

  if (issue.parentId) {
    fields.push({ label: "parent", value: issue.parentId });
  }

  fields.push(
    { label: "created", value: formatDate(issue.createdAt) },
    { label: "updated", value: formatDate(issue.updatedAt) },
    { label: "url", value: issue.url },
  );

  const sections: DetailSection[] = [
    { type: "header", title: `${issue.identifier}: ${issue.title}` },
    { type: "fields", fields },
  ];

  if (issue.description) {
    sections.push({ type: "text", body: issue.description });
  }

  return sections;
}
