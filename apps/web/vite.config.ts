import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern",
        silenceDeprecations: ["import", "legacy-js-api"],
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
