// Datos de prueba de Movimiento para el simulador (pruebas/navegador/simulador.js). Nada de esto existe en Supabase.
// Extra: ?entreno=curso (cronómetro corriendo hace 25 min) · ?entreno=olvidado (abierto hace 7 h).

import { diaLogico } from "/js/logica/dia.js";
import { sumarDias } from "/js/logica/calculo.js";
import { TIPOS_EJERCICIO } from "/js/logica/catalogos.js";
import { enCurso, lunesDe, resumenSemana } from "/js/ejercicio/logica.js";

const momento = (fecha, hora) => new Date(`${fecha}T${hora}:00-05:00`);

/** Semana tipo de Samuel: fuerza L/J/V, caminata casi a diario, trote miércoles, deporte sábado. */
const PLAN = [
  [0, "fuerza", "empuje", "17:00", 65],
  [0, "caminata", null, "06:00", 45, 4.1],
  [1, "caminata", null, "06:05", 40, 3.6],
  [2, "trote", null, "06:10", 32, 5.1],
  [3, "fuerza", "tiron", "17:10", 50],
  [3, "caminata", null, "06:00", 45, 4.3],
  [4, "fuerza", "pierna", "16:50", 70],
  [5, "deporte", null, "09:00", 90],
  [6, "movilidad", null, "20:30", 20],
];

function sesion(usuario, fecha, tipo, rutina, hora, minutos, km = null, notas = null) {
  const inicio = momento(fecha, hora);
  const fin = new Date(inicio.getTime() + minutos * 60_000);
  return {
    id: crypto.randomUUID(),
    id_cliente: crypto.randomUUID(),
    user_id: usuario,
    tipo,
    rutina,
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
    duracion_min: minutos,
    distancia_km: km,
    pasos: null,
    notas,
    en_curso: false,
    momento: inicio.toISOString(),
    fecha: diaLogico(inicio),
    origen: "web",
  };
}

export function agregar(datos, usuario) {
  const ahora = new Date();
  const hoy = diaLogico(ahora);
  const lunes = lunesDe(hoy);
  const filas = [];

  for (let semana = 0; semana < 6; semana++) {
    const inicioSemana = sumarDias(lunes, -7 * semana);
    PLAN.forEach(([dia, tipo, rutina, hora, minutos, km], i) => {
      // Que no todas las semanas sean perfectas.
      if ((semana + i) % 5 === 4) return;
      const fecha = sumarDias(inicioSemana, dia);
      const fila = sesion(usuario, fecha, tipo, rutina, hora, minutos + ((semana * 3 + i) % 7) - 3, km);
      if (Date.parse(fila.fin) < ahora.getTime()) filas.push(fila);
    });
  }
  filas[0] && (filas[0].notas = "Press banca 4×8 con 60 kg. Me sentí fuerte.");

  // Un registro viejo de la hoja de Hoy (antes de tener tipo, inicio y fin).
  const viejo = momento(sumarDias(lunes, -18), "18:20");
  filas.push({ id: crypto.randomUUID(), user_id: usuario, rutina: "pierna", tipo: "fuerza", momento: viejo.toISOString(), fecha: diaLogico(viejo), en_curso: false, origen: "web" });

  const modo = new URLSearchParams(location.search).get("entreno");
  if (modo === "curso" || modo === "olvidado") {
    const inicio = new Date(ahora.getTime() - (modo === "curso" ? 25 * 60_000 + 12_000 : 7 * 3_600_000));
    filas.push({
      id: crypto.randomUUID(),
      id_cliente: crypto.randomUUID(),
      user_id: usuario,
      tipo: modo === "curso" ? "fuerza" : "trote",
      rutina: modo === "curso" ? "empuje" : null,
      inicio: inicio.toISOString(),
      fin: null,
      duracion_min: null,
      en_curso: true,
      momento: inicio.toISOString(),
      fecha: diaLogico(inicio),
      origen: "atajo",
    });
  }

  // La fila base de Central (pierna ayer 17:00, sin tipo) se reemplaza por estas.
  datos.tablas.gym_sesiones = filas;

  // Pasos de Salud de las últimas 2 semanas (hoy, si ya pasaron las 21:30 o a medias).
  const pasos = [8120, 10450, 6890, 12030, 7340, 9980, 4510, 8870, 11230, 7600, 9310, 13020, 6420, 8050];
  datos.tablas.ejercicio_actividad = pasos.map((valor, i) => {
    const fecha = sumarDias(hoy, -i);
    const parcial = i === 0 ? Math.round(valor * 0.55) : valor;
    return {
      id: crypto.randomUUID(),
      user_id: usuario,
      fecha,
      pasos: parcial,
      distancia_km: Math.round(parcial * 0.00072 * 100) / 100,
      energia_kcal: Math.round(parcial * 0.04),
      fuente: "salud",
      origen: "atajo",
    };
  });
}

export function api(api) {
  const semana = (datos) => {
    const ahora = new Date();
    const sesiones = datos.tablas.gym_sesiones ?? [];
    const r = resumenSemana(sesiones, { gym_semana: 4 }, lunesDe(diaLogico(ahora)), datos.tablas.ejercicio_actividad ?? []);
    return { r, activa: enCurso(sesiones, ahora) };
  };
  api["GET ejercicio/menu"] = async ({ datos }) => {
    const { activa } = semana(datos);
    return {
      ok: true,
      mensaje: activa ? "⏱️ Entreno en curso" : "🏋️ ¿Qué vas a hacer?",
      datos: {
        en_curso: Boolean(activa && !activa.olvidada),
        tipos: TIPOS_EJERCICIO.filter((t) => t.valor !== "otro").map((t) => `${t.emoji} ${t.texto}`),
        rutinas: ["Empuje", "Tirón", "Pierna", "Full body"],
      },
    };
  };
  api["GET ejercicio/semana"] = async ({ datos }) => {
    const { r } = semana(datos);
    return { ok: true, mensaje: `🏋️ ${r.entrenos} de ${r.meta} entrenos`, datos: { semana: r } };
  };
  api["POST ejercicio/inicio"] = async () => ({ estado: 201, ok: true, mensaje: "🏋️ A darle", datos: {} });
  api["POST ejercicio/fin"] = async () => ({ ok: true, mensaje: "✅ 55 min", datos: {} });
  api["POST ejercicio/sesion"] = async () => ({ estado: 201, ok: true, mensaje: "🏋️ Fuerza · 1h 00", datos: {} });
  api["POST ejercicio/actividad"] = async ({ cuerpo }) => ({ ok: true, mensaje: `📈 ${cuerpo.pasos ?? 0} pasos`, datos: {} });
}
