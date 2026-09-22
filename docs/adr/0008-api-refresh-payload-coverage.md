# 8. api refresh payload coverage

## status

accepted

## context

refreshing the live schema for sdk 95.1.0 introduced issue release/sharing flags
and label group type. schema generation alone exposed them without updating
operation inference or the hand-written payload templates.

## decision

keep the existing generator architecture. wire these fields in the generator,
core inputs, and sdk payloads together, with router-level payload tests.

- release ids are literal ids, not name resolvers. `--release-ids '[]'` clears
  the replacement list because argv cannot directly express an empty array.
- release additions/removals are update-only; creation rejects them and directs
  callers to `--release-ids`.
- preserve explicit `false` and empty arrays rather than testing truthiness.
- label group type accepts `singleSelect`, `multiSelect`, or the literal `null`
  to reset groups to `singleSelect`, per the captured update-input description.
  core receives actual null, not the cli token.

## consequences

refreshing schema metadata is not proof of executable flag coverage. new flags
need dispatch and payload assertions before they are advertised as supported.
this refresh does not add standalone release commands or expand entity support.
