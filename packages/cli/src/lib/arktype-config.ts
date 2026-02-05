/**
 * arktype configuration for CLI schemas.
 *
 * extends ArkEnv.meta to support trpc-cli metadata like `positional`.
 * MUST be imported before any arktype usage in generated files.
 *
 * see: https://arktype.io/docs/configuration
 */

declare global {
  interface ArkEnv {
    meta(): {
      positional?: boolean;
    };
  }
}

export {};
