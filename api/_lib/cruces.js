// Cruces entre módulos desde la API (las reglas están en web/js/logica/cruces.js).

import { fechaDe } from "../../web/js/ejercicio/logica.js";
import { TIPOS_BLOQUE_CUBRIBLES, bloquesCubiertos } from "../../web/js/logica/cruces.js";

/**
 * Un entreno terminado marca "hecho" los bloques de la rutina que cubre, sin pisar lo que Samuel ya marcó
 * (hecho o saltado). Nunca falla: la rutina es un extra y no debe tumbar el guardado del entreno.
 */
export async function marcarRutinaCubierta(db, sesion) {
  try {
    const fecha = sesion?.fin ? fechaDe(sesion) : null;
    if (!fecha) return [];
    const [bloques, festivos] = await Promise.all([
      db.select("rutina_bloques", {
        columnas: "id,titulo,tipo,dias,hora_inicio,duracion_min,orden,activo",
        filtros: { activo: "eq.true", tipo: `in.(${TIPOS_BLOQUE_CUBRIBLES.join(",")})` },
      }),
      db.select("festivos", { columnas: "fecha,nombre", filtros: { fecha: `eq.${fecha}` } }),
    ]);
    const filas = bloquesCubiertos(sesion, bloques, festivos).map((f) => ({ ...f, estado: "hecho", origen: "automatizacion" }));
    if (filas.length) await db.upsert("rutina_checks", filas, { conflicto: "bloque_id,fecha", ignorarRepetidas: true });
    return filas;
  } catch {
    return [];
  }
}
