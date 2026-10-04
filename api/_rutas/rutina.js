// Rutas de Rutina, clases y tareas (G · Rutina, D-056). Las usan los atajos "☀️ Plan del día", "✅ Hecho",
// "🌙 Cierre del día" y "📚 Tarea", y el widget. Las reglas están en web/js/rutina/logica.js (principio 1).
// Mensajes: emoji + pocas palabras, sin montos (D-020).

import { randomUUID } from "node:crypto";
import { ok, ErrorApi } from "../_lib/respuesta.js";
import { entero, esUuid, fechaIso, idCliente, origen, texto, uno } from "../_lib/validar.js";
import { diaLogico } from "../../web/js/logica/dia.js";
import {
  ESTADOS_CHECK,
  ESTADOS_TAREA,
  aHora,
  ahoraYSiguiente,
  bloqueParaMarcar,
  cumplimiento,
  emojiDe,
  estadoDelDia,
  isoBogota,
  ordenarTareas,
  paraCuando,
  sumarDias,
  tipoDia,
} from "../../web/js/rutina/logica.js";

const COLUMNAS_BLOQUE = "id,titulo,tipo,dias,hora_inicio,duracion_min,obligatorio,aviso_min,lugar,enlace,materia,orden,activo";
const COLUMNAS_TAREA = "id,titulo,materia,fecha_limite,estimado_min,estado,prioridad,primer_paso,hecha_en,creado_en";
const UUID_EN_TEXTO = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const MAXIMO_POR_CIERRE = 100;

/** "2026-10-06" opcional; solo hoy o los 7 días anteriores (no se marca el futuro). */
function fechaDelCheck(valor, ahora) {
  const hoy = diaLogico(ahora);
  if (valor == null || valor === "") return hoy;
  const f = String(valor).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || f > hoy || f < sumarDias(hoy, -7)) {
    throw new ErrorApi("DATO_INVALIDO", "⚠️ Revisa: fecha");
  }
  return f;
}

/** Plantilla activa, chequeos y festivo de un día, con el estado de cada bloque. */
async function cargarDia(db, ahora, fecha = diaLogico(ahora)) {
  const [bloques, checks, festivos] = await Promise.all([
    db.select("rutina_bloques", { columnas: COLUMNAS_BLOQUE, filtros: { activo: "eq.true" } }),
    db.select("rutina_checks", { columnas: "id,bloque_id,fecha,estado", filtros: { fecha: `eq.${fecha}` } }),
    db.select("festivos", { columnas: "fecha,nombre", filtros: { fecha: `eq.${fecha}` } }),
  ]);
  const tipo = tipoDia(fecha, festivos);
  return { fecha, tipo, festivo: festivos[0]?.nombre ?? null, items: estadoDelDia(bloques, checks, ahora, { fecha, tipo }) };
}

/** Un bloque como lo usa Atajos: fechas ISO 8601 con zona de Bogotá, título del recordatorio y notas con el id. */
function paraAtajo(b) {
  const emoji = emojiDe(b.tipo);
  const rango = `${aHora(b.inicioMin)}–${aHora(b.finMin)}`;
  return {
    id: b.id,
    titulo: b.titulo,
    tipo: b.tipo,
    emoji,
    inicio: isoBogota(b.inicio),
    fin: isoBogota(b.fin),
    alerta: isoBogota(b.inicio - (Number(b.aviso_min) || 0) * 60_000),
    hora: aHora(b.inicioMin),
    duracion_min: Number(b.duracion_min),
    obligatorio: Boolean(b.obligatorio),
    lugar: b.lugar ?? null,
    enlace: b.enlace ?? null,
    estado: b.estado,
    marcable: b.marcable,
    recordatorio: `${emoji} ${b.titulo} · ${rango}`,
    // "goat:<id>" en las notas: el cierre del día lo busca para saber qué bloque completaste.
    notas: [b.obligatorio ? "● Obligatorio" : null, b.lugar ? `📍 ${b.lugar}` : null, b.enlace, `goat:${b.id}`].filter(Boolean).join("\n"),
  };
}

const porcentaje = (pct) => (pct === null ? null : Math.round(pct * 100));

function resumenCumplimiento(items) {
  const c = cumplimiento(items);
  return {
    hechos: c.hechos,
    total: c.total,
    pct: porcentaje(c.pct),
    obligatorios: { hechos: c.obligatorios.hechos, marcados: c.obligatorios.marcados, total: c.obligatorios.total },
  };
}

function paraTarea(t) {
  return {
    id: t.id,
    titulo: t.titulo,
    materia: t.materia ?? null,
    fecha_limite: t.fecha_limite ?? null,
    estado: t.estado,
    prioridad: t.prioridad ?? 2,
    primer_paso: t.primer_paso ?? null,
    vencida: t.vencida,
    vence: t.vence,
    // Para "Elegir de la lista" en Atajos.
    texto: `${t.vencida ? "⚠️ " : ""}${t.titulo} · ${t.vence}`,
  };
}

export default {
  /** Bloques de hoy (para "☀️ Plan del día": un recordatorio por bloque con alerta a su hora). */
  "GET rutina/hoy": async ({ db, ahora }) => {
    const dia = await cargarDia(db, ahora);
    const bloques = dia.items.map(paraAtajo);
    // Recordatorios: lo que falta por hacer hoy (las pausas van dentro del rango del trabajo útil).
    const recordatorios = bloques.filter((b) => b.marcable && b.estado !== "hecho" && b.estado !== "saltado" && Date.parse(b.fin) > ahora.getTime());
    const obligatorios = bloques.filter((b) => b.obligatorio && b.marcable).length;
    const mensaje = bloques.length
      ? `🗓️ ${recordatorios.length} ${recordatorios.length === 1 ? "bloque" : "bloques"} por delante${obligatorios ? ` · ${obligatorios} obligatorios` : ""}`
      : "🗓️ Sin rutina: créala en Goat";
    return ok(mensaje, {
      fecha: dia.fecha,
      tipo_dia: dia.tipo,
      festivo: dia.festivo,
      bloques,
      recordatorios,
      cumplimiento: resumenCumplimiento(dia.items),
    });
  },

  /** Bloque actual y siguiente, con mensaje corto ("🚶 Caminar · 45 min"). */
  "GET rutina/ahora": async ({ db, ahora }) => {
    const dia = await cargarDia(db, ahora);
    const { actual, siguiente, mensaje } = ahoraYSiguiente(dia.items, ahora);
    return ok(mensaje, {
      fecha: dia.fecha,
      actual: actual ? { ...paraAtajo(actual), quedan_min: Math.max(1, Math.ceil((actual.fin - ahora.getTime()) / 60_000)) } : null,
      siguiente: siguiente ? paraAtajo(siguiente) : null,
      cumplimiento: resumenCumplimiento(dia.items),
    });
  },

  /** Marca un bloque: { bloque_id | "actual", estado: "hecho" | "saltado" }. Marcar de nuevo actualiza. */
  "POST rutina/check": async ({ db, cuerpo, ahora }) => {
    const estado = uno(cuerpo.estado ?? "hecho", ESTADOS_CHECK, "estado");
    const fecha = fechaDelCheck(cuerpo.fecha, ahora);
    const pedido = String(cuerpo.bloque_id ?? "actual").trim().toLowerCase();
    if (pedido !== "actual" && !esUuid(pedido)) throw new ErrorApi("DATO_INVALIDO", "⚠️ Revisa: bloque");

    const dia = await cargarDia(db, ahora, fecha);
    const bloque = pedido === "actual" ? bloqueParaMarcar(dia.items, ahora) : dia.items.find((b) => b.id === pedido);
    if (!bloque) {
      throw pedido === "actual"
        ? new ErrorApi("NADA_QUE_MARCAR", "🤷 Nada que marcar ahora", 404)
        : new ErrorApi("NO_EXISTE", "🤷 Ese bloque no es de hoy", 404);
    }
    if (!bloque.marcable) throw new ErrorApi("NO_SE_MARCA", "☕ Las pausas no se marcan");

    const fila = {
      bloque_id: bloque.id,
      fecha,
      estado,
      nota: texto(cuerpo.nota, 120, "nota", { opcional: true }),
      momento: ahora.toISOString(),
      origen: origen(cuerpo.origen),
      id_cliente: esUuid(cuerpo.id_cliente) ? cuerpo.id_cliente : randomUUID(),
    };
    await db.upsert("rutina_checks", fila, { conflicto: "bloque_id,fecha" });
    const despues = dia.items.find((b) => b.inicio > ahora.getTime() && b.marcable && b.id !== bloque.id);
    const mensaje = estado === "hecho" ? `✅ Hecho · ${bloque.titulo}` : `⤼ Saltado · ${bloque.titulo}`;
    return ok(mensaje, {
      bloque_id: bloque.id,
      titulo: bloque.titulo,
      estado,
      fecha,
      siguiente: despues ? `${emojiDe(despues.tipo)} ${despues.titulo} · ${aHora(despues.inicioMin)}` : null,
    });
  },

  /**
   * Varios a la vez (lo usa "🌙 Cierre del día"): { items: [{ bloque_id, estado }] } y/o
   * { hechos: "<notas de los recordatorios completados>" } (se toman los ids que aparezcan).
   * Solo cuenta bloques de ese día; los obligatorios que queden sin marcar se confirman en la web.
   */
  "POST rutina/checks": async ({ db, cuerpo, ahora }) => {
    const fecha = fechaDelCheck(cuerpo.fecha, ahora);
    const pedidos = new Map();
    const items = Array.isArray(cuerpo.items) ? cuerpo.items : [];
    for (const item of items.slice(0, MAXIMO_POR_CIERRE)) {
      const id = String(item?.bloque_id ?? "").toLowerCase();
      if (esUuid(id)) pedidos.set(id, uno(item.estado ?? "hecho", ESTADOS_CHECK, "estado"));
    }
    const enTexto = typeof cuerpo.hechos === "string" ? cuerpo.hechos.slice(0, 20_000).match(UUID_EN_TEXTO) ?? [] : [];
    for (const id of enTexto.slice(0, MAXIMO_POR_CIERRE)) pedidos.set(id.toLowerCase(), "hecho");

    const dia = await cargarDia(db, ahora, fecha);
    const deHoy = new Map(dia.items.filter((b) => b.marcable).map((b) => [b.id, b]));
    const origenFila = origen(cuerpo.origen);
    const filas = [...pedidos]
      .filter(([id]) => deHoy.has(id))
      .map(([bloque_id, estado]) => ({ bloque_id, fecha, estado, momento: ahora.toISOString(), origen: origenFila, id_cliente: randomUUID() }));
    if (filas.length) await db.upsert("rutina_checks", filas, { conflicto: "bloque_id,fecha" });

    const marcados = new Set(filas.map((f) => f.bloque_id));
    const porConfirmar = dia.items.filter(
      (b) => b.marcable && b.obligatorio && !b.check && !marcados.has(b.id) && b.fin <= ahora.getTime(),
    );
    const partes = [filas.length ? `✅ ${filas.length} ${filas.length === 1 ? "marcado" : "marcados"}` : "🤷 Nada nuevo que marcar"];
    if (porConfirmar.length) partes.push(`${porConfirmar.length} por confirmar`);
    return ok(partes.join(" · "), {
      fecha,
      marcados: filas.length,
      ignorados: pedidos.size - filas.length,
      por_confirmar: porConfirmar.map((b) => `${emojiDe(b.tipo)} ${b.titulo}`),
    });
  },

  /** Tareas pendientes de la universidad, vencidas primero y luego por fecha límite. */
  "GET uni/tareas": async ({ db, ahora }) => {
    const filas = await db.select("uni_tareas", { columnas: COLUMNAS_TAREA, filtros: { estado: "neq.hecha" }, orden: "fecha_limite.asc" });
    const tareas = ordenarTareas(filas, ahora).map(paraTarea);
    const vencidas = tareas.filter((t) => t.vencida).length;
    const mensaje = tareas.length
      ? `📚 ${tareas.length} ${tareas.length === 1 ? "pendiente" : "pendientes"}${vencidas ? ` · ${vencidas} ${vencidas === 1 ? "vencida" : "vencidas"}` : ""}`
      : "📚 Nada pendiente";
    return ok(mensaje, { tareas, total: tareas.length, vencidas });
  },

  /** Nueva tarea: { titulo, materia?, fecha_limite? (ISO) | para?: hoy|manana|semana, primer_paso?, prioridad?, estimado_min? }. */
  "POST uni/tareas": async ({ db, cuerpo, ahora }) => {
    const limite = cuerpo.fecha_limite ? fechaIso(cuerpo.fecha_limite, "fecha límite") : null;
    const para = cuerpo.para ? paraCuando(uno(cuerpo.para, ["hoy", "manana", "semana"], "para cuándo"), ahora) : null;
    const fila = {
      titulo: texto(cuerpo.titulo, 120, "título"),
      materia: texto(cuerpo.materia, 60, "materia", { opcional: true }),
      fecha_limite: limite ? limite.toISOString() : para,
      estimado_min: cuerpo.estimado_min == null || cuerpo.estimado_min === "" ? null : entero(cuerpo.estimado_min, 5, 1440, "minutos"),
      prioridad: cuerpo.prioridad == null || cuerpo.prioridad === "" ? 2 : entero(cuerpo.prioridad, 1, 3, "prioridad"),
      primer_paso: texto(cuerpo.primer_paso, 120, "primer paso", { opcional: true }),
      estado: "pendiente",
      momento: ahora.toISOString(),
      origen: origen(cuerpo.origen),
    };
    fila.id_cliente = await idCliente(db, "uni_tareas", fila, ["titulo"], cuerpo.id_cliente, ahora);
    if (fila.id_cliente) await db.insert("uni_tareas", fila, { devolver: false });
    return ok("📚 Tarea guardada", { titulo: fila.titulo, fecha_limite: fila.fecha_limite }, 201);
  },

  /** Marca una tarea: { id, estado?: "hecha" (por defecto) | "en_progreso" | "pendiente" }. */
  "POST uni/tareas/hecha": async ({ db, cuerpo, ahora }) => {
    if (!esUuid(cuerpo.id)) throw new ErrorApi("DATO_INVALIDO", "⚠️ Falta la tarea");
    const estado = uno(cuerpo.estado ?? "hecha", ESTADOS_TAREA, "estado");
    const cambios = { estado, hecha_en: estado === "hecha" ? ahora.toISOString() : null };
    const filas = await db.update("uni_tareas", cambios, { id: `eq.${cuerpo.id}` });
    if (filas.length === 0) throw new ErrorApi("NO_EXISTE", "🤷 Esa tarea no existe", 404);
    const mensaje = estado === "hecha" ? "✅ Tarea hecha" : estado === "en_progreso" ? "▶️ Tarea empezada" : "↩️ Tarea pendiente";
    return ok(mensaje, { id: cuerpo.id, estado });
  },
};
