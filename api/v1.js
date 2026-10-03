// Única función de Vercel para /api/v1/* (D-052). vercel.json reescribe /api/v1/<ruta> → /api/v1?ruta=<ruta>.
// La lógica vive en api/_lib/enrutador.js (se puede probar sin Vercel) y las rutas en api/_rutas/.

import { atender, normalizarRuta } from "./_lib/enrutador.js";
import { RUTAS } from "./_lib/rutas.js";

/** De dónde sale la ruta: ?ruta= (reescritura) o el path original. */
function rutaDe(req) {
  const url = new URL(req.url ?? "/", "http://goat.local");
  const desdePath = url.pathname.replace(/^\/api\/v1\/?/, "");
  return normalizarRuta(desdePath || url.searchParams.get("ruta") || req.query?.ruta || "");
}

/** Cuerpo JSON (Vercel ya lo convierte; si llega como texto, se intenta leer). */
function cuerpoDe(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

export default async function handler(req, res) {
  const query = Object.fromEntries(new URL(req.url ?? "/", "http://goat.local").searchParams);
  delete query.ruta;
  const { estado, cuerpo } = await atender(
    { metodo: req.method, ruta: rutaDe(req), query, cuerpo: cuerpoDe(req), encabezados: req.headers },
    { rutas: RUTAS, entorno: process.env },
  );
  res.statusCode = estado;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(cuerpo));
}
