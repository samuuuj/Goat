// Reglas del centro de notificaciones: a partir del resumen del día (construirResumen de logica/calculo.js)
// deciden qué avisos crear. Funciones puras: las usa la campana de Hoy (campana.js) y la API
// (api/_rutas/notificaciones.js), así las reglas viven en un solo lugar (principio 1).
// Cada aviso lleva una `clave` única ("<regla>:…:<fecha>"): la misma clave nunca se guarda dos veces.
// Sin montos (D-020) y sin regañar: registrar "nada" también cuenta (principios 3 y 4).

import { sumarDias } from "../logica/calculo.js";
import { horaDecimal } from "../logica/dia.js";

/** Hitos de racha que merecen aviso. */
export const HITOS_RACHA = [3, 7, 14, 30];

/** Los 4 registros que cierran un día (calculo.js › REGISTROS_DEL_DIA). */
const REGISTROS_DEL_DIA = 4;

/** Hasta qué hora (día lógico) sale el resumen de la mañana. */
const HORA_FIN_MANANA = 12;

// ── Pendientes ───────────────────────────────────────────────────────────

/** Cómo se avisa cada pendiente de calculo.js. `corto`: 1–2 palabras para la notificación del iPhone. */
const PENDIENTES = {
  desayuno: {
    modulo: "comidas",
    titulo: "Desayuno pendiente",
    corto: "Desayuno pendiente",
    cuerpo: "Regístralo en segundos. Si no desayunaste, «No comí» también cuenta.",
  },
  almuerzo: {
    modulo: "comidas",
    titulo: "Almuerzo pendiente",
    corto: "Almuerzo pendiente",
    cuerpo: "Regístralo en segundos. Si no almorzaste, «No comí» también cuenta.",
  },
  cena: {
    modulo: "comidas",
    titulo: "Cena pendiente",
    corto: "Cena pendiente",
    cuerpo: "Regístrala antes de dormir. «No comí» también cuenta.",
  },
  checkin_finanzas: {
    modulo: "finanzas",
    titulo: "Check-in de gastos",
    corto: "Check-in gastos",
    cuerpo: "¿Gastaste algo? Si no, «No he gastado nada» también cuenta.",
  },
  cierre_finanzas: {
    modulo: "finanzas",
    titulo: "Cierre de gastos",
    corto: "Cerrar gastos",
    cuerpo: "Cierra el día de gastos y queda todo al día.",
  },
  sueno: {
    modulo: "sueno",
    titulo: "Registra tu sueño",
    corto: "Registrar sueño",
    cuerpo: "Cuéntale a Goat cómo dormiste.",
    url: "sueno.html",
  },
};

/** Módulo de un pendiente que no está en la lista (por ejemplo, bloques de rutina que agregue la integración). */
function moduloDePendiente(pendiente) {
  if (pendiente.modulo) return pendiente.modulo;
  const clave = String(pendiente.clave ?? "");
  if (/finanzas|gasto/.test(clave)) return "finanzas";
  if (/rutina|bloque/.test(clave)) return "rutina";
  if (/tarea|uni/.test(clave)) return "universidad";
  if (/sueno/.test(clave)) return "sueno";
  if (/gym|ejercicio|entreno/.test(clave)) return "ejercicio";
  return "diario";
}

/** Corta un texto a `max` caracteres sin partir palabras. */
function recortar(texto, max) {
  const t = String(texto ?? "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

/** Hora del día lógico: la 01:30 es 25,5 (sigue siendo "hoy"). */
function horaLogica(ahora) {
  const hora = horaDecimal(ahora);
  return hora < 4 ? hora + 24 : hora;
}

/**
 * El check-in de gastos puede volver a faltar varias veces en la tarde (pide algo en las últimas 5 h):
 * se avisa una vez por franja (antes de las 15:00, 15:00–18:00, desde las 18:00) para no llenar de avisos.
 */
function franja(ahora) {
  const hora = horaLogica(ahora);
  return hora < 15 ? "a" : hora < 18 ? "b" : "c";
}

function avisoDePendiente(pendiente, fecha, ahora) {
  const regla = PENDIENTES[pendiente.clave];
  const modulo = regla?.modulo ?? moduloDePendiente(pendiente);
  const sufijo = pendiente.clave === "checkin_finanzas" ? `:${franja(ahora)}` : "";
  return {
    modulo,
    emoji: pendiente.emoji ?? "📝",
    titulo: regla?.titulo ?? recortar(`${pendiente.texto} pendiente`, 60),
    cuerpo: regla?.cuerpo ?? "Toca para registrarlo. Registrar «nada» también cuenta.",
    url: regla?.url ?? (modulo === "rutina" ? "rutina.html" : "index.html#pendientes"),
    clave: `pendiente:${pendiente.clave}:${fecha}${sufijo}`,
  };
}

// ── Reglas ───────────────────────────────────────────────────────────────

/** ¿Hoy ya tiene los 4 registros? (anillo "registro" lleno). */
const registrosDeHoy = (resumen) => {
  const anillo = resumen.anillos?.find((a) => a.clave === "registro");
  return Math.round((anillo?.progreso ?? 0) * REGISTROS_DEL_DIA);
};

function avisoDeRacha(resumen) {
  const racha = Number(resumen.racha) || 0;
  const hito = Math.max(0, ...HITOS_RACHA.filter((h) => h <= racha));
  if (!hito) return null;
  // La racha cuenta hoy solo si hoy ya está completo; el inicio identifica la racha (no se repite al día siguiente).
  const completoHoy = registrosDeHoy(resumen) >= REGISTROS_DEL_DIA;
  const inicio = sumarDias(resumen.fecha, completoHoy ? 1 - racha : -racha);
  const cuerpos = {
    3: "Tres días con todo registrado. Así se arma un hábito.",
    7: "Una semana completa registrando. Sigue así.",
    14: "Dos semanas sin dejar un registro atrás.",
    30: "Un mes entero. Esto ya es parte de ti.",
  };
  return {
    modulo: "puntuacion",
    emoji: "🔥",
    titulo: `${hito} días seguidos`,
    cuerpo: cuerpos[hito],
    url: "index.html#semana",
    clave: `racha:${hito}:${inicio}`,
  };
}

function avisoDePuntaje(resumen) {
  const score = Number(resumen.score) || 0;
  if (score >= 100) {
    return {
      modulo: "puntuacion",
      emoji: "⭐",
      titulo: "Día de 100",
      cuerpo: "Puntaje perfecto. Hoy no hay nada más que pedir.",
      url: "index.html#anillos",
      clave: `puntaje:100:${resumen.fecha}`,
    };
  }
  if (score >= 80) {
    return {
      modulo: "puntuacion",
      emoji: "⭐",
      titulo: "Ya pasaste los 80 puntos",
      cuerpo: "Vas muy bien hoy.",
      url: "index.html#anillos",
      clave: `puntaje:80:${resumen.fecha}`,
    };
  }
  return null;
}

/** Resumen de la mañana: sale una vez por día, la primera vez que abres Goat antes del mediodía. */
function avisoDeManana(resumen, ahora) {
  if (horaLogica(ahora) >= HORA_FIN_MANANA) return null;
  const faltan = Math.max(0, REGISTROS_DEL_DIA - registrosDeHoy(resumen));
  const racha = Number(resumen.racha) || 0;
  const titulo = faltan === 0 ? "Tu día · todo al día" : `Tu día · ${faltan} ${faltan === 1 ? "cosa" : "cosas"} por hacer`;
  const inicio = racha > 0 ? `Racha de ${racha} ${racha === 1 ? "día" : "días"} 🔥. ` : "";
  const cuerpo =
    faltan === 0 ? `${inicio}Ya tienes los registros del día.` : `${inicio}Desayuno, almuerzo, cena y cierre de gastos. Registrar «nada» también cuenta.`;
  return { modulo: "diario", emoji: "☀️", titulo, cuerpo, url: "index.html", clave: `dia:${resumen.fecha}` };
}

/**
 * Avisos que corresponden a este resumen. Pueden repetir claves ya guardadas: filtra con `sinDuplicar()`.
 * `resumen`: el de construirResumen() · `ahora`: Date.
 */
export function generarNotificaciones(resumen, ahora = new Date()) {
  if (!resumen?.fecha) return [];
  const avisos = [
    avisoDeManana(resumen, ahora),
    ...(resumen.pendientes ?? []).map((p) => avisoDePendiente(p, resumen.fecha, ahora)),
    avisoDeRacha(resumen),
    avisoDePuntaje(resumen),
  ];
  return avisos.filter(Boolean);
}

/** Quita las que ya existen (misma clave, aunque estén leídas o borradas) y las repetidas entre sí. */
export function sinDuplicar(candidatas, existentes = []) {
  const vistas = new Set(existentes.map((n) => n.clave).filter(Boolean));
  return candidatas.filter((n) => {
    if (!n.clave) return true;
    if (vistas.has(n.clave)) return false;
    vistas.add(n.clave);
    return true;
  });
}

/**
 * Ids de avisos de pendientes sin leer que ya no aplican: lo registraste, es de un día que ya pasó
 * o es el check-in de una franja anterior (ya hay uno nuevo). Se marcan como leídos para que
 * el contador de la campana no siga contándolos.
 */
export function pendientesResueltas(existentes, resumen, ahora = new Date()) {
  if (!resumen?.fecha) return [];
  const siguen = new Set((resumen.pendientes ?? []).map((p) => p.clave));
  const franjaActual = franja(ahora);
  return existentes
    .filter((n) => !n.leida_en && !n.descartada_en && n.clave?.startsWith("pendiente:"))
    .filter((n) => {
      const [, clave, fecha, franjaAviso] = n.clave.split(":");
      if (fecha !== resumen.fecha) return fecha < resumen.fecha;
      return !siguen.has(clave) || (franjaAviso !== undefined && franjaAviso !== franjaActual);
    })
    .map((n) => n.id);
}

/**
 * Mensaje para la notificación del iPhone (automatizaciones "Hora del día"): emoji + 1–2 palabras, sin montos.
 * { notificar: false } si no falta nada.
 */
export function mensajeAhora(resumen) {
  const pendientes = resumen?.pendientes ?? [];
  if (pendientes.length === 0) return { notificar: false, mensaje: "✅ Todo al día" };
  const [primero] = pendientes;
  const emoji = primero.emoji ?? "📝";
  if (pendientes.length > 1) return { notificar: true, mensaje: `${emoji} ${pendientes.length} pendientes` };
  const corto = PENDIENTES[primero.clave]?.corto ?? String(primero.texto ?? "Pendiente").split(/\s+/).slice(0, 2).join(" ");
  return { notificar: true, mensaje: `${emoji} ${corto}` };
}
