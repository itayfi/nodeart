import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { aiDiagnosticsPlugin } from "./scripts/ai-diagnostics-server.ts"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), aiDiagnosticsPlugin()],
  base: "/nodeart/",
  optimizeDeps: { include: ["@huggingface/transformers", "monaco-editor"] },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
})
