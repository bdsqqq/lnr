---
"@bdsqqq/lnr-core": major
"@bdsqqq/lnr-cli": minor
---

upgrade the linear sdk from 68 to 95.1.0 and refresh the live api schema.

agent session type now returns null when absent; core consumers must handle it.
handle nullable comment sync metadata and view preferences. wire issue release
and shared-access flags and label group type through to api payloads.

cycle and git automation creation now propagate api and follow-up read errors
instead of returning null for exceptions. callers must handle rejections.

document linear's removal of direct cycle creation: use automatically generated
team cycles for list/show/update/archive operations.
