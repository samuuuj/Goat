// Datos de prueba de Rutina para el simulador (pruebas/navegador/simulador.js). Nada de esto existe en Supabase.
// Una semana realista con la rutina de Samuel: 6:00 levantarse, caminar 45 min, desayuno, trabajo útil 50/10,
// almuerzo, clases presenciales martes y miércoles, clase virtual, trabajos de la U, ejercicio, cena, caminar, estudiar.
// Respeta ?hora=2026-10-06T10:30 (la misma que usa rutina.html) para que "hoy" coincida.

import { diaLogico } from "/js/logica/dia.js";
import {
  ENCUESTA_BASE,
  ahoraYSiguiente,
  estadoDelDia,
  generarPlantilla,
  isoBogota,
  lunesDe,
  ordenarTareas,
  sumarDias,
  bloquesDelDia,
} from "/js/rutina/logica.js";

const ENCUESTA = {
  ...ENCUESTA_BASE,
  despertar: { habil: "06:00", finDeSemana: "07:00" },
  clasesPresenciales: [{ materia: "Cálculo", dias: [2, 3], inicio: "09:00", fin: "12:00", lugar: "Bloque 5 · 301" }],
  clasesVirtuales: [{ materia: "Inglés", dias: [1, 4], inicio: "14:00", fin: "16:00", enlace: "https://meet.google.com/abc-defg-hij" }],
  trabajosUni: [{ titulo: "Proyecto de Física", dias: [2, 5], inicio: "14:00", fin: "16:00" }],
};

function ahoraDePrueba() {
  const p = new URLSearchParams(location.search).get("hora");
  const t = p ? Date.parse(/(Z|[+-]\d{2}:\d{2})$/i.test(p) ? p : `${p}-05:00`) : NaN;
  return Number.isNaN(t) ? new Date() : new Date(t);
}

const idDe = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

export function agregar(datos, usuario) {
  const ahora = ahoraDePrueba();
  const hoy = diaLogico(ahora);
  const lunes = lunesDe(hoy);
  const bloques = generarPlantilla(ENCUESTA).map((b, i) => ({ ...b, id: idDe(i + 1), user_id: usuario, activo: true }));
  datos.tablas.rutina_bloques = bloques;

  // Chequeos de la semana: casi todo hecho, algún "saltado" y algo sin marcar (como una semana real).
  const checks = [];
  for (let f = lunes; f <= hoy; f = sumarDias(f, 1)) {
    bloquesDelDia(bloques, f).forEach((b, i) => {
      if (b.tipo === "descanso") return;
      if (f === hoy && b.fin > ahora.getTime()) return;
      const n = (i * 7 + Number(f.slice(8))) % 11;
      if (f === hoy && b.tipo === "caminar") return; // La caminata de hoy quedó sin marcar → "¿Lo hiciste?".
      if (n === 3) return; // sin marcar
      checks.push({
        id: crypto.randomUUID(),
        user_id: usuario,
        bloque_id: b.id,
        fecha: f,
        estado: n === 5 ? "saltado" : "hecho",
        origen: n % 2 ? "atajo" : "web",
        momento: isoBogota(b.fin),
      });
    });
  }
  datos.tablas.rutina_checks = checks;

  const fin = (fecha, hora = "23:59") => new Date(`${fecha}T${hora}:00-05:00`).toISOString();
  datos.tablas.uni_tareas = [
    { id: crypto.randomUUID(), titulo: "Informe de laboratorio de Física", materia: "Física", fecha_limite: fin(sumarDias(hoy, -1)), estado: "en_progreso", prioridad: 1, primer_paso: "Pasar las mediciones a la tabla del informe", creado_en: fin(sumarDias(hoy, -5)) },
    { id: crypto.randomUUID(), titulo: "Taller 3 de Cálculo", materia: "Cálculo", fecha_limite: fin(hoy, "18:00"), estado: "pendiente", prioridad: 2, primer_paso: "Abrir el PDF y leer el punto 1", creado_en: fin(sumarDias(hoy, -3)) },
    { id: crypto.randomUUID(), titulo: "Ensayo de Inglés (500 palabras)", materia: "Inglés", fecha_limite: fin(sumarDias(hoy, 3)), estado: "pendiente", prioridad: 2, primer_paso: null, creado_en: fin(sumarDias(hoy, -2)) },
    { id: crypto.randomUUID(), titulo: "Buscar tema del proyecto final", materia: null, fecha_limite: null, estado: "pendiente", prioridad: 3, primer_paso: "Anotar 3 ideas en Notas", creado_en: fin(sumarDias(hoy, -1)) },
    { id: crypto.randomUUID(), titulo: "Quiz 2 de Cálculo", materia: "Cálculo", fecha_limite: fin(sumarDias(hoy, -2)), estado: "hecha", prioridad: 2, hecha_en: new Date(Math.max(Date.parse(fin(lunes, "10:00")), ahora.getTime() - 86_400_000)).toISOString(), creado_en: fin(sumarDias(hoy, -6)) },
  ];
  // Respuestas guardadas de la encuesta (para "Rehacer con la encuesta").
  const perfil = datos.tablas.perfil?.[0];
  if (perfil) perfil.ajustes = { ...(perfil.ajustes ?? {}), rutina: { encuesta: ENCUESTA, creada: fin(lunes, "08:00") } };
}

/** Respuestas simuladas de las rutas de Rutina (por si otra página, como Conectar, las prueba). */
export function api(api) {
  const dia = (datos) => {
    const ahora = ahoraDePrueba();
    return estadoDelDia(datos.tablas.rutina_bloques ?? [], datos.tablas.rutina_checks ?? [], ahora, { festivos: datos.tablas.festivos ?? [] });
  };
  api["GET rutina/hoy"] = async ({ datos }) => {
    const items = dia(datos);
    return { ok: true, mensaje: `🗓️ ${items.length} bloques hoy`, datos: { fecha: diaLogico(ahoraDePrueba()), bloques: items.map((b) => ({ id: b.id, titulo: b.titulo, inicio: isoBogota(b.inicio), fin: isoBogota(b.fin), estado: b.estado })) } };
  };
  api["GET rutina/ahora"] = async ({ datos }) => {
    const { actual, siguiente, mensaje } = ahoraYSiguiente(dia(datos), ahoraDePrueba());
    return { ok: true, mensaje, datos: { actual: actual?.titulo ?? null, siguiente: siguiente?.titulo ?? null } };
  };
  api["GET uni/tareas"] = async ({ datos }) => {
    const tareas = ordenarTareas(datos.tablas.uni_tareas ?? [], ahoraDePrueba());
    return { ok: true, mensaje: `📚 ${tareas.length} pendientes`, datos: { tareas } };
  };
}
