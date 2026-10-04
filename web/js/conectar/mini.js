// Dato corto para la tarjeta "Conectar iPhone." en Hoy (sin montos). null = sin dato.

import { cargarConectar } from "./datos.js";
import { cargarAtajos, contarHechos } from "./logica.js";

export async function miniDato(sesion) {
  const [{ perfil, tokens }, grupos] = await Promise.all([cargarConectar(sesion.user.id), cargarAtajos()]);
  if (!tokens.some((t) => !t.revocado)) return "Falta tu llave";
  const { hechos, total } = contarHechos(grupos, perfil.ajustes?.atajos);
  if (total > 0 && hechos >= total) return "✓ Todo conectado";
  return `${hechos} de ${total} atajos listos`;
}
