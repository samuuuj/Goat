// Prepara la web para Vercel: copia los archivos del sitio a dist/ y crea dist/js/config.js
// con las variables de entorno SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY (Vercel › Settings › Environment Variables).
//
//   node scripts/construir.mjs                → dist/ (lo corre Vercel en cada despliegue)
//   node scripts/construir.mjs --solo-config  → crea js/config.js para probar en tu computador
//
// En el computador, si no hay variables de entorno, las lee de .env.local. Nunca imprime la clave.

import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEL_SITIO, RAIZ, leerEnvLocal, validarConfig } from "./sitio.mjs";

const variables = { ...leerEnvLocal(), ...process.env };
const url = variables.SUPABASE_URL?.trim();
const clave = variables.SUPABASE_PUBLISHABLE_KEY?.trim();

const errores = validarConfig(url, clave);
if (errores.length > 0) {
  console.error(`✗ No se pudo preparar la web:\n  - ${errores.join("\n  - ")}`);
  process.exit(1);
}

const config = [
  "// Generado por scripts/construir.mjs. No se sube a GitHub (.gitignore).",
  `export const SUPABASE_URL = ${JSON.stringify(url)};`,
  `export const SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(clave)};`,
  "",
].join("\n");

if (process.argv.includes("--solo-config")) {
  writeFileSync(join(RAIZ, "js", "config.js"), config);
  console.log("✓ js/config.js listo.");
  process.exit(0);
}

const dist = join(RAIZ, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
for (const ruta of DEL_SITIO) {
  cpSync(join(RAIZ, ruta), join(dist, ruta), {
    recursive: true,
    // La configuración local nunca se copia: se crea abajo con las variables de Vercel.
    filter: (origen) => !/[\\/]js[\\/]config(\.example)?\.js$/.test(origen),
  });
}
writeFileSync(join(dist, "js", "config.js"), config);
console.log("✓ Web lista en dist/");
