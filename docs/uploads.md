# uploads

```sh
lnr upload ./image.png                         # offline validation
lnr upload ./image.png --execute               # descriptor + one storage PUT
lnr upload ./image.png --filename cover.png --content-type image/png --execute
```

`--metadata <file>` accepts a json object or null. `--public` explicitly requests
public visibility; it is not the default. keep the local file unchanged until
the command finishes. core callers pass a `Blob` to `executeUpload`.

stdout is json: `ok`, `executed`, and `stage` (`descriptor` or `transfer`).
successful execution adds `assetUrl`. offline success does not allocate anything;
it checks local inputs, not remote permissions or storage compatibility.
`executed` means allocation was attempted, not that bytes reached storage.

the descriptor comes from SDK `fileUpload`. the PUT sends only the file body,
content-type/cache defaults from the upstream example, and descriptor headers.
client authentication is never copied. storage redirects and automatic retries
are disabled. errors omit signed upload URLs, headers, and raw provider messages.
protect returned asset URLs according to their visibility.

a failed PUT can leave an allocated upload. no attachment or deletion is implicit.
live upload verification is blocked pending an authorized retention/cleanup
scenario: the captured deletion mutation is internal. offline transport tests are
not proof of successful storage or eventual asset availability.

see [non-graphql decisions](adr/0010-non-graphql-capabilities.md).
