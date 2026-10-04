// Dato corto para la tarjeta "Tu noche." en Hoy (sin montos). null = sin dato.

import { cargarSueno } from "./datos.js";
import { duracionCorta, horaDe, resumenSueno } from "./logica.js";

export async function miniDato(sesion) {
  const ahora = new Date();
  const resumen = resumenSueno(await cargarSueno(sesion.user.id, ahora, 10), ahora);
  if (resumen.enCurso) return `En cama desde las ${horaDe(resumen.enCurso.acostarse)}`;
  const noche = resumen.ultimaNoche;
  if (!noche || noche.etiqueta !== "Anoche") return null;
  if (!noche.completa) return "Noche a medias";
  const duracion = duracionCorta(noche.duracionMin);
  return resumen.indice.valor === null ? `${duracion} anoche` : `${duracion} · índice ${resumen.indice.valor}`;
}
