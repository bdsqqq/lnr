type Mode = "json" | "quiet" | "verbose";
type Flags = Partial<Record<Mode, boolean>>;

/** Reject unsupported explicit modes before writes; configured read formatting does not alter acknowledgements. */
export function validateMutationOutput(
  command: string,
  input: Flags,
  supported: readonly Mode[] = [],
): void {
  const active = (["json", "quiet", "verbose"] as const).filter(mode => input[mode] === true);
  for (const mode of active) {
    if (!supported.includes(mode)) {
      throw new Error(`--${mode} is not supported for ${command}; omit --${mode}`);
    }
  }
  if (active.length > 1) throw new Error(`choose one output mode for ${command}`);
}
