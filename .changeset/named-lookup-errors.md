---
"@bdsqqq/lnr-core": patch
"@bdsqqq/lnr-cli": patch
---

preserve initiative and roadmap lookup errors while retaining direct identifier
lookup before name fallback, including for initiative actions. fallback is allowed
only for a null result or an SDK InvalidInputLinearError whose nonempty parsed
errors all identify exactly the requested root. this is rejected-identifier
fallback, not proof that an entity is absent. network, structured permission-error
types, mixed and lazy-relation errors propagate; direct slug success does not
require list access. core direct lookups continue forwarding arbitrary strings.
