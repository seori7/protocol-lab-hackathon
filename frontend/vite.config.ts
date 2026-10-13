import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ command }) => {
  const isBuild = command === "build";
  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(isBuild ? [viteSingleFile()] : []),
    ],
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
    server: { port: 5173 },
  };
});