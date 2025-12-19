{
  description = "CLI for Linear issue tracking";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachSystem [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ] (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        lnr = pkgs.callPackage ./nix/default.nix { };
      in
      {
        packages = {
          default = lnr;
          lnr = lnr;
        };

        apps.default = {
          type = "app";
          program = "${lnr}/bin/lnr";
        };

        devShells.default = pkgs.mkShell {
          packages = [ pkgs.bun pkgs.nodejs ];
        };
      }
    );
}
