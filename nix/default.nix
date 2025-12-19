{
  lib,
  stdenvNoCC,
  fetchurl,
  autoPatchelfHook,
  makeWrapper,
}:

let
  version = "0.1.0";

  sources = {
    "x86_64-linux" = {
      url = "https://github.com/bdsqqq/linear-cli/releases/download/v${version}/lnr-linux-x64";
      hash = lib.fakeHash;
    };
    "aarch64-linux" = {
      url = "https://github.com/bdsqqq/linear-cli/releases/download/v${version}/lnr-linux-arm64";
      hash = lib.fakeHash;
    };
    "x86_64-darwin" = {
      url = "https://github.com/bdsqqq/linear-cli/releases/download/v${version}/lnr-darwin-x64";
      hash = lib.fakeHash;
    };
    "aarch64-darwin" = {
      url = "https://github.com/bdsqqq/linear-cli/releases/download/v${version}/lnr-darwin-arm64";
      hash = lib.fakeHash;
    };
  };

  currentSource = sources.${stdenvNoCC.hostPlatform.system} or (throw "unsupported system: ${stdenvNoCC.hostPlatform.system}");
in
stdenvNoCC.mkDerivation {
  pname = "lnr";
  inherit version;

  src = fetchurl {
    inherit (currentSource) url hash;
  };

  dontUnpack = true;

  nativeBuildInputs = lib.optionals stdenvNoCC.isLinux [ autoPatchelfHook makeWrapper ];

  installPhase = ''
    runHook preInstall
    install -D -m 755 $src $out/bin/lnr
    runHook postInstall
  '';

  meta = {
    description = "CLI for Linear issue tracking";
    homepage = "https://github.com/bdsqqq/linear-cli";
    license = lib.licenses.mit;
    maintainers = [ ];
    platforms = builtins.attrNames sources;
    mainProgram = "lnr";
  };
}
