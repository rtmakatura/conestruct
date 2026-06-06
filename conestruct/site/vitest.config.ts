import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  // Use the automatic JSX runtime so component tests don't need to
  // `import React`. Next.js's TSX relies on the same runtime; mirroring
  // it here keeps vitest's transform consistent with the build.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
  },
});
