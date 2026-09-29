---
"@bdsqqq/lnr-core": patch
---

normalize boolean mutation confirmations to literal SDK success true so malformed truthy values cannot acknowledge a write. preserve existing rejection handling, subscription no-ops, and entity/payload-returning contracts; never retry uncertain writes.
