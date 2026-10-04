// Centro de notificaciones: funciones puras (sin pantalla ni internet) que usan el panel, las reglas y la API.
// Agrupa por sección de tiempo (Hoy · Esta semana · Antes) y por módulo (las "pilas" estilo iOS),
// escribe el tiempo relativo ("hace 5 min") y revisa que una notificación no lleve montos (D-020).

import { ZONA, diaLogico } from "../logica/dia.js";
import { sumarDias } from "../logica/calculo.js";

// ── Módulos ──────────────────────────────────────────────────────────────

/** Los mismos módulos que acepta la tabla `notificaciones` (schema.sql) y api/_lib/notificar.js. */
export const MODULOS = {
  finanzas: { nombre: "Dinero", emoji: "💸", url: "finanzas.html" },
  comidas: { nombre: "Comidas", emoji: "🍽️", url: "index.html#pendientes" },
  desbloqueo: { nombre: "Tu tiempo", emoji: "🔓", url: "desbloqueo.html" },
  sueno: { nombre: "Sueño", emoji: "🌙", url: "sueno.html" },
  ejercicio: { nombre: "Movimiento", emoji: "🏃", url: "ejercicio.html" },
  universidad: { nombre: "Universidad", emoji: "📚", url: "rutina.html" },
  ocio: { nombre: "Ocio", emoji: "🎮", url: "desbloqueo.html" },
  rutina: { nombre: "Tu día", emoji: "🗓️", url: "rutina.html" },
  puntuacion: { nombre: "Puntaje", emoji: "⭐", url: "index.html#anillos" },
  diario: { nombre: "Hoy", emoji: "☀️", url: "index.html" },
  notificaciones: { nombre: "Goat", emoji: "🔔", url: "index.html" },
  conectar: { nombre: "iPhone", emoji: "📲", url: "conectar.html" },
};

export const nombreModulo = (modulo) => MODULOS[modulo]?.nombre ?? "Goat";

// ── Validación (igual que la tabla: largos, url interna, sin montos) ─────

/** true si el texto parece llevar dinero: "$25.000", "25.000", "COP". Los conteos ("7 días", "100") sí se permiten. */
export function tieneMontos(texto) {
  return /\$\s?\d|\d{1,3}(?:[.,]\d{3})+|\bcop\b/i.test(String(texto ?? ""));
}

/** Solo rutas de la propia web ("finanzas.html", "index.html#anillos"): nada de "https:", "javascript:" ni "//". */
export function urlInterna(url) {
  if (url == null || url === "") return true;
  return typeof url === "string" && url.length <= 200 && !/^([a-zA-Z][a-zA-Z0-9+.-]*:|\/\/|\\)/.test(url.trim());
}

/**
 * Revisa y limpia una notificación antes de guardarla. Lanza Error con el motivo si no sirve.
 * Devuelve { modulo, emoji, titulo, cuerpo, url, clave }.
 */
export function validarNotificacion({ modulo, emoji, titulo, cuerpo = null, url = null, clave = null } = {}) {
  if (!MODULOS[modulo]) throw new Error(`Módulo de notificación inválido: ${modulo}`);
  const limpio = (t) => (typeof t === "string" ? t.trim() : t == null ? "" : String(t).trim());
  const fila = {
    modulo,
    emoji: limpio(emoji) || MODULOS[modulo].emoji,
    titulo: limpio(titulo),
    cuerpo: limpio(cuerpo) || null,
    url: limpio(url) || null,
    clave: limpio(clave) || null,
  };
  if ([...fila.emoji].length > 8) throw new Error("Emoji demasiado largo");
  if (!fila.titulo || fila.titulo.length > 60) throw new Error("El título va de 1 a 60 caracteres");
  if (fila.cuerpo && fila.cuerpo.length > 160) throw new Error("El texto va hasta 160 caracteres");
  if (fila.clave && fila.clave.length > 80) throw new Error("La clave va hasta 80 caracteres");
  if (!urlInterna(fila.url)) throw new Error("La url de una notificación debe ser interna");
  if (tieneMontos(`${fila.titulo} ${fila.cuerpo ?? ""}`)) throw new Error("Las notificaciones no llevan montos (D-020)");
  return fila;
}

// ── Estado ───────────────────────────────────────────────────────────────

/** Las que se ven en el panel: no descartadas. */
export const visibles = (lista) => lista.filter((n) => !n.descartada_en);

/** Lo que muestra el contador de la campana: no leídas y no descartadas. */
export const contarNoLeidas = (lista) => lista.filter((n) => !n.descartada_en && !n.leida_en).length;

/** Texto del contador: "" en 0 (desaparece), "99+" si son muchas. */
export const textoContador = (n) => (n <= 0 ? "" : n > 99 ? "99+" : String(n));

// ── Tiempo ───────────────────────────────────────────────────────────────

const MINUTO = 60_000;
const HORA = 60 * MINUTO;

const formatoSemana = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, weekday: "long" });
const formatoCorto = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, day: "numeric", month: "short" });
const formatoLargo = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, weekday: "long", day: "numeric", month: "long" });

const fechaDe = (n) => n.fecha ?? diaLogico(new Date(n.momento));

/**
 * "ahora" · "hace 5 min" · "hace 3 h" · "ayer" · "martes" · "12 sep".
 * Los días son lógicos (terminan a las 04:00), como el resto de la app.
 */
export function tiempoRelativo(momento, ahora = new Date()) {
  const cuando = new Date(momento);
  const diferencia = Math.max(0, ahora.getTime() - cuando.getTime());
  if (diferencia < MINUTO) return "ahora";
  if (diferencia < HORA) return `hace ${Math.floor(diferencia / MINUTO)} min`;

  const hoy = diaLogico(ahora);
  const dia = diaLogico(cuando);
  const horas = Math.floor(diferencia / HORA);
  if (horas < 24 && (dia === hoy || horas < 6)) return `hace ${horas} h`;
  if (dia === sumarDias(hoy, -1)) return "ayer";
  if (dia > sumarDias(hoy, -7)) return formatoSemana.format(cuando);
  const partes = formatoCorto.formatToParts(cuando);
  const parte = (tipo) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${parte("day")} ${parte("month").replace(".", "")}`;
}

/** "viernes, 3 de octubre" (como la pantalla bloqueada). */
export function fechaLarga(ahora = new Date()) {
  return formatoLargo.format(ahora);
}

// ── Agrupación ───────────────────────────────────────────────────────────

export const SECCIONES = [
  { clave: "hoy", titulo: "Hoy" },
  { clave: "semana", titulo: "Esta semana" },
  { clave: "antes", titulo: "Antes" },
];

/** "hoy" (día lógico de hoy) · "semana" (los 6 días anteriores) · "antes". */
export function seccionDe(fecha, hoy) {
  if (fecha >= hoy) return "hoy";
  if (fecha > sumarDias(hoy, -7)) return "semana";
  return "antes";
}

const masReciente = (a, b) => Date.parse(b.momento) - Date.parse(a.momento);

/**
 * Lista → secciones con pilas por módulo, lo más reciente arriba. Las descartadas no salen.
 * [{ clave, titulo, pilas: [{ id, modulo, nombre, items: [...], noLeidas }] }]
 */
export function agrupar(lista, ahora = new Date()) {
  const hoy = diaLogico(ahora);
  const porSeccion = new Map(SECCIONES.map((s) => [s.clave, new Map()]));

  for (const n of [...visibles(lista)].sort(masReciente)) {
    const seccion = seccionDe(fechaDe(n), hoy);
    const pilas = porSeccion.get(seccion);
    if (!pilas.has(n.modulo)) {
      pilas.set(n.modulo, { id: `${seccion}:${n.modulo}`, modulo: n.modulo, nombre: nombreModulo(n.modulo), items: [], noLeidas: 0 });
    }
    const pila = pilas.get(n.modulo);
    pila.items.push(n);
    if (!n.leida_en) pila.noLeidas++;
  }

  return SECCIONES.map((s) => ({ ...s, pilas: [...porSeccion.get(s.clave).values()] })).filter((s) => s.pilas.length > 0);
}
