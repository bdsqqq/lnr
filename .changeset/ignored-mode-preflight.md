---
"@bdsqqq/lnr-cli": patch
---

reject ignored read/write/deletion combinations and blank batch fields before acquiring credentials. preserve relative operation precedence while treating false subscription actions as inactive.

route the documented two-token `issue batch` invocation to the batch handler, retaining the quoted legacy form.
