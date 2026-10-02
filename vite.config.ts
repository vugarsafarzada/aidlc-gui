import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@xterm/")) return "terminal";
          if (id.includes("react-markdown") || id.includes("remark-") || id.includes("micromark") || id.includes("mdast") || id.includes("hast")) return "markdown";
          if (id.includes("node_modules/react") || id.includes("node_modules/lucide-react")) return "ui";
        },
      },
    },
  },
});
