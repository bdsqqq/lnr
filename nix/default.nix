{
  lib,
  stdenvNoCC,
  fetchurl,
  autoPatchelfHook,
  makeWrapper,
}:

let
  version = "2.0.1";

  sources = {
    "x86_64-linux" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-linux-x64";
      hash = "sha256-MEUHgWAfSaK2l9eoJWsUiG4WS8rtUZ37L/5krLImp8I=";
    };
    "aarch64-linux" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-linux-arm64";
      hash = "sha256-TFSMRgdprwxaVp6JPQXrbPwiIShmElm2lAb1bBos/wQ=";
    };
    "x86_64-darwin" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-darwin-x64";
      hash = "sha256-6Jpj7E/ZKhDdTkhXAXPc2jclUYoI3amn+jCknqwDKr8=";
    };
    "aarch64-darwin" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-darwin-arm64";
      hash = "sha256-f9dgmSqRGv/Q6Tqn5+DKmNUbc1+1rfi7JypoD8JbYJs=";
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
