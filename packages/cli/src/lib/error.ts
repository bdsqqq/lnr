import chalk from "chalk";

export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  AUTH_ERROR: 2,
  NOT_FOUND: 3,
  RATE_LIMITED: 4,
  PLAN_REQUIRED: 5,
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

const ENTERPRISE_ENTITIES = ["initiative", "roadmap", "customer", "company", "customerneed"];

function isEnterpriseError(msg: string): boolean {
  const enterprisePatterns = [
    "entity not accessible",
    "access denied",
    "not available on your plan",
    "requires enterprise",
    "requires business",
    "feature not available",
    "upgrade your plan",
    "feature is not enabled",
    "permission denied",
  ];
  return enterprisePatterns.some((pattern) => msg.includes(pattern));
}

function detectEnterpriseEntity(msg: string): string | null {
  for (const entity of ENTERPRISE_ENTITIES) {
    if (msg.includes(entity)) {
      return entity;
    }
  }
  return null;
}

export function handleApiError(error: unknown, entityHint?: string): never {
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

    if (isEnterpriseError(msg)) {
      const entity = entityHint ?? detectEnterpriseEntity(msg) ?? "this feature";
      exitWithError(
        `${entity} requires a Linear Business or Enterprise plan`,
        "check your workspace plan at linear.app/settings/billing",
        EXIT_CODES.PLAN_REQUIRED
      );
    }

    exitWithError(msg);
  }

  exitWithError("unknown error occurred");
}
