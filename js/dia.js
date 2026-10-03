// Día lógico del sistema: zona America/Bogota y corte a las 04:00.
// Debe coincidir con public.dia_logico() de supabase/schema.sql.

export const ZONA = "America/Bogota";
export const HORA_CORTE = 4;

const formatoISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formatoDiaSemana = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, weekday: "long" });
const formatoDiaMes = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, day: "2-digit", month: "short" });
const formatoHora = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Fecha lógica YYYY-MM-DD: antes de las 04:00 sigue siendo "ayer". */
export function diaLogico(momento) {
  return formatoISO.format(new Date(momento.getTime() - HORA_CORTE * 3_600_000));
}

/** Mediodía de Bogotá de una fecha YYYY-MM-DD, para formatearla sin saltos de zona. */
function mediodia(fecha) {
  return new Date(`${fecha}T12:00:00-05:00`);
}

/** "viernes" */
export function nombreDia(fecha) {
  return formatoDiaSemana.format(mediodia(fecha));
}

/** "02 oct" */
export function diaYMes(fecha) {
  const partes = formatoDiaMes.formatToParts(mediodia(fecha));
  const dia = (partes.find((p) => p.type === "day")?.value ?? "").padStart(2, "0");
  const mes = partes.find((p) => p.type === "month")?.value.replace(".", "") ?? "";
  return `${dia} ${mes}`;
}

/** "21:40" */
export function horaBogota(momento) {
  return formatoHora.format(momento);
}

/** Hora del día en Bogotá como decimal: 21:30 → 21.5 */
export function horaDecimal(momento) {
  const [h, m] = formatoHora.format(momento).split(":").map(Number);
  return h + m / 60;
}
