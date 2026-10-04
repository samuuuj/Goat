// Dato corto para la tarjeta "Tu día" en Hoy (sin montos). null = sin dato.
// Ej.: "Ahora: Caminar" · "12:30 Almuerzo" · "1 por marcar" · "Arma tu rutina".

import { supabase } from "../supabase/sesion.js";
import { diaLogico } from "../logica/dia.js";
import { aHora, ahoraYSiguiente, estadoDelDia, obligatoriosVencidos } from "./logica.js";

export async function miniDato(sesion) {
  if (!supabase) return null;
  const ahora = new Date();
  const hoy = diaLogico(ahora);
  const [bloques, checks, festivos] = await Promise.all([
    supabase.from("rutina_bloques").select("id, titulo, tipo, dias, hora_inicio, duracion_min, obligatorio, orden, activo").eq("user_id", sesion.user.id).eq("activo", true),
    supabase.from("rutina_checks").select("bloque_id, fecha, estado").eq("user_id", sesion.user.id).eq("fecha", hoy),
    supabase.from("festivos").select("fecha, nombre").eq("fecha", hoy),
  ]);
  if (bloques.error || checks.error) return null;
  if (!bloques.data.length) return "Arma tu rutina";
  const opciones = { fecha: hoy, festivos: festivos.data ?? [] };
  const vencidos = obligatoriosVencidos(bloques.data, checks.data, ahora, opciones);
  if (vencidos.length) return `${vencidos.length} por marcar`;
  const { actual, siguiente } = ahoraYSiguiente(estadoDelDia(bloques.data, checks.data, ahora, opciones), ahora);
  if (actual) return `Ahora: ${actual.titulo}`;
  if (siguiente) return `${aHora(siguiente.inicioMin)} ${siguiente.titulo}`;
  return "Día cerrado";
}
