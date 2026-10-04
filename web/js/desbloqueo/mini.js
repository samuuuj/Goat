// Dato corto para la tarjeta "Tu tiempo." en Hoy (sin montos). null = sin dato.

import { cargarRegistros } from "../supabase/datos.js";
import { leerAjustes } from "../supabase/ajustes.js";
import { construirResumen } from "../logica/calculo.js";
import { ajustesDesbloqueo, nivel } from "./logica.js";

export async function miniDato(sesion) {
  const ahora = new Date();
  const [registros, ajustes] = await Promise.all([cargarRegistros(sesion.user.id, ahora), leerAjustes(sesion.user.id)]);
  const resumen = construirResumen(registros, ahora);
  const actual = nivel(resumen, ajustesDesbloqueo(ajustes?.desbloqueo).niveles);
  if (actual.indice < 0) return "🔒 Registra para abrir";
  return `${actual.minutos} min por app`;
}
