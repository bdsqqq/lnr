---
"@bdsqqq/lnr-core": patch
---

exhaust issue subscriber pages before subscription no-ops or replacement writes,
preserving later-page subscribers, deduplicating overlapping subscriber ids in
first-seen order, and propagating pagination failures without writing. reuse the
guarded cycle traversal without changing its behavior.
full traversal does not prevent concurrent subscriber changes.
