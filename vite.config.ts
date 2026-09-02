import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ command, isPreview }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  optimizeDeps: {
    exclude: ["maplibre-gl", "h5wasm"],
  },
  // TanStack Start SSR otherwise resolves maplibre-gl's CJS/package entry and
  // the worker URL import never reaches Vite's ?worker&url pipeline.
  // h5wasm ships its own Node/wasm loader — keep it external.
  ssr: { noExternal: ["maplibre-gl"], external: ["h5wasm", "@vercel/functions"] },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    ...(command === "build" || isPreview ? [nitro({ preset: "vercel" })] : []),
    viteReact(),
  ],
}));
