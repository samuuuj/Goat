// Frase del día de los widgets (E · Widgets). Funciones puras: las usan la API (GET /api/v1/widget),
// widgets.html y la tarjeta de Hoy, así la frase es la misma en todas partes (principio 1).
//
// Reglas: cortas, cómplices, estilo Apple; nunca regañan y nunca llevan montos (D-020).
// Se eligen por contexto (franja horaria, racha, puntaje, pendientes, fin de semana, festivo) y rotan cada día
// con una semilla `fecha + franja + contexto`: dos días seguidos nunca repiten frase dentro del mismo contexto.

/** Frases por contexto. `{racha}` = días de racha, `{siguiente}` = racha + 1, `{dia}` = "viernes". */
export const FRASES = Object.freeze({
  manana: [
    "Lo difícil ya empezó. Sigue.",
    "Un buen día se arma temprano.",
    "Primero lo importante. Lo demás espera.",
    "Café, plan y a darle.",
    "Hoy cuenta. Empieza por lo pequeño.",
    "El día es tuyo antes de que lo pidan otros.",
    "Desayuna, registra y arranca.",
    "Arranca suave, pero arranca.",
  ],
  tarde: [
    "Media jornada. Lo mejor sigue.",
    "Un bloque más y el día cambia de color.",
    "La tarde también suma. Sigue.",
    "Pausa corta, foco largo.",
    "Lo que hagas ahora, la noche lo agradece.",
    "Constancia le gana a intensidad.",
    "Vas bien. No sueltes el ritmo.",
    "Almuerza, respira y vuelve.",
  ],
  noche: [
    "Cierra el día como lo empezaste.",
    "Registra, suelta el celular y a dormir.",
    "Mañana empieza con lo que hagas esta noche.",
    "Buen trabajo hoy. Descansa en serio.",
    "Cierra lo pendiente y apaga la mente.",
    "Dormir bien también es entrenar.",
    "Último esfuerzo: el cierre del día.",
  ],
  madrugada: [
    "Es tarde. Tu yo de mañana te pide dormir.",
    "Lo que falte puede esperar al sol.",
    "Dormir ahora es la mejor jugada.",
    "Apaga la pantalla. Mañana se gana temprano.",
  ],
  racha: [
    "{racha} días seguidos. No rompas la cadena hoy.",
    "Racha de {racha}. Hoy es un día más, no uno menos.",
    "{racha} días al hilo. Esto ya es costumbre.",
    "La racha va en {racha}. Que hoy sume.",
    "{racha} días de constancia. Así se construye.",
    "Llevas {racha}. El día {siguiente} se gana igual.",
  ],
  puntaje_alto: [
    "Día redondo. Disfruta lo ganado.",
    "Así se ve un día bien jugado.",
    "Puntaje alto. Mantén la calma y el ritmo.",
    "Hoy estás en tu mejor versión.",
    "Nivel alto. Tu tiempo libre te lo ganaste.",
  ],
  subiendo: [
    "Mejor que ayer. Eso es lo que importa.",
    "Vas por encima de ayer. Sigue así.",
    "Hoy ya le ganas a ayer.",
    "Subiendo. Así se mueve la aguja.",
  ],
  pendientes: [
    "Un registro y vuelves al día.",
    "Registrar algo malo también cuenta.",
    "Anótalo como fue. Eso es lo que suma.",
    "Lo que falta toma menos de un minuto.",
    "Ponte al día y lo demás se abre.",
    "Quince segundos y quedas al día.",
  ],
  puntaje_bajo: [
    "Un día flojo no define la semana.",
    "Empieza por una cosa. Solo una.",
    "No hace falta un día perfecto. Hace falta uno más.",
    "Pequeño también cuenta. Haz lo siguiente.",
    "Hoy todavía tiene tiempo.",
    "Lo difícil es empezar. Lo demás fluye.",
  ],
  al_dia: [
    "Todo al día. Así da gusto.",
    "Al día. El tiempo libre es tuyo.",
    "Nada pendiente. Respira.",
    "Al día y con tiempo. Bien jugado.",
  ],
  fin_de_semana: [
    "Fin de semana: descansa sin perder el hilo.",
    "Descansa en serio. El lunes te lo agradece.",
    "Menos agenda, mismo Goat.",
    "El hábito no se toma el fin de semana.",
  ],
  festivo: [
    "Festivo: día libre, hábitos encendidos.",
    "Disfruta el festivo. Lo básico, igual.",
    "Hoy no hay clase, pero sí hay racha.",
  ],
  lunes: ["Lunes. La semana se decide hoy.", "Semana nueva, misma cadena.", "Lunes: arranca la semana con un registro."],
  viernes: ["Viernes. Cierra la semana fuerte.", "Viernes: termina lo que empezaste el lunes.", "Último día hábil. Que cuente."],
});

/** Franja del día por la hora de Bogotá (0–23): madrugada 0–4 · mañana 5–11 · tarde 12–18 · noche 19–23. */
export function franjaDe(hora) {
  const h = Number(hora);
  if (h < 5) return "madrugada";
  if (h < 12) return "manana";
  if (h < 19) return "tarde";
  return "noche";
}

/** Días desde 2020-01-01 de una fecha YYYY-MM-DD (para la rotación diaria). */
function numeroDeDia(fecha) {
  const t = Date.parse(`${fecha}T12:00:00Z`);
  return Number.isFinite(t) ? Math.floor((t - Date.UTC(2020, 0, 1, 12)) / 86_400_000) : 0;
}

/** Hash pequeño y estable de un texto (FNV-1a de 32 bits). */
function hash(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const mcd = (a, b) => (b === 0 ? a : mcd(b, a % b));

/** Paso de la rotación: coprimo con n, así días seguidos caen en frases distintas y se recorren todas. */
function pasoPara(n) {
  return [7, 11, 13, 17, 19, 23, 29].find((p) => p % n !== 0 && mcd(p, n) === 1) ?? 1;
}

/**
 * Contextos que aplican, del más específico al más general (la franja siempre va al final).
 * `d`: { franja, score, scoreAyer, racha, pendientes (número), tipoDia, diaSemana (1 = lunes) }.
 */
export function contextosDe(d) {
  if (d.franja === "madrugada") return ["madrugada"];
  const lista = [];
  const score = Number(d.score) || 0;
  const tarde = d.franja === "tarde" || d.franja === "noche";
  if (d.pendientes > 0) lista.push("pendientes");
  if (d.racha >= 3) lista.push("racha");
  if (score >= 80) lista.push("puntaje_alto");
  else if (d.scoreAyer != null && tarde && score >= Number(d.scoreAyer) + 5) lista.push("subiendo");
  if (score < 40 && tarde) lista.push("puntaje_bajo");
  if (!(d.pendientes > 0) && score < 80) lista.push("al_dia");
  if (d.tipoDia === "festivo") lista.push("festivo");
  else if (d.tipoDia === "fin_de_semana") lista.push("fin_de_semana");
  else if (d.diaSemana === 1) lista.push("lunes");
  else if (d.diaSemana === 5) lista.push("viernes");
  lista.push(d.franja);
  return lista;
}

/**
 * La frase de hoy. Mezcla las frases de los 2 contextos más específicos con las de la franja
 * y rota con la fecha: cambia cada día y por franja, y se queda quieta mientras el contexto no cambie
 * (el widget se refresca cada 15 min sin que la frase salte).
 * `d`: { fecha: "2026-10-03", franja, score, scoreAyer, racha, pendientes, tipoDia, diaSemana, dia: "viernes" }.
 */
export function elegirFrase(d) {
  const contextos = contextosDe(d);
  const usados = [...new Set([...contextos.slice(0, 2), d.franja])].filter((c) => FRASES[c]);
  const pool = usados.flatMap((c) => FRASES[c]);
  const n = pool.length;
  const i = (numeroDeDia(d.fecha) * pasoPara(n) + hash(`${d.franja}|${usados.join(",")}`)) % n;
  const racha = Math.max(0, Math.round(Number(d.racha) || 0));
  return pool[i]
    .replaceAll("{racha}", String(racha))
    .replaceAll("{siguiente}", String(racha + 1))
    .replaceAll("{dia}", d.dia ?? "hoy");
}
