// Conectar iPhone: funciones puras (sin pantalla ni internet). Las usan conectar.html, mini.js, bienvenida.js y las pruebas.

import { ATAJOS, GRUPOS } from "./guias.js";

/** Grupos del asistente, en el orden en que conviene armarlos (web/js/conectar/guias.js). */
export const MODULOS = GRUPOS;

// ── Primer uso ───────────────────────────────────────────────────────────

/** ¿Hay que llevar a este dispositivo al asistente? Solo si no tiene la marca local y no se completó en ninguno. */
export function necesitaBienvenida({ marcaLocal = false, ajustes = {} } = {}) {
  if (marcaLocal) return false;
  return ajustes?.bienvenida?.completada !== true;
}

// ── Atajos (todas las guías viven en web/js/conectar/guias.js, D-063) ──────

const texto = (valor) => typeof valor === "string" && valor.trim().length > 0;
const lista = (valor) => (Array.isArray(valor) ? valor : []);

/**
 * Agrupa las guías para el asistente, en el orden de `grupos`.
 * Un id repetido, un atajo sin nombre o sin pasos ni automatizaciones, o un grupo que no existe es un error de
 * programación: se lanza con un mensaje claro. Devuelve [{ modulo (id del grupo), emoji, nombre, intro, atajos }].
 */
export function agruparAtajos(atajos = ATAJOS, grupos = GRUPOS) {
  const vistos = new Set();
  const porGrupo = new Map(grupos.map((g) => [g.id, []]));
  atajos.forEach((atajo, i) => {
    if (!texto(atajo?.id)) throw new Error(`El atajo ${i + 1} no tiene id`);
    if (vistos.has(atajo.id)) throw new Error(`Atajo repetido: "${atajo.id}"`);
    vistos.add(atajo.id);
    if (!texto(atajo.nombre)) throw new Error(`El atajo "${atajo.id}" no tiene nombre`);
    if (!porGrupo.has(atajo.grupo)) throw new Error(`El atajo "${atajo.id}" está en un grupo que no existe: ${atajo.grupo}`);
    const pasos = lista(atajo.pasos);
    const automatizaciones = lista(atajo.automatizaciones).filter((a) => a && texto(a.disparador));
    if (pasos.length === 0 && automatizaciones.length === 0) throw new Error(`El atajo "${atajo.id}" no tiene pasos`);
    porGrupo.get(atajo.grupo).push({
      ...atajo,
      emoji: texto(atajo.emoji) ? atajo.emoji : "⚡",
      para: texto(atajo.para) ? atajo.para : "",
      pasos,
      requisitos: lista(atajo.requisitos),
      automatizaciones,
      permisos: lista(atajo.permisos),
      prueba: atajo.prueba && texto(atajo.prueba.ruta) ? { metodo: atajo.prueba.metodo ?? "GET", ruta: atajo.prueba.ruta } : null,
    });
  });
  return grupos
    .map((g) => ({ modulo: g.id, emoji: g.emoji, nombre: g.nombre, intro: g.intro ?? "", atajos: porGrupo.get(g.id) }))
    .filter((g) => g.atajos.length > 0);
}

/** Las guías agrupadas (async por compatibilidad con quien ya la usaba así). */
export async function cargarAtajos() {
  return agruparAtajos();
}

/** Todos los atajos en una sola lista. */
export const todosLosAtajos = (grupos) => grupos.flatMap((g) => g.atajos);

/** { hechos, total } según perfil.ajustes.atajos ({ id: true }). Ids que ya no existen no cuentan. */
export function contarHechos(grupos, marcados) {
  const atajos = todosLosAtajos(grupos ?? []);
  const hechos = atajos.filter((a) => marcados?.[a.id] === true).length;
  return { hechos, total: atajos.length };
}

/** Copia de perfil.ajustes.atajos con `id` marcado o desmarcado (solo guarda los true). */
export function marcarAtajo(marcados, id, hecho) {
  const nuevo = {};
  for (const [clave, valor] of Object.entries(marcados ?? {})) if (valor === true) nuevo[clave] = true;
  if (hecho) nuevo[id] = true;
  else delete nuevo[id];
  return nuevo;
}

// ── Llaves (api_tokens) ──────────────────────────────────────────────────

/**
 * Qué mostrar en "Tu llave". El token solo existe en `recien` (memoria de la página, justo después de crearlo):
 * la base guarda solo su hash y GET tokens nunca lo devuelve, así que al recargar ya no se ve.
 */
export function estadoLlave({ tokens = [], recien = null } = {}) {
  const activas = tokens.filter((t) => !t.revocado);
  if (recien?.token) return { vista: "nueva", token: recien.token, activas };
  if (activas.length > 0) return { vista: "activas", token: null, activas, usada: activas.some((t) => t.ultimo_uso) };
  return { vista: "crear", token: null, activas };
}

/**
 * "Probar conexión": ¿alguna llave activa se usó desde que empezó la prueba?
 * `antes`: { id: ultimo_uso } al tocar Probar. `desde`: ms de ese momento.
 * La API anota el uso como máximo una vez por minuto, así que un uso de los últimos 2 min también cuenta.
 */
export function conexionProbada(filas, antes, desde, margen = 120_000) {
  return (
    (filas ?? []).find((fila) => {
      if (fila.revocado || !fila.ultimo_uso) return false;
      if (fila.ultimo_uso !== (antes?.[fila.id] ?? null)) return true;
      return Date.parse(fila.ultimo_uso) >= desde - margen;
    }) ?? null
  );
}

/** "finanzas/menu" → "finanzas". */
export const moduloDeRuta = (ruta) => String(ruta ?? "").split("/").filter(Boolean)[0] ?? "";

/**
 * "Probar" de un atajo: entre las llamadas nuevas de log_api, ¿llegó alguna a la parte de la API de su prueba?
 * Devuelve { ok: fila } si alguna salió bien, { error: fila } si solo hubo errores, o null si no llegó nada.
 */
export function pruebaRecibida(logs, prueba) {
  const modulo = moduloDeRuta(prueba?.ruta);
  if (!modulo) return null;
  const suyas = (logs ?? []).filter((l) => moduloDeRuta(l.ruta) === modulo);
  const buena = suyas.find((l) => Number(l.estado) < 400);
  if (buena) return { ok: buena };
  return suyas.length ? { error: suyas[suyas.length - 1] } : null;
}

// ── Textos ───────────────────────────────────────────────────────────────

/** Dirección de Goat para el atajo "⚙️ Goat": el origen, sin barra al final ni /api/v1. */
export const urlBase = (origen) => String(origen ?? "").replace(/\/+$/, "");

/** "ios" (iPhone o iPad), "android" u "otro". */
export function plataforma(agente = "", puntosTactiles = 0) {
  if (/iPhone|iPad|iPod/i.test(agente)) return "ios";
  if (/Macintosh/i.test(agente) && puntosTactiles > 1) return "ios"; // iPad que se presenta como Mac.
  if (/Android/i.test(agente)) return "android";
  return "otro";
}

const MINUTO = 60_000;
const formatoFecha = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" });

/** "3 oct" */
export function fechaCorta(iso) {
  const partes = formatoFecha.formatToParts(new Date(iso));
  const dia = partes.find((p) => p.type === "day")?.value ?? "";
  const mes = (partes.find((p) => p.type === "month")?.value ?? "").replace(".", "");
  return `${dia} ${mes}`.trim();
}

/** "hace un momento", "hace 5 min", "hace 3 h", "ayer", "hace 4 días" o "3 oct". */
export function tiempoRelativo(iso, ahora = new Date()) {
  if (!iso) return "nunca";
  const pasado = ahora.getTime() - Date.parse(iso);
  if (pasado < MINUTO) return "hace un momento";
  if (pasado < 60 * MINUTO) return `hace ${Math.floor(pasado / MINUTO)} min`;
  if (pasado < 24 * 60 * MINUTO) return `hace ${Math.floor(pasado / (60 * MINUTO))} h`;
  if (pasado < 48 * 60 * MINUTO) return "ayer";
  if (pasado < 30 * 24 * 60 * MINUTO) return `hace ${Math.floor(pasado / (24 * 60 * MINUTO))} días`;
  return fechaCorta(iso);
}

/** Una llave en una línea: "Creada 3 oct · usada hace 2 h". */
export function detalleLlave(llave, ahora = new Date()) {
  const uso = llave.ultimo_uso ? `usada ${tiempoRelativo(llave.ultimo_uso, ahora)}` : "sin usar todavía";
  return `Creada ${fechaCorta(llave.creado_en)} · ${uso}`;
}

/** Filas del paso "Listo": qué quedó y qué falta. */
export function resumenListo({ instalada, tokens = [], hechos = 0, total = 0 }) {
  const activas = tokens.filter((t) => !t.revocado);
  const conectada = activas.some((t) => t.ultimo_uso);
  return [
    {
      clave: "instalada",
      emoji: "📲",
      titulo: "Goat en tu inicio",
      detalle: instalada ? "Se abre como una app" : "Safari › Compartir › Agregar a inicio",
      listo: Boolean(instalada),
    },
    {
      clave: "llave",
      emoji: "🔑",
      titulo: "iPhone conectado",
      detalle: conectada ? "Tu llave ya funciona" : activas.length ? "Corre «🧪 Goat · Probar»" : "Falta crear tu llave",
      listo: conectada,
    },
    {
      clave: "atajos",
      emoji: "⚡",
      titulo: "Atajos",
      detalle: total ? `${hechos} de ${total} listos` : "Ninguno todavía",
      listo: total > 0 && hechos >= total,
    },
  ];
}
