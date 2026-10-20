import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  plugins: [react()],
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },
  server: {
    // SPA dev server; proxies API calls to `wrangler dev` on :8787
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
