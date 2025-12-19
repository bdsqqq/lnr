import chalk from "chalk";

export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  AUTH_ERROR: 2,
  NOT_FOUND: 3,
  RATE_LIMITED: 4,
} as const;

export function exitWithError(
  message: string,
  hint?: string,
  code: number = EXIT_CODES.GENERAL_ERROR
): never {
  console.error(chalk.red(`error: ${message}`));
  if (hint) {
    console.error(chalk.dim(`  ${hint}`));
  }
  process.exit(code);
}

export function handleApiError(error: unknown): never {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes("unauthorized") || msg.includes("authentication")) {
      exitWithError("not authenticated", "run: lnr auth <api-key>", EXIT_CODES.AUTH_ERROR);
    }

    if (msg.includes("not found")) {
      exitWithError(msg, undefined, EXIT_CODES.NOT_FOUND);
    }

    if (msg.includes("rate limit")) {
      exitWithError("rate limited, retry in 30s", undefined, EXIT_CODES.RATE_LIMITED);
    }

    exitWithError(msg);
  }

  exitWithError("unknown error occurred");
}
