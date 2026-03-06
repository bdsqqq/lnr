{
  lib,
  stdenvNoCC,
  fetchurl,
  autoPatchelfHook,
  makeWrapper,
}:

let
  version = "2.0.2";

  sources = {
    "x86_64-linux" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-linux-x64";
      hash = "sha256-LsEulzu1tsW1/FoDk+TBfb8WvBl4W3djEdN7BI0XXLY=";
    };
    "aarch64-linux" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-linux-arm64";
      hash = "sha256-cmTHLNRoX7/Fc7/HH6AetOResHsePxJgErVP+CvCg34=";
    };
    "x86_64-darwin" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-darwin-x64";
      hash = "sha256-/nXJvVSwyBYQdVSPuOQtPhn0gdHzrep428er2wMpRA4=";
    };
    "aarch64-darwin" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-darwin-arm64";
      hash = "sha256-YnfuKDlxfxR9Di0qndugH7H+jmjYTuQOPxOwodR3EcI=";
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
    homepage = "https://github.com/bdsqqq/lnr";
    license = lib.licenses.mit;
    maintainers = [ ];
    platforms = builtins.attrNames sources;
    mainProgram = "lnr";
  };
}
