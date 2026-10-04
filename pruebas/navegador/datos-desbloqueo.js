// Datos de prueba del desbloqueo para el simulador (pruebas/navegador/simulador.js). Nada de esto existe en Supabase.
// http://localhost:3000/_pruebas/desbloqueo.html               → registros al día (≈ 90 pts → 60 min), uso de hoy y un juego
// http://localhost:3000/_pruebas/desbloqueo.html?desbloqueo=cerrado → sin los registros extra (cerrado si la hora ya pide algo)
// http://localhost:3000/_pruebas/desbloqueo.html?desbloqueo=pase    → además, el pase de hoy usado en Instagram
// http://localhost:3000/_pruebas/desbloqueo.html?escenario=vacio    → todo vacío

import { diaLogico } from "/js/logica/dia.js";
import { construirResumen, leerMetas } from "/js/logica/calculo.js";
import { estadoApp, estadoDesbloqueo, mensajeGate, minutosUsados, slugApp } from "/js/desbloqueo/logica.js";

const MINUTO = 60_000;
const opcion = new URLSearchParams(location.search).get("desbloqueo");

/** Momento ISO de hace `min` minutos, o null si cae antes de que empezara el día lógico (04:00). */
function hace(min) {
  const ahora = Date.now();
  const inicioDia = Date.parse(`${diaLogico(new Date())}T04:00:00-05:00`);
  const t = ahora - min * MINUTO;
  return t > inicioDia ? new Date(t).toISOString() : null;
}

export function agregar(datos, usuario) {
  const hoy = diaLogico(new Date());
  const perfil = datos.tablas.perfil[0];
  perfil.ajustes = { ...(perfil.ajustes ?? {}), desbloqueo: { juegos: [{ id: "clash-royale", nombre: "Clash Royale" }] } };

  if (opcion !== "cerrado") {
    // Almuerzo, cena y cierre de gastos: registros al día y ≈ 90 puntos (nivel de 60 min).
    const reciente = hace(20) ?? new Date().toISOString();
    datos.tablas.comidas.push(
      { tipo: "almuerzo", kcal: 950, proteina_g: 45, omitida: false, fecha: hoy, momento: reciente },
      { tipo: "cena", kcal: 800, proteina_g: 45, omitida: false, fecha: hoy, momento: reciente },
    );
    datos.tablas.checkins.push({ modulo: "finanzas", tipo: "cierre", fecha: hoy, momento: reciente });
  }

  const eventos = [];
  const sesion = (app, desde, hasta, permitido = true) => {
    const abrir = hace(desde);
    if (!abrir) return;
    eventos.push({ id: crypto.randomUUID(), user_id: usuario, app, evento: "abrir", permitido, momento: abrir, fecha: hoy, origen: "automatizacion" });
    const cerrar = hasta === null ? null : hace(hasta);
    if (cerrar) eventos.push({ id: crypto.randomUUID(), user_id: usuario, app, evento: "cerrar", permitido: null, momento: cerrar, fecha: hoy, origen: "automatizacion" });
  };
  sesion("tiktok", 200, 178);
  sesion("clash-royale", 150, 149.5, false);
  sesion("instagram", 120, 105);
  sesion("youtube", 60, 20);
  sesion("tiktok", 12, null); // Abierta ahora mismo.
  datos.tablas.apps_eventos = eventos;

  datos.tablas.desbloqueo_pases =
    opcion === "pase" && hace(90)
      ? [{ id: crypto.randomUUID(), user_id: usuario, app: "instagram", minutos: 10, momento: hace(90), fecha: hoy, origen: "web" }]
      : [];
}

/** Registros como los arma el servidor (api/_lib/registros.js), desde las tablas del simulador. */
function registros(d) {
  const t = d.tablas;
  return {
    metas: leerMetas(t.perfil?.[0]?.metas),
    comidas: t.comidas ?? [],
    movimientos: t.finanzas_movimientos ?? [],
    checkins: (t.checkins ?? []).filter((c) => c.modulo === "finanzas"),
    estudio: t.uni_sesiones ?? [],
    gym: t.gym_sesiones ?? [],
    festivos: t.festivos ?? [],
  };
}

const deHoy = (filas) => (filas ?? []).filter((f) => f.fecha === diaLogico(new Date()));

export function api(rutas, usuario) {
  const contexto = (d) => ({
    resumen: construirResumen(registros(d), new Date()),
    eventos: deHoy(d.tablas.apps_eventos),
    pases: deHoy(d.tablas.desbloqueo_pases),
    ajustes: d.tablas.perfil?.[0]?.ajustes?.desbloqueo,
    ahora: new Date(),
  });

  rutas["GET desbloqueo/gate"] = async ({ query, datos: d }) => {
    const app = slugApp(query.app);
    if (!app) return { estado: 400, ok: false, mensaje: "⚠️ Revisa: app", codigo: "DATO_INVALIDO" };
    const e = estadoApp({ ...contexto(d), app });
    (d.tablas.apps_eventos ??= []).push({
      id: crypto.randomUUID(), user_id: usuario, app, evento: "abrir", permitido: e.permitido,
      momento: new Date().toISOString(), fecha: diaLogico(new Date()), origen: "automatizacion",
    });
    const mensaje = mensajeGate(e);
    return { ok: true, mensaje, datos: { app, permitido: e.permitido, accion: e.permitido ? "pasar" : "bloquear", mensaje, minutos_restantes: e.restantes, pase_disponible: e.paseDisponible, faltan: e.faltan } };
  };

  rutas["GET desbloqueo/estado"] = async ({ datos: d }) => {
    const e = estadoDesbloqueo(contexto(d));
    return { ok: true, mensaje: e.abierto ? `✅ ${e.nivel.minutos} min por app` : "🔒 Falta registrar", datos: { abierto: e.abierto, puntaje: e.score, apps: e.apps.map((a) => ({ app: a.app, minutos_restantes: a.restantes })) } };
  };

  rutas["POST desbloqueo/evento"] = async ({ cuerpo, datos: d }) => {
    const app = slugApp(cuerpo.app);
    const evento = cuerpo.evento === "abrir" ? "abrir" : "cerrar";
    (d.tablas.apps_eventos ??= []).push({ id: crypto.randomUUID(), user_id: usuario, app, evento, momento: new Date().toISOString(), fecha: diaLogico(new Date()), origen: "atajo" });
    const usados = Math.round(minutosUsados(deHoy(d.tablas.apps_eventos), app, new Date()));
    return { estado: 201, ok: true, mensaje: `👋 ${usados} min hoy`, datos: { app, evento, minutos_usados: usados } };
  };

  rutas["POST desbloqueo/pase"] = async ({ cuerpo, datos: d }) => {
    if (deHoy(d.tablas.desbloqueo_pases).length > 0) return { estado: 409, ok: false, mensaje: "🔒 Ya usaste el pase de hoy", codigo: "PASE_USADO" };
    const app = slugApp(cuerpo.app);
    (d.tablas.desbloqueo_pases ??= []).push({ id: crypto.randomUUID(), user_id: usuario, app, minutos: 10, momento: new Date().toISOString(), fecha: diaLogico(new Date()), origen: "atajo" });
    return { estado: 201, ok: true, mensaje: "🆘 10 min", datos: { app, minutos: 10 } };
  };
}
