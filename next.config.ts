import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
      // Markdown imports as its raw text (the About page's copy, src/app/about/about.md).
      "*.md": {
        type: "text",
      },
    },
  },
};

export default nextConfig;
