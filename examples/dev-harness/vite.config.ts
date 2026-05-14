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
          if (id.includes("@lezer")) {
            return "lezer";
          }
          if (id.includes("@codemirror")) {
            return "codemirror";
          }
          if (id.includes("react") || id.includes("react-dom")) {
            return "react";
          }
        }
      }
    }
  }
});
