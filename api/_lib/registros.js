// Los mismos registros que lee el navegador (web/js/supabase/datos.js › cargarRegistros), pero desde el servidor.
// Así construirResumen() de web/js/logica/calculo.js da exactamente el mismo resultado en la API (principio 1).

import { diaLogico } from "../../web/js/logica/dia.js";
import { DIAS_HISTORIA, inicioDeMes, leerMetas, sumarDias } from "../../web/js/logica/calculo.js";

export async function cargarRegistrosServidor(db, ahora = new Date()) {
  const hoy = diaLogico(ahora);
  const desde = sumarDias(hoy, -(DIAS_HISTORIA - 1));
  const desdeFinanzas = inicioDeMes(desde) < desde ? inicioDeMes(desde) : desde;

  const [perfil, comidas, movimientos, checkins, estudio, gym, festivos, rutinaBloques, rutinaChecks] = await Promise.all([
    db.select("perfil", { columnas: "metas", limite: 1 }),
    db.select("comidas", { columnas: "tipo,kcal,proteina_g,omitida,fecha", filtros: { fecha: `gte.${desde}` } }),
    db.select("finanzas_movimientos", { columnas: "tipo,monto,fecha,momento", filtros: { fecha: `gte.${desdeFinanzas}` } }),
    db.select("checkins", { columnas: "tipo,fecha,momento", filtros: { modulo: "eq.finanzas", fecha: `gte.${desde}` } }),
    db.select("uni_sesiones", { columnas: "minutos,fecha", filtros: { fecha: `gte.${desde}` } }),
    db.select("gym_sesiones", { columnas: "fecha,tipo", filtros: { fecha: `gte.${desde}` } }),
    db.select("festivos", { columnas: "fecha,nombre", filtros: { fecha: [`gte.${sumarDias(hoy, -6)}`, `lte.${hoy}`] } }),
    db.select("rutina_bloques", {
      columnas: "id,titulo,tipo,dias,hora_inicio,duracion_min,obligatorio,orden,activo",
      filtros: { activo: "eq.true" },
    }),
    db.select("rutina_checks", { columnas: "bloque_id,fecha,estado", filtros: { fecha: `eq.${hoy}` } }),
  ]);

  return {
    metas: leerMetas(perfil[0]?.metas),
    comidas,
    movimientos,
    checkins,
    estudio,
    gym,
    festivos,
    rutinaBloques,
    rutinaChecks,
  };
}
