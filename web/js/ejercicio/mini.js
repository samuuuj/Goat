// Dato corto para la tarjeta "Movimiento." en Hoy (sin montos): "⏱️ Fuerza en curso" · "2 de 4 entrenos" · "Semana cumplida ✓".

import { supabase } from "../supabase/sesion.js";
import { diaLogico } from "../logica/dia.js";
import { leerMetas } from "../logica/calculo.js";
import { combinar, enCurso, lunesDe, nombreTipo, resumenSemana } from "./logica.js";
import { leerCola } from "./datos.js";

export async function miniDato(sesion) {
  const ahora = new Date();
  const lunes = lunesDe(diaLogico(ahora));
  const userId = sesion.user.id;
  const [perfil, semana, abiertas] = await Promise.all([
    supabase.from("perfil").select("metas").eq("user_id", userId).maybeSingle(),
    supabase.from("gym_sesiones").select("id, id_cliente, tipo, inicio, fin, en_curso, momento, fecha").eq("user_id", userId).gte("fecha", lunes),
    supabase.from("gym_sesiones").select("id, id_cliente, tipo, inicio, fin, en_curso, momento, fecha").eq("user_id", userId).eq("en_curso", true),
  ]);
  if (semana.error || abiertas.error) return null;

  const porId = new Map([...(semana.data ?? []), ...(abiertas.data ?? [])].map((s) => [s.id, s]));
  const sesiones = combinar([...porId.values()], leerCola());
  const activa = enCurso(sesiones, ahora);
  if (activa && !activa.olvidada) return `⏱️ ${nombreTipo(activa.sesion.tipo)} en curso`;

  const r = resumenSemana(sesiones, leerMetas(perfil.data?.metas), lunes);
  return r.faltan === 0 ? "Semana cumplida ✓" : `${r.entrenos} de ${r.meta} entrenos`;
}
