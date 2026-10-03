// Rutina, clases y tareas: reglas puras (sin pantalla ni internet).
// Las usan rutina.html, la API (api/_rutas/rutina.js) y la integración: faltantes() de calculo.js
// sumará obligatoriosVencidos() a lo que falta en Hoy, en la puerta de desbloqueo y en el widget.
// No importar calculo.js aquí: calculo.js importará este archivo (se evitaría un ciclo).

import { HORA_CORTE, diaLogico, diaYMes, horaBogota, nombreDia } from "../logica/dia.js";

const MINUTO = 60_000;
const CORTE_MIN = HORA_CORTE * 60;

/** Un bloque sin marcar "vence" 30 min después de terminar (D-056). */
export const MINUTOS_GRACIA = 30;

/** Tipos de bloque (mismo orden y valores que el check de rutina_bloques en schema.sql). */
export const TIPOS = {
  despertar: { emoji: "⏰", texto: "Levantarte" },
  caminar: { emoji: "🚶", texto: "Caminar" },
  desayuno: { emoji: "🍳", texto: "Desayuno" },
  trabajo: { emoji: "🎯", texto: "Trabajo útil" },
  descanso: { emoji: "☕", texto: "Pausa" },
  almuerzo: { emoji: "🍽️", texto: "Almuerzo" },
  ejercicio: { emoji: "🏋️", texto: "Ejercicio" },
  cena: { emoji: "🍲", texto: "Cena" },
  estudio: { emoji: "📚", texto: "Estudiar" },
  clase_presencial: { emoji: "🏫", texto: "Clase" },
  clase_virtual: { emoji: "💻", texto: "Clase virtual" },
  trabajo_uni: { emoji: "📝", texto: "Trabajos de la U" },
  dormir: { emoji: "😴", texto: "A dormir" },
  libre: { emoji: "🌿", texto: "Libre" },
  otro: { emoji: "📌", texto: "Otro" },
};

export const TIPOS_VALIDOS = Object.keys(TIPOS);
export const ESTADOS_CHECK = ["hecho", "saltado"];
export const ESTADOS_TAREA = ["pendiente", "en_progreso", "hecha"];

/** Las pausas y el tiempo libre no se marcan: no cuentan para el cumplimiento ni vencen. */
const NO_MARCABLES = new Set(["descanso", "libre"]);
export const esMarcable = (bloque) => !NO_MARCABLES.has(bloque.tipo);

export const emojiDe = (tipo) => TIPOS[tipo]?.emoji ?? "📌";

/** 1 = lunes … 7 = domingo. */
export const DIAS = [
  { n: 1, corto: "L", abrev: "Lun", nombre: "lunes" },
  { n: 2, corto: "M", abrev: "Mar", nombre: "martes" },
  { n: 3, corto: "M", abrev: "Mié", nombre: "miércoles" },
  { n: 4, corto: "J", abrev: "Jue", nombre: "jueves" },
  { n: 5, corto: "V", abrev: "Vie", nombre: "viernes" },
  { n: 6, corto: "S", abrev: "Sáb", nombre: "sábado" },
  { n: 7, corto: "D", abrev: "Dom", nombre: "domingo" },
];

const HABILES = [1, 2, 3, 4, 5];
const TODOS = [1, 2, 3, 4, 5, 6, 7];

// ── Horas y fechas ───────────────────────────────────────────────────────

/** "06:10" o "06:10:00" → 370. Devuelve null si no es una hora válida. */
export function aMinutos(hora) {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(hora ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 370 → "06:10" (da la vuelta a la medianoche). */
export function aHora(minutos) {
  const m = ((Math.round(minutos) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** En el día lógico la 00:30 va después de las 23:00 (el día termina a las 04:00). */
export const minutoLogico = (minutos) => (minutos < CORTE_MIN ? minutos + 1440 : minutos);

const mediodiaUTC = (fecha) => new Date(`${fecha}T12:00:00Z`);

export function sumarDias(fecha, dias) {
  const d = mediodiaUTC(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Lunes = 1 … domingo = 7. */
export const diaSemana = (fecha) => ((mediodiaUTC(fecha).getUTCDay() + 6) % 7) + 1;

/** Lunes de la semana de esa fecha. */
export const lunesDe = (fecha) => sumarDias(fecha, 1 - diaSemana(fecha));

/** "festivo" · "fin_de_semana" · "habil". `festivos`: [{ fecha, nombre }]. */
export function tipoDia(fecha, festivos = []) {
  if (festivos.some((f) => f.fecha === fecha)) return "festivo";
  return diaSemana(fecha) >= 6 ? "fin_de_semana" : "habil";
}

/** Qué día de la plantilla se usa: los festivos usan los bloques del domingo. */
export const diaDePlantilla = (fecha, tipo) => (tipo === "festivo" ? 7 : diaSemana(fecha));

/** Instante (ms) de un minuto lógico de esa fecha en Bogotá (UTC−5 todo el año, sin horario de verano). */
export const instante = (fecha, minutosLogicos) => Date.parse(`${fecha}T00:00:00-05:00`) + minutosLogicos * MINUTO;

/** ISO 8601 con la zona de Bogotá: "2026-10-06T06:10:00-05:00" (lo que entiende Atajos). */
export function isoBogota(ms) {
  return `${new Date(ms - 5 * 3_600_000).toISOString().slice(0, 19)}-05:00`;
}

/** "Lunes a viernes", "Martes y miércoles", "Todos los días", "Lun, Mié y Vie". */
export function textoDias(dias = []) {
  const lista = [...new Set(dias.map(Number))].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  const clave = lista.join("");
  if (clave === "1234567") return "Todos los días";
  if (clave === "12345") return "Lunes a viernes";
  if (clave === "123456") return "Lunes a sábado";
  if (clave === "67") return "Fines de semana";
  if (lista.length === 0) return "Ningún día";
  const nombres = lista.map((d) => DIAS[d - 1]);
  if (lista.length === 1) return capital(nombres[0].nombre);
  if (lista.length === 2) return capital(`${nombres[0].nombre} y ${nombres[1].nombre}`);
  return `${nombres.slice(0, -1).map((d) => d.abrev).join(", ")} y ${nombres.at(-1).abrev}`;
}

const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** "06:10 – 06:55" */
export const rangoTexto = (bloque) => `${aHora(bloque.inicioMin)} – ${aHora(bloque.finMin)}`;

// ── Bloques de un día ────────────────────────────────────────────────────

/** Minutos lógicos de inicio y fin de un bloque de la plantilla. */
function minutosDe(bloque) {
  const inicioMin = minutoLogico(aMinutos(bloque.hora_inicio) ?? 0);
  return { inicioMin, finMin: inicioMin + Number(bloque.duracion_min) };
}

/**
 * Bloques activos de la plantilla que tocan esa fecha, ordenados por hora.
 * `tipo`: "habil" · "fin_de_semana" · "festivo" (el festivo usa los bloques del domingo).
 * Cada uno sale con { fecha, inicioMin, finMin, inicio, fin } (inicio y fin en ms).
 */
export function bloquesDelDia(bloques, fecha, tipo = tipoDia(fecha)) {
  const dia = diaDePlantilla(fecha, tipo);
  return bloques
    .filter((b) => b.activo !== false && (b.dias ?? []).map(Number).includes(dia))
    .map((b) => {
      const { inicioMin, finMin } = minutosDe(b);
      return { ...b, fecha, inicioMin, finMin, inicio: instante(fecha, inicioMin), fin: instante(fecha, finMin) };
    })
    .sort((a, b) => a.inicioMin - b.inicioMin || (a.orden ?? 0) - (b.orden ?? 0) || String(a.titulo).localeCompare(String(b.titulo)));
}

const ms = (ahora) => (ahora instanceof Date ? ahora.getTime() : Number(ahora));

/** El bloque que está pasando ahora (si se cruzan, el que empezó de último). */
export function bloqueActual(delDia, ahora) {
  const t = ms(ahora);
  const enCurso = delDia.filter((b) => b.inicio <= t && t < b.fin);
  return enCurso.sort((a, b) => b.inicio - a.inicio)[0] ?? null;
}

/** El próximo bloque que todavía no empieza. */
export function siguiente(delDia, ahora) {
  const t = ms(ahora);
  return delDia.filter((b) => b.inicio > t).sort((a, b) => a.inicio - b.inicio)[0] ?? null;
}

/**
 * Estado de cada bloque de un día: pendiente · ahora · hecho · saltado · vencido.
 * Vencido = terminó hace más de 30 min y nadie lo marcó. Entre el fin y los 30 min sigue "pendiente" con porMarcar.
 * `checks`: filas de rutina_checks (de cualquier fecha; se usan las de `fecha`).
 */
export function estadoDelDia(bloques, checks, ahora, { fecha = diaLogico(new Date(ms(ahora))), festivos = [], tipo } = {}) {
  const t = ms(ahora);
  const tipoDelDia = tipo ?? tipoDia(fecha, festivos);
  const marcas = new Map(checks.filter((c) => c.fecha === fecha).map((c) => [c.bloque_id, c]));
  return bloquesDelDia(bloques, fecha, tipoDelDia).map((b) => {
    const check = marcas.get(b.id) ?? null;
    const marcable = esMarcable(b);
    let estado;
    if (check && marcable) estado = check.estado;
    else if (t < b.inicio) estado = "pendiente";
    else if (t < b.fin) estado = "ahora";
    else if (marcable && t >= b.fin + MINUTOS_GRACIA * MINUTO) estado = "vencido";
    else estado = "pendiente";
    return {
      ...b,
      check: marcable ? check : null,
      marcable,
      estado,
      porMarcar: marcable && !check && t >= b.fin,
    };
  });
}

/**
 * Bloques obligatorios que vencieron sin marcar (fin + 30 min). Formato listo para faltantes() de calculo.js:
 * { clave: "rutina:<id>", emoji, texto, accion: "rutina", bloque_id, fin }.
 * Marcar "saltado" también lo quita: registrar algo malo cuenta como registro (principio 3).
 */
export function obligatoriosVencidos(bloques = [], checks = [], ahora = new Date(), opciones = {}) {
  return estadoDelDia(bloques, checks, ahora, opciones)
    .filter((b) => b.obligatorio && b.estado === "vencido")
    .map((b) => ({
      clave: `rutina:${b.id}`,
      emoji: emojiDe(b.tipo),
      texto: b.titulo,
      accion: "rutina",
      bloque_id: b.id,
      fin: isoBogota(b.fin),
    }));
}

/**
 * Qué marca el atajo "✅ Hecho" (bloque "actual"): entre los bloques que ya empezaron y siguen sin marcar,
 * el que termina (o terminó) más cerca de ahora. Así, si terminaste de caminar a las 06:57, marca Caminar
 * (06:55) y no el desayuno que acaba de empezar.
 */
export function bloqueParaMarcar(items, ahora) {
  const t = ms(ahora);
  return (
    items
      .filter((b) => (b.marcable ?? esMarcable(b)) && !b.check && b.inicio <= t)
      .sort((a, b) => Math.abs(a.fin - t) - Math.abs(b.fin - t) || b.inicio - a.inicio)[0] ?? null
  );
}

/** % de bloques hechos (marcables) y de obligatorios. pct de 0 a 1, o null si no hay bloques. */
export function cumplimiento(items) {
  const marcables = items.filter((b) => b.marcable ?? esMarcable(b));
  const contar = (lista) => {
    const hechos = lista.filter((b) => b.estado === "hecho").length;
    const marcados = lista.filter((b) => b.estado === "hecho" || b.estado === "saltado").length;
    return { total: lista.length, hechos, marcados, pct: lista.length ? hechos / lista.length : null };
  };
  return { ...contar(marcables), obligatorios: contar(marcables.filter((b) => b.obligatorio)) };
}

/** La semana (lunes a domingo) de `fecha`: estado y cumplimiento por día. */
export function semana(bloques, checks, ahora, { fecha = diaLogico(new Date(ms(ahora))), festivos = [] } = {}) {
  const hoy = diaLogico(new Date(ms(ahora)));
  const lunes = lunesDe(fecha);
  return Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(lunes, i);
    const tipo = tipoDia(f, festivos);
    const items = estadoDelDia(bloques, checks, ahora, { fecha: f, tipo });
    return {
      fecha: f,
      dia: DIAS[i],
      tipo,
      festivo: festivos.find((x) => x.fecha === f)?.nombre ?? null,
      esHoy: f === hoy,
      futuro: f > hoy,
      items,
      cumplimiento: cumplimiento(items),
    };
  });
}

/** Lo que muestra la tarjeta "Ahora" y responde GET rutina/ahora. Mensaje corto con emoji, sin montos. */
export function ahoraYSiguiente(items, ahora) {
  const t = ms(ahora);
  const actual = bloqueActual(items, t);
  const proximo = siguiente(items, t);
  let mensaje;
  if (actual) {
    const quedan = Math.max(1, Math.ceil((actual.fin - t) / MINUTO));
    mensaje = `${emojiDe(actual.tipo)} ${actual.titulo} · ${duracionTexto(quedan)}`;
  } else if (proximo) {
    mensaje = `${emojiDe(proximo.tipo)} ${proximo.titulo} a las ${aHora(proximo.inicioMin)}`;
  } else {
    mensaje = items.length ? "🌙 Nada más por hoy" : "🗓️ Sin rutina hoy";
  }
  return { actual, siguiente: proximo, mensaje };
}

/** 45 → "45 min" · 90 → "1h 30" */
export function duracionTexto(minutos) {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}`;
}

// ── Choques de horario ───────────────────────────────────────────────────

/** Pares de bloques que se cruzan algún día: [{ a, b, dias, desde, hasta }]. Tocarse (fin = inicio) no es choque. */
export function choques(bloques) {
  const activos = bloques.filter((b) => b.activo !== false && b.tipo !== "libre").map((b) => ({ ...b, ...minutosDe(b) }));
  const lista = [];
  for (let i = 0; i < activos.length; i++) {
    for (let j = i + 1; j < activos.length; j++) {
      const a = activos[i];
      const b = activos[j];
      const dias = (a.dias ?? []).map(Number).filter((d) => (b.dias ?? []).map(Number).includes(d));
      if (dias.length === 0) continue;
      const desde = Math.max(a.inicioMin, b.inicioMin);
      const hasta = Math.min(a.finMin, b.finMin);
      if (desde < hasta) lista.push({ a, b, dias: dias.sort((x, y) => x - y), desde: aHora(desde), hasta: aHora(hasta) });
    }
  }
  return lista;
}

// ── Encuesta → plantilla semanal ─────────────────────────────────────────

/** Respuestas por defecto de la encuesta (lo que pidió Samuel: levantarse a las 6, caminar 45 min…). */
export const ENCUESTA_BASE = {
  despertar: { habil: "06:00", finDeSemana: null }, // null = la misma hora todos los días
  caminata: { activa: true, minutos: 45 },
  desayuno: { preparar: 20, comer: 20 },
  trabajo: { activo: true, inicio: "08:00", horas: 4, ritmo: "50/10", dias: HABILES },
  almuerzo: { hora: "12:30", minutos: 60 },
  ejercicio: { activo: true, dias: HABILES, hora: "17:00", minutos: 60, obligatorio: true },
  cena: { hora: "19:00", minutos: 30 },
  caminataNoche: { activa: true, minutos: 20 },
  estudio: { activo: true, dias: HABILES, hora: "20:00", minutos: 90 },
  clasesPresenciales: [], // [{ materia, dias, inicio, fin, lugar }]
  clasesVirtuales: [], // [{ materia, dias, inicio, fin, enlace }]
  trabajosUni: [], // [{ titulo, dias, inicio, fin }]
  dormir: { hora: "22:00" },
};

export const RITMOS = { "50/10": [50, 10], "25/5": [25, 5] };

const entre = (n, min, max, porDefecto) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(Math.max(v, min), max) : porDefecto;
};
const diasValidos = (dias, porDefecto) => {
  const lista = [...new Set((dias ?? []).map(Number))].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7).sort((a, b) => a - b);
  return lista.length ? lista : porDefecto;
};
const textoCorto = (t, max) => {
  const s = String(t ?? "").trim();
  return s ? s.slice(0, max) : null;
};
export const enlaceSeguro = (url) => {
  const s = String(url ?? "").trim();
  return /^https:\/\/\S+$/.test(s) && s.length <= 300 ? s : null;
};

/** Duración entre dos horas ("09:00" → "12:00" = 180). Si el fin es antes, cruza la medianoche. */
function duracionEntre(inicio, fin) {
  const a = aMinutos(inicio);
  const b = aMinutos(fin);
  if (a === null || b === null) return null;
  return b > a ? b - a : b + 1440 - a;
}

/**
 * Arma la plantilla semanal a partir de las respuestas de la encuesta.
 * Primero los bloques fijos (mañana, comidas, ejercicio, clases, trabajos de la U, estudio, dormir) y después
 * el trabajo útil en ciclos (50/10 o 25/5) que se salta solo los ratos en que hay otra cosa ese día.
 * Devuelve filas listas para rutina_bloques (sin id ni user_id).
 */
export function generarPlantilla(respuestas = {}) {
  const r = { ...ENCUESTA_BASE, ...respuestas };
  const fijos = [];
  const agregar = (b) => {
    const inicio = aMinutos(b.hora_inicio);
    if (inicio === null) return;
    fijos.push({
      titulo: textoCorto(b.titulo, 60) ?? TIPOS[b.tipo].texto,
      tipo: b.tipo,
      dias: diasValidos(b.dias, TODOS),
      hora_inicio: aHora(inicio),
      duracion_min: entre(b.duracion_min, 5, 600, 30),
      obligatorio: Boolean(b.obligatorio),
      aviso_min: entre(b.aviso_min ?? 0, 0, 120, 0),
      lugar: textoCorto(b.lugar, 80),
      enlace: enlaceSeguro(b.enlace),
      materia: textoCorto(b.materia, 60),
      notas: null,
    });
  };

  // Mañana: levantarse → caminar → preparar desayuno → desayunar. Si el fin de semana te levantas a otra hora, va aparte.
  const habil = aMinutos(r.despertar?.habil) ?? 360;
  const finde = aMinutos(r.despertar?.finDeSemana);
  const grupos = finde === null || finde === habil ? [[TODOS, habil]] : [[HABILES, habil], [[6, 7], finde]];
  for (const [dias, hora] of grupos) {
    let t = hora;
    agregar({ titulo: "Levantarte", tipo: "despertar", dias, hora_inicio: aHora(t), duracion_min: 10 });
    t += 10;
    if (r.caminata?.activa) {
      const min = entre(r.caminata.minutos, 5, 180, 45);
      agregar({ titulo: "Caminar", tipo: "caminar", dias, hora_inicio: aHora(t), duracion_min: min, obligatorio: true });
      t += min;
    }
    const preparar = entre(r.desayuno?.preparar ?? 20, 0, 120, 20);
    const comer = entre(r.desayuno?.comer ?? 20, 5, 120, 20);
    if (preparar >= 5) {
      agregar({ titulo: "Preparar desayuno", tipo: "desayuno", dias, hora_inicio: aHora(t), duracion_min: preparar });
      t += preparar;
    }
    agregar({ titulo: "Desayunar", tipo: "desayuno", dias, hora_inicio: aHora(t), duracion_min: comer });
  }

  agregar({ titulo: "Almuerzo", tipo: "almuerzo", dias: TODOS, hora_inicio: r.almuerzo?.hora ?? "12:30", duracion_min: r.almuerzo?.minutos ?? 60 });

  if (r.ejercicio?.activo) {
    agregar({
      titulo: "Ejercicio",
      tipo: "ejercicio",
      dias: diasValidos(r.ejercicio.dias, HABILES),
      hora_inicio: r.ejercicio.hora ?? "17:00",
      duracion_min: r.ejercicio.minutos ?? 60,
      obligatorio: r.ejercicio.obligatorio !== false,
      aviso_min: 10,
    });
  }

  const cena = aMinutos(r.cena?.hora) ?? 1140;
  const minCena = entre(r.cena?.minutos ?? 30, 5, 120, 30);
  agregar({ titulo: "Cena", tipo: "cena", dias: TODOS, hora_inicio: aHora(cena), duracion_min: minCena });
  if (r.caminataNoche?.activa) {
    agregar({
      titulo: "Caminar",
      tipo: "caminar",
      dias: TODOS,
      hora_inicio: aHora(cena + minCena),
      duracion_min: entre(r.caminataNoche.minutos, 5, 120, 20),
      obligatorio: true,
    });
  }

  if (r.estudio?.activo) {
    agregar({
      titulo: "Estudiar",
      tipo: "estudio",
      dias: diasValidos(r.estudio.dias, HABILES),
      hora_inicio: r.estudio.hora ?? "20:00",
      duracion_min: r.estudio.minutos ?? 90,
    });
  }

  for (const c of r.clasesPresenciales ?? []) {
    const dur = duracionEntre(c.inicio, c.fin);
    if (!dur) continue;
    agregar({
      titulo: c.materia || "Clase",
      tipo: "clase_presencial",
      dias: diasValidos(c.dias, [2, 3]),
      hora_inicio: c.inicio,
      duracion_min: dur,
      aviso_min: 15,
      lugar: c.lugar,
      materia: c.materia,
    });
  }
  for (const c of r.clasesVirtuales ?? []) {
    const dur = duracionEntre(c.inicio, c.fin);
    if (!dur) continue;
    agregar({
      titulo: c.materia || "Clase virtual",
      tipo: "clase_virtual",
      dias: diasValidos(c.dias, [1]),
      hora_inicio: c.inicio,
      duracion_min: dur,
      aviso_min: 5,
      enlace: c.enlace,
      materia: c.materia,
    });
  }
  for (const t of r.trabajosUni ?? []) {
    const dur = duracionEntre(t.inicio, t.fin);
    if (!dur) continue;
    agregar({ titulo: t.titulo || "Trabajos de la U", tipo: "trabajo_uni", dias: diasValidos(t.dias, HABILES), hora_inicio: t.inicio, duracion_min: dur });
  }

  agregar({ titulo: "A dormir", tipo: "dormir", dias: TODOS, hora_inicio: r.dormir?.hora ?? "22:00", duracion_min: 15 });

  const trabajo = r.trabajo?.activo ? bloquesDeTrabajo(r.trabajo, fijos) : [];
  return [...fijos, ...trabajo]
    .map((b) => ({ ...b, ...minutosDe(b) }))
    .sort((a, b) => a.inicioMin - b.inicioMin || a.dias[0] - b.dias[0])
    .map(({ inicioMin: _i, finMin: _f, ...b }, i) => ({ ...b, orden: i }));
}

/** Ciclos de trabajo útil con pausas; en cada día se quitan los que se cruzan con un bloque fijo. */
function bloquesDeTrabajo(trabajo, fijos) {
  const [foco, pausa] = RITMOS[trabajo.ritmo] ?? RITMOS["50/10"];
  const inicio = minutoLogico(aMinutos(trabajo.inicio) ?? 480);
  const total = entre(Number(trabajo.horas) * 60, 30, 720, 240);
  const ciclos = Math.max(1, Math.floor((total + pausa) / (foco + pausa)));
  const dias = diasValidos(trabajo.dias, HABILES);
  const ocupado = fijos.map((b) => ({ ...minutosDe(b), dias: b.dias }));
  const libre = (desde, hasta, dia) => !ocupado.some((o) => o.dias.includes(dia) && o.inicioMin < hasta && desde < o.finMin);

  const salida = [];
  const focoEn = (i) => inicio + i * (foco + pausa);
  for (let i = 0; i < ciclos; i++) {
    const t = focoEn(i);
    const diasFoco = dias.filter((d) => libre(t, t + foco, d));
    if (diasFoco.length) {
      salida.push({ titulo: "Trabajo útil", tipo: "trabajo", dias: diasFoco, hora_inicio: aHora(t), duracion_min: foco, obligatorio: false, aviso_min: 0, lugar: null, enlace: null, materia: null, notas: null });
    }
    if (i === ciclos - 1) break;
    // La pausa solo existe si ese día hay foco antes y después.
    const siguienteT = focoEn(i + 1);
    const diasPausa = diasFoco.filter((d) => libre(t + foco, siguienteT, d) && libre(siguienteT, siguienteT + foco, d));
    if (diasPausa.length) {
      salida.push({ titulo: "Pausa", tipo: "descanso", dias: diasPausa, hora_inicio: aHora(t + foco), duracion_min: pausa, obligatorio: false, aviso_min: 0, lugar: null, enlace: null, materia: null, notas: null });
    }
  }
  return salida;
}

// ── Tareas de la universidad ─────────────────────────────────────────────

/** Fin de un día lógico a las 23:59 de Bogotá, en ISO con zona. */
const finDelDia = (fecha) => `${fecha}T23:59:00-05:00`;

/** "hoy" · "manana" · "semana" (domingo) → fecha límite ISO. */
export function paraCuando(opcion, ahora = new Date()) {
  const hoy = diaLogico(ahora);
  if (opcion === "hoy") return finDelDia(hoy);
  if (opcion === "manana") return finDelDia(sumarDias(hoy, 1));
  if (opcion === "semana") return finDelDia(sumarDias(lunesDe(hoy), 6));
  return null;
}

/** Texto de la fecha límite: "Vencida · ayer", "Hoy 23:59", "Mañana 23:59", "Jueves 08 oct", "Sin fecha". */
export function venceTexto(tarea, ahora = new Date()) {
  if (!tarea.fecha_limite) return "Sin fecha";
  const limite = new Date(tarea.fecha_limite);
  const hoy = diaLogico(ahora);
  const dia = diaLogico(limite);
  const hora = horaBogota(limite);
  if (limite.getTime() < ms(ahora)) {
    const dias = Math.round((Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${dia}T12:00:00Z`)) / 86_400_000);
    return dias <= 0 ? `Vencida · hoy ${hora}` : dias === 1 ? "Vencida · ayer" : `Vencida · hace ${dias} días`;
  }
  if (dia === hoy) return `Hoy ${hora}`;
  if (dia === sumarDias(hoy, 1)) return `Mañana ${hora}`;
  if (dia <= sumarDias(hoy, 6)) return `${capital(nombreDia(dia))} ${hora}`;
  return `${capital(nombreDia(dia))} ${diaYMes(dia)}`;
}

/**
 * Pendientes primero las vencidas, luego por fecha límite (las sin fecha al final), luego prioridad (1 = alta).
 * Cada tarea sale con { vencida, vence } (texto). Las hechas no salen.
 */
export function ordenarTareas(tareas, ahora = new Date()) {
  const t = ms(ahora);
  return tareas
    .filter((x) => x.estado !== "hecha")
    .map((x) => {
      const limite = x.fecha_limite ? Date.parse(x.fecha_limite) : null;
      return { ...x, limite, vencida: limite !== null && limite < t, vence: venceTexto(x, ahora) };
    })
    .sort(
      (a, b) =>
        Number(b.vencida) - Number(a.vencida) ||
        (a.limite ?? Infinity) - (b.limite ?? Infinity) ||
        (a.prioridad ?? 2) - (b.prioridad ?? 2) ||
        String(a.creado_en ?? "").localeCompare(String(b.creado_en ?? "")),
    )
    .map(({ limite: _l, ...x }) => x);
}
