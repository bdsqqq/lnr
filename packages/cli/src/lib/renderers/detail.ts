import chalk from "chalk";

export interface HeaderSection {
  type: "header";
  title: string;
  subtitle?: string;
}

export interface FieldsSection {
  type: "fields";
  fields: { label: string; value: string }[];
}

export interface TextSection {
  type: "text";
  body: string;
}

export interface DividerSection {
  type: "divider";
}

export type DetailSection =
  | HeaderSection
  | FieldsSection
  | TextSection
  | DividerSection;

export function outputDetail(sections: DetailSection[]): void {
  for (const section of sections) {
    switch (section.type) {
      case "header": {
        console.log(section.title);
        if (section.subtitle) {
          console.log(section.subtitle);
        }
        break;
      }
      case "fields": {
        const maxLabelWidth = Math.max(
          ...section.fields.map((f) => f.label.length)
        );
        console.log();
        for (const field of section.fields) {
          const paddedLabel = field.label.padEnd(maxLabelWidth);
          console.log(`${paddedLabel}  ${field.value}`);
        }
        break;
      }
      case "text": {
        console.log();
        console.log(section.body);
        break;
      }
      case "divider": {
        console.log(chalk.dim("─".repeat(40)));
        break;
      }
    }
  }
}
