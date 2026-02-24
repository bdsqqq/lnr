export type OperationSpec<
  Input extends Record<string, unknown> = Record<string, unknown>,
  Op extends string = string,
> = {
  readonly command: string;
  readonly operations: readonly Op[];
  readonly mutationFlags: readonly (keyof Input & string)[];
  readonly inferOperation: (input: Input) => Op;
};

export type AnyOperationSpec = OperationSpec<any, string>;
