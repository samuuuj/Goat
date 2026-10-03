// Qué archivos forman la web publicada y cómo se valida la configuración de Supabase.
// Lo usan construir.mjs (Vercel) y servidor-local.mjs (pruebas en el computador).

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Lo único que se publica. docs/, supabase/, scripts/ y las claves nunca salen a internet. */
export const DEL_SITIO = ["index.html", "login.html", "manifest.webmanifest", "robots.txt", "css", "js", "fuentes", "img"];

/** Lee .env.local (si existe) como { NOMBRE: "valor" }. Solo para construir en el computador. */
export function leerEnvLocal() {
  const ruta = join(RAIZ, ".env.local");
  if (!existsSync(ruta)) return {};
  const variables = {};
  for (const linea of readFileSync(ruta, "utf8").split(/\r?\n/)) {
    const encontrado = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (encontrado) variables[encontrado[1]] = encontrado[2].replace(/^["']|["']$/g, "");
  }
  return variables;
}

/** Revisa que la URL sea de Supabase y que la clave sea la publicable (nunca la secreta). */
export function validarConfig(url, clave) {
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
  return errores;
}

/** Claves antiguas de Supabase (JWT): el rol dice si es "anon" (pública) o "service_role" (secreta). */
function rolDeJwt(clave) {
  try {
    return JSON.parse(Buffer.from(clave.split(".")[1], "base64url").toString("utf8")).role ?? null;
  } catch {
    return null;
  }
}
