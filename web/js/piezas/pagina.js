// Arranque común de las páginas de sección (finanzas.html, rutina.html…).
// Esqueleto esperado en el HTML (ver web/finanzas.html):
//   #cargando · main#contenido (con .barra-seccion, a.volver y, si hay dinero, #boton-discreto)
//   main#falta-base · main#fallo (con #reintentar) · .aviso-zona > #aviso · <template id="plantilla-chip">

import { cerrarSesion, requerirSesion } from "../supabase/sesion.js";
import { BaseSinInstalar, SesionVencida } from "../supabase/datos.js";
import { avisar, iniciarDiscreto } from "./ui.js";

const VISTAS = ["contenido", "falta-base", "fallo"];

/**
 * Pide sesión (sin sesión va al login), conecta el ojo del modo discreto, "Cerrar sesión" y "Reintentar".
 * `alReintentar()`: qué hacer al tocar Reintentar (normalmente volver a cargar).
 * Devuelve { sesion, mostrar(vista), manejarError(error) }.
 */
export async function iniciarPagina({ alReintentar } = {}) {
  const sesion = await requerirSesion();
  let mostrada = null;

  const discreto = document.getElementById("boton-discreto");
  if (discreto) iniciarDiscreto(discreto);
  else document.documentElement.classList.add("discreto");

  document.querySelectorAll("[data-cerrar-sesion]").forEach((boton) => boton.addEventListener("click", cerrarSesion));
  document.getElementById("reintentar")?.addEventListener("click", () => alReintentar?.());

  function mostrar(vista) {
    mostrada = vista;
    const cargando = document.getElementById("cargando");
    if (cargando) cargando.hidden = true;
    for (const id of VISTAS) {
      const el = document.getElementById(id);
      if (el) el.hidden = id !== vista;
    }
    document.querySelectorAll("[data-con-contenido]").forEach((el) => (el.hidden = vista !== "contenido"));
  }

  /** Muestra el error como corresponde. Si ya se ve la página, solo avisa. */
  function manejarError(error) {
    if (error instanceof SesionVencida) return cerrarSesion();
    if (error instanceof BaseSinInstalar) return mostrar("falta-base");
    console.error(error);
    if (mostrada === "contenido") avisar("⚠️ No se pudo actualizar.");
    else mostrar("fallo");
  }

  return { sesion, mostrar, manejarError };
}
