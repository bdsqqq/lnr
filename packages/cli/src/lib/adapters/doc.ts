import type { Document } from "@bdsqqq/lnr-core";
import type { DetailSection } from "../renderers/detail";

export function docToDetail(doc: Document): DetailSection[] {
  const sections: DetailSection[] = [
    { type: "header", title: doc.title },
  ];

  if (doc.content) {
    sections.push({ type: "text", body: doc.content });
  }

  return sections;
}
