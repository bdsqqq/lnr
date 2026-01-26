{
  lib,
  stdenvNoCC,
  fetchurl,
  autoPatchelfHook,
  makeWrapper,
}:

let
  version = "1.3.0";

  sources = {
    "x86_64-linux" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-linux-x64";
      hash = "sha256-sfHIffKvsbiYwOFv7ELkoiRpiTOKMYhvaLFIbL4fqO4=";
    };
    "aarch64-linux" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-linux-arm64";
      hash = "sha256-BdI/5Dj7VuZqxUJYJo6LULyyNNevj4Kch3cXGk3JCR0=";
    };
    "x86_64-darwin" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-darwin-x64";
      hash = "sha256-0pzL1C2q5d33Qw5NISKWVaG9bgRFspWcSk3amaLq4Zk=";
    };
    "aarch64-darwin" = {
      url = "https://github.com/bdsqqq/lnr/releases/download/v${version}/lnr-darwin-arm64";
      hash = "sha256-WR5klnrTBPq4GiH6i3atJ3S9XYWYc6z4SuU68BrCxRY=";
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
