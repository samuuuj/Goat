// Desbloqueo por puntaje (D-054). Funciones puras: sin pantalla ni internet.
// Las usan desbloqueo.html (navegador) y /api/v1/desbloqueo/* (servidor): la regla vive en un solo lugar.
//
// Regla:
//   registros atrasados → 0 min · al día → 30 min · puntaje ≥ 80 → 60 min · puntaje 100 → 90 min (por app, cada una su bolsa).
//   1 pase de emergencia de 10 min al día, para la app que elijas.
//   Minutos usados = pares abrir → cerrar del día lógico; una apertura sin cierre cuenta como máximo 30 min.
//   Si el nivel baja, lo usado no se devuelve: los restantes nunca son negativos.

import { diaLogico } from "../logica/dia.js";

// ── Constantes ───────────────────────────────────────────────────────────

/** Apps que siempre cuentan. Los juegos los agrega Samuel en perfil.ajustes.desbloqueo.juegos. */
export const APPS_FIJAS = Object.freeze([
  Object.freeze({ id: "tiktok", nombre: "TikTok", emoji: "🎵" }),
  Object.freeze({ id: "instagram", nombre: "Instagram", emoji: "📸" }),
  Object.freeze({ id: "youtube", nombre: "YouTube", emoji: "▶️" }),
]);

export const EMOJI_JUEGO = "🎮";

/** Niveles por defecto: puntaje mínimo de hoy → minutos por app. El de puntaje 0 es "registros al día". */
export const NIVELES_BASE = Object.freeze([
  Object.freeze({ puntaje: 0, minutos: 30 }),
  Object.freeze({ puntaje: 80, minutos: 60 }),
  Object.freeze({ puntaje: 100, minutos: 90 }),
]);

export const PASE = Object.freeze({ minutos: 10, porDia: 1 });

/** Una apertura sin cierre cuenta como máximo esto (min). */
export const TOPE_SIN_CIERRE = 30;

export const MAX_JUEGOS = 12;
export const MAX_NOMBRE_JUEGO = 30;
export const MAX_MINUTOS_NIVEL = 240;
const MAX_NIVELES = 6;

/** Identificador de app: minúsculas, números y guiones, hasta 40 (igual que el check de schema.sql). */
export const APP_VALIDA = /^[a-z0-9][a-z0-9-]{0,39}$/;

const MINUTO_MS = 60_000;
const HORA_MS = 3_600_000;

// ── Apps ─────────────────────────────────────────────────────────────────

/** "Clash Royale" → "clash-royale" · "TikTok" → "tiktok" · "Pokémon GO!" → "pokemon-go". */
export function slugApp(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

/** Nombre legible de un slug que no está en la lista: "clash-royale" → "Clash Royale". */
function nombreDesdeSlug(id) {
  return id
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/** Ajustes del desbloqueo (perfil.ajustes.desbloqueo) limpios: { juegos, niveles }. Lo raro se ignora. */
export function ajustesDesbloqueo(crudo) {
  const fuente = crudo && typeof crudo === "object" ? crudo : {};
  return { juegos: leerJuegos(fuente.juegos), niveles: leerNiveles(fuente.niveles) };
}

function leerJuegos(lista) {
  if (!Array.isArray(lista)) return [];
  const ocupados = new Set(APPS_FIJAS.map((a) => a.id));
  const juegos = [];
  for (const juego of lista) {
    const nombre = (typeof juego === "string" ? juego : typeof juego?.nombre === "string" ? juego.nombre : "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, MAX_NOMBRE_JUEGO);
    const id = slugApp(typeof juego?.id === "string" && juego.id ? juego.id : nombre);
    if (!nombre || !APP_VALIDA.test(id) || ocupados.has(id)) continue;
    ocupados.add(id);
    juegos.push({ id, nombre, emoji: EMOJI_JUEGO });
    if (juegos.length >= MAX_JUEGOS) break;
  }
  return juegos;
}

/**
 * Niveles personalizados: [{ puntaje 0–100, minutos 0–240 }], ordenados por puntaje.
 * Siempre hay uno de puntaje 0 (registros al día) y un nivel más alto nunca da menos minutos que uno más bajo.
 */
function leerNiveles(lista) {
  const base = () => NIVELES_BASE.map((n) => ({ ...n }));
  if (!Array.isArray(lista) || lista.length === 0) return base();
  const porPuntaje = new Map();
  for (const n of lista) {
    const puntaje = Number(n?.puntaje);
    const minutos = Number(n?.minutos);
    if (!Number.isInteger(puntaje) || puntaje < 0 || puntaje > 100) continue;
    if (!Number.isInteger(minutos) || minutos < 0 || minutos > MAX_MINUTOS_NIVEL) continue;
    porPuntaje.set(puntaje, minutos);
  }
  if (porPuntaje.size === 0) return base();
  if (!porPuntaje.has(0)) porPuntaje.set(0, NIVELES_BASE[0].minutos);
  let anterior = 0;
  return [...porPuntaje]
    .sort((a, b) => a[0] - b[0])
    .slice(0, MAX_NIVELES)
    .map(([puntaje, minutos]) => {
      anterior = Math.max(anterior, minutos);
      return { puntaje, minutos: anterior };
    });
}

/** TikTok, Instagram, YouTube y los juegos de Samuel. */
export function listaApps(ajustes) {
  return [...APPS_FIJAS.map((a) => ({ ...a })), ...ajustesDesbloqueo(ajustes).juegos];
}

/** { id, nombre, emoji } de una app (también de una que no está en la lista: tiene su propia bolsa). */
export function buscarApp(app, ajustes) {
  const id = slugApp(app);
  return listaApps(ajustes).find((a) => a.id === id) ?? { id, nombre: nombreDesdeSlug(id) || id, emoji: EMOJI_JUEGO };
}

// ── Niveles ──────────────────────────────────────────────────────────────

export function nombreNivel(n) {
  if (n.puntaje === 0) return "Registros al día";
  return n.puntaje >= 100 ? "100 puntos" : `${n.puntaje}+ puntos`;
}

/** Nivel de hoy según el resumen de calculo.js: { indice, nombre, puntaje, minutos }. indice −1 = atrasado. */
export function nivel(resumen, niveles = NIVELES_BASE) {
  if ((resumen?.pendientes ?? []).length > 0) {
    return { indice: -1, nombre: "Registros atrasados", puntaje: null, minutos: 0 };
  }
  const score = Number(resumen?.score) || 0;
  let indice = 0;
  niveles.forEach((n, i) => {
    if (score >= n.puntaje) indice = i;
  });
  const n = niveles[indice];
  return { indice, nombre: nombreNivel(n), puntaje: n.puntaje, minutos: n.minutos };
}

/** El nivel que sigue: { puntaje, minutos, nombre, faltanPuntos, requiereRegistros } o null si ya es el máximo. */
export function siguienteNivel(resumen, niveles = NIVELES_BASE) {
  const actual = nivel(resumen, niveles);
  const siguiente = niveles[actual.indice + 1];
  if (!siguiente) return null;
  const atrasado = actual.indice < 0;
  return {
    puntaje: siguiente.puntaje,
    minutos: siguiente.minutos,
    nombre: nombreNivel(siguiente),
    faltanPuntos: atrasado ? 0 : Math.max(0, siguiente.puntaje - (Number(resumen?.score) || 0)),
    requiereRegistros: atrasado,
  };
}

// ── Uso de hoy ───────────────────────────────────────────────────────────

const fechaDe = (fila) => fila.fecha ?? diaLogico(new Date(fila.momento));
const porMomento = (a, b) => Date.parse(a.momento) - Date.parse(b.momento);

/**
 * Sesiones del día lógico de `ahora` a partir de los eventos (todas las apps):
 * [{ app, inicio, fin, minutos, cerrada, enCurso, permitido }], en orden.
 *  - abrir → cerrar: cuenta todo el par.
 *  - abrir sin cierre: hasta la siguiente apertura de esa app o `ahora`, como máximo 30 min.
 *  - cerrar sin apertura: se ignora.
 */
export function sesionesDelDia(eventos, ahora) {
  const hoy = diaLogico(ahora);
  const limite = ahora.getTime();
  const delDia = (eventos ?? [])
    .filter((e) => e && fechaDe(e) === hoy && Date.parse(e.momento) <= limite)
    .sort(porMomento);

  const sesiones = [];
  const abiertas = new Map();
  const terminar = (apertura, hasta, cerrada) => {
    const inicio = Date.parse(apertura.momento);
    const tope = inicio + TOPE_SIN_CIERRE * MINUTO_MS;
    const fin = Math.max(inicio, cerrada ? hasta : Math.min(hasta, tope));
    sesiones.push({
      app: slugApp(apertura.app),
      inicio: new Date(inicio),
      fin: new Date(fin),
      minutos: (fin - inicio) / MINUTO_MS,
      cerrada,
      enCurso: !cerrada && hasta === limite && limite < tope,
      permitido: apertura.permitido ?? null,
    });
  };

  for (const evento of delDia) {
    const app = slugApp(evento.app);
    const pendiente = abiertas.get(app);
    if (evento.evento === "abrir") {
      if (pendiente) terminar(pendiente, Date.parse(evento.momento), false);
      abiertas.set(app, evento);
    } else if (evento.evento === "cerrar" && pendiente) {
      terminar(pendiente, Date.parse(evento.momento), true);
      abiertas.delete(app);
    }
  }
  for (const pendiente of abiertas.values()) terminar(pendiente, limite, false);
  return sesiones.sort((a, b) => a.inicio - b.inicio);
}

/** Minutos (con decimales) que lleva hoy una app. */
export function minutosUsados(eventos, app, ahora) {
  const id = slugApp(app);
  return sesionesDelDia(eventos, ahora)
    .filter((s) => s.app === id)
    .reduce((total, s) => total + s.minutos, 0);
}

/** Minutos de uso en cada una de las 24 horas del día lógico (04:00 → 04:00), estilo Tiempo en pantalla. */
export function usoPorHora(sesiones, ahora) {
  const inicioDia = Date.parse(`${diaLogico(ahora)}T04:00:00-05:00`);
  const horas = Array(24).fill(0);
  for (const s of sesiones) {
    for (let h = 0; h < 24; h++) {
      const desde = Math.max(s.inicio.getTime(), inicioDia + h * HORA_MS);
      const hasta = Math.min(s.fin.getTime(), inicioDia + (h + 1) * HORA_MS);
      if (hasta > desde) horas[h] += (hasta - desde) / MINUTO_MS;
    }
  }
  return horas;
}

/** Pases que valen hoy (como máximo PASE.porDia, los primeros). */
export function pasesDeHoy(pases, ahora) {
  const hoy = diaLogico(ahora);
  return (pases ?? [])
    .filter((p) => p && fechaDe(p) === hoy && Date.parse(p.momento) <= ahora.getTime())
    .sort(porMomento)
    .slice(0, PASE.porDia);
}

// ── Estado ───────────────────────────────────────────────────────────────

/**
 * Estado de UNA app hoy.
 * `resumen`: construirResumen() de calculo.js · `eventos`: apps_eventos · `pases`: desbloqueo_pases
 * `ajustes`: perfil.ajustes.desbloqueo (puede faltar).
 */
export function estadoApp({ resumen, eventos = [], pases = [], app, ajustes, ahora }) {
  const conf = ajustesDesbloqueo(ajustes);
  const info = buscarApp(app, ajustes);
  const actual = nivel(resumen, conf.niveles);
  const validos = pasesDeHoy(pases, ahora);
  const pase = validos.filter((p) => slugApp(p.app) === info.id).reduce((t, p) => t + (Number(p.minutos) || 0), 0);
  const usados = Math.round(minutosUsados(eventos, info.id, ahora));
  const ganados = actual.minutos;
  const restantes = Math.max(0, ganados + pase - usados);
  return {
    app: info.id,
    nombre: info.nombre,
    emoji: info.emoji,
    permitido: restantes > 0,
    ganados,
    pase,
    total: ganados + pase,
    usados,
    restantes,
    score: Number(resumen?.score) || 0,
    nivel: actual,
    faltan: resumen?.pendientes ?? [],
    siguienteNivel: siguienteNivel(resumen, conf.niveles),
    paseDisponible: validos.length < PASE.porDia,
  };
}

/** Todo lo de hoy para la página y el widget: apps, nivel, pase, sesiones y uso por hora. */
export function estadoDesbloqueo({ resumen, eventos = [], pases = [], ajustes, ahora }) {
  const conf = ajustesDesbloqueo(ajustes);
  const sesiones = sesionesDelDia(eventos, ahora);
  const validos = pasesDeHoy(pases, ahora);

  // Las apps de la lista y cualquier otra que haya aparecido hoy (una automatización con otro nombre).
  const ids = listaApps(ajustes).map((a) => a.id);
  for (const fila of [...sesiones, ...validos]) {
    const id = slugApp(fila.app);
    if (APP_VALIDA.test(id) && !ids.includes(id)) ids.push(id);
  }
  const apps = ids.map((id) => estadoApp({ resumen, eventos, pases, app: id, ajustes, ahora }));

  return {
    fecha: diaLogico(ahora),
    abierto: (resumen?.pendientes ?? []).length === 0,
    score: Number(resumen?.score) || 0,
    nivel: nivel(resumen, conf.niveles),
    siguienteNivel: siguienteNivel(resumen, conf.niveles),
    niveles: conf.niveles.map((n) => ({ ...n, nombre: nombreNivel(n) })),
    faltan: resumen?.pendientes ?? [],
    apps,
    paseDisponible: validos.length < PASE.porDia,
    paseUsado: validos[0] ? { app: slugApp(validos[0].app), minutos: Number(validos[0].minutos) || 0, momento: validos[0].momento } : null,
    sesiones,
    usoPorHora: usoPorHora(sesiones, ahora),
    usadosTotal: Math.round(sesiones.reduce((t, s) => t + s.minutos, 0)),
  };
}

// ── Mensajes (sin montos, D-020) ─────────────────────────────────────────

const enMinuscula = (texto) => texto.charAt(0).toLowerCase() + texto.slice(1);

/** "almuerzo" · "desayuno y almuerzo" · "desayuno y almuerzo (+1)". */
export function listaFaltan(faltan) {
  const nombres = (faltan ?? []).map((p) => enMinuscula(p.texto ?? p.clave ?? ""));
  if (nombres.length === 0) return "";
  const primeros = nombres.slice(0, 2).join(" y ");
  return nombres.length > 2 ? `${primeros} (+${nombres.length - 2})` : primeros;
}

/** Lo que muestra el atajo "🔒 Puerta": `✅ 42 min en TikTok` · `🔒 Falta: almuerzo` · `⏳ Se acabó TikTok por hoy`. */
export function mensajeGate(estado) {
  if (estado.permitido) return `✅ ${estado.restantes} min en ${estado.nombre}`;
  if (estado.faltan.length > 0) return `🔒 Falta: ${listaFaltan(estado.faltan)}`;
  return `⏳ Se acabó ${estado.nombre} por hoy`;
}

/** Frase corta sobre cómo ganar más minutos hoy. */
export function pista(estado) {
  const siguiente = estado.siguienteNivel;
  if (estado.nivel.indice < 0) {
    return siguiente ? `Registra lo que falta y se abre con ${siguiente.minutos} min por app.` : "Registra lo que falta para abrir.";
  }
  if (!siguiente) return "Nivel máximo. Hoy no hay más que ganar.";
  const faltan = siguiente.faltanPuntos === 1 ? "Te falta 1 punto" : `Te faltan ${siguiente.faltanPuntos} puntos`;
  return `${faltan} para ${siguiente.minutos} min por app.`;
}

// ── Cómo registrar lo que falta ──────────────────────────────────────────

/** Atajo de iPhone que registra cada acción (los demás se registran en la web). */
const ATAJO_DE = { gasto: "💸 Movimiento" };
const WEB_DE = {
  comida: "index.html#registrar=comida",
  gasto: "index.html#registrar=gasto",
  estudio: "index.html#registrar=estudio",
  gym: "index.html#registrar=gym",
  rutina: "rutina.html",
};

/**
 * Para un pendiente de calculo.js ({ clave, accion, … }): { atajo, web, abrir }.
 * `abrir` es lo que abre el atajo "🔒 Puerta" en "Registrar ahora": el atajo de iPhone si existe, si no la web.
 * `origenWeb`: "https://goat.vercel.app" (sin barra final) o null.
 */
export function comoRegistrar(pendiente, origenWeb = null) {
  const atajo = ATAJO_DE[pendiente?.accion] ?? null;
  const web = WEB_DE[pendiente?.accion] ?? "index.html";
  const abrir = atajo ? `shortcuts://run-shortcut?name=${encodeURIComponent(atajo)}` : origenWeb ? `${origenWeb}/${web}` : null;
  return { atajo, web, abrir };
}
