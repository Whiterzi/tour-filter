import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { normalizeApiBase } from "./lib/tours/api-client";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (command === "build") normalizeApiBase(env.VITE_API_URL);
  return {
    base: "/tour-filter/",
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8787",
          headers: { Origin: "http://127.0.0.1:8787" },
        },
      },
    },
  };
});
