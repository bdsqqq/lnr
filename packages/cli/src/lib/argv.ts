/** `issue` already names a procedure, so its flat batch sibling needs one routing token. */
export function normalizeArgv(argv: string[]): string[] {
  return argv[0] === "issue" && argv[1] === "batch"
    ? ["issue batch", ...argv.slice(2)]
    : argv;
}
