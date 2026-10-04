// Ejercicio: leer y guardar en Supabase (RLS: solo tus filas) + una cola en este teléfono
// para que empezar, terminar y registrar funcionen sin internet y se suban al volver (con id_cliente).

import { supabase } from "../supabase/sesion.js";
import { BaseSinInstalar, SesionVencida, revisar } from "../supabase/datos.js";
import { leerMetas } from "../logica/calculo.js";
import { nuevoId } from "../piezas/ui.js";
import { sumarDias } from "./logica.js";

export const COLUMNAS =
  "id, tipo, rutina, inicio, fin, duracion_min, distancia_km, pasos, notas, en_curso, momento, fecha, origen, id_cliente";

/** Lo que se puede escribir en gym_sesiones (fecha es generada; user_id lo pone la base). */
const ESCRIBIBLES = ["tipo", "rutina", "inicio", "fin", "duracion_min", "distancia_km", "pasos", "notas", "en_curso", "momento"];

const CLAVE_COLA = "goat:ejercicio:cola";
const SEMANAS_HISTORIAL = 26;

// Tabla o columna que la base todavía no tiene (falta pegar schema.sql).
const SIN_ESQUEMA = new Set(["PGRST205", "42P01", "42703", "PGRST204"]);

function revisarModulo(respuesta) {
  if (respuesta.error && SIN_ESQUEMA.has(respuesta.error.code)) throw new BaseSinInstalar(respuesta.error.message);
  revisar(respuesta);
}

/** Metas, sesiones de las últimas 26 semanas (más cualquier entreno en curso) y pasos de las últimas 2 semanas. */
export async function cargar(userId, hoy) {
  const desde = sumarDias(hoy, -7 * SEMANAS_HISTORIAL);
  const respuestas = await Promise.all([
    supabase.from("perfil").select("metas").eq("user_id", userId).maybeSingle(),
    supabase
      .from("gym_sesiones")
      .select(COLUMNAS)
      .eq("user_id", userId)
      .gte("fecha", desde)
      .order("momento", { ascending: false })
      .limit(600),
    supabase.from("gym_sesiones").select(COLUMNAS).eq("user_id", userId).eq("en_curso", true),
    supabase
      .from("ejercicio_actividad")
      .select("fecha, pasos, distancia_km, energia_kcal")
      .eq("user_id", userId)
      .gte("fecha", sumarDias(hoy, -14)),
  ]);
  respuestas.forEach(revisarModulo);
  const [perfil, sesiones, abiertas, actividad] = respuestas;

  const porId = new Map();
  for (const fila of [...(sesiones.data ?? []), ...(abiertas.data ?? [])]) porId.set(fila.id, fila);
  return { metas: leerMetas(perfil.data?.metas), sesiones: [...porId.values()], actividad: actividad.data ?? [] };
}

// ── Cola local (localStorage) ────────────────────────────────────────────

const claveDe = (fila) => fila.id_cliente ?? fila.id;

/** Cambios hechos en este teléfono que todavía no llegaron a Supabase: [{ fila, borrar }]. */
export function leerCola() {
  try {
    const cola = JSON.parse(localStorage.getItem(CLAVE_COLA) ?? "[]");
    return Array.isArray(cola) ? cola.filter((p) => p?.fila && claveDe(p.fila)) : [];
  } catch {
    return [];
  }
}

function guardarCola(cola) {
  try {
    localStorage.setItem(CLAVE_COLA, JSON.stringify(cola));
  } catch {
    // Modo privado estricto: el cambio vive solo en memoria hasta que suba.
  }
}

/** Anota el estado completo de una sesión (o que hay que borrarla). Gana sobre lo del servidor hasta que suba. */
export function encolar(fila, { borrar = false } = {}) {
  const limpia = {};
  for (const campo of ["id", "id_cliente", "origen", ...ESCRIBIBLES]) if (fila[campo] !== undefined) limpia[campo] = fila[campo];
  if (!limpia.id && !limpia.id_cliente) limpia.id_cliente = nuevoId(); // Sin clave no se podría subir ni reconocer.
  const cola = leerCola().filter((p) => claveDe(p.fila) !== claveDe(limpia));
  cola.push({ fila: limpia, borrar });
  guardarCola(cola);
}

/** Quita de la cola solo si no cambió mientras se subía. */
function quitar(pendiente) {
  const texto = JSON.stringify(pendiente);
  guardarCola(leerCola().filter((p) => JSON.stringify(p) !== texto));
}

// ── Subir ────────────────────────────────────────────────────────────────

/** "subida", "queda" (sin internet o falta la base: se reintenta) o "descartada" (la base no la acepta). */
function resultado(respuesta) {
  if (!respuesta.error) return "subida";
  if (respuesta.status === 401) throw new SesionVencida(respuesta.error.message);
  if (respuesta.status === 0 || respuesta.status >= 500 || !respuesta.error.code) return "queda";
  if (SIN_ESQUEMA.has(respuesta.error.code)) return "queda";
  console.error(`[ejercicio] ${respuesta.error.code} ${respuesta.error.message}`);
  return "descartada";
}

async function subirUno({ fila, borrar }) {
  const tabla = () => supabase.from("gym_sesiones");
  const donde = (consulta) => (fila.id ? consulta.eq("id", fila.id) : consulta.eq("id_cliente", fila.id_cliente));

  if (borrar) return resultado(await donde(tabla().delete()));

  const datos = {};
  for (const campo of ESCRIBIBLES) if (fila[campo] !== undefined) datos[campo] = fila[campo];

  // Primero actualizar (por si ya subió antes); si no existía, insertarla.
  const cambio = await donde(tabla().update(datos)).select("id");
  const r = resultado(cambio);
  if (r !== "subida" || fila.id || (cambio.data ?? []).length > 0) return r;

  const nueva = await tabla().insert({ ...datos, id_cliente: fila.id_cliente, origen: fila.origen ?? "web" });
  return resultado(nueva);
}

let enMarcha = null;

/** Sube lo pendiente en orden. Devuelve { subidas, descartadas, quedan }. Lanza SesionVencida si hay que volver a entrar. */
export function sincronizar() {
  enMarcha ??= (async () => {
    let subidas = 0;
    let descartadas = 0;
    for (const pendiente of leerCola()) {
      let r;
      try {
        r = await subirUno(pendiente);
      } catch (error) {
        if (error instanceof SesionVencida) throw error;
        r = "queda"; // fetch falló: sin conexión.
      }
      if (r === "queda") break;
      quitar(pendiente);
      if (r === "subida") subidas++;
      else descartadas++;
    }
    return { subidas, descartadas, quedan: leerCola().length };
  })().finally(() => (enMarcha = null));
  return enMarcha;
}
