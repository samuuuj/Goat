// Ejercicio y actividad: reglas puras (sin pantalla ni internet).
// Las usan ejercicio.html, la hoja Gym de Hoy y las rutas de /api/v1/ejercicio (principio 1: un solo lugar).
// Una sesión es una fila de gym_sesiones: { tipo, rutina, inicio, fin, duracion_min, distancia_km, pasos, en_curso, momento, fecha }.

import { HORA_CORTE, ZONA, diaLogico, diaYMes, horaBogota } from "../logica/dia.js";
import { formatoDuracion, formatoMiles } from "../logica/formato.js";
import { RUTINAS, TIPOS_EJERCICIO } from "../logica/catalogos.js";

const MINUTO = 60_000;
const HORA = 3_600_000;

export const MAXIMO_HORAS = 6;
export const MAXIMO_KM = 100;
export const MAXIMO_PASOS = 100_000;
export const MAXIMO_NOTAS = 500;
/** Lo mínimo de un bloque de la rutina que una sesión debe cubrir para marcarlo hecho. */
export const SOLAPE_MINIMO = 0.7;

export const TIPOS = new Map(TIPOS_EJERCICIO.map((t) => [t.valor, t]));

/** Tipos que suman a la meta semanal de entrenos (metas.gym_semana). Caminata y movilidad se cuentan aparte. */
export const TIPOS_META = new Set(["fuerza", "trote", "cardio", "deporte", "otro"]);

/** Tipos donde tiene sentido la distancia; el ritmo (min/km) solo en caminata y trote. */
export const TIPOS_CON_DISTANCIA = new Set(["caminata", "trote", "cardio"]);
export const TIPOS_CON_RITMO = new Set(["caminata", "trote"]);

/** Qué bloques de la rutina (rutina_bloques.tipo) puede cubrir cada tipo de sesión. */
const BLOQUES_COMPATIBLES = {
  fuerza: ["ejercicio"],
  cardio: ["ejercicio"],
  deporte: ["ejercicio"],
  caminata: ["caminar"],
  trote: ["ejercicio", "caminar"],
};

// ── Ayudas ───────────────────────────────────────────────────────────────

/** Milisegundos de un Date, un texto ISO o un número; null si no sirve. */
function aMs(valor) {
  if (valor == null || valor === "") return null;
  const t = valor instanceof Date ? valor.getTime() : typeof valor === "number" ? valor : Date.parse(String(valor));
  return Number.isFinite(t) ? t : null;
}

const iso = (ms) => new Date(ms).toISOString();
const dosDecimales = (n) => Math.round(n * 100) / 100;

/** Texto sin tildes, emojis ni mayúsculas ("🏋️ Tirón" → "tiron"). */
const normalizar = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim();

const formatoCalendario = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });
const formatoKmNumero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

// ── Fechas (YYYY-MM-DD) ──────────────────────────────────────────────────

const mediodia = (fecha) => new Date(`${fecha}T12:00:00Z`);

export function sumarDias(fecha, dias) {
  const d = mediodia(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Lunes = 1 … domingo = 7. */
export const diaSemana = (fecha) => ((mediodia(fecha).getUTCDay() + 6) % 7) + 1;

/** Lunes de la semana de una fecha. */
export const lunesDe = (fecha) => sumarDias(fecha, 1 - diaSemana(fecha));

/** Fecha de calendario en Bogotá. Salud cuenta los pasos de "hoy" desde las 00:00 (no desde las 04:00). */
export const fechaCalendario = (momento) => formatoCalendario.format(new Date(aMs(momento)));

/** Día lógico de una sesión: el de su inicio (o momento; si no, la columna fecha). */
export function fechaDe(sesion) {
  const t = aMs(sesion?.inicio) ?? aMs(sesion?.momento);
  return t != null ? diaLogico(new Date(t)) : (sesion?.fecha ?? null);
}

/** "7:05" o "07:05:00" → "07:05"; null si no es una hora. */
export function normalizarHora(texto) {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(texto ?? "").trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** Instante de una hora "HH:MM" de Bogotá (UTC−5 todo el año) en una fecha de calendario. */
const instante = (fechaCalendarioTexto, hhmm) => Date.parse(`${fechaCalendarioTexto}T${hhmm}:00-05:00`);

/**
 * Inicio y fin a partir del día lógico y dos horas "HH:MM".
 * Antes de las 04:00 la hora cae en el día siguiente del calendario (el día lógico no cambia);
 * si el fin queda antes del inicio, cruzó la medianoche. Devuelve { inicio: Date, fin: Date } o null.
 */
export function instantesDesdeHoras(fechaLogica, horaInicio, horaFin) {
  const hi = normalizarHora(horaInicio);
  const hf = normalizarHora(horaFin);
  if (!hi || !hf || !/^\d{4}-\d{2}-\d{2}$/.test(fechaLogica ?? "")) return null;
  const calendario = (hhmm) => (Number(hhmm.slice(0, 2)) < HORA_CORTE ? sumarDias(fechaLogica, 1) : fechaLogica);
  const inicio = instante(calendario(hi), hi);
  let fin = instante(calendario(hf), hf);
  if (fin <= inicio) fin += 24 * HORA;
  return { inicio: new Date(inicio), fin: new Date(fin) };
}

/**
 * Como instantesDesdeHoras, pero sin elegir día (hoja Gym de Hoy): el de hoy si ya pasó; si no, el de ayer.
 * Así "23:00–23:45" registrado a las 10:00 es lo de anoche.
 */
export function instantesRecientes(ahora, horaInicio, horaFin) {
  const hoy = diaLogico(new Date(aMs(ahora)));
  for (const fecha of [hoy, sumarDias(hoy, -1)]) {
    const r = instantesDesdeHoras(fecha, horaInicio, horaFin);
    if (!r) return null;
    if (r.fin.getTime() <= aMs(ahora) + 5 * MINUTO) return r;
  }
  return instantesDesdeHoras(hoy, horaInicio, horaFin);
}

/** Valores para el formulario: terminó ahora y empezó hace `minutos`. */
export function horarioSugerido(ahora, minutos = 60) {
  const fin = Math.floor(aMs(ahora) / MINUTO) * MINUTO;
  const inicio = fin - minutos * MINUTO;
  return { fecha: diaLogico(new Date(inicio)), inicio: horaBogota(new Date(inicio)), fin: horaBogota(new Date(fin)) };
}

// ── Una sesión ───────────────────────────────────────────────────────────

export const emojiTipo = (tipo) => TIPOS.get(tipo ?? "fuerza")?.emoji ?? "✨";
export const nombreTipo = (tipo) => TIPOS.get(tipo ?? "fuerza")?.texto ?? "Entreno";
export const nombreRutina = (valor) => RUTINAS.find((r) => r.valor === valor)?.texto ?? valor ?? "";

/** "Fuerza · Empuje" · "Caminata" */
export function tituloSesion(sesion) {
  const tipo = sesion.tipo ?? "fuerza";
  return tipo === "fuerza" && sesion.rutina ? `${nombreTipo(tipo)} · ${nombreRutina(sesion.rutina)}` : nombreTipo(tipo);
}

/** ¿Suma a la meta semanal? (Las filas viejas sin tipo eran de gym: sí.) */
export const cuentaParaMeta = (sesion) => TIPOS_META.has(sesion.tipo ?? "fuerza");

/** Minutos entre dos instantes (redondeados, mínimo 1); null si el fin no va después del inicio. */
export function minutosEntre(inicio, fin) {
  const a = aMs(inicio);
  const b = aMs(fin);
  if (a == null || b == null || b <= a) return null;
  return Math.max(1, Math.round((b - a) / MINUTO));
}

/**
 * Minutos de una sesión: de inicio a fin, o los guardados. En curso: lo que lleva hasta `ahora`
 * (sin `ahora`, null). Sin datos, null.
 */
export function duracion(sesion, ahora = null) {
  if (sesion.en_curso && !sesion.fin) {
    const a = aMs(sesion.inicio);
    return a == null || ahora == null ? null : Math.max(0, Math.floor((aMs(ahora) - a) / MINUTO));
  }
  const calculada = minutosEntre(sesion.inicio, sesion.fin);
  if (calculada != null) return calculada;
  const guardada = Number(sesion.duracion_min);
  return Number.isFinite(guardada) && guardada > 0 ? guardada : null;
}

/** "07:10–08:05" · "Desde 07:10" (sin fin) · "17:00" (registro viejo sin inicio). */
export function rangoHoras(sesion) {
  const a = aMs(sesion.inicio);
  const b = aMs(sesion.fin);
  if (a != null && b != null) return `${horaBogota(new Date(a))}–${horaBogota(new Date(b))}`;
  if (a != null) return `Desde ${horaBogota(new Date(a))}`;
  const m = aMs(sesion.momento);
  return m != null ? horaBogota(new Date(m)) : "";
}

/** Ritmo en minutos por km (6.5 = 6:30 /km); null si falta la distancia o el tiempo. */
export function ritmo(km, minutos) {
  const k = Number(km);
  const m = Number(minutos);
  if (!(k > 0) || !(m > 0)) return null;
  return m / k;
}

/** 6.5 → "6:30 /km" */
export function formatoRitmo(minPorKm) {
  if (minPorKm == null || !Number.isFinite(minPorKm)) return "";
  const total = Math.round(minPorKm * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")} /km`;
}

/** 3.2 → "3,2 km" */
export const formatoKm = (km) => `${formatoKmNumero.format(Number(km) || 0)} km`;

/** 309000 ms → "05:09" · 3909000 → "1:05:09" */
export function formatoCronometro(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Detalle de la fila del historial: "3,2 km · 6:30 /km", "Empuje" o "". */
export function detalleSesion(sesion) {
  const partes = [];
  const km = Number(sesion.distancia_km);
  if (km > 0) {
    partes.push(formatoKm(km));
    const r = TIPOS_CON_RITMO.has(sesion.tipo) ? ritmo(km, duracion(sesion)) : null;
    if (r) partes.push(formatoRitmo(r));
  }
  if (Number(sesion.pasos) > 0) partes.push(`${formatoMiles(Number(sesion.pasos))} pasos`);
  return partes.join(" · ");
}

// ── Lo que mandan los atajos (a veces texto con formato del iPhone) ─────

/** "🏋️ Fuerza", "fuerza", "FUERZA" → "fuerza"; null si no es un tipo. */
export function tipoDesdeTexto(texto) {
  const n = normalizar(texto);
  if (!n) return null;
  return TIPOS_EJERCICIO.find((t) => t.valor === n || normalizar(t.texto) === n)?.valor ?? null;
}

/** "Tirón", "tiron", "Full body" → valor de RUTINAS; null si no es una rutina. */
export function rutinaDesdeTexto(texto) {
  const n = normalizar(texto);
  if (!n) return null;
  return RUTINAS.find((r) => r.valor === n || normalizar(r.texto) === n)?.valor ?? null;
}

/** Entero de un número o texto: 8432, "8432", "8.432" (miles), "8432.0", "1.234,5". null si no sirve. */
export function enteroFlexible(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? Math.round(valor) : null;
  const t = String(valor ?? "").trim().replace(/\s/g, "");
  if (!t) return null;
  let n;
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) n = Number(t.replace(/[.,]/g, ""));
  else n = decimalFlexible(t);
  return n == null || !Number.isFinite(n) ? null : Math.round(n);
}

/** Decimal de un número o texto: 3.2, "3,2", "1.234,5". null si no sirve. */
export function decimalFlexible(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  let t = String(valor ?? "").trim().replace(/\s/g, "");
  if (!t) return null;
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(",", ".");
  const n = Number(t);
  return /^-?\d*\.?\d+$/.test(t) && Number.isFinite(n) ? n : null;
}

// ── Validar y armar filas (web, hoja Gym de Hoy y API) ───────────────────

/** Rutina válida para el tipo: solo "fuerza" lleva rutina. Devuelve { rutina } o { error }. */
function revisarRutina(tipo, rutina) {
  if (tipo !== "fuerza" || rutina == null || rutina === "") return { rutina: null };
  const valor = rutinaDesdeTexto(rutina);
  return valor ? { rutina: valor } : { error: "⚠️ Revisa la rutina" };
}

/** Distancia, pasos y notas opcionales. Devuelve { extra } o { error }. */
function revisarExtra(tipo, datos) {
  const extra = {};
  if (datos.distancia_km != null && datos.distancia_km !== "") {
    const km = decimalFlexible(datos.distancia_km);
    if (km == null || km < 0 || km > MAXIMO_KM) return { error: "⚠️ Revisa la distancia" };
    extra.distancia_km = TIPOS_CON_DISTANCIA.has(tipo) && km > 0 ? dosDecimales(km) : null;
  }
  if (datos.pasos != null && datos.pasos !== "") {
    const pasos = enteroFlexible(datos.pasos);
    if (pasos == null || pasos < 0 || pasos > MAXIMO_PASOS) return { error: "⚠️ Revisa los pasos" };
    extra.pasos = pasos;
  }
  if (datos.notas != null) {
    const notas = String(datos.notas).trim();
    if (notas.length > MAXIMO_NOTAS) return { error: "⚠️ Las notas son muy largas" };
    extra.notas = notas || null;
  }
  return { extra };
}

/**
 * Revisa una sesión ya terminada ({ tipo, inicio, fin, rutina?, distancia_km?, pasos?, notas? }).
 * Devuelve { fila } lista para gym_sesiones, o { error: "⚠️ …" } para mostrar tal cual.
 */
export function validarSesion(datos, ahora = new Date()) {
  const tipo = TIPOS.has(datos?.tipo) ? datos.tipo : tipoDesdeTexto(datos?.tipo);
  if (!tipo) return { error: "⚠️ Elige el tipo" };
  const inicio = aMs(datos.inicio);
  const fin = aMs(datos.fin);
  if (inicio == null) return { error: "⚠️ Falta la hora de inicio" };
  if (fin == null) return { error: "⚠️ Falta la hora de fin" };
  if (fin <= inicio) return { error: "⚠️ Termina antes de empezar" };
  if (fin - inicio > MAXIMO_HORAS * HORA) return { error: "⚠️ Máximo 6 horas" };
  if (fin > aMs(ahora) + 5 * MINUTO) return { error: "⚠️ Termina en el futuro" };

  const r = revisarRutina(tipo, datos.rutina);
  if (r.error) return r;
  const e = revisarExtra(tipo, datos);
  if (e.error) return e;

  return {
    fila: {
      tipo,
      rutina: r.rutina,
      inicio: iso(inicio),
      fin: iso(fin),
      momento: iso(inicio),
      duracion_min: minutosEntre(inicio, fin),
      en_curso: false,
      ...e.extra,
    },
  };
}

/** Fila para empezar un entreno con cronómetro ({ tipo, rutina? }). Devuelve { fila } o { error }. */
export function nuevaEnCurso(datos, ahora = new Date()) {
  const tipo = TIPOS.has(datos?.tipo) ? datos.tipo : tipoDesdeTexto(datos?.tipo);
  if (!tipo) return { error: "⚠️ Elige el tipo" };
  const r = revisarRutina(tipo, datos.rutina);
  if (r.error) return r;
  const inicio = aMs(datos.inicio) ?? aMs(ahora);
  if (inicio > aMs(ahora) + 5 * MINUTO) return { error: "⚠️ Empieza en el futuro" };
  return {
    fila: { tipo, rutina: r.rutina, inicio: iso(inicio), momento: iso(inicio), fin: null, duracion_min: null, en_curso: true },
  };
}

/**
 * Cambios para terminar la sesión en curso a la hora `fin` (+ distancia, pasos o notas).
 * Si pasaron más de 6 h, se olvidó terminarla: queda sin hora de fin para corregirla a mano (nunca se inventa).
 * Devuelve { cambios, olvidada } o { error }.
 */
export function terminar(sesion, fin, datos = {}) {
  const a = aMs(sesion?.inicio);
  const b = aMs(fin);
  if (a == null || b == null) return { error: "⚠️ Falta la hora" };
  if (b <= a) return { error: "⚠️ Termina antes de empezar" };
  const e = revisarExtra(sesion.tipo ?? "fuerza", datos);
  if (e.error) return e;
  if (b - a > MAXIMO_HORAS * HORA) {
    return { cambios: { en_curso: false, fin: null, duracion_min: null, ...e.extra }, olvidada: true };
  }
  return { cambios: { en_curso: false, fin: iso(b), duracion_min: minutosEntre(a, b), ...e.extra }, olvidada: false };
}

/** La sesión en curso más reciente: { sesion, transcurridoMs, olvidada } o null. Olvidada = más de 6 h. */
export function enCurso(sesiones, ahora = new Date()) {
  const abiertas = sesiones
    .filter((s) => s.en_curso && !s.fin && aMs(s.inicio) != null)
    .sort((x, y) => aMs(y.inicio) - aMs(x.inicio));
  const sesion = abiertas[0];
  if (!sesion) return null;
  const transcurrido = aMs(ahora) - aMs(sesion.inicio);
  return { sesion, transcurridoMs: Math.max(0, transcurrido), olvidada: transcurrido > MAXIMO_HORAS * HORA };
}

/** "✅ 55 min" · "✅ 45 min · 3,2 km" (sin montos: va a notificaciones del iPhone). */
export function mensajeGuardada(sesion) {
  const minutos = duracion(sesion);
  const partes = [minutos ? formatoDuracion(minutos) : nombreTipo(sesion.tipo)];
  if (Number(sesion.distancia_km) > 0) partes.push(formatoKm(sesion.distancia_km));
  return `✅ ${partes.join(" · ")}`;
}

// ── Semana e historial ───────────────────────────────────────────────────

function totales(sesiones) {
  let minutos = 0;
  let km = 0;
  let pasos = 0;
  for (const s of sesiones) {
    if (!s.en_curso) minutos += duracion(s) ?? 0;
    km += Number(s.distancia_km) || 0;
    pasos += Number(s.pasos) || 0;
  }
  return { total: sesiones.length, minutos, km: dosDecimales(km), pasos };
}

/** "4 sesiones · 3h 20 · 6,2 km" */
export function textoTotales({ total, minutos, km }) {
  const partes = [`${total} ${total === 1 ? "sesión" : "sesiones"}`];
  if (minutos > 0) partes.push(formatoDuracion(minutos));
  if (km > 0) partes.push(formatoKm(km));
  return partes.join(" · ");
}

/**
 * La semana (lunes a domingo, días lógicos) que empieza en `lunes`.
 * Entrenos contra la meta `metas.gym_semana`, minutos, km, sesiones por tipo, minutos por día
 * y pasos promedio de `actividad` (filas de ejercicio_actividad).
 */
export function resumenSemana(sesiones, metas, lunes, actividad = []) {
  const domingo = sumarDias(lunes, 6);
  const enSemana = sesiones.filter((s) => {
    const f = fechaDe(s);
    return f && f >= lunes && f <= domingo;
  });
  const meta = Number(metas?.gym_semana) > 0 ? Number(metas.gym_semana) : 4;
  const entrenos = enSemana.filter(cuentaParaMeta).length;

  const porTipo = TIPOS_EJERCICIO.map((t) => {
    const delTipo = enSemana.filter((s) => (s.tipo ?? "fuerza") === t.valor);
    return { tipo: t.valor, texto: t.texto, emoji: t.emoji, ...totales(delTipo) };
  }).filter((t) => t.total > 0);

  const dias = Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDias(lunes, i);
    const delDia = enSemana.filter((s) => fechaDe(s) === fecha);
    return { fecha, ...totales(delDia) };
  });

  const conPasos = actividad.filter((a) => a.fecha >= lunes && a.fecha <= domingo && Number(a.pasos) >= 0 && a.pasos != null);
  const pasosTotal = conPasos.reduce((suma, a) => suma + Number(a.pasos), 0);
  const kmCaminando = conPasos.reduce((suma, a) => suma + (Number(a.distancia_km) || 0), 0);

  const { minutos, km } = totales(enSemana);
  return {
    lunes,
    domingo,
    meta,
    entrenos,
    sesiones: enSemana.length,
    cumplimiento: entrenos / meta,
    faltan: Math.max(0, meta - entrenos),
    minutos,
    km,
    porTipo,
    dias,
    pasosPromedio: conPasos.length ? Math.round(pasosTotal / conPasos.length) : null,
    diasConPasos: conPasos.length,
    kmCaminando: dosDecimales(kmCaminando),
  };
}

/** Frase corta de la semana. Nunca regaña. */
export function fraseSemana(r) {
  if (r.faltan === 0) return r.entrenos > r.meta ? `Semana cumplida y ${r.entrenos - r.meta} de más 🏋️` : "Semana cumplida 🏋️";
  if (r.entrenos === 0) return `Tu meta: ${r.meta} entrenos. Uno de 30 min ya cuenta.`;
  return `Te ${r.faltan === 1 ? "falta 1 entreno" : `faltan ${r.faltan} entrenos`} esta semana.`;
}

/**
 * Historial agrupado, lo más reciente primero.
 * "semana": un grupo por semana (clave = lunes). "tipo": un grupo por tipo, en el orden del catálogo.
 * Cada grupo: { clave, sesiones, total, minutos, km, pasos }.
 */
export function agrupar(sesiones, modo = "semana") {
  const cuando = (s) => aMs(s.inicio) ?? aMs(s.momento) ?? 0;
  const ordenadas = sesiones.filter((s) => fechaDe(s)).sort((x, y) => cuando(y) - cuando(x));
  const grupos = new Map();
  for (const s of ordenadas) {
    const clave = modo === "tipo" ? (s.tipo ?? "fuerza") : lunesDe(fechaDe(s));
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(s);
  }
  const lista = [...grupos].map(([clave, items]) => ({ clave, sesiones: items, ...totales(items) }));
  if (modo === "tipo") {
    const orden = TIPOS_EJERCICIO.map((t) => t.valor);
    return lista.sort((x, y) => orden.indexOf(x.clave) - orden.indexOf(y.clave));
  }
  return lista.sort((x, y) => (x.clave < y.clave ? 1 : -1));
}

/** "Esta semana" · "Semana pasada" · "Semana del 29 sep" */
export function etiquetaSemana(lunes, lunesActual) {
  if (lunes === lunesActual) return "Esta semana";
  if (lunes === sumarDias(lunesActual, -7)) return "Semana pasada";
  return `Semana del ${diaYMes(lunes)}`;
}

/** Une lo que llegó de Supabase con lo guardado en este dispositivo sin subir todavía (gana lo local). */
export function combinar(servidor, pendientes = []) {
  const clave = (s) => s.id_cliente ?? s.id;
  const mapa = new Map(servidor.map((s) => [clave(s), s]));
  for (const p of pendientes) {
    const k = clave(p.fila);
    if (p.borrar) mapa.delete(k);
    else mapa.set(k, { ...mapa.get(k), ...p.fila, pendiente: true });
  }
  return [...mapa.values()];
}

// ── Rutina (lo usa la integración para marcar bloques solos) ─────────────

/** Inicio y fin (ms) de un bloque: { inicio, fin } ISO, o { hora_inicio, duracion_min, fecha? } de la plantilla. */
function intervaloBloque(bloque, fechaPorDefecto) {
  const a = aMs(bloque.inicio);
  const b = aMs(bloque.fin);
  if (a != null && b != null) return b > a ? { inicio: a, fin: b } : null;
  const hora = normalizarHora(bloque.hora_inicio);
  const minutos = Number(bloque.duracion_min);
  const fecha = bloque.fecha ?? fechaPorDefecto;
  if (!hora || !(minutos > 0) || !fecha) return null;
  if (Array.isArray(bloque.dias) && bloque.dias.length && !bloque.dias.map(Number).includes(diaSemana(fecha))) return null;
  const desde = instantesDesdeHoras(fecha, hora, hora)?.inicio.getTime();
  return desde == null ? null : { inicio: desde, fin: desde + minutos * MINUTO };
}

/**
 * ¿Esta sesión terminada cubre el bloque de la rutina? Tipo compatible (fuerza/cardio/deporte ↔ ejercicio,
 * caminata ↔ caminar, trote ↔ ejercicio o caminar) y al menos 70% del bloque dentro de la sesión.
 * `bloque`: { tipo, inicio, fin } (ISO) o { tipo, hora_inicio, duracion_min, dias?, fecha? } (plantilla; sin fecha usa la de la sesión).
 */
export function cubreBloque(sesion, bloque) {
  if (!sesion || !bloque) return false;
  if (!(BLOQUES_COMPATIBLES[sesion.tipo ?? "fuerza"] ?? []).includes(bloque.tipo)) return false;
  const a = aMs(sesion.inicio);
  const b = aMs(sesion.fin);
  if (a == null || b == null || b <= a) return false;
  const intervalo = intervaloBloque(bloque, fechaDe(sesion));
  if (!intervalo) return false;
  const solape = Math.max(0, Math.min(b, intervalo.fin) - Math.max(a, intervalo.inicio));
  return solape / (intervalo.fin - intervalo.inicio) >= SOLAPE_MINIMO;
}
