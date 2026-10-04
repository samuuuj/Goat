// Cruces entre módulos que no son de uno solo (integración). Funciones puras: las usan la web y la API.
// No importar calculo.js aquí (calculo.js ya importa rutina/logica.js y ejercicio/logica.js).

import { cubreBloque, fechaDe } from "../ejercicio/logica.js";
import { bloquesDelDia, tipoDia } from "../rutina/logica.js";

/** Tipos de bloque de la rutina que un entreno puede cubrir (ver cubreBloque en ejercicio/logica.js). */
export const TIPOS_BLOQUE_CUBRIBLES = ["ejercicio", "caminar"];

/**
 * Bloques de la plantilla de rutina que un entreno terminado cubre ese día: [{ bloque_id, fecha }].
 * `bloques`: filas de rutina_bloques (activas) · `festivos`: [{ fecha }] (un festivo usa los bloques del domingo).
 */
export function bloquesCubiertos(sesion, bloques = [], festivos = []) {
  if (!sesion?.inicio || !sesion?.fin) return [];
  const fecha = fechaDe(sesion);
  if (!fecha) return [];
  return bloquesDelDia(bloques, fecha, tipoDia(fecha, festivos))
    .filter((b) => cubreBloque(sesion, { tipo: b.tipo, inicio: b.inicio, fin: b.fin }))
    .map((b) => ({ bloque_id: b.id, fecha }));
}
