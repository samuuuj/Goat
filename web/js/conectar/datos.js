// Lectura y escritura de Conectar desde el navegador.
//  - Tablas con supabase-js y RLS (solo tus filas): perfil, api_tokens (solo lectura) y log_api (solo lectura).
//  - Crear y revocar llaves: /api/v1/tokens con la sesión de la web (el servidor guarda solo el hash).
// El token nunca se guarda aquí: vive en memoria de la página hasta que la cierras.

import { sesionActual, supabase } from "../supabase/sesion.js";
import { SesionVencida, leer, revisar } from "../supabase/datos.js";
import { guardarAjuste } from "../supabase/ajustes.js";

const COLUMNAS_LLAVE = "id, nombre, ultimo_uso, revocado, creado_en";

/** Perfil (nombre, metas, ajustes) y tus llaves. */
export async function cargarConectar(userId) {
  const [perfil, tokens] = await Promise.all([
    leer(supabase.from("perfil").select("nombre, metas, ajustes").eq("user_id", userId).maybeSingle()),
    leerLlaves(userId),
  ]);
  return { perfil: { nombre: perfil?.nombre ?? null, metas: perfil?.metas ?? {}, ajustes: perfil?.ajustes ?? {} }, tokens };
}

/** Tus llaves, la más nueva primero (sin hash: la columna ni se pide). */
export async function leerLlaves(userId) {
  return (
    (await leer(
      supabase.from("api_tokens").select(COLUMNAS_LLAVE).eq("user_id", userId).order("creado_en", { ascending: false }),
    )) ?? []
  );
}

/** Id de la última llamada a la API anotada en log_api (0 si no hay). */
export async function ultimoLog(userId) {
  const filas = await leer(supabase.from("log_api").select("id").eq("user_id", userId).order("id", { ascending: false }).limit(1));
  return Number(filas?.[0]?.id ?? 0);
}

/** Llamadas a la API después de `id` (las que hizo el iPhone mientras esperamos). */
export async function logsDesde(userId, id) {
  return (
    (await leer(
      supabase
        .from("log_api")
        .select("id, ruta, metodo, estado, creado_en")
        .eq("user_id", userId)
        .gt("id", id)
        .order("id", { ascending: true })
        .limit(50),
    )) ?? []
  );
}

/**
 * Llama a /api/v1/<ruta> con la sesión de la web. Nunca lanza por la red: devuelve
 * { estado, ok, mensaje, datos?, codigo? } para mostrar el mensaje tal cual.
 */
async function pedirApi(metodo, ruta, cuerpo) {
  const sesion = await sesionActual();
  if (!sesion?.access_token) throw new SesionVencida("Sin sesión");
  let respuesta;
  try {
    respuesta = await fetch(`/api/v1/${ruta}`, {
      method: metodo,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${sesion.access_token}`,
        ...(cuerpo ? { "Content-Type": "application/json" } : {}),
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    return { estado: 0, ok: false, mensaje: "📡 Sin conexión", codigo: "SIN_RED" };
  }
  const json = await respuesta.json().catch(() => null);
  if (!json || typeof json !== "object") {
    return { estado: respuesta.status, ok: false, mensaje: "⚠️ Goat no respondió bien", codigo: "SIN_RESPUESTA" };
  }
  return { estado: respuesta.status, ...json };
}

/** Crea una llave. Si sale bien, `datos.token` trae el token: se muestra una vez y no se guarda. */
export const crearLlave = (nombre) => pedirApi("POST", "tokens", { nombre });

/** Revoca una llave: el atajo que la use deja de funcionar. */
export const revocarLlave = (id) => pedirApi("DELETE", `tokens?id=${encodeURIComponent(id)}`, { id });

/** La ruta de prueba de un atajo, llamada desde la web (comprueba que Goat responda). */
export const probarRuta = (prueba) => pedirApi(prueba.metodo ?? "GET", prueba.ruta);

/** perfil.ajustes.atajos = { id: true } (los atajos que ya armaste). */
export const guardarAtajosHechos = (marcados) => guardarAjuste("atajos", marcados);

/** Terminaste el asistente (en cualquier dispositivo). */
export const completarBienvenida = (ahora = new Date()) =>
  guardarAjuste("bienvenida", { completada: true, fecha: ahora.toISOString() });

/** Cambia una meta de perfil.metas sin pisar las demás. Devuelve las metas nuevas. */
export async function guardarMeta(userId, metasActuales, clave, valor) {
  const metas = { ...(metasActuales ?? {}), [clave]: valor };
  revisar(await supabase.from("perfil").update({ metas }).eq("user_id", userId));
  return metas;
}
