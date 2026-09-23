# 10. non-graphql capabilities

## status

accepted; upload and webhook bindings implemented; OAuth and live proof incomplete.

## decision

graphql access cannot transfer file bytes or receive webhook deliveries. reconcile
those separately from generated graphql operations. sdk transport configuration,
model traversal and pagination helpers are not additional server operations.

use the sdk's `fileUpload` descriptor operation, followed by one HTTPS PUT with
the returned storage headers. follow the [pinned upstream example](https://github.com/linear/linear/blob/3addb24bdf771700da1c050742e70e645cc7e36a/examples/nextjs-file-upload/pages/api/uploadFileToLinear.ts#L32-L59).
never copy client credentials, follow redirects, retry writes, create attachments,
or delete objects implicitly. `lnr upload` validates offline by default; `--execute`
authorizes both stages. public visibility is a separate explicit flag.

failures report the attempted phase without signed URLs, headers, or raw SDK
errors. a transfer failure can leave an allocated upload. the internal
`fileUploadDangerouslyDelete` operation is not an approved cleanup mechanism.
live upload verification requires an authorized retention/cleanup scenario.

reuse SDK webhook verification and adapters rather than inventing signing rules.
verification, parsing, and receiver delivery remain separately evidenced. existing
OAuth-token consumption does not implement authorization, token exchange/refresh,
client-credentials issuance, or revocation; those need separately sourced bindings.

public graphql subscription transport remains unresolved. SDK HTTP-only behavior
and webhook availability do not prove upstream subscriptions unavailable.
