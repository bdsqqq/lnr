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
  // gestures
  "+1": "👍", thumbsup: "👍", "-1": "👎", thumbsdown: "👎",
  wave: "👋", raised_back_of_hand: "🤚", raised_hand: "✋", hand: "✋",
  vulcan_salute: "🖖", ok_hand: "👌", pinched_fingers: "🤌", pinching_hand: "🤏",
  v: "✌️", crossed_fingers: "🤞", love_you_gesture: "🤟", metal: "🤘",
  call_me_hand: "🤙", point_left: "👈", point_right: "👉", point_up_2: "👆",
  point_down: "👇", point_up: "☝️", fist: "✊", fist_raised: "✊",
  facepunch: "👊", punch: "👊", fist_oncoming: "👊", fist_left: "🤛", fist_right: "🤜",
  clap: "👏", raised_hands: "🙌", open_hands: "👐", palms_up_together: "🤲",
  handshake: "🤝", pray: "🙏", writing_hand: "✍️", nail_care: "💅",
  selfie: "🤳", muscle: "💪", mechanical_arm: "🦾",
  eyes: "👀", eye: "👁️", tongue: "👅", lips: "👄",

  // smileys
  grinning: "😀", smile: "😊", grin: "😁", joy: "😂", rofl: "🤣",
  smiley: "😃", sweat_smile: "😅", laughing: "😆", laugh: "😄",
  wink: "😉", blush: "😊", yum: "😋", sunglasses: "😎", heart_eyes: "😍",
  kissing_heart: "💋", kissing: "😗", relaxed: "☺️",
  stuck_out_tongue: "😛", stuck_out_tongue_winking_eye: "😜", stuck_out_tongue_closed_eyes: "😝",
  disappointed: "😞", worried: "😟", angry: "😠", rage: "😡", pout: "😡",
  cry: "😢", persevere: "😣", triumph: "😤", disappointed_relieved: "😥",
  frowning: "😦", anguished: "😧", fearful: "😨", weary: "😩",
  sleepy: "😪", tired_face: "😫", grimacing: "😬", sob: "😭",
  open_mouth: "😮", hushed: "😯", cold_sweat: "😰", scream: "😱",
  astonished: "😲", flushed: "😳", sleeping: "😴", dizzy_face: "😵",
  no_mouth: "😶", mask: "😷", neutral_face: "😐", expressionless: "😑",
  unamused: "😒", sweat: "😓", pensive: "😔", confused: "😕", confounded: "😖",
  upside_down_face: "🙃", money_mouth_face: "🤑", thinking_face: "🤔", thinking: "🤔",
  zipper_mouth_face: "🤐", nerd_face: "🤓", hugs: "🤗", rolling_eyes: "🙄",
  smirk: "😏", drooling_face: "🤤", lying_face: "🤥",
  face_with_raised_eyebrow: "🤨", shushing_face: "🤫", face_with_hand_over_mouth: "🤭",
  face_vomiting: "🤮", exploding_head: "🤯", cowboy_hat_face: "🤠",
  partying_face: "🥳", disguised_face: "🥸", pleading_face: "🥺",
  skull: "💀", skull_and_crossbones: "☠️", ghost: "👻", alien: "👽",
  robot: "🤖", poop: "💩", hankey: "💩", clown_face: "🤡",

  // hearts
  heart: "❤️", red_heart: "❤️", orange_heart: "🧡", yellow_heart: "💛",
  green_heart: "💚", blue_heart: "💙", purple_heart: "💜", black_heart: "🖤",
  white_heart: "🤍", brown_heart: "🤎", broken_heart: "💔", heart_exclamation: "❣️",
  two_hearts: "💕", revolving_hearts: "💞", heartbeat: "💓", heartpulse: "💗",
  sparkling_heart: "💖", cupid: "💘", gift_heart: "💝", heart_decoration: "💟",

  // celebration
  tada: "🎉", confetti_ball: "🎊", balloon: "🎈", birthday: "🎂", gift: "🎁",
  trophy: "🏆", medal_military: "🎖️", medal_sports: "🏅",
  first_place_medal: "🥇", second_place_medal: "🥈", third_place_medal: "🥉",

  // symbols
  fire: "🔥", sparkles: "✨", star: "⭐", star2: "🌟", dizzy: "💫",
  boom: "💥", collision: "💥", zap: "⚡", lightning: "⚡",
  snowflake: "❄️", cloud: "☁️", sunny: "☀️", rainbow: "🌈",
  rocket: "🚀", airplane: "✈️", 100: "💯",
  check: "✅", white_check_mark: "✅", ballot_box_with_check: "☑️", heavy_check_mark: "✔️",
  x: "❌", cross_mark: "❌", negative_squared_cross_mark: "❎",
  warning: "⚠️", exclamation: "❗", question: "❓",
  grey_exclamation: "❕", grey_question: "❔", bangbang: "‼️", interrobang: "⁉️",
  bulb: "💡", memo: "📝", pencil: "✏️", pencil2: "✏️", pen: "🖊️",
  lock: "🔒", unlock: "🔓", key: "🔑", bell: "🔔", no_bell: "🔕",
  bookmark: "🔖", link: "🔗", paperclip: "📎", pushpin: "📌", scissors: "✂️",
  file_folder: "📁", open_file_folder: "📂", page_facing_up: "📄", page_with_curl: "📃",
  calendar: "📅", date: "📅", clipboard: "📋",
  chart_with_upwards_trend: "📈", chart_with_downwards_trend: "📉", bar_chart: "📊",
  email: "📧", envelope: "✉️", inbox_tray: "📥", outbox_tray: "📤",
  package: "📦", mailbox: "📫", speech_balloon: "💬", thought_balloon: "💭",
  mag: "🔍", mag_right: "🔎", gear: "⚙️", wrench: "🔧", hammer: "🔨",
  hammer_and_wrench: "🛠️", tools: "🛠️", nut_and_bolt: "🔩", shield: "🛡️",
  hourglass: "⌛", hourglass_flowing_sand: "⏳", watch: "⌚", alarm_clock: "⏰",
  stopwatch: "⏱️", timer_clock: "⏲️",

  // animals
  see_no_evil: "🙈", hear_no_evil: "🙉", speak_no_evil: "🙊",
  monkey: "🐒", monkey_face: "🐵", dog: "🐕", dog2: "🐕", cat: "🐈", cat2: "🐈",
  tiger: "🐅", tiger2: "🐅", lion: "🦁", horse: "🐴", unicorn: "🦄",
  cow: "🐄", cow2: "🐄", pig: "🐷", pig2: "🐷", chicken: "🐔", penguin: "🐧",
  bird: "🐦", eagle: "🦅", duck: "🦆", owl: "🦉", bat: "🦇", wolf: "🐺",
  fox_face: "🦊", bear: "🐻", panda_face: "🐼", koala: "🐨",
  rabbit: "🐰", rabbit2: "🐇", mouse: "🐭", mouse2: "🐁", rat: "🐀", hamster: "🐹",
  frog: "🐸", snake: "🐍", turtle: "🐢", lizard: "🦎", dragon: "🐉", dragon_face: "🐲",
  whale: "🐋", whale2: "🐋", dolphin: "🐬", fish: "🐟", tropical_fish: "🐠",
  blowfish: "🐡", shark: "🦈", octopus: "🐙", crab: "🦀", lobster: "🦞",
  shrimp: "🦐", squid: "🦑", snail: "🐌", butterfly: "🦋", bug: "🐛",
  ant: "🐜", bee: "🐝", honeybee: "🐝", spider: "🕷️", spider_web: "🕸️",

  // food & drink
  apple: "🍎", green_apple: "🍏", pear: "🍐", tangerine: "🍊", orange: "🍊",
  lemon: "🍋", banana: "🍌", watermelon: "🍉", grapes: "🍇", strawberry: "🍓",
  peach: "🍑", cherries: "🍒", pizza: "🍕", hamburger: "🍔", fries: "🍟",
  hotdog: "🌭", sandwich: "🥪", taco: "🌮", burrito: "🌯", egg: "🥚", cooking: "🍳",
  cake: "🍰", cookie: "🍪", chocolate_bar: "🍫", candy: "🍬", lollipop: "🍭",
  ice_cream: "🍨", icecream: "🍦", doughnut: "🍩",
  coffee: "☕", tea: "🍵", beer: "🍺", beers: "🍻", wine_glass: "🍷",
  cocktail: "🍸", tropical_drink: "🍹", champagne: "🍾",

  // objects
  computer: "💻", keyboard: "⌨️", desktop_computer: "🖥️", printer: "🖨️",
  mouse_three_button: "🖱️", trackball: "🖲️", joystick: "🕹️", video_game: "🎮",
  phone: "📱", iphone: "📱", telephone: "☎️", telephone_receiver: "📞",
  battery: "🔋", electric_plug: "🔌", camera: "📷", camera_flash: "📸",
  video_camera: "📹", movie_camera: "🎥", film_projector: "📽️", tv: "📺",
  radio: "📻", microphone: "🎤", headphones: "🎧", musical_note: "🎵", notes: "🎶",
  art: "🎨", performing_arts: "🎭", tickets: "🎟️", clapper: "🎬",
  books: "📚", book: "📖", notebook: "📓", newspaper: "📰", scroll: "📜",
  moneybag: "💰", dollar: "💵", credit_card: "💳", gem: "💎", ring: "💍",
  crown: "👑", tophat: "🎩", necktie: "👔", shirt: "👕", jeans: "👖",
  dress: "👗", lipstick: "💄", kiss: "💋", footprints: "👣",

  // arrows
  arrow_up: "⬆️", arrow_down: "⬇️", arrow_left: "⬅️", arrow_right: "➡️",
  arrow_upper_left: "↖️", arrow_upper_right: "↗️", arrow_lower_left: "↙️", arrow_lower_right: "↘️",
  left_right_arrow: "↔️", arrow_up_down: "↕️",
  arrows_counterclockwise: "🔄", arrows_clockwise: "🔃",
  rewind: "⏪", fast_forward: "⏩", play_or_pause_button: "⏯️",
  pause_button: "⏸️", stop_button: "⏹️", record_button: "⏺️",

  // numbers
  zero: "0️⃣", one: "1️⃣", two: "2️⃣", three: "3️⃣", four: "4️⃣",
  five: "5️⃣", six: "6️⃣", seven: "7️⃣", eight: "8️⃣", nine: "9️⃣", keycap_ten: "🔟",
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
