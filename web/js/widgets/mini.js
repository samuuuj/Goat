// Dato corto para la tarjeta "Widgets." en Hoy: la frase del día (la misma que muestran los widgets). Sin montos.

import { cargarRegistros } from "../supabase/datos.js";
import { construirResumen } from "../logica/calculo.js";
import { fraseDe } from "./logica.js";

export async function miniDato(sesion) {
  const ahora = new Date();
  return fraseDe(construirResumen(await cargarRegistros(sesion.user.id, ahora), ahora), ahora);
}
