// Rutina: leer y guardar en Supabase con supabase-js (RLS: solo tus filas; user_id lo pone la base de datos).

import { supabase } from "../supabase/sesion.js";
import { leer, revisar } from "../supabase/datos.js";
import { nuevoId } from "../piezas/ui.js";
import { diaLogico } from "../logica/dia.js";
import { lunesDe, sumarDias } from "./logica.js";

const COLUMNAS_BLOQUE = "id, titulo, tipo, dias, hora_inicio, duracion_min, obligatorio, aviso_min, lugar, enlace, materia, notas, orden, activo";
const COLUMNAS_TAREA = "id, titulo, materia, fecha_limite, estimado_min, estado, prioridad, primer_paso, hecha_en, creado_en";

/** Todo lo de la página: plantilla activa, chequeos y festivos de esta semana, tareas pendientes y hechas en la semana. */
export async function cargarRutina(userId, ahora = new Date()) {
  const lunes = lunesDe(diaLogico(ahora));
  const domingo = sumarDias(lunes, 6);
  const [bloques, checks, festivos, pendientes, hechas] = await Promise.all([
    leer(supabase.from("rutina_bloques").select(COLUMNAS_BLOQUE).eq("user_id", userId).eq("activo", true).order("hora_inicio")),
    leer(supabase.from("rutina_checks").select("id, bloque_id, fecha, estado, origen").eq("user_id", userId).gte("fecha", lunes).lte("fecha", domingo)),
    leer(supabase.from("festivos").select("fecha, nombre").gte("fecha", lunes).lte("fecha", domingo)),
    leer(supabase.from("uni_tareas").select(COLUMNAS_TAREA).eq("user_id", userId).neq("estado", "hecha").order("fecha_limite")),
    leer(
      supabase
        .from("uni_tareas")
        .select("id")
        .eq("user_id", userId)
        .eq("estado", "hecha")
        .gte("hecha_en", new Date(`${lunes}T04:00:00-05:00`).toISOString()),
    ),
  ]);
  return { bloques: bloques ?? [], checks: checks ?? [], festivos: festivos ?? [], tareas: pendientes ?? [], hechasSemana: (hechas ?? []).length };
}

// ── Chequeos ─────────────────────────────────────────────────────────────

/** Marca un bloque en una fecha (hecho/saltado). Si ya estaba marcado (aquí, en otro equipo o por el atajo), actualiza. */
export async function marcar({ bloqueId, fecha, estado, checkId = null }) {
  const cambios = { estado, momento: new Date().toISOString(), origen: "web" };
  if (checkId) {
    const filas = await leer(supabase.from("rutina_checks").update(cambios).eq("id", checkId).select("id, bloque_id, fecha, estado, origen"));
    if (filas?.length) return filas[0];
  }
  const respuesta = await supabase
    .from("rutina_checks")
    .insert({ bloque_id: bloqueId, fecha, estado, origen: "web", id_cliente: nuevoId() })
    .select("id, bloque_id, fecha, estado, origen");
  if (!respuesta.error) return respuesta.data[0];
  if (respuesta.error.code !== "23505") revisar(respuesta);
  // Ya había un chequeo para ese bloque y fecha (único): se actualiza.
  const filas = await leer(
    supabase.from("rutina_checks").update(cambios).eq("bloque_id", bloqueId).eq("fecha", fecha).select("id, bloque_id, fecha, estado, origen"),
  );
  return filas[0];
}

export async function quitarMarca(checkId) {
  await leer(supabase.from("rutina_checks").delete().eq("id", checkId).select("id"));
}

// ── Plantilla ────────────────────────────────────────────────────────────

const limpiarBloque = (b) => ({
  titulo: b.titulo,
  tipo: b.tipo,
  dias: b.dias,
  hora_inicio: b.hora_inicio,
  duracion_min: b.duracion_min,
  obligatorio: Boolean(b.obligatorio),
  aviso_min: b.aviso_min ?? 0,
  lugar: b.lugar || null,
  enlace: b.enlace || null,
  materia: b.materia || null,
  notas: b.notas || null,
  orden: b.orden ?? 0,
});

/** Crea o actualiza un bloque. Devuelve la fila guardada. */
export async function guardarBloque(bloque, id = null) {
  if (id) {
    const filas = await leer(supabase.from("rutina_bloques").update(limpiarBloque(bloque)).eq("id", id).select(COLUMNAS_BLOQUE));
    return filas[0];
  }
  const filas = await leer(
    supabase.from("rutina_bloques").insert({ ...limpiarBloque(bloque), origen: "web", id_cliente: nuevoId() }).select(COLUMNAS_BLOQUE),
  );
  return filas[0];
}

/** "Quitar de la rutina": el bloque queda inactivo (sus chequeos pasados no se pierden). */
export async function quitarBloque(id) {
  await leer(supabase.from("rutina_bloques").update({ activo: false }).eq("id", id).select("id"));
}

/** Guarda la plantilla que armó la encuesta. Primero inserta la nueva y después apaga la anterior (nunca te quedas sin rutina). */
export async function crearPlantilla(filas, idsAnteriores = []) {
  const nuevas = await leer(
    supabase
      .from("rutina_bloques")
      .insert(filas.map((f) => ({ ...limpiarBloque(f), origen: "web", id_cliente: nuevoId() })))
      .select(COLUMNAS_BLOQUE),
  );
  if (idsAnteriores.length) {
    await leer(supabase.from("rutina_bloques").update({ activo: false }).in("id", idsAnteriores).select("id"));
  }
  return nuevas;
}

// ── Tareas de la universidad ─────────────────────────────────────────────

const limpiarTarea = (t) => ({
  titulo: t.titulo,
  materia: t.materia || null,
  fecha_limite: t.fecha_limite || null,
  primer_paso: t.primer_paso || null,
  prioridad: t.prioridad ?? 2,
});

export async function guardarTarea(tarea, id = null) {
  if (id) {
    const filas = await leer(supabase.from("uni_tareas").update(limpiarTarea(tarea)).eq("id", id).select(COLUMNAS_TAREA));
    return filas[0];
  }
  const filas = await leer(
    supabase.from("uni_tareas").insert({ ...limpiarTarea(tarea), estado: "pendiente", origen: "web", id_cliente: nuevoId() }).select(COLUMNAS_TAREA),
  );
  return filas[0];
}

export async function cambiarEstadoTarea(id, estado) {
  const hecha_en = estado === "hecha" ? new Date().toISOString() : null;
  const filas = await leer(supabase.from("uni_tareas").update({ estado, hecha_en }).eq("id", id).select(COLUMNAS_TAREA));
  return filas[0];
}

export async function borrarTarea(id) {
  await leer(supabase.from("uni_tareas").delete().eq("id", id).select("id"));
}
