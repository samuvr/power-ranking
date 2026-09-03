import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Hasta ahora ningún módulo con test usaba el alias `@/`, así que Vitest
// funcionaba sin configuración. Se declara aquí el mismo alias que en
// `tsconfig.json` para que el código de `src/lib` pueda importar como importa
// el resto de la app.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
