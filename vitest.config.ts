import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "supabase/functions/**/__tests__/**/*.{test,spec}.ts",
    ],
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      // Server-side SanMar modules import fast-xml-parser from esm.sh so
      // they run unmodified in Deno edge functions. For Vitest (Node) we
      // redirect to the npm devDependency of the same library — same API,
      // local install. Deno production builds are unaffected.
      {
        find: /^https:\/\/esm\.sh\/fast-xml-parser(?:@[^/]+)?(?:\/.*)?$/,
        replacement: "fast-xml-parser",
      },
    ],
  },
});
