// Dato corto para la tarjeta "Dinero." de Hoy (sin montos, D-020). null = sin dato.
// Prioridad: un pago de deuda en 3 días o menos; si no, cuántos movimientos llevas hoy.

import { supabase } from "../supabase/sesion.js";
import { diaLogico } from "../logica/dia.js";
import { diasEntre, proximaFecha } from "./logica.js";

export async function miniDato(sesion) {
  const userId = sesion?.user?.id;
  if (!supabase || !userId) return null;
  const hoy = diaLogico(new Date());
  const [movimientos, deudas] = await Promise.all([
    supabase.from("finanzas_movimientos").select("id").eq("user_id", userId).eq("fecha", hoy),
    supabase.from("finanzas_deudas").select("direccion,dia_pago").eq("user_id", userId).eq("estado", "activa"),
  ]);

  // Sin la tabla de deudas (base sin la v2) igual se muestra el conteo de hoy.
  const pagos = (deudas.data ?? [])
    .filter((d) => d.direccion === "debo" && d.dia_pago)
    .map((d) => diasEntre(hoy, proximaFecha(d.dia_pago, hoy)))
    .filter((dias) => dias <= 3)
    .sort((a, b) => a - b);
  if (pagos.length > 0) {
    const dias = pagos[0];
    return `📒 Pago ${dias === 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`}`;
  }

  if (movimientos.error) return null;
  const n = movimientos.data?.length ?? 0;
  return n === 0 ? "Sin movimientos hoy" : `${n} ${n === 1 ? "movimiento" : "movimientos"} hoy`;
}
