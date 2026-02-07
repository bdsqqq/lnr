import type { Label } from "@bdsqqq/lnr-core";
import type { DetailSection } from "../renderers/detail";

export function labelToDetail(label: Label): DetailSection[] {
  const fields: { label: string; value: string }[] = [
    { label: "id", value: label.id },
    { label: "color", value: label.color ?? "-" },
  ];

  const sections: DetailSection[] = [
    { type: "header", title: label.name },
    { type: "fields", fields },
  ];

  if (label.description) {
    sections.push({ type: "text", body: label.description });
  }

  return sections;
}
