// Widgets: lo mismo que responde GET /api/v1/widget, pero armado en el navegador con supabase-js y RLS
// (así la vista previa funciona aunque el servidor aún no tenga su clave). Usa las mismas piezas que la API:
// construirResumen, rutina/logica, sueno/logica, desbloqueo/logica y armarWidget (principio 1).

import { supabase } from "../supabase/sesion.js";
import { SesionVencida, cargarRegistros, leer } from "../supabase/datos.js";
import { cargarDesbloqueo } from "../desbloqueo/datos.js";
import { cargarSueno } from "../sueno/datos.js";
import { construirResumen } from "../logica/calculo.js";
import { estadoDesbloqueo } from "../desbloqueo/logica.js";
import { resumenSueno } from "../sueno/logica.js";
import { armarWidget, desbloqueoCorto, rutinaCorta, suenoCorto } from "./logica.js";

/** Una parte que falla (tabla sin instalar…) queda en null; la sesión vencida sí corta todo. */
async function opcional(nombre, tarea) {
  try {
    return (await tarea()) ?? null;
  } catch (error) {
    if (error instanceof SesionVencida) throw error;
    console.warn(`[widgets] sin ${nombre}:`, error?.message ?? error);
    return null;
  }
}

async function contarAvisos(userId) {
  const filas = await leer(
    supabase.from("notificaciones").select("id").eq("user_id", userId).is("leida_en", null).is("descartada_en", null).limit(100),
  );
  return { sinLeer: (filas ?? []).length };
}

/**
 * Datos del widget con tus registros de hoy (incluye el dinero: la página lo muestra solo si lo pides y borroso
 * en modo discreto). Lanza si no se pueden leer ni los registros básicos.
 */
export async function cargarWidget(userId, ahora = new Date()) {
  const [desbloqueo, sueno, avisos] = await Promise.all([
    opcional("desbloqueo", () => cargarDesbloqueo(userId, ahora)),
    opcional("sueño", async () => suenoCorto(resumenSueno(await cargarSueno(userId, ahora), ahora))),
    opcional("avisos", () => contarAvisos(userId)),
  ]);
  // cargarDesbloqueo ya trae los registros; si falló, se leen solos.
  const registros = desbloqueo?.registros ?? (await cargarRegistros(userId, ahora));
  const resumen = construirResumen(registros, ahora);
  const rutina = await opcional("rutina", () =>
    rutinaCorta(
      { bloques: registros.rutinaBloques ?? [], checks: registros.rutinaChecks ?? [], festivos: registros.festivos ?? [], fecha: resumen.fecha },
      ahora,
    ),
  );
  const estado = desbloqueo
    ? desbloqueoCorto(
        estadoDesbloqueo({ resumen, eventos: desbloqueo.eventos, pases: desbloqueo.pases, ajustes: desbloqueo.ajustes?.desbloqueo, ahora }),
      )
    : null;
  return armarWidget({ resumen, rutina, sueno, desbloqueo: estado, avisos }, { ahora, dinero: true });
}
