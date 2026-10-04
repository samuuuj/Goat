// ¿Hay que mostrar el asistente "Conectar iPhone"? Hoy la llama al cargar; true = ir a conectar.html.
// Dos marcas: localStorage["goat:bienvenida"] (este dispositivo: "Ahora no" o terminado) y
// perfil.ajustes.bienvenida.completada (terminado en cualquier dispositivo).

import { necesitaBienvenida } from "./logica.js";

export const CLAVE_BIENVENIDA = "goat:bienvenida";

/** localStorage, o null si el navegador lo bloquea (modo privado estricto). */
function almacenLocal() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** true = este dispositivo ya pasó por el asistente. null = no se puede saber (sin almacenamiento). */
function leerMarca(almacen) {
  if (!almacen) return null;
  try {
    return almacen.getItem(CLAVE_BIENVENIDA) != null;
  } catch {
    return null;
  }
}

/** Marca este dispositivo para no volver a abrir el asistente solo ("Ahora no" o "Ir a Hoy"). */
export function marcarDispositivo(almacen = almacenLocal()) {
  try {
    almacen?.setItem(CLAVE_BIENVENIDA, "1");
  } catch {
    // Sin almacenamiento: la próxima vez se vuelve a revisar perfil.ajustes.
  }
}

/**
 * true si hay que ir a conectar.html. Nunca lanza: si algo falla, Hoy sigue normal.
 * `deps` (para las pruebas): { almacen, leerAjustes(userId) }.
 */
export async function revisarBienvenida(sesion, { almacen = almacenLocal(), leerAjustes } = {}) {
  const marca = leerMarca(almacen);
  if (marca === true) return false;
  // Si no hay dónde guardar "Ahora no", no se insiste: el asistente sigue a un toque en Hoy › Conectar iPhone.
  if (marca === null) return false;

  let ajustes = {};
  try {
    const leer = leerAjustes ?? (async (id) => (await import("../supabase/ajustes.js")).leerAjustes(id));
    ajustes = (await leer(sesion?.user?.id)) ?? {};
  } catch {
    return false;
  }

  if (!necesitaBienvenida({ marcaLocal: false, ajustes })) {
    marcarDispositivo(almacen); // Ya lo terminó en otro dispositivo: no hace falta preguntar otra vez.
    return false;
  }
  return true;
}
