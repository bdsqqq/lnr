# 9. complete schema capture and public api access

## status

accepted; capture and explicit query/mutation access implemented, parity evidence incomplete.

## context

the entity allowlist omitted root operations and their deprecations. sdk 95.1.0
still exposes `createCycle`, although the server no longer supports it.
curated flags also omit public inputs and output fields.

## decision

capture the complete graphql schema independently of cli entity configuration.
validate before replacing the accepted snapshot, retain source/sdk/hash provenance,
and derive a finite inventory of operations, arguments, and type fields.
do not infer operation support from input-type existence.

keep the live capture and sdk-release schema distinct. the latter comes from the
immutable upstream commit linked by the npm release provenance and annotated tag;
it supports offline validation, not claims about current live behavior.
the release schema remains a comparison artifact. the runtime `api-schema.graphql`
and inventory derive from the accepted live capture: sdk 95.1.0 omitted live
fields and retained stale internal markers on public-candidate project-label fields.
an absent `[Internal]` marker means public-candidate, not confirmed public.

live introspection batches up to eight named types per request to reduce quota
usage. only this metadata reader retries transient HTTP failures, at most three
attempts. partial/error responses never replace `schema.json`.
two full passes must agree before publication. this detects observed field-only
drift, but is not an upstream atomic snapshot: the endpoint exposes no revision
binding here. provenance records this consistency limit.

retain curated commands. the additive `api` command uses the sdk's public
graphql transport with schema/document/variable validation and caller-selected
json output. graphql's parser and validators own syntax/type rules, not custom
string parsing. a generic path can provide access without hundreds of wrappers.
offline validation is the default; `--execute` is required for every request.

structural reachability, offline contract coverage, and authorized live verification
remain separate. a generic transport does not grant credentials or prove every
operation works. queries can have effects; live verification uses approved scenarios,
not automatically executed inventory entries. no implicit pagination or write retries.

join a sparse, reviewed coverage ledger onto every inventory coordinate. absent
records stay unresolved. source hashes and literal test anchors detect stale
references, not whether assertions prove the contract. classify implementation,
authorization requirements, and live evidence separately; structural root tests
cannot discharge input/output obligations.

`api:coverage:check` validates ledger integrity and may pass with gaps.
`api:accept` first checks artifacts, then requires gap-free coverage evidence.
even that is only the coverage prerequisite: task 0098 additionally requires
reviewed classifications, reproducible generation and passing exact-head CI.
the initial ledger deliberately contains no inferred coverage credits.

## consequences

capture failures leave the last snapshot intact. descriptions/default values and
deprecations are preserved; SDK helpers are not counted as server capabilities.
internal operations, unavailable upstream operations, and unresolved classifications
remain visible. non-graphql capabilities require separate reconciliation.

full parity is not complete until the inventory's evidence and authorization gaps
are resolved, including existing curated flags that silently drop input.
