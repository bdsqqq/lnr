# coverage evidence

`bun run api:coverage` emits every inventory coordinate with explicit gaps.
counts are grouped by kind: types, fields and operations are not interchangeable.

`bun run api:coverage:check` checks snapshot pins, duplicate/unknown coordinates,
classifications and evidence references. it may pass with unresolved coverage.
`bun run api:accept` also checks captured artifacts and requires gap-free evidence.
it currently MUST fail. neither command performs live operations.

the ledger is `packages/codegen/api-coverage.json`. each exact coordinate records:

- classification and implementation status, with reviewed source rationale;
- command/mode, resolver and payload/output mapping;
- structural or contract test evidence;
- authentication, scopes, plan and ownership requirements;
- live scenario, tested revision, successful run and assertion sources.

references use repository-relative paths and sha256 hashes of utf8 source contents.
test names are literal review anchors, not an assertion parser. adding a filename
or a passing run URL does not prove a field contract. reviewers must trace the
assertions to the binding and verify the run; no automatic promotion is performed.
one coordinate's evidence does not cover sibling fields or another binding/mode.

internal and sourced upstream-unavailable entries remain separately visible.
deprecation alone does not waive coverage. subscriptions are locally unsupported;
their public upstream transport remains unresolved, not proven unavailable.
non-graphql completeness requires its own reviewed implementation and verification.

the initial ledger is empty rather than inventing coverage from generic root
witnesses. populate it only with reviewed, scoped evidence. the synthetic positive
fixture in `api-coverage.test.ts` proves gate rules, not actual API completeness.

passing this gate is only a coverage prerequisite. task 0098 still requires
reproducible generation, passing exact-head CI, and reviewed authorization/scope
evidence. do not label a green integrity check “full parity.”
