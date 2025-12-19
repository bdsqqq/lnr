# distribution plan

automated releases to npm, github releases, and nixpkgs.

---

## targets

### 1. npm
- publish `@linear-cli/core` and `@linear-cli/cli` packages
- or single package if we rename

### 2. github releases
- create release with changelog
- attach compiled binaries for:
  - linux-x64
  - linux-arm64
  - darwin-x64 (intel mac)
  - darwin-arm64 (apple silicon)
  - windows-x64

### 3. nixpkgs
- submit package to nixpkgs repo
- keep in sync with releases
- requires: npm package published first (nix often pulls from npm)

---

## automation approach

### github actions workflow

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      
      # version bump + changelog (via chosen tool)
      - run: # versioning step
      
      # build binaries for all platforms
      - run: bun run build:all
      
      # publish to npm
      - run: bun publish --access public
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
      
      # create github release with binaries
      - uses: softprops/action-gh-release@v1
        with:
          files: dist/*
```

### cross-platform builds

bun supports cross-compilation:
```bash
bun build ./packages/cli/src/cli.ts --compile --target=bun-linux-x64 --outfile dist/li-linux-x64
bun build ./packages/cli/src/cli.ts --compile --target=bun-linux-arm64 --outfile dist/li-linux-arm64
bun build ./packages/cli/src/cli.ts --compile --target=bun-darwin-x64 --outfile dist/li-darwin-x64
bun build ./packages/cli/src/cli.ts --compile --target=bun-darwin-arm64 --outfile dist/li-darwin-arm64
bun build ./packages/cli/src/cli.ts --compile --target=bun-windows-x64 --outfile dist/li-windows-x64.exe
```

---

## secrets needed

| secret | purpose |
|--------|---------|
| `NPM_TOKEN` | publish to npm registry |
| `GITHUB_TOKEN` | auto-provided, for gh releases |

for nixpkgs: manual PR, no secrets needed (just follow their process)

---

## nixpkgs package

basic nix expression (will need refinement):
```nix
{ lib, stdenv, fetchFromGitHub, bun }:

stdenv.mkDerivation rec {
  pname = "li"; # or whatever name we choose
  version = "0.1.0";

  src = fetchFromGitHub {
    owner = "bdsqqq";
    repo = "linear-cli";
    rev = "v${version}";
    sha256 = "...";
  };

  nativeBuildInputs = [ bun ];

  buildPhase = ''
    bun install --frozen-lockfile
    bun build ./packages/cli/src/cli.ts --compile --outfile li
  '';

  installPhase = ''
    mkdir -p $out/bin
    cp li $out/bin/
  '';

  meta = with lib; {
    description = "CLI for Linear issue tracking";
    homepage = "https://github.com/bdsqqq/linear-cli";
    license = licenses.mit; # or whatever we choose
    maintainers = with maintainers; [ bdsqqq ];
    platforms = platforms.unix;
  };
}
```

alternative: use prebuilt binaries from gh releases (simpler, faster builds)

---

## implementation order

1. **versioning** - set up chosen versioning tool
2. **build script** - add `build:all` for cross-platform binaries
3. **npm publish** - configure package.json for publishing
4. **github actions** - create release workflow
5. **test workflow** - verify release works
6. **nixpkgs** - prepare and submit PR (after npm publish works)

---

## agents to spawn

1. `build-script` - add cross-platform build script to package.json
2. `npm-setup` - configure packages for npm publishing (needs user for npm org/scope decision)
3. `gh-actions` - create release workflow (needs user for NPM_TOKEN)
4. `nix-package` - prepare nix expression (after above complete)
