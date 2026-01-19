import chalk from "chalk";
import { getConfigValue, type Comment } from "@bdsqqq/lnr-core";

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

export function formatDate(date: Date | string | undefined | null): string {
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

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${diffYears}y ago`;
}

export interface CommentThread {
  root: Comment;
  replies: Comment[];
}

function buildCommentThreads(comments: Comment[]): CommentThread[] {
  const rootComments = comments.filter((c) => !c.parentId);
  const childMap = new Map<string, Comment[]>();

  for (const c of comments) {
    if (c.parentId) {
      const existing = childMap.get(c.parentId) ?? [];
      existing.push(c);
      childMap.set(c.parentId, existing);
    }
  }

  return rootComments
    .map((root) => ({
      root,
      replies: (childMap.get(root.id) ?? []).sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      ),
    }))
    .sort((a, b) => a.root.createdAt.getTime() - b.root.createdAt.getTime());
}

const EMOJI_MAP: Record<string, string> = {
  "+1": "👍",
  "-1": "👎",
  laugh: "😄",
  laughing: "😆",
  confused: "😕",
  heart: "❤️",
  tada: "🎉",
  eyes: "👀",
  fire: "🔥",
  rocket: "🚀",
  thinking_face: "🤔",
  thinking: "🤔",
  clap: "👏",
  ok_hand: "👌",
  raised_hands: "🙌",
  pray: "🙏",
  100: "💯",
  sparkles: "✨",
  star: "⭐",
  check: "✅",
  white_check_mark: "✅",
  x: "❌",
  warning: "⚠️",
  bulb: "💡",
  memo: "📝",
  zap: "⚡",
  wave: "👋",
  muscle: "💪",
  thumbsup: "👍",
  thumbsdown: "👎",
  smile: "😊",
  sob: "😭",
  joy: "😂",
  sunglasses: "😎",
  skull: "💀",
  ghost: "👻",
  see_no_evil: "🙈",
  hear_no_evil: "🙉",
  speak_no_evil: "🙊",
};

function shortcodeToEmoji(shortcode: string): string {
  return EMOJI_MAP[shortcode] ?? `:${shortcode}:`;
}

function formatReactions(reactions: { emoji: string; count: number }[]): string {
  if (reactions.length === 0) return "";
  return reactions.map((r) => {
    const emoji = shortcodeToEmoji(r.emoji);
    return `${emoji}${r.count > 1 ? r.count : ""}`;
  }).join(" ");
}

function wrapText(text: string, width: number, indent: string): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\n/);

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= width) {
        currentLine += (currentLine ? " " : "") + word;
      } else {
        if (currentLine) lines.push(indent + currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(indent + currentLine);
  }

  return lines;
}

function getActorName(comment: Comment): string {
  return comment.externalUser ?? comment.user ?? comment.botActor ?? "unknown";
}

function getSourceLabel(comment: Comment): string {
  const sync = comment.syncedWith[0];
  if (!sync) return "";
  const serviceName = sync.service.charAt(0).toUpperCase() + sync.service.slice(1).toLowerCase();
  return ` via ${serviceName}`;
}

function getSyncChannelName(comment: Comment): string | undefined {
  const sync = comment.syncedWith[0];
  if (!sync) return undefined;
  
  if (sync.meta.type === "slack") {
    return sync.meta.channelName;
  }
  if (sync.meta.type === "github" && sync.meta.repo) {
    return `${sync.meta.owner ?? ""}/${sync.meta.repo}`;
  }
  if (sync.meta.type === "jira" && sync.meta.issueKey) {
    return sync.meta.issueKey;
  }
  return undefined;
}

function formatCommentHeader(
  comment: Comment,
  isThreadRoot: boolean,
  replyCount?: number,
  threadUrl?: string
): string {
  const sync = comment.syncedWith[0];
  const time = formatRelativeTime(comment.createdAt);

  if (isThreadRoot && sync) {
    const channelName = getSyncChannelName(comment);
    const channelPart = channelName ? ` in #${chalk.white(channelName)}` : "";
    const serviceName = sync.service.charAt(0).toUpperCase() + sync.service.slice(1).toLowerCase();
    let header = `${chalk.white(serviceName)} thread connected${channelPart} ${chalk.dim(time)}`;

    if (replyCount && replyCount > 3 && threadUrl) {
      header += `\n└ ${chalk.dim(`${replyCount - 3} previous replies,`)} [view all](${threadUrl})`;
    }
    return header;
  }

  const actor = chalk.white(`@${getActorName(comment)}`);
  const source = chalk.dim(getSourceLabel(comment));
  return `${actor} ${chalk.dim(time)}${source}`;
}

function outputSingleComment(comment: Comment, indent: string): void {
  const bodyLines = wrapText(comment.body.trim(), 60, indent + "└ ");
  for (const line of bodyLines) {
    console.log(line);
  }

  const reactions = formatReactions(comment.reactions);
  if (reactions) {
    console.log(`${indent}└ ${chalk.dim(`[${reactions}]`)}`);
  }
}

export function outputCommentThreads(comments: Comment[], maxThreads = 3): void {
  if (comments.length === 0) {
    console.log(chalk.dim("no comments"));
    return;
  }

  const threads = buildCommentThreads(comments);
  const recentThreads = threads.slice(-maxThreads);

  for (let i = 0; i < recentThreads.length; i++) {
    const thread = recentThreads[i];
    if (!thread) continue;

    const totalReplies = thread.replies.length;
    const last3Replies = thread.replies.slice(-3);
    const threadUrl = thread.root.url;
    const hasSync = thread.root.syncedWith.length > 0;

    console.log(formatCommentHeader(thread.root, true, totalReplies, threadUrl));

    if (!hasSync) {
      outputSingleComment(thread.root, "");
    }

    for (const reply of last3Replies) {
      const header = formatCommentHeader(reply, false);
      console.log(`└ ${header}`);
      outputSingleComment(reply, "  ");
    }

    if (i < recentThreads.length - 1) {
      console.log();
    }
  }
}
