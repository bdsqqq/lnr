---
"@bdsqqq/lnr-core": minor
"@bdsqqq/lnr-cli": patch
---

forward existing project creation and issue update fields without dropping zero or empty strings. use atomic label additions/removals, preserving each issue's other labels when batch-adding. reject unconfirmed issue/project mutations instead of reporting success; never retry those writes.
