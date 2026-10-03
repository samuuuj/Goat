// Crea web/js/config.js con la URL y la clave publicable de Supabase.
//   - En tu computador: `npm run config` (las lee de .env.local).
//   - En Vercel: corre en cada publicación (las lee de Settings › Environment Variables).
// Se niega a seguir si la clave es la secreta o la URL no es de Supabase. Nunca imprime la clave.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Lee .env.local (si existe) como { NOMBRE: "valor" }. */
function leerEnvLocal() {
  const ruta = join(RAIZ, ".env.local");
  if (!existsSync(ruta)) return {};
  const variables = {};
  for (const linea of readFileSync(ruta, "utf8").split(/\r?\n/)) {
    const encontrado = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (encontrado) variables[encontrado[1]] = encontrado[2].replace(/^["']|["']$/g, "");
  }
  return variables;
}

/** Claves antiguas de Supabase (JWT): el rol dice si es "anon" (pública) o "service_role" (secreta). */
function rolDeJwt(clave) {
  try {
    return JSON.parse(Buffer.from(clave.split(".")[1], "base64url").toString("utf8")).role ?? null;
  } catch {
    return null;
  }
}

const variables = { ...leerEnvLocal(), ...process.env };
const url = variables.SUPABASE_URL?.trim();
const clave = variables.SUPABASE_PUBLISHABLE_KEY?.trim();

const errores = [];
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url ?? "")) {
  errores.push("SUPABASE_URL debe verse como https://<tu-proyecto>.supabase.co");
}
if (!clave) errores.push("Falta SUPABASE_PUBLISHABLE_KEY");
else if (/^sb_secret_/.test(clave) || rolDeJwt(clave) === "service_role") {
  errores.push("¡Esa es la clave SECRETA! Usa la publishable (empieza por sb_publishable_).");
} else if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(clave) && rolDeJwt(clave) !== "anon") {
  errores.push("SUPABASE_PUBLISHABLE_KEY no parece una clave publicable de Supabase.");
}
if (errores.length > 0) {
  console.error(`✗ No se pudo crear web/js/config.js:\n  - ${errores.join("\n  - ")}`);
  process.exit(1);
}

writeFileSync(
  join(RAIZ, "web", "js", "config.js"),
  [
    "// Creado por scripts/crear-config.mjs. No se sube a GitHub (.gitignore).",
    `export const SUPABASE_URL = ${JSON.stringify(url)};`,
    `export const SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(clave)};`,
    "",
  ].join("\n"),
);
console.log("✓ web/js/config.js listo.");
