// Configuración del servidor. La URL y la clave publicable salen de web/js/config.js (las mismas del navegador);
// la clave secreta SOLO de la variable de entorno SUPABASE_SECRET_KEY de Vercel (nunca en el código ni en web/).

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../../web/js/config.js";

/** Lee la configuración en cada petición (permite cambiar el entorno en las pruebas). */
export function leerConfig(entorno = process.env) {
  const url = (entorno.SUPABASE_URL || SUPABASE_URL || "").trim();
  const publicable = (entorno.SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY || "").trim();
  const secreta = (entorno.SUPABASE_SECRET_KEY || "").trim();
  return {
    url,
    publicable,
    secreta,
    lista: /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && Boolean(publicable) && Boolean(secreta),
  };
}
