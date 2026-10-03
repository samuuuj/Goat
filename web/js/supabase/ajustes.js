// Ajustes personales en perfil.ajustes (jsonb): bienvenida, atajos hechos, reglas de desbloqueo…
// Cada módulo usa su propia clave de primer nivel ("bienvenida", "desbloqueo", "atajos"…).

import { supabase } from "./sesion.js";
import { leer, revisar } from "./datos.js";

/** Todos los ajustes del usuario ({} si no hay). */
export async function leerAjustes(userId) {
  const perfil = await leer(supabase.from("perfil").select("ajustes").eq("user_id", userId).maybeSingle());
  return perfil?.ajustes ?? {};
}

/** Guarda una clave de primer nivel sin pisar las demás (función ajustes_poner de schema.sql). */
export async function guardarAjuste(clave, valor) {
  revisar(await supabase.rpc("ajustes_poner", { clave, valor }));
}
