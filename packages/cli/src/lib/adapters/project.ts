import type { Project } from "@bdsqqq/lnr-core";
import { formatDate } from "../output";
import type { DetailSection } from "../renderers/detail";

export function projectToDetail(project: Project): DetailSection[] {
  const header: DetailSection = project.description
    ? { type: "header", title: project.name, subtitle: project.description }
    : { type: "header", title: project.name };

  const sections: DetailSection[] = [header];

  const fields: { label: string; value: string }[] = [
    { label: "state", value: project.state ?? "-" },
    { label: "progress", value: `${Math.round((project.progress ?? 0) * 100)}%` },
    { label: "target", value: formatDate(project.targetDate) },
    { label: "started", value: formatDate(project.startDate) },
    { label: "created", value: formatDate(project.createdAt) },
  ];

  sections.push({ type: "fields", fields });

  return sections;
}
