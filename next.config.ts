import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O Joel deixa o dev server no ar. `build:check` escreve em outra pasta para
  // nao reescrever os manifests que o dev dele esta usando.
  distDir: process.env.npm_lifecycle_event === "build:check" ? ".next-check" : ".next",
  // resvg e sharp sao binarios nativos: precisam ficar fora do bundle e as
  // fontes da arte precisam viajar junto para o servidor.
  serverExternalPackages: ["@resvg/resvg-js", "sharp"],
  outputFileTracingIncludes: {
    "/**": ["./assets/fonts/**"],
  },
};

export default nextConfig;
