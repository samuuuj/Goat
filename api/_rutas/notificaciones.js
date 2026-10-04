// Rutas de /api/v1 del centro de notificaciones (D-057).
//   GET  notificaciones/ahora   → para las automatizaciones "Hora del día" del iPhone: { notificar, mensaje, aviso }.
//   GET  notificaciones         → lista para Scriptable u otros clientes (sin las borradas).
//   POST notificaciones/leidas  → marcar leídas ({ ids: [...] } o { todas: true }).
// Las reglas son las mismas de la web (web/js/notificaciones/reglas.js). Sin montos (D-020).

import { ok, ErrorApi } from "../_lib/respuesta.js";
import { notificar } from "../_lib/notificar.js";
import { cargarRegistrosServidor } from "../_lib/registros.js";
import { entero, esUuid } from "../_lib/validar.js";
import { construirResumen } from "../../web/js/logica/calculo.js";
import { generarNotificaciones, mensajeAhora } from "../../web/js/notificaciones/reglas.js";

const COLUMNAS = "id,modulo,emoji,titulo,cuerpo,url,momento,leida_en";
const MAXIMO_IDS = 100;

/** Guarda en el centro de notificaciones los avisos de las reglas (la clave evita duplicados). Nunca rompe la respuesta. */
async function guardarAvisos(db, resumen, ahora) {
  for (const aviso of generarNotificaciones(resumen, ahora)) {
    try {
      await notificar(db, { ...aviso, momento: ahora });
    } catch (e) {
      console.warn("[notificaciones] aviso sin guardar:", aviso.clave, e?.message);
    }
  }
}

export default {
  /**
   * Para "Mostrar notificación" en el iPhone: emoji + 1–2 palabras si falta algo (pendientes del día;
   * los bloques obligatorios de la rutina entran cuando calculo.js los sume a los pendientes).
   * `aviso` es el mensaje o null, para que el atajo pregunte "Si aviso tiene algún valor".
   */
  "GET notificaciones/ahora": async ({ db, ahora }) => {
    const resumen = construirResumen(await cargarRegistrosServidor(db, ahora), ahora);
    const { notificar: hayAlgo, mensaje } = mensajeAhora(resumen);
    await guardarAvisos(db, resumen, ahora);
    return ok(mensaje, {
      notificar: hayAlgo,
      mensaje,
      aviso: hayAlgo ? mensaje : null,
      pendientes: resumen.pendientes.length,
    });
  },

  /** Lista para Scriptable o futuros clientes. ?limite=20 (máx. 50) · ?no_leidas=1 solo las no leídas. */
  "GET notificaciones": async ({ db, query }) => {
    const limite = query.limite == null || query.limite === "" ? 20 : entero(query.limite, 1, 50, "límite");
    const filtros = { descartada_en: "is.null" };
    if (query.no_leidas === "1" || query.no_leidas === "true") filtros.leida_en = "is.null";
    const [lista, sinLeer] = await Promise.all([
      db.select("notificaciones", { columnas: COLUMNAS, filtros, orden: "momento.desc", limite }),
      db.select("notificaciones", { columnas: "id", filtros: { descartada_en: "is.null", leida_en: "is.null" }, limite: 100 }),
    ]);
    const n = sinLeer.length;
    return ok(n > 0 ? `🔔 ${n} sin leer` : "🔔 Al día", {
      no_leidas: n,
      notificaciones: lista.map(({ leida_en, ...resto }) => ({ ...resto, leida: Boolean(leida_en) })),
    });
  },

  /** Marca leídas las que digas ({ ids: [...] }) o todas ({ todas: true }). */
  "POST notificaciones/leidas": async ({ db, cuerpo, ahora }) => {
    const filtros = { leida_en: "is.null", descartada_en: "is.null" };
    if (cuerpo.todas !== true) {
      const ids = Array.isArray(cuerpo.ids) ? cuerpo.ids : cuerpo.id ? [cuerpo.id] : [];
      if (ids.length === 0 || ids.length > MAXIMO_IDS || !ids.every(esUuid)) {
        throw new ErrorApi("DATO_INVALIDO", "⚠️ Revisa: ids", 400);
      }
      filtros.id = `in.(${[...new Set(ids)].join(",")})`;
    }
    const marcadas = await db.update("notificaciones", { leida_en: ahora.toISOString() }, filtros);
    return ok("✅ Leídas", { marcadas: marcadas.length });
  },
};
