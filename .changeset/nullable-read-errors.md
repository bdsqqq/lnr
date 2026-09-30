---
"@bdsqqq/lnr-core": patch
---

preserve API and relationship errors in nullable read helpers instead of
misreporting failed reads as missing entities or preferences. genuine absent
results remain nullable.
