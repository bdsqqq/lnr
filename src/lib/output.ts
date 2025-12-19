import chalk from "chalk";
import { getConfigValue } from "./config";

export type OutputFormat = "table" | "json" | "quiet";

export interface OutputOptions {
  format?: OutputFormat;
  verbose?: boolean;
}

export function getOutputFormat(options: OutputOptions): OutputFormat {
  if (options.format) {
    return options.format;
  }
  return getConfigValue("output_format") ?? "table";
}

export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function outputQuiet(ids: string[]): void {
  for (const id of ids) {
    console.log(id);
  }
}

export interface TableColumn<T> {
  header: string;
  value: (item: T) => string;
  width?: number;
}

export function outputTable<T>(
  items: T[],
  columns: TableColumn<T>[],
  options: OutputOptions = {}
): void {
  if (items.length === 0) {
    console.log(chalk.dim("no results"));
    return;
  }

  const widths: number[] = columns.map((col) => {
    const headerLen = col.header.length;
    const maxValueLen = Math.max(
      ...items.map((item) => col.value(item).length)
    );
    return col.width ?? Math.max(headerLen, maxValueLen);
  });

  if (options.verbose) {
    const headerLine = columns
      .map((col, i) => col.header.padEnd(widths[i] ?? 10))
      .join("  ");
    console.log(chalk.dim(headerLine));
    console.log(chalk.dim("-".repeat(headerLine.length)));
  }

  for (const item of items) {
    const line = columns
      .map((col, i) => {
        const val = col.value(item);
        const w = widths[i] ?? 10;
        return val.slice(0, w).padEnd(w);
      })
      .join("  ");
    console.log(line);
  }
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

export function formatDate(date: Date | string | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  const result = d.toISOString().split("T")[0];
  return result ?? "-";
}

export function formatPriority(priority: number | undefined): string {
  switch (priority) {
    case 0:
      return "-";
    case 1:
      return "urgent";
    case 2:
      return "high";
    case 3:
      return "medium";
    case 4:
      return "low";
    default:
      return "-";
  }
}
