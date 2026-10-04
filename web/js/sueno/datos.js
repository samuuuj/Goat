// Sueño: leer y guardar con supabase-js. RLS hace que solo veas y escribas tus filas.

import { supabase } from "../supabase/sesion.js";
import { guardar, leer } from "../supabase/datos.js";
import { guardarAjuste } from "../supabase/ajustes.js";
import { nuevoId } from "../piezas/ui.js";

const DIA_MS = 86_400_000;

/**
 * Metas de sueño: las de perfil.metas, y encima las que cambies en esta página (perfil.ajustes.sueno).
 * La API hace la misma mezcla (api/_rutas/sueno.js).
 */
export const mezclarMetas = (perfil) => ({ ...(perfil?.metas ?? {}), ...(perfil?.ajustes?.sueno ?? {}) });

/** Eventos y muestras de los últimos `dias` días, más tus metas: lo que necesita resumenSueno(). */
export async function cargarSueno(userId, ahora = new Date(), dias = 21) {
  const desde = new Date(ahora.getTime() - dias * DIA_MS).toISOString();
  const [perfil, eventos, muestras] = await Promise.all([
    leer(supabase.from("perfil").select("metas, ajustes").eq("user_id", userId).maybeSingle()),
    leer(
      supabase
        .from("sueno_eventos")
        .select("tipo, fuente, momento, origen, creado_en")
        .eq("user_id", userId)
        .gte("momento", desde)
        .order("momento"),
    ),
    leer(
      supabase.from("sueno_muestras").select("inicio, fin, tipo, creado_en").eq("user_id", userId).gte("fin", desde).order("inicio"),
    ),
  ]);
  return { metas: mezclarMetas(perfil), eventos: eventos ?? [], muestras: muestras ?? [] };
}

/** "Me acosté" / "Me levanté" anotado a mano. Devuelve true si quedó guardado. */
export function guardarEvento(tipo, momento) {
  return guardar("sueno_eventos", { tipo, fuente: "manual", momento: momento.toISOString(), id_cliente: nuevoId() });
}

/** Tus metas de sueño (horas, hora de acostarte y de levantarte) en perfil.ajustes.sueno. */
export function guardarMetas(metas) {
  return guardarAjuste("sueno", metas);
}
