---
"@bdsqqq/lnr-core": patch
"@bdsqqq/lnr-cli": patch
---

reject invalid issue priorities before credentials instead of silently clearing
priority. accept case-insensitive names or exact numeric strings: none/0,
urgent/1, high/2, medium/3, low/4. reject whitespace and other numeric spellings.
