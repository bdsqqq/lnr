# 2. Introspection Over SDK Types

Date: 2026-01-27

## Status

Accepted

## Context

needed to choose a schema source for code generation. three options evaluated:

| source | descriptions | enums | deprecations | auth required |
|--------|--------------|-------|--------------|---------------|
| introspection | ✓ all fields | ✓ 70 enums | ✓ 19 deprecated | yes (API key) |
| SDK .d.ts | ✗ none | partial (unions) | ✗ none | no |
| vendored SDL | ✓ | ✓ | ✓ | no |

## Decision

use GraphQL introspection query against Linear API.

vendored SDL would work but requires manual updates. SDK .d.ts lacks descriptions and deprecations. introspection is authoritative.

implementation: `packages/codegen/introspect-linear.ts` fetches schema in batches (Linear limits query complexity to 10k). outputs `packages/codegen/schema.json`.

## Consequences

- requires LINEAR_API_KEY for regeneration (uses ~/.lnr/config.json as fallback)
- schema.json committed to repo so codegen works without auth
- must re-run introspection when Linear API changes
- rich metadata available: descriptions for help text, deprecations for warnings
