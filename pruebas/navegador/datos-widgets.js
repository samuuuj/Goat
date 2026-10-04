// Datos de prueba de Widgets para el simulador (pruebas/navegador/simulador.js). Nada de esto existe en Supabase.
// http://localhost:3000/_pruebas/widgets.html                    → vista previa con los datos de prueba de todos los módulos
// http://localhost:3000/_pruebas/widgets.html?escenario=vacio    → usuario nuevo (sin rutina, sin sueño)
//
// Los registros, la rutina, el sueño y el desbloqueo ya los ponen los datos-<modulo>.js de cada sección.
// Aquí solo va la respuesta simulada de GET /api/v1/widget (para el botón "Probar" de Conectar).

import { diaLogico } from "/js/logica/dia.js";
import { construirResumen, leerMetas } from "/js/logica/calculo.js";
import { estadoDesbloqueo } from "/js/desbloqueo/logica.js";
import { resumenSueno } from "/js/sueno/logica.js";
import { armarWidget, desbloqueoCorto, rutinaCorta, suenoCorto } from "/js/widgets/logica.js";

/** Sin tablas propias: los widgets leen las de los demás módulos. */
export function agregar(_datos, _usuario) {}

/** Registros como los arma el servidor (api/_lib/registros.js), desde las tablas del simulador. */
function registros(t) {
  const hoy = diaLogico(new Date());
  return {
    metas: leerMetas(t.perfil?.[0]?.metas),
    comidas: t.comidas ?? [],
    movimientos: t.finanzas_movimientos ?? [],
    checkins: (t.checkins ?? []).filter((c) => c.modulo === "finanzas"),
    estudio: t.uni_sesiones ?? [],
    gym: t.gym_sesiones ?? [],
    festivos: t.festivos ?? [],
    rutinaBloques: (t.rutina_bloques ?? []).filter((b) => b.activo !== false),
    rutinaChecks: (t.rutina_checks ?? []).filter((c) => c.fecha === hoy),
  };
}

export function api(rutas) {
  rutas["GET widget"] = async ({ query, datos: d }) => {
    const t = d.tablas;
    const ahora = new Date();
    const hoy = diaLogico(ahora);
    const regs = registros(t);
    const resumen = construirResumen(regs, ahora);
    const perfil = t.perfil?.[0] ?? {};
    const datos = armarWidget(
      {
        resumen,
        rutina: rutinaCorta({ bloques: regs.rutinaBloques, checks: regs.rutinaChecks, festivos: regs.festivos, fecha: resumen.fecha }, ahora),
        sueno: suenoCorto(
          resumenSueno({ eventos: t.sueno_eventos ?? [], muestras: t.sueno_muestras ?? [], metas: { ...(perfil.metas ?? {}), ...(perfil.ajustes?.sueno ?? {}) } }, ahora),
        ),
        desbloqueo: desbloqueoCorto(
          estadoDesbloqueo({
            resumen,
            eventos: (t.apps_eventos ?? []).filter((e) => e.fecha === hoy),
            pases: (t.desbloqueo_pases ?? []).filter((p) => p.fecha === hoy),
            ajustes: perfil.ajustes?.desbloqueo,
            ahora,
          }),
        ),
        avisos: { sinLeer: (t.notificaciones ?? []).filter((n) => !n.leida_en && !n.descartada_en).length },
      },
      { ahora, dinero: query.dinero === "1" },
    );
    return { ok: true, mensaje: datos.bloqueo.linea, datos };
  };
}
