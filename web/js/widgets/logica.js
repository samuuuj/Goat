// Widgets (E): arma la respuesta compacta de GET /api/v1/widget. Funciones puras (sin pantalla ni internet):
// las usan la API (api/_rutas/widget.js) y widgets.html (vista previa), así los dos muestran lo mismo.
// El puntaje, la racha, los anillos y los pendientes salen de construirResumen() de calculo.js (principio 1);
// la rutina, el sueño y el desbloqueo, de las funciones de cada módulo. Aquí solo se recorta y se da formato.
//
// Sin dinero salvo que se pida (`dinero: true`), y nunca en los textos de la pantalla bloqueada (D-020).

import { diaYMes, horaBogota, nombreDia } from "../logica/dia.js";
import { aHora, ahoraYSiguiente, diaSemana, duracionTexto, emojiDe, estadoDelDia, DIAS } from "../rutina/logica.js";
import { duracionCorta } from "../sueno/logica.js";
import { comoRegistrar, listaFaltan } from "../desbloqueo/logica.js";
import { elegirFrase, franjaDe } from "./frases.js";

export const VERSION_WIDGET = 1;
/** Tope del tamaño de la respuesta (Scriptable la guarda para usarla sin internet). */
export const MAXIMO_BYTES = 4096;

const MINUTO = 60_000;
const redondear = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const corto = (t, max) => (t && t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t);

/** Rutina de hoy (bloques de la plantilla + chequeos) → { ahora, siguiente, … } o null si no hay rutina hoy. */
export function rutinaCorta({ bloques = [], checks = [], festivos = [], fecha }, ahora) {
  const items = estadoDelDia(bloques, checks, ahora, { fecha, festivos });
  if (items.length === 0) return null;
  const { actual, siguiente, mensaje } = ahoraYSiguiente(items, ahora);
  const t = ahora.getTime();
  return {
    ahora: actual ? corto(actual.titulo, 40) : null,
    emojiAhora: actual ? emojiDe(actual.tipo) : null,
    quedan: actual ? duracionTexto(Math.max(1, Math.ceil((actual.fin - t) / MINUTO))) : null,
    siguiente: siguiente ? corto(siguiente.titulo, 40) : null,
    emojiSiguiente: siguiente ? emojiDe(siguiente.tipo) : null,
    hora: siguiente ? aHora(siguiente.inicioMin) : null,
    mensaje,
  };
}

/** resumenSueno() de sueno/logica.js → { duracion: "7 h 10", indice, etiqueta, enCama } o null si no hay noches. */
export function suenoCorto(resumen) {
  if (!resumen) return null;
  if (resumen.enCurso) {
    return { duracion: null, indice: resumen.indice?.valor ?? null, etiqueta: "En cama", enCama: true };
  }
  const noche = resumen.ultimaNoche;
  if (!noche) return null;
  return {
    duracion: noche.completa && noche.duracionMin ? duracionCorta(noche.duracionMin) : null,
    indice: resumen.indice?.valor ?? null,
    etiqueta: noche.etiqueta ?? "Anoche",
    enCama: false,
  };
}

/** estadoDesbloqueo() de desbloqueo/logica.js → { abierto, minutos (ganados por app), apps: [{ emoji, nombre, restantes }] }. */
export function desbloqueoCorto(estado) {
  if (!estado) return null;
  return {
    abierto: Boolean(estado.abierto),
    minutos: Number(estado.nivel?.minutos) || 0,
    apps: (estado.apps ?? []).slice(0, 4).map((a) => ({ emoji: a.emoji, nombre: a.nombre, restantes: a.restantes })),
  };
}

/** La frase del día a partir del resumen de calculo.js (la usan la API, widgets.html y la tarjeta de Hoy). */
export function fraseDe(resumen, ahora = new Date()) {
  return elegirFrase({
    fecha: resumen.fecha,
    franja: franjaDe(Number(horaBogota(ahora).slice(0, 2))),
    score: Math.round(Number(resumen.score) || 0),
    scoreAyer: resumen.scoreAyer,
    racha: Math.max(0, Math.round(Number(resumen.racha) || 0)),
    pendientes: (resumen.pendientes ?? []).length,
    tipoDia: resumen.tipoDia,
    diaSemana: diaSemana(resumen.fecha),
    dia: nombreDia(resumen.fecha),
  });
}

/** Lo que dicen los widgets de la pantalla bloqueada. Nunca dinero ni frases largas. */
function textosBloqueo({ score, racha, pendientes, rutina }) {
  const fuego = racha > 0 ? ` · 🔥${racha}` : "";
  return {
    linea: `Goat ${score}${fuego}`,
    titulo: `${score} pts${fuego}`,
    detalle: pendientes.total > 0 ? `Falta ${pendientes.texto}` : "Todo al día",
    extra: rutina?.siguiente ? `${rutina.hora} ${rutina.siguiente}` : rutina?.ahora ? `Ahora: ${rutina.ahora}` : null,
  };
}

/**
 * Respuesta de GET /api/v1/widget (≤ 4 KB).
 * `partes`: { resumen (obligatorio, de construirResumen), rutina, sueno, desbloqueo, avisos } — las opcionales pueden
 *   faltar (null): ese campo sale null y el widget lo omite.
 * `opciones`: { ahora, dinero } — `dinero: true` agrega { disponibleHoy } (solo para los widgets mediano y grande).
 */
export function armarWidget({ resumen, rutina = null, sueno = null, desbloqueo = null, avisos = null }, { ahora = new Date(), dinero = false } = {}) {
  const fecha = resumen.fecha;
  const score = Math.round(Number(resumen.score) || 0);
  const racha = Math.max(0, Math.round(Number(resumen.racha) || 0));
  const lista = resumen.pendientes ?? [];
  const pendientes = {
    total: lista.length,
    primero: lista[0] ? `${lista[0].emoji} ${lista[0].texto}` : null,
    texto: lista.length ? corto(listaFaltan(lista), 48) : null,
    lista: lista.slice(0, 3).map((p) => `${p.emoji} ${corto(p.texto, 32)}`),
  };
  const hora = horaBogota(ahora);
  const frase = fraseDe(resumen, ahora);

  const datos = {
    v: VERSION_WIDGET,
    fecha,
    dia: nombreDia(fecha),
    fechaCorta: diaYMes(fecha),
    hora,
    actualizado: ahora.toISOString(),
    score,
    scoreAyer: resumen.scoreAyer ?? null,
    racha,
    anillos: (resumen.anillos ?? []).map((a) => ({
      clave: a.clave,
      nombre: a.nombre,
      progreso: redondear(Math.min(Math.max(Number(a.progreso) || 0, 0), 2)),
    })),
    semana: (resumen.semana ?? []).map((d) => ({
      dia: DIAS[diaSemana(d.fecha) - 1].corto,
      score: d.score === null || d.score === undefined ? null : Math.round(d.score),
      hoy: d.fecha === fecha,
    })),
    pendientes,
    rutina,
    sueno,
    desbloqueo,
    avisos,
    frase,
    // Lo que se abre al tocar el widget: el registro que falta (index.html#registrar=…, rutina.html) o Hoy.
    abrir: lista[0] ? comoRegistrar(lista[0]).web : "index.html",
    bloqueo: textosBloqueo({ score, racha, pendientes, rutina }),
  };
  if (dinero) {
    const disponible = (resumen.metricas ?? []).find((m) => m.clave === "disponible");
    datos.dinero = disponible ? { disponibleHoy: Math.round(Number(disponible.valor) || 0) } : null;
  }
  return datos;
}

/**
 * Datos de ejemplo (para la vista previa cuando no se pueden leer los tuyos). Mismo formato que la API.
 * Un viernes a las 15:20: 72 puntos, racha de 5, falta el almuerzo, trabajo útil en curso y luego ejercicio.
 */
export function ejemploWidget(ahora = new Date()) {
  const fecha = "2026-10-02";
  const dias = ["2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", fecha];
  const resumen = {
    fecha,
    tipoDia: "habil",
    score: 72,
    scoreAyer: 64,
    racha: 5,
    anillos: [
      { clave: "registro", nombre: "Registro", progreso: 0.75 },
      { clave: "cuerpo", nombre: "Cuerpo", progreso: 0.42 },
      { clave: "mente", nombre: "Mente", progreso: 0.6 },
    ],
    semana: dias.map((f, i) => ({ fecha: f, score: [58, 81, 70, 92, 66, 64, 72][i] })),
    pendientes: [{ clave: "almuerzo", emoji: "🍽️", texto: "Almuerzo", accion: "comida" }],
    metricas: [{ clave: "disponible", valor: 19100 }],
  };
  const fijo = new Date(`${fecha}T15:20:00-05:00`);
  const datos = armarWidget(
    {
      resumen,
      rutina: {
        ahora: "Trabajo útil",
        emojiAhora: emojiDe("trabajo"),
        quedan: "40 min",
        siguiente: "Ejercicio",
        emojiSiguiente: emojiDe("ejercicio"),
        hora: "17:00",
        mensaje: "🎯 Trabajo útil · 40 min",
      },
      sueno: { duracion: "7 h 10", indice: 82, etiqueta: "Anoche", enCama: false },
      desbloqueo: {
        abierto: false,
        minutos: 0,
        apps: [
          { emoji: "🎵", nombre: "TikTok", restantes: 0 },
          { emoji: "📸", nombre: "Instagram", restantes: 0 },
          { emoji: "▶️", nombre: "YouTube", restantes: 0 },
        ],
      },
      avisos: { sinLeer: 2 },
    },
    { ahora: fijo, dinero: true },
  );
  return { ...datos, actualizado: ahora.toISOString(), ejemplo: true };
}
