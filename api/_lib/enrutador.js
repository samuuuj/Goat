// Enrutador de /api/v1 (D-052): una sola función de Vercel atiende todas las rutas.
// Cada módulo declara sus rutas en api/_rutas/<modulo>.js:
//   export default {
//     "GET finanzas/menu": async (ctx) => ok("…", datos),
//     "POST tokens": { auth: "sesion", manejar: async (ctx) => … },
//   }
// auth: "usuario" (por defecto: token de atajo o sesión web) · "sesion" (solo la web) · "publica" (sin usuario).

import { leerConfig } from "./config.js";
import { error, ErrorApi } from "./respuesta.js";
import { baseDeDatos } from "./supabase.js";
import { leerBearer, pareceJwt, usuarioDeSesion, usuarioDeToken } from "./auth.js";

const METODOS = new Set(["GET", "POST", "PATCH", "DELETE"]);
const LIMITE_POR_MINUTO = 60;

/** Une los archivos de rutas. Una ruta repetida es un error de programación. */
export function unirRutas(...modulos) {
  const rutas = {};
  for (const modulo of modulos) {
    for (const [clave, definicion] of Object.entries(modulo ?? {})) {
      if (rutas[clave]) throw new Error(`Ruta repetida: ${clave}`);
      const def = typeof definicion === "function" ? { manejar: definicion } : definicion;
      rutas[clave] = { auth: "usuario", ...def };
    }
  }
  return rutas;
}

// Límite simple por usuario dentro de cada instancia de la función (suficiente para un uso personal).
const llamadas = new Map();
function dentroDelLimite(clave, ahora) {
  const ventana = (llamadas.get(clave) ?? []).filter((t) => ahora - t < 60_000);
  ventana.push(ahora);
  llamadas.set(clave, ventana);
  if (llamadas.size > 1000) llamadas.clear();
  return ventana.length <= LIMITE_POR_MINUTO;
}

/** "finanzas/menu/" o "/finanzas/menu" → "finanzas/menu". */
export function normalizarRuta(ruta) {
  return String(ruta ?? "")
    .split("/")
    .filter(Boolean)
    .join("/")
    .toLowerCase();
}

/**
 * Atiende una petición ya leída: { metodo, ruta, query, cuerpo, encabezados }.
 * `deps`: { rutas, entorno, fetch, ahora } (las pruebas cambian fetch y entorno).
 * Devuelve { estado, cuerpo }.
 */
export async function atender(peticion, deps) {
  const inicio = Date.now();
  const ahora = deps.ahora ?? new Date();
  const metodo = String(peticion.metodo ?? "").toUpperCase();
  const ruta = normalizarRuta(peticion.ruta);
  const config = leerConfig(deps.entorno);
  const f = deps.fetch ?? fetch;
  let usuario = null;
  let resultado;

  try {
    if (!METODOS.has(metodo)) throw new ErrorApi("METODO_NO_PERMITIDO", "Método no permitido", 405);
    const definicion = deps.rutas[`${metodo} ${ruta}`];
    if (!definicion) throw new ErrorApi("RUTA_NO_EXISTE", "Esa ruta no existe", 404);

    const bearer = leerBearer(peticion.encabezados);

    if (definicion.auth === "publica") {
      if (bearer && config.lista) usuario = await identificar(config, bearer, definicion, f, ahora).catch(() => null);
    } else {
      if (!config.lista) throw new ErrorApi("SERVIDOR_SIN_CONFIGURAR", "🛠️ Falta configurar el servidor", 503);
      if (!bearer) throw new ErrorApi("SIN_TOKEN", "🔑 Falta el token", 401);
      usuario = await identificar(config, bearer, definicion, f, ahora);
      if (!usuario) throw new ErrorApi("TOKEN_INVALIDO", "🔑 Token inválido o revocado", 401);
      if (!dentroDelLimite(usuario.id, ahora.getTime())) throw new ErrorApi("DEMASIADAS_LLAMADAS", "⏳ Espera un minuto", 429);
    }

    const ctx = {
      metodo,
      ruta,
      query: peticion.query ?? {},
      cuerpo: peticion.cuerpo && typeof peticion.cuerpo === "object" ? peticion.cuerpo : {},
      encabezados: peticion.encabezados ?? {},
      usuario,
      db: usuario ? baseDeDatos(config, usuario.id, { fetch: f }) : null,
      config,
      ahora,
      fetch: f,
    };
    resultado = await definicion.manejar(ctx);
    if (!resultado?.cuerpo) throw new Error(`La ruta ${metodo} ${ruta} no devolvió respuesta`);
  } catch (e) {
    if (e instanceof ErrorApi) resultado = error(e.codigo, e.message, e.estado);
    else {
      console.error(`[api] ${metodo} ${ruta}:`, e?.codigo ?? "", e?.message ?? e);
      resultado = error("ERROR_INTERNO", "⚠️ Algo falló. Intenta otra vez.", 500);
    }
  }

  // Registro de llamadas para depurar atajos, sin cuerpo (puede tener montos).
  if (usuario && config.lista && ruta !== "ping") {
    await baseDeDatos(config, usuario.id, { fetch: f })
      .insert("log_api", { ruta, metodo, estado: resultado.estado, duracion_ms: Date.now() - inicio }, { devolver: false })
      .catch(() => {});
  }
  return resultado;
}

/** Token de atajo o sesión web, según lo que acepte la ruta. */
async function identificar(config, bearer, definicion, f, ahora) {
  if (pareceJwt(bearer)) return usuarioDeSesion(config, bearer, { fetch: f });
  if (definicion.auth === "sesion") return null; // Crear o revocar tokens solo con la sesión de la web.
  return usuarioDeToken(config, bearer, { ahora, fetch: f });
}
