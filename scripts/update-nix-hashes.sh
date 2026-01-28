#!/usr/bin/env bash
set -euo pipefail

VERSION="$1"

if [[ -z "$VERSION" ]]; then
  echo "usage: $0 <version>" >&2
  exit 1
fi

BASE_URL="https://github.com/bdsqqq/lnr/releases/download/v${VERSION}"
NIX_FILE="nix/default.nix"

get_hash() {
  local url="$1"
  nix-prefetch-url --type sha256 "$url" 2>/dev/null | xargs nix hash convert --to sri --hash-algo sha256
}

echo "fetching hashes for v${VERSION}..."

HASH_LINUX_X64=$(get_hash "${BASE_URL}/lnr-linux-x64")
HASH_LINUX_ARM64=$(get_hash "${BASE_URL}/lnr-linux-arm64")
HASH_DARWIN_X64=$(get_hash "${BASE_URL}/lnr-darwin-x64")
HASH_DARWIN_ARM64=$(get_hash "${BASE_URL}/lnr-darwin-arm64")

echo "linux-x64:     $HASH_LINUX_X64"
echo "linux-arm64:   $HASH_LINUX_ARM64"
echo "darwin-x64:    $HASH_DARWIN_X64"
echo "darwin-arm64:  $HASH_DARWIN_ARM64"

sed -i.bak -E "s/version = \"[^\"]+\"/version = \"${VERSION}\"/" "$NIX_FILE"

sed -i.bak -E '/x86_64-linux/,/hash =/{s|hash = "sha256-[^"]+"|hash = "'"$HASH_LINUX_X64"'"|;}' "$NIX_FILE"
sed -i.bak -E '/aarch64-linux/,/hash =/{s|hash = "sha256-[^"]+"|hash = "'"$HASH_LINUX_ARM64"'"|;}' "$NIX_FILE"
sed -i.bak -E '/x86_64-darwin/,/hash =/{s|hash = "sha256-[^"]+"|hash = "'"$HASH_DARWIN_X64"'"|;}' "$NIX_FILE"
sed -i.bak -E '/aarch64-darwin/,/hash =/{s|hash = "sha256-[^"]+"|hash = "'"$HASH_DARWIN_ARM64"'"|;}' "$NIX_FILE"

rm -f "${NIX_FILE}.bak"

echo "updated $NIX_FILE to v${VERSION}"
