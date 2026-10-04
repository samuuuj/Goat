// Lectura y escritura del desbloqueo desde el navegador (supabase-js + RLS: solo tus filas).

import { supabase } from "../supabase/sesion.js";
import { SesionVencida, cargarRegistros, leer } from "../supabase/datos.js";
import { guardarAjuste, leerAjustes } from "../supabase/ajustes.js";
import { diaLogico } from "../logica/dia.js";
import { nuevoId } from "../piezas/ui.js";
import { PASE } from "./logica.js";

/**
 * Todo lo que necesita la página: registros (para el resumen de calculo.js), ajustes, eventos y pases de hoy.
 * `ajustes` es perfil.ajustes completo; la regla usa ajustes.desbloqueo.
 */
export async function cargarDesbloqueo(userId, ahora = new Date()) {
  const hoy = diaLogico(ahora);
  const [registros, ajustes, eventos, pases] = await Promise.all([
    cargarRegistros(userId, ahora),
    leerAjustes(userId),
    leer(
      supabase
        .from("apps_eventos")
        .select("id, app, evento, permitido, momento, fecha")
        .eq("user_id", userId)
        .eq("fecha", hoy)
        .order("momento", { ascending: true }),
    ),
    leer(
      supabase
        .from("desbloqueo_pases")
        .select("id, app, minutos, momento, fecha")
        .eq("user_id", userId)
        .eq("fecha", hoy)
        .order("momento", { ascending: true }),
    ),
  ]);
  return { registros, ajustes: ajustes ?? {}, eventos: eventos ?? [], pases: pases ?? [] };
}

/**
 * Usa el pase de emergencia de hoy en `app`. Devuelve "ok" o "usado" (ya había uno hoy: lo impide la base de datos).
 */
export async function usarPase(app) {
  const { error, status } = await supabase
    .from("desbloqueo_pases")
    .insert({ app, minutos: PASE.minutos, id_cliente: nuevoId(), origen: "web" });
  if (!error) return "ok";
  if (error.code === "23505") return "usado";
  if (status === 401 || error.code === "42501") throw new SesionVencida(error.message);
  throw new Error(`No se pudo usar el pase (${error.code})`);
}

/** Cambia perfil.ajustes.desbloqueo sin pisar sus otras claves ni las de otros módulos. */
export async function guardarDesbloqueo(actual, cambios) {
  const base = actual && typeof actual === "object" ? actual : {};
  await guardarAjuste("desbloqueo", { ...base, ...cambios });
}
