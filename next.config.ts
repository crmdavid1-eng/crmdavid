import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Отдельная папка сборки для второго dev-сервера (демо-режим на другом порту)
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
