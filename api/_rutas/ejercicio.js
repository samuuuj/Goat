// Rutas de /api/v1 de Ejercicio (objetivo H). Las usan los atajos "🏋️ Entreno" y "📈 Actividad del día".
// Las reglas viven en web/js/ejercicio/logica.js (las mismas de la web). Mensajes: emoji + pocas palabras.

import { ok, ErrorApi } from "../_lib/respuesta.js";
import { fechaIso, idCliente, origen } from "../_lib/validar.js";
import { notificar } from "../_lib/notificar.js";
import { diaLogico } from "../../web/js/logica/dia.js";
import { leerMetas } from "../../web/js/logica/calculo.js";
import { formatoDuracion } from "../../web/js/logica/formato.js";
import { RUTINAS, TIPOS_EJERCICIO } from "../../web/js/logica/catalogos.js";
import {
  cuentaParaMeta,
  emojiTipo,
  enCurso,
  fechaCalendario,
  formatoCronometro,
  lunesDe,
  mensajeActividad,
  mensajeGuardada,
  nombreTipo,
  nuevaEnCurso,
  resumenSemana,
  sumarDias,
  terminar,
  validarActividad,
  validarSesion,
} from "../../web/js/ejercicio/logica.js";
import { marcarRutinaCubierta } from "../_lib/cruces.js";

const COLUMNAS = "id,tipo,rutina,inicio,fin,duracion_min,distancia_km,pasos,notas,en_curso,momento,fecha,origen,id_cliente";
const MINUTO = 60_000;

/** Corta con 400 y el mensaje de la lógica ("⚠️ Termina antes de empezar"). */
function revisar(resultado) {
  if (resultado.error) throw new ErrorApi("DATO_INVALIDO", resultado.error, 400);
  return resultado;
}

const sesionesAbiertas = (db) =>
  db.select("gym_sesiones", { columnas: COLUMNAS, filtros: { en_curso: "eq.true" }, orden: "inicio.desc", limite: 5 });

/** "⏱️ Fuerza en curso · 25:10" */
const mensajeEnCurso = (activa) => `⏱️ ${nombreTipo(activa.sesion.tipo)} en curso · ${formatoCronometro(activa.transcurridoMs)}`;

/** Resumen de esta semana (lo usan semana, fin y sesión). */
async function semanaActual(db, ahora) {
  const lunes = lunesDe(diaLogico(ahora));
  const [perfil, sesiones, actividad] = await Promise.all([
    db.select("perfil", { columnas: "metas", limite: 1 }),
    db.select("gym_sesiones", { columnas: COLUMNAS, filtros: { fecha: `gte.${lunes}` } }),
    db.select("ejercicio_actividad", {
      columnas: "fecha,pasos,distancia_km,energia_kcal",
      filtros: { fecha: `gte.${sumarDias(lunes, -1)}` },
    }),
  ]);
  return { resumen: resumenSemana(sesiones, leerMetas(perfil[0]?.metas), lunes, actividad), actividad };
}

/** Si esta sesión completó la meta de la semana, deja una notificación (una sola vez por semana). */
async function avisarSiCumplio(db, ahora, sesion) {
  if (!cuentaParaMeta(sesion)) return null;
  const { resumen } = await semanaActual(db, ahora);
  if (resumen.entrenos === resumen.meta) {
    await notificar(db, {
      modulo: "ejercicio",
      emoji: "🏋️",
      titulo: "Semana cumplida",
      cuerpo: `${resumen.meta} entrenos esta semana.`,
      url: "ejercicio.html",
      clave: `ejercicio:semana:${resumen.lunes}`,
    }).catch(() => {});
  }
  return { entrenos: resumen.entrenos, meta: resumen.meta };
}

export default {
  /** Para los menús del atajo: tipos ("🏋️ Fuerza"…), rutinas y si hay un entreno en curso. */
  "GET ejercicio/menu": async ({ db, ahora }) => {
    const activa = enCurso(await sesionesAbiertas(db), ahora);
    const corriendo = Boolean(activa && !activa.olvidada);
    return ok(corriendo ? mensajeEnCurso(activa) : "🏋️ ¿Qué vas a hacer?", {
      en_curso: corriendo,
      tipos: TIPOS_EJERCICIO.filter((t) => t.valor !== "otro").map((t) => `${t.emoji} ${t.texto}`),
      rutinas: RUTINAS.map((r) => r.texto),
    });
  },

  /** Empieza el cronómetro: { tipo, rutina?, inicio? }. Si ya hay uno corriendo, no crea otro. */
  "POST ejercicio/inicio": async ({ db, cuerpo, ahora }) => {
    const abiertas = await sesionesAbiertas(db);
    const activa = enCurso(abiertas, ahora);
    if (activa && !activa.olvidada) return ok(mensajeEnCurso(activa), { sesion: activa.sesion, ya_estaba: true });

    // Las que llevan más de 6 h abiertas se olvidaron: quedan sin hora de fin para corregirlas en la web.
    for (const vieja of abiertas) await db.update("gym_sesiones", { en_curso: false }, { id: `eq.${vieja.id}` });

    const { fila } = revisar(
      nuevaEnCurso({ tipo: cuerpo.tipo, rutina: cuerpo.rutina, inicio: fechaIso(cuerpo.inicio ?? cuerpo.momento, "inicio") }, ahora),
    );
    fila.origen = origen(cuerpo.origen);
    fila.id_cliente = await idCliente(db, "gym_sesiones", fila, ["tipo", "en_curso"], cuerpo.id_cliente, ahora);
    const mensaje = `${emojiTipo(fila.tipo)} A darle`;
    if (!fila.id_cliente) return ok(mensaje, { ya_estaba: true });
    const [guardada] = await db.insert("gym_sesiones", fila);
    return ok(mensaje, { sesion: guardada ?? fila, ya_estaba: !guardada }, guardada ? 201 : 200);
  },

  /** Termina el entreno en curso: { fin?, distancia_km?, pasos?, notas? }. Sin fin → ahora. */
  "POST ejercicio/fin": async ({ db, cuerpo, ahora }) => {
    const fin = fechaIso(cuerpo.fin ?? cuerpo.momento, "fin", ahora);
    const abiertas = await sesionesAbiertas(db);
    const activa = enCurso(abiertas, ahora);

    if (!activa) {
      // ¿El atajo reintentó? Si la última terminó hace menos de 2 min, responde lo mismo.
      const [ultima] = await db.select("gym_sesiones", {
        columnas: COLUMNAS,
        filtros: { fin: `gte.${new Date(ahora.getTime() - 2 * MINUTO).toISOString()}` },
        orden: "fin.desc",
        limite: 1,
      });
      if (ultima) return ok(mensajeGuardada(ultima), { sesion: ultima, ya_estaba: true });
      throw new ErrorApi("SIN_ENTRENO", "🤷 No hay entreno en curso", 404);
    }

    const r = revisar(terminar(activa.sesion, fin, { distancia_km: cuerpo.distancia_km, pasos: cuerpo.pasos, notas: cuerpo.notas }));
    const [cerrada] = await db.update("gym_sesiones", r.cambios, { id: `eq.${activa.sesion.id}` });
    const sesion = { ...activa.sesion, ...cerrada, ...r.cambios };
    if (r.olvidada) return ok("⚠️ Más de 6 h: pon la hora de fin en la web", { sesion, olvidada: true });
    const semana = await avisarSiCumplio(db, ahora, sesion);
    const rutina = await marcarRutinaCubierta(db, sesion);
    return ok(mensajeGuardada(sesion), { sesion, semana, rutina });
  },

  /** Un entreno ya hecho: { tipo, inicio, fin | duracion_min, rutina?, distancia_km?, pasos?, notas? }. */
  "POST ejercicio/sesion": async ({ db, cuerpo, ahora }) => {
    const inicio = fechaIso(cuerpo.inicio ?? cuerpo.momento, "inicio");
    let fin = fechaIso(cuerpo.fin, "fin");
    if (!fin && inicio && cuerpo.duracion_min != null && cuerpo.duracion_min !== "") {
      const minutos = Number(String(cuerpo.duracion_min).replace(",", "."));
      if (!(minutos > 0)) throw new ErrorApi("DATO_INVALIDO", "⚠️ Revisa la duración", 400);
      fin = new Date(inicio.getTime() + Math.round(minutos) * MINUTO);
    }
    const { fila } = revisar(
      validarSesion(
        {
          tipo: cuerpo.tipo,
          rutina: cuerpo.rutina,
          inicio,
          fin,
          distancia_km: cuerpo.distancia_km,
          pasos: cuerpo.pasos,
          notas: cuerpo.notas,
        },
        ahora,
      ),
    );
    fila.origen = origen(cuerpo.origen);
    fila.id_cliente = await idCliente(db, "gym_sesiones", fila, ["tipo", "inicio"], cuerpo.id_cliente, ahora);
    if (fila.id_cliente) await db.insert("gym_sesiones", fila, { devolver: false });
    const semana = await avisarSiCumplio(db, ahora, fila);
    const rutina = fila.id_cliente ? await marcarRutinaCubierta(db, fila) : [];
    return ok(`${emojiTipo(fila.tipo)} ${nombreTipo(fila.tipo)} · ${formatoDuracion(fila.duracion_min)}`, { sesion: fila, semana, rutina }, 201);
  },

  /** Pasos, distancia y energía del día desde Salud: { fecha?, pasos, distancia_km?, energia_kcal? }. Una fila por fecha. */
  "POST ejercicio/actividad": async ({ db, cuerpo, ahora }) => {
    const { fila } = revisar(validarActividad(cuerpo, ahora));
    fila.fuente = "salud";
    fila.origen = origen(cuerpo.origen);
    const [guardada] = await db.upsert("ejercicio_actividad", fila, { conflicto: "user_id,fecha" });
    return ok(mensajeActividad(fila), { actividad: guardada ?? fila });
  },

  /** Esta semana: entrenos contra la meta, minutos, km, pasos y el entreno en curso. */
  "GET ejercicio/semana": async ({ db, ahora }) => {
    const [{ resumen, actividad }, abiertas] = await Promise.all([semanaActual(db, ahora), sesionesAbiertas(db)]);
    const activa = enCurso(abiertas, ahora);
    const corriendo = activa && !activa.olvidada ? activa : null;
    const hoy = actividad.find((a) => a.fecha === fechaCalendario(ahora)) ?? null;
    return ok(corriendo ? mensajeEnCurso(corriendo) : `🏋️ ${resumen.entrenos} de ${resumen.meta} entrenos`, {
      semana: resumen,
      en_curso: corriendo ? { ...corriendo.sesion, transcurrido_min: Math.floor(corriendo.transcurridoMs / MINUTO) } : null,
      pasos_hoy: hoy?.pasos ?? null,
    });
  },
};
