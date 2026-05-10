import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["packages/**/*.test.ts", "packages/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@iris/protocol": resolve(root, "packages/protocol/src/index.ts"),
      "@iris/core": resolve(root, "packages/core/src/index.ts"),
      "@iris/tauri": resolve(root, "packages/tauri/src/index.ts"),
      "@iris/react": resolve(root, "packages/react/src/index.tsx"),
      "@iris/test-utils": resolve(root, "packages/test-utils/src/index.ts"),
      "@iris/mcp": resolve(root, "packages/mcp/src/index.ts"),
      "@iris/devtools": resolve(root, "packages/devtools/src/index.tsx"),
    },
  },
});
