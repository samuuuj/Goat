// Leer y escribir la tabla `notificaciones` desde el navegador (supabase-js + RLS: solo ves las tuyas).
// Cualquier módulo de la web puede avisar con notificarLocal({ modulo, emoji, titulo, cuerpo, url, clave }).
// Sin montos (D-020): validarNotificacion() lo revisa antes de guardar.

import { supabase, sesionActual } from "../supabase/sesion.js";
import { guardar, leer } from "../supabase/datos.js";
import { validarNotificacion } from "./logica.js";

const COLUMNAS = "id,modulo,emoji,titulo,cuerpo,url,clave,leida_en,descartada_en,momento,fecha";

/** Cuántos días hacia atrás se muestran (y se revisan para no duplicar). */
export const DIAS_VISIBLES = 30;
const LIMITE = 300;

/** Evento que avisa a la campana que hay notificaciones nuevas. */
export const EVENTO_NUEVAS = "goat:notificaciones";

let usuario = null;
async function idUsuario() {
  if (!usuario) usuario = (await sesionActual())?.user?.id ?? null;
  return usuario;
}

/** Las de los últimos 30 días, incluidas las leídas y descartadas (el panel filtra), lo más reciente primero. */
export async function cargarNotificaciones(ahora = new Date()) {
  const desde = new Date(ahora.getTime() - DIAS_VISIBLES * 86_400_000).toISOString();
  let consulta = supabase.from("notificaciones").select(COLUMNAS).gte("momento", desde);
  const id = await idUsuario();
  if (id) consulta = consulta.eq("user_id", id);
  return (await leer(consulta.order("momento", { ascending: false }).limit(LIMITE))) ?? [];
}

/** Guarda una notificación ya validada. Una clave repetida cuenta como guardada (no se duplica). */
export async function guardarNotificacion(notificacion) {
  return guardar("notificaciones", validarNotificacion(notificacion));
}

/**
 * Para los demás módulos de la web: agrega un aviso al centro de notificaciones y actualiza la campana.
 * Devuelve true si quedó guardado (o ya existía esa clave); false si algo falló (nunca rompe la página).
 */
export async function notificarLocal({ modulo, emoji, titulo, cuerpo = null, url = null, clave = null }) {
  try {
    const guardada = await guardarNotificacion({ modulo, emoji, titulo, cuerpo, url, clave });
    if (guardada) document.dispatchEvent(new CustomEvent(EVENTO_NUEVAS));
    return guardada;
  } catch (error) {
    console.warn("[notificaciones] no se guardó el aviso:", error.message);
    return false;
  }
}

async function cambiar(ids, cambios, { soloSinLeer = false } = {}) {
  const lista = [...new Set(ids)].filter(Boolean);
  for (let i = 0; i < lista.length; i += 100) {
    let consulta = supabase.from("notificaciones").update(cambios).in("id", lista.slice(i, i + 100));
    if (soloSinLeer) consulta = consulta.is("leida_en", null);
    await leer(consulta);
  }
}

/** Marca como leídas (tocar una, cerrar el panel o un pendiente ya resuelto). */
export function marcarLeidas(ids, ahora = new Date()) {
  return cambiar(ids, { leida_en: ahora.toISOString() }, { soloSinLeer: true });
}

/** Borra del panel (deslizar o "Borrar todo"). La fila se queda para que su clave no se repita. */
export function descartar(ids, ahora = new Date()) {
  return cambiar(ids, { descartada_en: ahora.toISOString() });
}
