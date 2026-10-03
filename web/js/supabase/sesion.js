// Conexión con Supabase desde el navegador.
// La seguridad la pone la base de datos (docs/SEGURIDAD.md): la clave publicable solo sirve para
// entrar con correo y contraseña, y las reglas RLS hacen que cada quien vea únicamente sus filas.

const CLAVE_RECORDAR = "goat:recordar";
const CLAVE_SESION = "goat-sesion";

// web/js/config.js no está en GitHub (se crea con `npm run config`); si falta, el login lo avisa.
let config = null;
try {
  config = await import("../config.js");
} catch {
  config = null;
}

export const configFaltante = !config?.SUPABASE_URL || !config?.SUPABASE_PUBLISHABLE_KEY;

/** localStorage o sessionStorage; undefined si el navegador los bloquea (modo privado estricto). */
function almacen(nombre) {
  try {
    return window[nombre] ?? undefined;
  } catch {
    return undefined;
  }
}

/** "Mantener sesión iniciada": encendido por defecto. */
export function quiereRecordar() {
  try {
    return localStorage.getItem(CLAVE_RECORDAR) !== "0";
  } catch {
    return true;
  }
}

let recordar = quiereRecordar();

/** Se llama antes de entrar: decide dónde se guarda la sesión. */
export function elegirRecordar(valor) {
  recordar = valor;
  try {
    localStorage.setItem(CLAVE_RECORDAR, valor ? "1" : "0");
  } catch {
    // Sin almacenamiento: la sesión dura lo que dure la pestaña.
  }
}

// Con "mantener sesión" la sesión vive en localStorage (sobrevive a cerrar la app).
// Sin él, en sessionStorage: se borra al cerrar la pestaña o la app.
const almacenSesion = {
  getItem(clave) {
    for (const nombre of ["localStorage", "sessionStorage"]) {
      try {
        const valor = almacen(nombre)?.getItem(clave);
        if (valor != null) return valor;
      } catch {
        // Sigue con el otro almacén.
      }
    }
    return null;
  },
  setItem(clave, valor) {
    const [destino, otro] = recordar ? ["localStorage", "sessionStorage"] : ["sessionStorage", "localStorage"];
    try {
      almacen(destino)?.setItem(clave, valor);
      almacen(otro)?.removeItem(clave);
    } catch {
      // Lleno o bloqueado: la sesión queda solo en memoria.
    }
  },
  removeItem(clave) {
    for (const nombre of ["localStorage", "sessionStorage"]) {
      try {
        almacen(nombre)?.removeItem(clave);
      } catch {
        // Nada que borrar.
      }
    }
  },
};

export const supabase = configFaltante
  ? null
  : window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: almacenSesion,
        storageKey: CLAVE_SESION,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });

/** Sesión guardada en este dispositivo, o null. */
export async function sesionActual() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Para páginas privadas: sin sesión, al login. */
export async function requerirSesion() {
  const sesion = await sesionActual();
  if (sesion) return sesion;
  location.replace("login.html");
  return new Promise(() => {}); // La página se va; no sigue cargando.
}

export async function cerrarSesion() {
  try {
    await supabase?.auth.signOut({ scope: "local" });
  } finally {
    almacenSesion.removeItem(CLAVE_SESION);
    location.replace("login.html");
  }
}
