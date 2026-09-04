import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: resolve(fileURLToPath(new URL(".", import.meta.url)), "../.."),
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3001",
      "/socket.io": { target: "http://127.0.0.1:3001", ws: true },
    },
  },
});
