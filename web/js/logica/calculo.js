// Resumen del día a partir de los registros. Funciones puras (no tocan la base de datos) para poder probarlas.
// Fórmula v1 de Central (D-039), provisional hasta que 09 · Puntuación madure la suya.

import { HORA_CORTE, diaLogico, horaDecimal } from "./dia.js";
import { formatoDuracion, formatoMiles } from "./formato.js";
// Cruces con otros módulos (funciones puras que no importan este archivo: no hay ciclo).
import { obligatoriosVencidos } from "../rutina/logica.js";
import { cuentaParaMeta } from "../ejercicio/logica.js";

// ── Entradas ─────────────────────────────────────────────────────────────

/** Arranque mientras Samuel responde P-05 y P-06. Se cambian en la tabla `perfil`, columna `metas`. */
export const METAS_BASE = {
  kcal: 2600,
  proteina_g: 130,
  estudio_min_dia: 120,
  presupuesto_mensual: 500_000,
  gym_semana: 4,
};

/** Días hacia atrás que necesita el cálculo (para la racha). */
export const DIAS_HISTORIA = 60;

/** Lee las metas guardadas; lo que falte o no sea un número positivo toma el valor base. */
export function leerMetas(guardadas) {
  const fuente = typeof guardadas === "object" && guardadas !== null ? guardadas : {};
  const metas = { ...METAS_BASE };
  for (const clave of Object.keys(METAS_BASE)) {
    const valor = Number(fuente[clave]);
    if (Number.isFinite(valor) && valor > 0) metas[clave] = valor;
  }
  return metas;
}

// ── Fechas (YYYY-MM-DD, días lógicos) ────────────────────────────────────

const HORA_MS = 3_600_000;
const mediodia = (fecha) => new Date(`${fecha}T12:00:00Z`);

export function sumarDias(fecha, dias) {
  const d = mediodia(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export const inicioDeMes = (fecha) => `${fecha.slice(0, 8)}01`;

function diasDelMes(fecha) {
  const [anio, mes] = fecha.split("-").map(Number);
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** Lunes = 1 … domingo = 7. */
function diaDeLaSemana(fecha) {
  return ((mediodia(fecha).getUTCDay() + 6) % 7) + 1;
}

/** Instante de una hora en punto de Bogotá (UTC−5 todo el año) en esa fecha. */
function instante(fecha, hora) {
  return Date.parse(`${fecha}T${String(hora).padStart(2, "0")}:00:00-05:00`);
}

/** Hora del día lógico: la 01:30 de la madrugada es 25,5 (sigue siendo "hoy"). */
function horaLogica(ahora) {
  const hora = horaDecimal(ahora);
  return hora < HORA_CORTE ? hora + 24 : hora;
}

// ── Registros agrupados por día ──────────────────────────────────────────

const diaVacio = () => ({ comidas: [], egresos: 0, ultimoFinanzas: 0, cierre: false, estudioMin: 0, gym: 0 });

function agrupar(registros) {
  const dias = new Map();
  const del = (fecha) => {
    let dia = dias.get(fecha);
    if (!dia) dias.set(fecha, (dia = diaVacio()));
    return dia;
  };

  for (const comida of registros.comidas) del(comida.fecha).comidas.push(comida);
  for (const mov of registros.movimientos) {
    const dia = del(mov.fecha);
    if (mov.tipo === "egreso") dia.egresos += Number(mov.monto);
    dia.ultimoFinanzas = Math.max(dia.ultimoFinanzas, Date.parse(mov.momento));
  }
  for (const checkin of registros.checkins) {
    const dia = del(checkin.fecha);
    if (checkin.tipo === "cierre") dia.cierre = true;
    dia.ultimoFinanzas = Math.max(dia.ultimoFinanzas, Date.parse(checkin.momento));
  }
  for (const sesion of registros.estudio) del(sesion.fecha).estudioMin += Number(sesion.minutos);
  // Caminata y movilidad se ven en Movimiento, pero no cuentan para la meta semanal de entrenos.
  for (const sesion of registros.gym) if (cuentaParaMeta(sesion)) del(sesion.fecha).gym += 1;
  return dias;
}

const comio = (dia, tipo) => dia.comidas.some((c) => c.tipo === tipo);
const sumar = (dia, campo) => dia.comidas.reduce((total, c) => total + Number(c[campo] ?? 0), 0);

/** Los 4 registros que cierran un día: desayuno, almuerzo, cena y cierre de gastos. */
const REGISTROS_DEL_DIA = 4;

function registrosHechos(dia) {
  return [comio(dia, "desayuno"), comio(dia, "almuerzo"), comio(dia, "cena"), dia.cierre].filter(Boolean).length;
}

// ── Lo que falta (requisitos progresivos, docs/modulos/03-desbloqueo.md) ─

const PENDIENTES = {
  desayuno: { emoji: "🍳", texto: "Desayuno", accion: "comida" },
  almuerzo: { emoji: "🍽️", texto: "Almuerzo", accion: "comida" },
  checkin_finanzas: { emoji: "💸", texto: "Check-in de gastos", accion: "gasto" },
  cena: { emoji: "🌙", texto: "Cena", accion: "comida" },
  cierre_finanzas: { emoji: "🧾", texto: "Cierre de gastos", accion: "gasto" },
};

/** Requisitos que la hora ya exige y no están hechos. Exige registros, nunca metas. */
function faltantes(fecha, dia, ahora) {
  const hora = horaLogica(ahora);
  const faltan = [];
  if (hora >= 10.5 && !comio(dia, "desayuno")) faltan.push("desayuno");
  if (hora >= 15 && !comio(dia, "almuerzo")) faltan.push("almuerzo");
  if (hora >= 13 && hora < 22) {
    // 13:00–15:00: algo de finanzas desde las 08:00 · 15:00–22:00: algo en las últimas 5 horas.
    const desde = hora < 15 ? instante(fecha, 8) : ahora.getTime() - 5 * HORA_MS;
    if (dia.ultimoFinanzas < desde) faltan.push("checkin_finanzas");
  }
  if (hora >= 22 && !comio(dia, "cena")) faltan.push("cena");
  if (hora >= 22 && !dia.cierre) faltan.push("cierre_finanzas");
  return faltan;
}

// ── Finanzas ─────────────────────────────────────────────────────────────

function gastadoEnElMesAntesDe(fecha, dias) {
  let total = 0;
  for (let f = inicioDeMes(fecha); f < fecha; f = sumarDias(f, 1)) total += dias.get(f)?.egresos ?? 0;
  return total;
}

/** Lo que queda del presupuesto del mes repartido entre los días que faltan (incluido este). */
function presupuestoDelDia(fecha, metas, dias) {
  const restante = metas.presupuesto_mensual - gastadoEnElMesAntesDe(fecha, dias);
  const diasRestantes = diasDelMes(fecha) - Number(fecha.slice(8)) + 1;
  return Math.max(0, Math.floor(restante / diasRestantes));
}

// ── Puntuación v1 ────────────────────────────────────────────────────────
// Registro 30 · Comidas 15 · Finanzas 10 · Estudio 10. Sueño, pasos y ocio entran cuando lleguen sus datos.

const PESO_TOTAL = 30 + 15 + 10 + 10;

function puntuar(fecha, dia, metas, dias) {
  const proteina = sumar(dia, "proteina_g");
  const kcal = sumar(dia, "kcal");
  const registro = (30 * registrosHechos(dia)) / REGISTROS_DEL_DIA;
  const comidas =
    10 * Math.min(proteina / (0.9 * metas.proteina_g), 1) + (Math.abs(kcal - metas.kcal) <= 0.15 * metas.kcal ? 5 : 0);
  const finanzas = dia.egresos <= presupuestoDelDia(fecha, metas, dias) ? 10 : 0;
  const estudio = 10 * Math.min(dia.estudioMin / metas.estudio_min_dia, 1);
  return Math.round(((registro + comidas + finanzas + estudio) / PESO_TOTAL) * 100);
}

/** Días seguidos con los 4 registros completos. Hoy suma cuando ya está completo; si no, no rompe la racha. */
function calcularRacha(hoy, dias) {
  let racha = 0;
  for (let f = sumarDias(hoy, -1); racha < DIAS_HISTORIA; f = sumarDias(f, -1)) {
    const dia = dias.get(f);
    if (!dia || registrosHechos(dia) < REGISTROS_DEL_DIA) break;
    racha++;
  }
  const deHoy = dias.get(hoy);
  return racha + (deHoy && registrosHechos(deHoy) === REGISTROS_DEL_DIA ? 1 : 0);
}

function tipoDeDia(fecha, festivos) {
  const festivo = festivos.find((f) => f.fecha === fecha);
  if (festivo) return { tipo: "festivo", descripcion: `Festivo · ${festivo.nombre}` };
  if (diaDeLaSemana(fecha) >= 6) return { tipo: "fin_de_semana", descripcion: "Fin de semana" };
  return { tipo: "habil", descripcion: "Día hábil" };
}

// ── Métricas ─────────────────────────────────────────────────────────────
// Las frases nunca llevan montos de dinero: se leen aunque el modo discreto esté activo (D-020).

function construirMetricas(hoy, dia, metas, dias) {
  const disponible = presupuestoDelDia(hoy, metas, dias) - dia.egresos;
  const gastadoMes = gastadoEnElMesAntesDe(hoy, dias) + dia.egresos;
  const pctPresupuesto = Math.round((gastadoMes / metas.presupuesto_mensual) * 100);
  const pctMes = Math.round((Number(hoy.slice(8)) / diasDelMes(hoy)) * 100);

  const proteina = Math.round(sumar(dia, "proteina_g"));
  const kcal = Math.round(sumar(dia, "kcal"));
  const enRangoKcal = Math.abs(kcal - metas.kcal) <= 0.15 * metas.kcal;

  const lunes = sumarDias(hoy, 1 - diaDeLaSemana(hoy));
  let entrenos = 0;
  for (let f = lunes; f <= hoy; f = sumarDias(f, 1)) entrenos += dias.get(f)?.gym ?? 0;
  const faltanEntrenos = metas.gym_semana - entrenos;

  return [
    {
      clave: "disponible",
      etiqueta: "Disponible hoy",
      valor: disponible,
      formato: "cop",
      sensible: true,
      frase:
        disponible < 0
          ? "Hoy te pasaste. Mañana se reparte lo que queda del mes."
          : `Vas en ${pctPresupuesto}% del presupuesto y va ${pctMes}% del mes.`,
    },
    {
      clave: "proteina",
      etiqueta: "Proteína",
      valor: proteina,
      meta: metas.proteina_g,
      formato: "gramos",
      sensible: false,
      frase:
        proteina >= metas.proteina_g
          ? "Meta cumplida. Así se gana músculo 💪"
          : `Faltan ${metas.proteina_g - proteina} g para tu meta de músculo.`,
    },
    {
      clave: "kcal",
      etiqueta: "Calorías",
      valor: kcal,
      meta: metas.kcal,
      formato: "kcal",
      sensible: false,
      frase: enRangoKcal
        ? "Justo en tu rango para ganar músculo."
        : kcal < metas.kcal
          ? `Faltan ${formatoMiles(metas.kcal - kcal)} kcal. Para crecer hay que comer.`
          : "Por encima de tu meta de hoy.",
    },
    {
      clave: "estudio",
      etiqueta: "Estudio",
      valor: dia.estudioMin,
      meta: metas.estudio_min_dia,
      formato: "duracion",
      sensible: false,
      frase:
        dia.estudioMin === 0
          ? "Una sesión de 25 min ya cuenta."
          : dia.estudioMin < metas.estudio_min_dia
            ? `${formatoDuracion(metas.estudio_min_dia - dia.estudioMin)} más y cumples el día.`
            : "Meta de estudio cumplida 📚",
    },
    {
      clave: "gym",
      etiqueta: "Entrenos esta semana",
      valor: entrenos,
      meta: metas.gym_semana,
      formato: "entero",
      sensible: false,
      frase:
        faltanEntrenos <= 0
          ? "Semana cumplida 🏋️"
          : `Te ${faltanEntrenos === 1 ? "falta 1" : `faltan ${faltanEntrenos}`} esta semana.`,
    },
  ];
}

// ── Resumen completo ─────────────────────────────────────────────────────

/**
 * `registros`: { metas, comidas, movimientos, checkins (solo finanzas), estudio, gym, festivos, rutinaBloques, rutinaChecks }.
 * Devuelve lo que pinta la pantalla de inicio (y lo que devolverá GET /api/v1/hoy).
 */
export function construirResumen(registros, ahora) {
  const { metas } = registros;
  const hoy = diaLogico(ahora);
  const dias = agrupar(registros);
  const dia = dias.get(hoy) ?? diaVacio();
  const { tipo, descripcion } = tipoDeDia(hoy, registros.festivos);

  const score = puntuar(hoy, dia, metas, dias);
  const semana = Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDias(hoy, i - 6);
    const delDia = dias.get(fecha);
    return { fecha, score: fecha === hoy ? score : delDia ? puntuar(fecha, delDia, metas, dias) : null };
  });

  const hechos = registrosHechos(dia);
  const proteina = sumar(dia, "proteina_g");
  const anillos = [
    { clave: "registro", nombre: "Registro", progreso: hechos / REGISTROS_DEL_DIA, detalle: `${hechos} de ${REGISTROS_DEL_DIA} registros` },
    {
      clave: "cuerpo",
      nombre: "Cuerpo",
      progreso: proteina / metas.proteina_g,
      detalle: `${Math.round(proteina)} de ${metas.proteina_g} g de proteína`,
    },
    {
      clave: "mente",
      nombre: "Mente",
      progreso: dia.estudioMin / metas.estudio_min_dia,
      detalle: `${formatoDuracion(dia.estudioMin)} de ${formatoDuracion(metas.estudio_min_dia)} de estudio`,
    },
  ];

  return {
    fecha: hoy,
    tipoDia: tipo,
    descripcionDia: descripcion,
    score,
    scoreAyer: semana[5].score,
    racha: calcularRacha(hoy, dias),
    anillos,
    pendientes: [
      ...faltantes(hoy, dia, ahora).map((clave) => ({ clave, ...PENDIENTES[clave] })),
      // Bloques obligatorios de la rutina que ya vencieron sin marcar ("saltado" también cuenta como registro).
      ...obligatoriosVencidos(registros.rutinaBloques ?? [], registros.rutinaChecks ?? [], ahora, {
        fecha: hoy,
        festivos: registros.festivos ?? [],
      }).map((pendiente) => ({ ...pendiente, modulo: "rutina" })),
    ],
    metricas: construirMetricas(hoy, dia, metas, dias),
    semana,
  };
}
