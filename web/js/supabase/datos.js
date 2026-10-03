// Lectura y escritura en Supabase. RLS garantiza que solo se lean y escriban filas tuyas;
// user_id lo pone la base de datos (auth.uid()).

import { supabase } from "./sesion.js";
import { diaLogico } from "../logica/dia.js";
import { DIAS_HISTORIA, inicioDeMes, leerMetas, sumarDias } from "../logica/calculo.js";

/** La base de datos todavía no tiene las tablas (falta correr supabase/schema.sql en Supabase). */
export class BaseSinInstalar extends Error {}

/** La sesión venció o la cerraron desde otro lado: hay que volver a entrar. */
export class SesionVencida extends Error {}

// PostgREST: tabla inexistente (PGRST205) · Postgres: relación inexistente (42P01).
const SIN_TABLA = new Set(["PGRST205", "42P01"]);

/** Convierte el error de una respuesta de supabase-js en BaseSinInstalar, SesionVencida o Error. */
export function revisar(respuesta) {
  const { error, status } = respuesta;
  if (!error) return;
  if (SIN_TABLA.has(error.code)) throw new BaseSinInstalar(error.message);
  if (status === 401 || error.code === "42501") throw new SesionVencida(error.message);
  throw new Error(`No se pudieron leer los registros (${error.code})`);
}

/** Lee tus registros de los últimos 60 días (los que necesita el cálculo del resumen). */
export async function cargarRegistros(userId, ahora = new Date()) {
  const hoy = diaLogico(ahora);
  const desde = sumarDias(hoy, -(DIAS_HISTORIA - 1));
  // Finanzas necesita el mes completo para repartir el presupuesto.
  const desdeFinanzas = inicioDeMes(desde) < desde ? inicioDeMes(desde) : desde;

  const respuestas = await Promise.all([
    supabase.from("perfil").select("metas").eq("user_id", userId).maybeSingle(),
    supabase.from("comidas").select("tipo, kcal, proteina_g, omitida, fecha").eq("user_id", userId).gte("fecha", desde),
    supabase
      .from("finanzas_movimientos")
      .select("tipo, monto, fecha, momento")
      .eq("user_id", userId)
      .gte("fecha", desdeFinanzas),
    supabase
      .from("checkins")
      .select("tipo, fecha, momento")
      .eq("user_id", userId)
      .eq("modulo", "finanzas")
      .gte("fecha", desde),
    supabase.from("uni_sesiones").select("minutos, fecha").eq("user_id", userId).gte("fecha", desde),
    supabase.from("gym_sesiones").select("fecha").eq("user_id", userId).gte("fecha", desde),
    supabase.from("festivos").select("fecha, nombre").gte("fecha", sumarDias(hoy, -6)).lte("fecha", hoy),
  ]);
  respuestas.forEach(revisar);

  const [perfil, comidas, movimientos, checkins, estudio, gym, festivos] = respuestas;
  return {
    metas: leerMetas(perfil.data?.metas),
    comidas: comidas.data ?? [],
    movimientos: movimientos.data ?? [],
    checkins: checkins.data ?? [],
    estudio: estudio.data ?? [],
    gym: gym.data ?? [],
    festivos: festivos.data ?? [],
  };
}

/** Lee con supabase-js y revisa el error: `await leer(supabase.from("tabla").select("*"))` devuelve data. */
export async function leer(consulta) {
  const respuesta = await consulta;
  revisar(respuesta);
  return respuesta.data;
}

/** Inserta una fila. Un id_cliente repetido (doble toque) cuenta como guardado. Devuelve true si quedó guardada. */
export async function guardar(tabla, fila) {
  const { error, status } = await supabase.from(tabla).insert({ ...fila, origen: "web" });
  if (!error || error.code === "23505") return true;
  if (status === 401) throw new SesionVencida(error.message);
  console.error(`[registro] ${tabla}: ${error.code} ${error.message}`);
  return false;
}
