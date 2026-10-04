// Sueño: noches, índice y regularidad. Funciones puras (sin pantalla ni internet).
// Las usan sueno.html, mini.js y la API (api/_rutas/sueno.js): las reglas viven en un solo lugar.
//
// Sin Apple Watch, la noche se arma con lo que el iPhone sí deja ver (.claude/objetivos/C-sueno.md):
//   · eventos "me acuesto" (Hora de dormir comienza, Modo Sueño, cargador) y "desperté" (Despertar, alarma);
//   · muestras "En cama" de Salud (el iPhone las anota con el horario de sueño, según cuándo dejas el celular).
// Una noche pertenece al día lógico en que te acostaste (D-014): acostarte a la 01:10 es la noche de "ayer".

import { HORA_CORTE, diaLogico, nombreDia } from "../logica/dia.js";
import { sumarDias } from "../logica/calculo.js";

const MIN = 60_000;
const HORA = 3_600_000;
/** Bogotá no cambia de hora: siempre UTC−5. */
const DESFASE_MIN = 5 * 60;

// ── Catálogos y metas ────────────────────────────────────────────────────

export const TIPOS_EVENTO = ["acostarse", "despertar"];
export const FUENTES = ["hora_dormir", "modo_sueno", "cargador", "alarma", "despertar", "manual"];
export const TIPOS_MUESTRA = ["en_cama", "dormido", "despierto"];

export const NOMBRE_FUENTE = {
  hora_dormir: "Hora de dormir",
  modo_sueno: "Modo Sueño",
  cargador: "Cargador",
  alarma: "Alarma",
  despertar: "Despertar",
  manual: "A mano",
  salud: "Salud · En cama",
};

/** Metas de arranque. Se cambian en perfil.metas (sueno_horas, hora_despertar, hora_acostarse). */
export const METAS_SUENO = { sueno_horas: 7.5, hora_despertar: "06:00", hora_acostarse: "22:30" };

/** Reglas para armar una noche (ver construirNoches). En minutos salvo que diga otra cosa. */
export const REGLAS = {
  /** Dos ratos "En cama" separados por menos de 3 h son la misma noche (te levantaste un rato). */
  huecoMax: 180,
  /** Menos de 1 h en cama no es una noche. */
  bloqueMin: 60,
  /** Un "me acuesto" hasta 30 min después del inicio de "En cama" todavía cuenta como "antes". */
  tolerancia: 30,
  /** Si el último "me acuesto" quedó más de 45 min antes de "En cama", seguiste con el celular: manda "En cama". */
  celularMax: 45,
  /** "En cama" que empieza hasta 8 h después de un "me acuesto" es esa misma noche. */
  enlace: 8 * 60,
  /** Un "desperté" a menos de 30 min de acostarte no cuenta. */
  despertarMin: 30,
  /** Una noche dura como mucho 16 h. */
  nocheMax: 16 * 60,
  /** El cargador solo cuenta como "me acuesto" de 21:00 a 03:00. */
  cargadorDesde: 21,
  cargadorHasta: 3,
};

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function partesHora(texto) {
  const m = HHMM.exec(String(texto ?? "").trim());
  return m ? [Number(m[1]), Number(m[2])] : null;
}

const dosDigitos = (n) => String(n).padStart(2, "0");

/** Lee las metas de sueño guardadas en perfil.metas; lo que falte o no sirva toma el valor de arranque. */
export function leerMetasSueno(guardadas) {
  const fuente = typeof guardadas === "object" && guardadas !== null ? guardadas : {};
  const horas = Number(fuente.sueno_horas);
  const hora = (clave) => {
    const p = partesHora(fuente[clave]);
    return p ? `${dosDigitos(p[0])}:${dosDigitos(p[1])}` : METAS_SUENO[clave];
  };
  return {
    sueno_horas: Number.isFinite(horas) && horas >= 3 && horas <= 14 ? horas : METAS_SUENO.sueno_horas,
    hora_despertar: hora("hora_despertar"),
    hora_acostarse: hora("hora_acostarse"),
  };
}

// ── Horas de Bogotá ──────────────────────────────────────────────────────

/** Minuto del día en Bogotá (0–1439) de un instante en ms. */
function minutoDia(t) {
  return (((Math.floor(t / MIN) - DESFASE_MIN) % 1440) + 1440) % 1440;
}

/** Fecha de calendario en Bogotá (YYYY-MM-DD), sin el corte de las 04:00. */
function fechaCalendario(t) {
  return diaLogico(new Date(t + HORA_CORTE * HORA));
}

/** Instante (ms) de una hora de Bogotá en una fecha de calendario. */
function instante(fecha, [h, m]) {
  return Date.parse(`${fecha}T${dosDigitos(h)}:${dosDigitos(m)}:00-05:00`);
}

/** Minutos desde la hora `pivote` (para promediar horas que cruzan la medianoche: con pivote 12, la 00:30 va después de las 23:40). */
function minutosDesde(t, pivote) {
  return (minutoDia(t) - pivote * 60 + 1440) % 1440;
}

function minutosDeHora(hora, pivote) {
  const [h, m] = partesHora(hora) ?? [0, 0];
  return (h * 60 + m - pivote * 60 + 1440) % 1440;
}

/** "23:42" a partir de minutos contados desde el pivote. */
function aHora(minutos, pivote = 0) {
  const total = (((Math.round(minutos) + pivote * 60) % 1440) + 1440) % 1440;
  return `${dosDigitos(Math.floor(total / 60))}:${dosDigitos(total % 60)}`;
}

/** "23:42" de un momento (ISO, Date o ms) en Bogotá. */
export function horaDe(momento) {
  const t = momento instanceof Date ? momento.getTime() : typeof momento === "number" ? momento : Date.parse(momento);
  return Number.isFinite(t) ? aHora(minutoDia(t)) : "";
}

/** "7 h 10" · "7 h" · "45 min" (sirve en la API: no es dinero). */
export function duracionCorta(minutos) {
  if (minutos === null || minutos === undefined || !Number.isFinite(minutos)) return "";
  const total = Math.max(0, Math.round(minutos));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${dosDigitos(m)}`;
}

/** ¿El cargador a esta hora cuenta como "me acuesto"? (21:00 a 03:00 en Bogotá). */
export function cuentaCargador(momento) {
  const hora = minutoDia(new Date(momento).getTime()) / 60;
  return hora >= REGLAS.cargadorDesde || hora < REGLAS.cargadorHasta;
}

/**
 * Hora escrita a mano ("23:40") → el momento más reciente que ya pasó con esa hora.
 * A las 07:00, "23:40" es ayer y "01:10" es hoy. Devuelve { momento, cuando: "hoy" | "ayer" } o null.
 */
export function momentoDesdeHora(hora, ahora = new Date()) {
  const p = partesHora(hora);
  if (!p) return null;
  const hoy = fechaCalendario(ahora.getTime());
  let t = instante(hoy, p);
  let cuando = "hoy";
  if (t > ahora.getTime() + MIN) {
    t = instante(sumarDias(hoy, -1), p);
    cuando = "ayer";
  }
  return { momento: new Date(t), cuando };
}

// ── Fechas que mandan los Atajos ─────────────────────────────────────────

const MESES = {
  ene: 1, enero: 1, jan: 1, january: 1,
  feb: 2, febrero: 2, february: 2,
  mar: 3, marzo: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6, june: 6,
  jul: 7, julio: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  sep: 9, sept: 9, septiembre: 9, setiembre: 9, september: 9,
  oct: 10, octubre: 10, october: 10,
  nov: 11, noviembre: 11, november: 11,
  dic: 12, diciembre: 12, dec: 12, december: 12,
};

const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[t ](\d{1,2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?)?\s*(z|[+-]\d{2}(?::?\d{2})?)?$/;
const MERIDIANO = String.raw`(?:\s*([ap])\.?\s?m\.?)?`;
// "2 oct 2026, 23:40" · "2 de octubre de 2026, 11:40 p. m." · "2 oct. 2026 a las 23:40"
const TEXTO_ES = new RegExp(
  String.raw`^(\d{1,2})(?:\s+de)?[\s\-/]*([a-z]+)\.?(?:\s+de)?[\s\-/,]*(\d{4})(?:,?\s*(?:a las|at)?\s*)(\d{1,2}):(\d{2})(?::(\d{2}))?${MERIDIANO}$`,
);
// "Oct 2, 2026 at 11:40 PM"
const TEXTO_EN = new RegExp(String.raw`^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})(?:,?\s*(?:at)?\s*)(\d{1,2}):(\d{2})(?::(\d{2}))?${MERIDIANO}$`);
// "02/10/2026 23:40" (día/mes/año, como en Colombia)
const NUMERICA = new RegExp(String.raw`^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4}),?\s*(?:a las\s*)?(\d{1,2}):(\d{2})(?::(\d{2}))?${MERIDIANO}$`);

/** Fecha y hora de Bogotá → Date (null si no existe). */
function deBogota(anio, mes, dia, hora, minuto, segundo = 0, meridiano = null) {
  let h = hora;
  if (meridiano) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (meridiano === "p" ? 12 : 0);
  }
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || h > 23 || minuto > 59 || segundo > 59) return null;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia, h, minuto, segundo) + DESFASE_MIN * MIN);
  // 31 de febrero no existe: Date lo pasaría a marzo.
  if (new Date(fecha.getTime() - DESFASE_MIN * MIN).getUTCDate() !== dia) return null;
  return fecha;
}

/**
 * Lee una fecha como la mandan los Atajos y la devuelve como Date (o null).
 * Mejor: "Formatear fecha › ISO 8601" (2026-10-02T23:40:00-05:00). También acepta la fecha sin formatear
 * en español o inglés ("2 oct 2026, 11:40 p. m.", "Oct 2, 2026 at 11:40 PM", "02/10/2026 23:40").
 * Sin zona horaria se entiende hora de Bogotá.
 */
export function leerFecha(valor) {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor === "number") return Number.isFinite(valor) ? new Date(valor < 1e12 ? valor * 1000 : valor) : null;
  if (typeof valor !== "string") return null;
  const texto = valor.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  if (!texto || texto.length > 60) return null;

  let m = ISO.exec(texto);
  if (m) {
    const [, a, mes, d, h = "0", mi = "0", s = "0", zona] = m;
    if (!zona) return deBogota(+a, +mes, +d, +h, +mi, +s);
    const z = zona === "z" ? "+00:00" : zona.length === 3 ? `${zona}:00` : zona.includes(":") ? zona : `${zona.slice(0, 3)}:${zona.slice(3)}`;
    const t = Date.parse(`${a}-${mes}-${d}T${dosDigitos(+h)}:${mi}:${dosDigitos(+s)}${z}`);
    return Number.isNaN(t) ? null : new Date(t);
  }
  m = TEXTO_ES.exec(texto);
  if (m && MESES[m[2]]) return deBogota(+m[3], MESES[m[2]], +m[1], +m[4], +m[5], +(m[6] ?? 0), m[7] ?? null);
  m = TEXTO_EN.exec(texto);
  if (m && MESES[m[1]]) return deBogota(+m[3], MESES[m[1]], +m[2], +m[4], +m[5], +(m[6] ?? 0), m[7] ?? null);
  m = NUMERICA.exec(texto);
  if (m) {
    const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return deBogota(anio, +m[2], +m[1], +m[4], +m[5], +(m[6] ?? 0), m[7] ?? null);
  }
  // Último intento: textos con zona explícita ("Fri Oct 02 2026 23:40:00 GMT-0500").
  if (/(gmt|utc|[+-]\d{2}:?\d{2})/.test(texto)) {
    const t = Date.parse(valor);
    if (!Number.isNaN(t)) return new Date(t);
  }
  return null;
}

// ── Muestras de Salud ────────────────────────────────────────────────────

const sinTildes = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .trim();

/**
 * Valor de "Análisis del sueño" (como lo escribe iOS en español o inglés) → en_cama | dormido | despierto.
 * Vacío = en_cama (es lo que anota el iPhone sin reloj). Desconocido = null.
 */
export function tipoMuestra(valor) {
  const t = sinTildes(valor);
  if (!t) return "en_cama";
  if (/^\d$/.test(t)) return { 0: "en_cama", 2: "despierto" }[t] ?? (Number(t) <= 5 ? "dormido" : null);
  if (/(en cama|encama|in ?bed)/.test(t)) return "en_cama";
  if (/(despierto|awake)/.test(t)) return "despierto";
  if (/(dormido|asleep|sleep|nucleo|core|profundo|deep|rem|sin especificar|unspecified)/.test(t)) return "dormido";
  return null;
}

const ALIAS = {
  inicio: ["inicio", "start", "startdate", "fecha de inicio", "fechainicio", "desde", "comienzo"],
  fin: ["fin", "end", "enddate", "fecha de finalizacion", "fecha final", "fechafin", "hasta", "final"],
  tipo: ["tipo", "valor", "value", "type", "estado"],
};

function campo(objeto, nombre) {
  const claves = new Map(Object.keys(objeto).map((k) => [sinTildes(k).replace(/\s+/g, " "), k]));
  for (const alias of ALIAS[nombre]) {
    const k = claves.get(alias) ?? claves.get(alias.replace(/\s+/g, ""));
    if (k !== undefined) return objeto[k];
  }
  return undefined;
}

/**
 * Lo que manda "☀️ Desperté" (resultado de "Buscar muestras de salud") → muestras limpias.
 * Acepta una lista de diccionarios ({inicio, fin, tipo} o {start, end, value}), una lista de textos
 * "inicio;fin;valor", o un solo texto con una muestra por línea. Ignora lo que no sirva (sin fallar).
 * Devuelve { muestras: [{ inicio, fin, tipo }] (ISO, ordenadas), omitidas }.
 */
export function leerMuestras(entrada, { maximo = 300 } = {}) {
  let lista = entrada;
  if (typeof lista === "string") {
    const texto = lista.trim();
    if (/^[[{]/.test(texto)) {
      try {
        lista = JSON.parse(texto);
      } catch {
        lista = texto.split(/\r\n|\r|\n/);
      }
    } else lista = texto ? texto.split(/\r\n|\r|\n/) : [];
  }
  if (lista && typeof lista === "object" && !Array.isArray(lista)) lista = [lista];
  if (!Array.isArray(lista)) return { muestras: [], omitidas: 0 };

  const unicas = new Map();
  let omitidas = 0;
  for (const item of lista.slice(0, maximo)) {
    let crudo;
    if (typeof item === "string") {
      if (!item.trim()) continue;
      const [inicio, fin, tipo] = item.split(/\s*[;|\t]\s*/);
      crudo = { inicio, fin, tipo };
    } else if (item && typeof item === "object") {
      crudo = { inicio: campo(item, "inicio"), fin: campo(item, "fin"), tipo: campo(item, "tipo") };
    } else {
      omitidas++;
      continue;
    }
    const inicio = leerFecha(crudo.inicio);
    const fin = leerFecha(crudo.fin);
    const tipo = tipoMuestra(crudo.tipo);
    const largo = inicio && fin ? fin.getTime() - inicio.getTime() : 0;
    if (!inicio || !fin || !tipo || largo <= 0 || largo > REGLAS.nocheMax * MIN) {
      omitidas++;
      continue;
    }
    const muestra = { inicio: inicio.toISOString(), fin: fin.toISOString(), tipo };
    const clave = `${muestra.inicio}|${tipo}`;
    const previa = unicas.get(clave);
    if (!previa || muestra.fin > previa.fin) unicas.set(clave, muestra);
  }
  omitidas += Math.max(0, lista.length - maximo);
  const muestras = [...unicas.values()].sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
  return { muestras, omitidas };
}

// ── Noches ───────────────────────────────────────────────────────────────

const ms = (valor) => (valor instanceof Date ? valor.getTime() : Date.parse(valor));

function normalizarEventos(eventos) {
  return eventos
    .map((e) => ({ tipo: e.tipo, fuente: e.fuente ?? "manual", t: ms(e.momento), escrito: ms(e.creado_en ?? e.momento) }))
    .filter((e) => TIPOS_EVENTO.includes(e.tipo) && Number.isFinite(e.t))
    .map((e) => ({ ...e, escrito: Number.isFinite(e.escrito) ? e.escrito : e.t }))
    .sort((a, b) => a.t - b.t);
}

/** El último que escribiste a mano manda (sirve para corregir lo automático). */
const ultimoEscrito = (lista) => lista.reduce((a, b) => (b.escrito >= a.escrito ? b : a));

/** Une los ratos "En cama" (y "Dormido", si hay reloj) en sesiones: una por noche. */
function sesionesEnCama(muestras) {
  const tramos = muestras
    .filter((m) => (m.tipo ?? "en_cama") !== "despierto")
    .map((m) => ({ inicio: ms(m.inicio), fin: ms(m.fin) }))
    .filter((x) => Number.isFinite(x.inicio) && Number.isFinite(x.fin) && x.fin > x.inicio)
    .sort((a, b) => a.inicio - b.inicio);

  // Ratos solapados (En cama + Dormido) se vuelven uno.
  const unidos = [];
  for (const tramo of tramos) {
    const ultimo = unidos.at(-1);
    if (ultimo && tramo.inicio <= ultimo.fin) ultimo.fin = Math.max(ultimo.fin, tramo.fin);
    else unidos.push({ ...tramo });
  }

  // Ratos con huecos cortos (te levantaste un momento) son la misma sesión.
  const sesiones = [];
  for (const tramo of unidos) {
    const ultima = sesiones.at(-1);
    if (ultima && tramo.inicio - ultima.fin <= REGLAS.huecoMax * MIN) {
      ultima.fin = tramo.fin;
      ultima.tramos.push(tramo);
    } else sesiones.push({ fin: tramo.fin, tramos: [tramo] });
  }

  return sesiones
    .map((s) => {
      const enCamaMin = s.tramos.reduce((total, x) => total + (x.fin - x.inicio) / MIN, 0);
      // "Acostarse" mira el primer rato largo (un ratico de 10 min antes no cuenta).
      const largo = s.tramos.find((x) => x.fin - x.inicio >= REGLAS.bloqueMin * MIN) ?? s.tramos[0];
      return { inicio: largo.inicio, fin: s.fin, enCamaMin: Math.round(enCamaMin) };
    })
    .filter((s) => s.enCamaMin >= REGLAS.bloqueMin);
}

const HORARIO = new Set(["hora_dormir", "modo_sueno"]);

/** Hora de acostarse de un grupo { eventos, sesion }. */
function elegirAcostarse({ eventos, sesion }) {
  const manuales = eventos.filter((e) => e.fuente === "manual");
  if (manuales.length) return { t: ultimoEscrito(manuales).t, fuente: "manual" };
  if (sesion) {
    const antes = eventos.filter((e) => e.t <= sesion.inicio + REGLAS.tolerancia * MIN);
    const ultimo = antes.at(-1);
    if (ultimo && sesion.inicio - ultimo.t <= REGLAS.celularMax * MIN) return { t: ultimo.t, fuente: ultimo.fuente };
    return { t: sesion.inicio, fuente: "salud" };
  }
  const ultimo = eventos.at(-1);
  return { t: ultimo.t, fuente: ultimo.fuente };
}

/** Las primeras 04:00 de Bogotá después de un instante. */
function corteDespues(t) {
  let corte = instante(fechaCalendario(t), [HORA_CORTE, 0]);
  if (corte <= t) corte = instante(sumarDias(fechaCalendario(t), 1), [HORA_CORTE, 0]);
  return corte;
}

/** Hora de despertar: el primer "desperté" después de las 04:00, o el fin de "En cama". */
function elegirDespertar(acostarse, sesion, despiertos, hasta) {
  const desde = acostarse + REGLAS.despertarMin * MIN;
  const candidatos = despiertos.filter((e) => e.t > desde && e.t <= hasta);
  const manuales = candidatos.filter((e) => e.fuente === "manual");
  if (manuales.length) return { t: ultimoEscrito(manuales).t, fuente: "manual" };
  const corte = corteDespues(acostarse);
  const deManana = candidatos.find((e) => e.t >= corte);
  if (deManana) return { t: deManana.t, fuente: deManana.fuente };
  if (sesion && sesion.fin > desde && sesion.fin <= hasta) return { t: sesion.fin, fuente: "salud" };
  if (candidatos.length) return { t: candidatos[0].t, fuente: candidatos[0].fuente };
  return null;
}

/**
 * Arma las noches con los eventos (`{ tipo, fuente, momento, creado_en }`) y las muestras de Salud (`{ inicio, fin, tipo }`).
 * Reglas (C-sueno.md, con REGLAS arriba):
 *  - acostarse = el "me acuesto" más tardío antes del primer rato largo "En cama" (o el inicio de "En cama" si no hay
 *    evento). Si ese evento quedó más de 45 min antes de "En cama", seguiste con el celular: cuenta "En cama".
 *  - despertar = el primer "desperté" después de las 04:00 (o el fin de "En cama").
 *  - lo anotado a mano manda sobre lo automático (el último que escribiste).
 *  - la noche es del día lógico en que te acostaste.
 * Devuelve [{ fecha, acostarse, despertar, duracionMin, fuente, fuenteDespertar, completa, celularMin, enCama }] por fecha.
 */
export function construirNoches(eventos = [], muestras = []) {
  const evs = normalizarEventos(eventos);
  const acostados = evs.filter((e) => e.tipo === "acostarse");
  const despiertos = evs.filter((e) => e.tipo === "despertar");

  // 1. Grupos por noche: los "me acuesto" de cada día lógico + su sesión "En cama".
  const grupos = new Map();
  const grupo = (fecha) => {
    if (!grupos.has(fecha)) grupos.set(fecha, { fecha, eventos: [], sesion: null });
    return grupos.get(fecha);
  };
  for (const e of acostados) grupo(diaLogico(new Date(e.t))).eventos.push(e);

  for (const sesion of sesionesEnCama(muestras)) {
    // Si "En cama" empezó hasta 8 h después de un "me acuesto", es esa noche (aunque ya fueran las 04:30).
    let destino = null;
    let mejor = -Infinity;
    for (const g of grupos.values()) {
      const previo = g.eventos.filter((e) => e.t <= sesion.inicio + REGLAS.tolerancia * MIN).at(-1);
      if (previo && sesion.inicio - previo.t <= REGLAS.enlace * MIN && previo.t > mejor) {
        destino = g;
        mejor = previo.t;
      }
    }
    destino ??= grupo(diaLogico(new Date(sesion.inicio)));
    if (!destino.sesion || sesion.enCamaMin > destino.sesion.enCamaMin) destino.sesion = sesion;
  }

  // 2. Hora de acostarse de cada noche.
  const noches = [...grupos.values()]
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    .map((g) => {
      const acostarse = elegirAcostarse(g);
      // Minutos con el celular después de que empezó tu hora de dormir (solo si el horario de Salud avisó).
      const horario = g.eventos.find((e) => HORARIO.has(e.fuente));
      const celular = horario && acostarse.fuente !== "manual" ? Math.round((acostarse.t - horario.t) / MIN) : null;
      return { fecha: g.fecha, sesion: g.sesion, acostarse, celularMin: celular !== null && celular >= 10 ? celular : null };
    });

  // 3. Hora de despertar (antes de la siguiente noche y dentro de 16 h).
  noches.forEach((noche, i) => {
    const siguiente = noches.slice(i + 1).find((n) => n.acostarse.t > noche.acostarse.t);
    noche.hasta = Math.min(noche.acostarse.t + REGLAS.nocheMax * MIN, siguiente ? siguiente.acostarse.t : Infinity);
    noche.despertar = elegirDespertar(noche.acostarse.t, noche.sesion, despiertos, noche.hasta);
  });

  // 4. Mañanas con "desperté" pero sin noche (falló "me acuesto" y no hay Salud): noche a medias.
  const huerfanas = new Map();
  for (const e of despiertos) {
    if (noches.some((n) => e.t > n.acostarse.t && e.t <= n.hasta)) continue;
    const hora = minutoDia(e.t) / 60;
    if (hora < HORA_CORTE || hora >= 14) continue;
    const fecha = sumarDias(fechaCalendario(e.t), -1);
    if (grupos.has(fecha)) continue;
    const lista = huerfanas.get(fecha) ?? [];
    lista.push(e);
    huerfanas.set(fecha, lista);
  }

  const resultado = noches.map((n) => {
    const despertar = n.despertar;
    return {
      fecha: n.fecha,
      acostarse: new Date(n.acostarse.t).toISOString(),
      despertar: despertar ? new Date(despertar.t).toISOString() : null,
      duracionMin: despertar ? Math.round((despertar.t - n.acostarse.t) / MIN) : null,
      fuente: n.acostarse.fuente,
      fuenteDespertar: despertar?.fuente ?? null,
      completa: Boolean(despertar),
      celularMin: n.celularMin,
      enCama: n.sesion ? { inicio: new Date(n.sesion.inicio).toISOString(), fin: new Date(n.sesion.fin).toISOString() } : null,
    };
  });
  for (const [fecha, lista] of huerfanas) {
    const manuales = lista.filter((e) => e.fuente === "manual");
    const e = manuales.length ? ultimoEscrito(manuales) : lista[0];
    resultado.push({
      fecha,
      acostarse: null,
      despertar: new Date(e.t).toISOString(),
      duracionMin: null,
      fuente: null,
      fuenteDespertar: e.fuente,
      completa: false,
      celularMin: null,
      enCama: null,
    });
  }
  return resultado.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}

// ── Promedios, regularidad e índice ──────────────────────────────────────

const media = (lista) => lista.reduce((a, b) => a + b, 0) / lista.length;
const desviacion = (lista) => {
  const m = media(lista);
  return Math.sqrt(media(lista.map((x) => (x - m) ** 2)));
};
const limitar = (v, min, max) => Math.min(Math.max(v, min), max);

/** Pivotes para promediar: las horas de acostarse se cuentan desde mediodía; las de levantarse, desde las 18:00. */
const PIVOTE_ACOSTARSE = 12;
const PIVOTE_DESPERTAR = 18;

function ventana(noches, dias, hasta) {
  const fin = hasta ?? noches.reduce((max, n) => (n.fecha > max ? n.fecha : max), "");
  if (!fin) return [];
  const desde = sumarDias(fin, -(dias - 1));
  return noches.filter((n) => n.fecha >= desde && n.fecha <= fin);
}

/**
 * Promedios de las noches de los últimos `dias` hasta `hasta` (por defecto, la última noche).
 * Devuelve { acostarse: "23:42" | null, despertar: "06:05" | null, duracionMin | null, noches }.
 */
export function promedios(noches, dias = 7, hasta = null) {
  const dentro = ventana(noches, dias, hasta);
  const acostarse = dentro.filter((n) => n.acostarse).map((n) => minutosDesde(ms(n.acostarse), PIVOTE_ACOSTARSE));
  const despertar = dentro.filter((n) => n.despertar).map((n) => minutosDesde(ms(n.despertar), PIVOTE_DESPERTAR));
  const duraciones = dentro.filter((n) => n.completa).map((n) => n.duracionMin);
  return {
    acostarse: acostarse.length ? aHora(media(acostarse), PIVOTE_ACOSTARSE) : null,
    despertar: despertar.length ? aHora(media(despertar), PIVOTE_DESPERTAR) : null,
    duracionMin: duraciones.length ? Math.round(media(duraciones)) : null,
    noches: duraciones.length,
  };
}

/** Desviación (min) de 30 o menos = 100 puntos; de 120 o más = 0. */
const puntajeDesviacion = (min) => Math.round(limitar((120 - min) / 90, 0, 1) * 100);

/**
 * Qué tan parecidas son tus horas de acostarte (y de levantarte) en las noches dadas.
 * Hacen falta 3 noches. Devuelve { acostarseMin, despertarMin, noches, puntaje (0–100) | null, texto }.
 */
export function regularidad(noches) {
  const acostarse = noches.filter((n) => n.acostarse).map((n) => minutosDesde(ms(n.acostarse), PIVOTE_ACOSTARSE));
  const despertar = noches.filter((n) => n.despertar).map((n) => minutosDesde(ms(n.despertar), PIVOTE_DESPERTAR));
  if (acostarse.length < 3) {
    return { acostarseMin: null, despertarMin: null, noches: acostarse.length, puntaje: null, texto: "Faltan noches" };
  }
  const sd = Math.round(desviacion(acostarse));
  const sdDespertar = despertar.length >= 3 ? Math.round(desviacion(despertar)) : null;
  const texto = sd <= 30 ? "Muy regular" : sd <= 60 ? "Regular" : sd <= 90 ? "Algo variable" : "Irregular";
  return { acostarseMin: sd, despertarMin: sdDespertar, noches: acostarse.length, puntaje: puntajeDesviacion(sd), texto };
}

/**
 * Índice de sueño de 0 a 100 con las últimas 7 noches:
 *  duración contra tu meta (50 %) · regularidad de la hora de acostarte (30 %) · acostarte antes de tu meta (20 %).
 * Si aún no hay 3 noches, la regularidad no cuenta y el resto se reparte. Sin noches completas: valor null.
 * Devuelve { valor, partes: { duracion, regularidad, hora } (0–100), noches, frase }.
 */
export function indiceSueno(noches, metas = {}) {
  const m = leerMetasSueno(metas);
  const recientes = noches
    .filter((n) => n.acostarse)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    .slice(-7);
  const completas = recientes.filter((n) => n.completa);
  if (completas.length === 0) {
    return { valor: null, partes: null, noches: 0, frase: "Cuando tengas una noche completa, aquí verás tu índice." };
  }

  const metaMin = m.sueno_horas * 60;
  const metaAcostarse = minutosDeHora(m.hora_acostarse, PIVOTE_ACOSTARSE);
  // Llegar a la meta = 100; el 60 % de la meta o menos = 0 (6 h de 7 h 30 = 50).
  const duracion = media(completas.map((n) => limitar((n.duracionMin / metaMin - 0.6) / 0.4, 0, 1)));
  const reg = regularidad(recientes);
  // Hasta 15 min tarde no resta; 1 h 45 tarde o más = 0.
  const hora = media(
    recientes.map((n) => limitar(1 - (minutosDesde(ms(n.acostarse), PIVOTE_ACOSTARSE) - metaAcostarse - 15) / 90, 0, 1)),
  );

  const partes = [
    { clave: "duracion", peso: 50, valor: duracion },
    { clave: "regularidad", peso: 30, valor: reg.puntaje === null ? null : reg.puntaje / 100 },
    { clave: "hora", peso: 20, valor: hora },
  ];
  const usadas = partes.filter((p) => p.valor !== null);
  const valor = Math.round((100 * usadas.reduce((s, p) => s + p.peso * p.valor, 0)) / usadas.reduce((s, p) => s + p.peso, 0));

  // La frase habla de lo que más resta, sin regañar.
  let frase = "Noches sólidas: duermes lo que necesitas y a horas parecidas.";
  if (valor < 85 || usadas.some((p) => p.valor < 0.85)) {
    const peor = usadas.reduce((a, b) => (b.peso * (1 - b.valor) > a.peso * (1 - a.valor) ? b : a));
    const prom = promedios(recientes, 7);
    if (peor.clave === "duracion" && prom.duracionMin !== null && prom.duracionMin < metaMin) {
      frase = `Duermes ${duracionCorta(prom.duracionMin)} en promedio; tu meta es ${duracionCorta(metaMin)}.`;
    } else if (peor.clave === "regularidad") {
      frase = `Tu hora de dormir cambia ±${duracionCorta(reg.acostarseMin)}. Una hora fija ayuda.`;
    } else if (peor.clave === "hora" && prom.acostarse) {
      frase = `Te acuestas hacia las ${prom.acostarse}; tu meta es ${m.hora_acostarse}.`;
    } else {
      frase = "Vas bien. Unas noches más y el índice se afina.";
    }
  }

  const porcentaje = (clave) => {
    const p = partes.find((x) => x.clave === clave);
    return p.valor === null ? null : Math.round(p.valor * 100);
  };
  return {
    valor,
    partes: { duracion: porcentaje("duracion"), regularidad: porcentaje("regularidad"), hora: porcentaje("hora") },
    noches: completas.length,
    frase,
  };
}

// ── Semana (barras estilo Salud) ─────────────────────────────────────────

/** Hora "desde mediodía" en decimales: 23:30 → 23,5 · 01:10 → 25,17 · 10:00 → 34. */
const horaEje = (t) => PIVOTE_ACOSTARSE + minutosDesde(t, PIVOTE_ACOSTARSE) / 60;

/**
 * Las 7 noches hasta `hasta` (inclusive), una fila por día aunque no haya datos.
 * `enCurso`: la noche de hoy si ya te acostaste y aún no te levantas (se dibuja hasta `ahora`).
 * Cada fila: { fecha, dia: "lun", noche | null, ultima, enCurso, desdeH, hastaH } (horas del eje, desde mediodía).
 */
export function resumenSemana(noches, hasta, { ahora = new Date(), enCurso = null } = {}) {
  const filas = [];
  for (let i = 6; i >= 0; i--) {
    const fecha = sumarDias(hasta, -i);
    const noche = noches.find((n) => n.fecha === fecha) ?? null;
    const enCursoAqui = Boolean(enCurso && enCurso.fecha === fecha);
    let desdeH = null;
    let hastaH = null;
    if (noche?.acostarse) {
      desdeH = horaEje(ms(noche.acostarse));
      const finT = noche.despertar ? ms(noche.despertar) : enCursoAqui ? ahora.getTime() : null;
      if (finT !== null) hastaH = desdeH + Math.max(0, finT - ms(noche.acostarse)) / HORA;
    } else if (noche?.despertar) {
      hastaH = horaEje(ms(noche.despertar));
      if (hastaH < 24) hastaH += 24;
    }
    filas.push({
      fecha,
      dia: nombreDia(fecha).slice(0, 3),
      noche,
      ultima: i === 0,
      enCurso: enCursoAqui,
      desdeH: desdeH === null ? null : Math.round(desdeH * 100) / 100,
      hastaH: hastaH === null ? null : Math.round(hastaH * 100) / 100,
    });
  }
  return filas;
}

/** Eje de la gráfica: de 20:00 a 10:00 (horas desde mediodía 20–34), más ancho si alguna noche se sale. Pares. */
export function ejeSemana(filas) {
  let desde = 20;
  let hasta = 34;
  for (const f of filas) {
    if (f.desdeH !== null) desde = Math.min(desde, Math.floor(f.desdeH / 2) * 2);
    if (f.hastaH !== null) hasta = Math.max(hasta, Math.ceil(f.hastaH / 2) * 2);
  }
  return { desde: Math.max(12, desde), hasta: Math.min(40, hasta) };
}

// ── Todo junto (lo que pintan la página, el widget y la API) ────────────

/**
 * Resumen del sueño a partir de lo guardado: { eventos, muestras, metas (perfil.metas) }.
 * Devuelve { fecha, metas, ultimaNoche, enCurso, indice, regularidad, promedios, semana, eje, hasta }.
 */
export function resumenSueno({ eventos = [], muestras = [], metas = {} } = {}, ahora = new Date()) {
  const m = leerMetasSueno(metas);
  const hoy = diaLogico(ahora);
  const t = ahora.getTime();
  const noches = construirNoches(eventos, muestras).filter((n) => n.fecha <= hoy);

  // Esta noche: ya te acostaste "hoy" y todavía no te levantas.
  const ultima = noches.at(-1) ?? null;
  const acostado = ultima?.acostarse ? ms(ultima.acostarse) : null;
  const enCurso =
    ultima && ultima.fecha === hoy && !ultima.despertar && acostado <= t && t - acostado < REGLAS.nocheMax * MIN ? ultima : null;

  const anteriores = noches.filter((n) => n !== enCurso);
  const ultimaNoche = anteriores.at(-1) ?? null;
  const ayer = sumarDias(hoy, -1);
  const hasta = enCurso || ultimaNoche?.fecha === hoy ? hoy : ayer;
  const semanaNoches = ventana(anteriores, 7, hasta);
  const semana = resumenSemana(noches, hasta, { ahora, enCurso });

  return {
    fecha: hoy,
    metas: m,
    ultimaNoche: ultimaNoche
      ? { ...ultimaNoche, etiqueta: ultimaNoche.fecha === ayer || ultimaNoche.fecha === hoy ? "Anoche" : "Tu última noche" }
      : null,
    enCurso,
    indice: indiceSueno(semanaNoches, m),
    regularidad: regularidad(semanaNoches.filter((n) => n.acostarse)),
    promedios: promedios(semanaNoches, 7, hasta),
    semana,
    eje: ejeSemana(semana),
    hasta,
  };
}
