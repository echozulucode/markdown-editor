import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (normalizedId.includes("@lezer")) {
            return "lezer";
          }
          if (normalizedId.includes("@codemirror")) {
            return "codemirror";
          }
          if (normalizedId.includes("@lexical") || normalizedId.includes("/lexical/")) {
            return "wysiwyg-lexical";
          }
          if (
            normalizedId.includes("/node_modules/.pnpm/react@") ||
            normalizedId.includes("/node_modules/.pnpm/react-dom@")
          ) {
            return "react";
          }
        }
      }
    }
  }
});
