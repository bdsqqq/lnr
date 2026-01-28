{
  lib,
  stdenvNoCC,
  fetchurl,
  autoPatchelfHook,
  makeWrapper,
}:

let
  version = "1.6.0";

  sources = {
    "x86_64-linux" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-linux-x64";
      hash = "sha256-rLYo684/lkmukFM6wTSVvntp8LYnvGSwVWnD+/ZSVw8=";
    };
    "aarch64-linux" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-linux-arm64";
      hash = "sha256-zSMC7CWTawCCKwrnKFGMLLOCD7P/r6stQ3SCX1kXdAw=";
    };
    "x86_64-darwin" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-darwin-x64";
      hash = "sha256-Ns2Btylhh17s8bucjtxyfKM7MgUF5qEvT68GyKk5Kb0=";
    };
    "aarch64-darwin" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-darwin-arm64";
      hash = "sha256-bkFBd2wFqS4jlQ5746pz3wWB2QHAFmeNDFFdDhNF3pg=";
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
