{
  lib,
  stdenvNoCC,
  fetchurl,
  autoPatchelfHook,
  makeWrapper,
}:

let
  version = "1.1.0";

  sources = {
    "x86_64-linux" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-linux-x64";
      hash = "sha256-91k/oWB6bYKrE70CjRHfJjfz8GEhx2Khgcp8Bj8i55A=";
    };
    "aarch64-linux" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-linux-arm64";
      hash = "sha256-DZGRbhXPAfdZNE1BJnLSsFNCV4zvg64wvssA5AOxhIE=";
    };
    "x86_64-darwin" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-darwin-x64";
      hash = "sha256-ZI6oUhkhsks9d5gWTz6DMc/s3iv9oG7Bkg7Lo9fysng=";
    };
    "aarch64-darwin" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-darwin-arm64";
      hash = "sha256-DHRkoiQvYlrTv0eR3XeXF+QGhSmg8CEDhyaKxO4oyLc=";
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
