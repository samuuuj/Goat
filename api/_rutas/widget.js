// Rutas de /api/v1 de los widgets (E · Widgets, D-009/D-058). Las usa el script de Scriptable (web/scriptable/goat.js).
//   GET widget            → puntaje, racha, anillos, semana, pendientes, rutina, sueño, desbloqueo, avisos y frase del día
//   GET widget?dinero=1   → además { dinero: { disponibleHoy } } (solo para los widgets mediano y grande; nunca en bloqueo)
//
// Principio 1: nada se recalcula aquí. El resumen sale de cargarRegistrosServidor + construirResumen (como GET hoy);
// la rutina de rutina/logica.js; el sueño de la ruta GET sueno/resumen; el desbloqueo de cargarDesbloqueo +
// estadoDesbloqueo; los avisos de GET notificaciones. Lo que falle (tabla sin instalar, etc.) sale null y el widget
// sigue con lo demás. Solo el resumen es obligatorio.

import { ok } from "../_lib/respuesta.js";
import { cargarRegistrosServidor } from "../_lib/registros.js";
import { construirResumen } from "../../web/js/logica/calculo.js";
import { estadoDesbloqueo } from "../../web/js/desbloqueo/logica.js";
import { armarWidget, desbloqueoCorto, rutinaCorta, suenoCorto } from "../../web/js/widgets/logica.js";
import { cargarDesbloqueo } from "./desbloqueo.js";
import rutasSueno from "./sueno.js";
import rutasNotificaciones from "./notificaciones.js";

/**
 * La misma consulta pedida dos veces en una llamada se hace una sola vez
 * (cargarDesbloqueo vuelve a leer los registros que ya se leyeron para el resumen).
 */
export function conMemoria(db) {
  const memoria = new Map();
  return {
    ...db,
    select(tabla, opciones = {}) {
      const clave = `${tabla}|${JSON.stringify(opciones)}`;
      if (!memoria.has(clave)) memoria.set(clave, db.select(tabla, opciones));
      return memoria.get(clave);
    },
  };
}

/** Llama a una ruta de solo lectura de otro módulo y devuelve sus `datos` (o lanza si no respondió ok). */
async function datosDe(definicion, ctx) {
  const manejar = typeof definicion === "function" ? definicion : definicion?.manejar;
  if (!manejar) throw new Error("Ruta no disponible");
  const respuesta = await manejar(ctx);
  if (!respuesta?.cuerpo?.ok) throw new Error(respuesta?.cuerpo?.codigo ?? "Sin datos");
  return respuesta.cuerpo.datos;
}

/** Ejecuta una parte opcional: si falla, se anota en el log del servidor (sin datos) y devuelve null. */
async function opcional(nombre, tarea) {
  try {
    return (await tarea()) ?? null;
  } catch (e) {
    console.warn(`[widget] sin ${nombre}:`, e?.codigo ?? e?.message ?? e);
    return null;
  }
}

export const conDinero = (query = {}) => ["1", "true", "si", "sí"].includes(String(query.dinero ?? "").toLowerCase());

export default {
  "GET widget": async ({ db, query, ahora }) => {
    const base = conMemoria(db);
    const registros = await cargarRegistrosServidor(base, ahora);
    const resumen = construirResumen(registros, ahora);

    const [rutina, sueno, desbloqueo, avisos] = await Promise.all([
      opcional("rutina", () =>
        rutinaCorta(
          { bloques: registros.rutinaBloques ?? [], checks: registros.rutinaChecks ?? [], festivos: registros.festivos ?? [], fecha: resumen.fecha },
          ahora,
        ),
      ),
      opcional("sueño", async () => suenoCorto(await datosDe(rutasSueno["GET sueno/resumen"], { db: base, ahora, query: {} }))),
      opcional("desbloqueo", async () => desbloqueoCorto(estadoDesbloqueo({ ...(await cargarDesbloqueo(base, ahora)), ahora }))),
      opcional("avisos", async () => {
        const datos = await datosDe(rutasNotificaciones["GET notificaciones"], { db: base, ahora, query: { limite: "1", no_leidas: "1" } });
        return { sinLeer: Number(datos.no_leidas) || 0 };
      }),
    ]);

    const datos = armarWidget({ resumen, rutina, sueno, desbloqueo, avisos }, { ahora, dinero: conDinero(query) });
    return ok(datos.bloqueo.linea, datos);
  },
};
