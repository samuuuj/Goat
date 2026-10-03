// Agrega una notificación al centro de notificaciones de la app (tabla notificaciones, D-057).
// Sin montos (D-020). `clave` evita duplicados: la misma clave no se guarda dos veces.

const MODULOS = new Set([
  "finanzas", "comidas", "desbloqueo", "sueno", "ejercicio", "universidad",
  "ocio", "rutina", "puntuacion", "diario", "notificaciones", "conectar",
]);

/** `db` de baseDeDatos(). Devuelve true si se guardó (false si ya existía esa clave). */
export async function notificar(db, { modulo, emoji = "🔔", titulo, cuerpo = null, url = null, clave = null, momento = null }) {
  if (!MODULOS.has(modulo)) throw new Error(`Módulo de notificación inválido: ${modulo}`);
  if (/\$\s?\d/.test(`${titulo} ${cuerpo ?? ""}`)) throw new Error("Las notificaciones no llevan montos (D-020)");
  if (url && /^([a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/.test(url)) throw new Error("La url de una notificación debe ser interna");
  const fila = { modulo, emoji, titulo, cuerpo, url, clave, origen: "automatizacion" };
  if (momento) fila.momento = momento instanceof Date ? momento.toISOString() : momento;
  const guardadas = await db.insert("notificaciones", fila);
  return guardadas.length > 0;
}
