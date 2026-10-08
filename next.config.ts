import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // resvg usa un binario nativo; las fuentes se leen del disco al generar los gráficos del Excel.
  serverExternalPackages: ["@resvg/resvg-js"],
  outputFileTracingIncludes: {
    "/api/export": ["./assets/fonts/**"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
