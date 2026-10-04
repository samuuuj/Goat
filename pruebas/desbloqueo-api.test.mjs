// /api/v1/desbloqueo/*: la puerta calcula en el servidor y anota la apertura, cierres, pase 1 vez al día, sin montos.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ENTORNO, crearSupabaseFalso, jwtFalso, llamar } from "./ayuda/supabase-falso.mjs";
import { atender } from "../api/_lib/enrutador.js";
import { RUTAS } from "../api/_lib/rutas.js";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const SESION_A = jwtFalso("a");
const F = "2026-10-02";
const en = (hora, fecha = F) => new Date(`${fecha}T${hora}:00-05:00`);
const iso = (hora, fecha = F) => en(hora, fecha).toISOString();

function base(datos = {}) {
  return crearSupabaseFalso({
    datos: { perfil: [{ user_id: A, metas: {}, ajustes: {} }], api_tokens: [], ...datos },
    sesiones: { [SESION_A]: A },
    unicas: { desbloqueo_pases: [["user_id", "fecha"]] },
  });
}

async function conToken(falso) {
  const r = await llamar(falso, "POST tokens", { token: SESION_A, cuerpo: { nombre: "iPhone" } });
  assert.equal(r.estado, 201);
  return r.cuerpo.datos.token;
}

/** Como llamar(), pero con encabezados extra (Host de Vercel). */
function llamarCon(falso, metodoYRuta, { token, query = {}, cuerpo, ahora, encabezados = {} }) {
  const [metodo, ruta] = metodoYRuta.split(" ");
  return atender(
    { metodo, ruta, query, cuerpo, encabezados: { authorization: `Bearer ${token}`, ...encabezados } },
    { rutas: RUTAS, entorno: ENTORNO, fetch: falso.fetch, ahora },
  );
}

/** Día completo (score 100) visto a la 01:30 del día siguiente: sigue siendo el día F. */
const DIA_COMPLETO = {
  comidas: ["desayuno", "almuerzo", "cena"].map((tipo) => ({ user_id: A, tipo, kcal: 870, proteina_g: 45, omitida: false, fecha: F })),
  checkins: [{ user_id: A, modulo: "finanzas", tipo: "cierre", fecha: F, momento: iso("23:00") }],
  uni_sesiones: [{ user_id: A, minutos: 120, fecha: F }],
  gym_sesiones: [{ user_id: A, fecha: F }],
};

const sinMontos = (r) => {
  assert.doesNotMatch(r.cuerpo.mensaje, /\$/);
  if (r.cuerpo.datos?.mensaje) assert.doesNotMatch(r.cuerpo.datos.mensaje, /\$/);
};

test("la puerta exige token antes de todo", async () => {
  const falso = base();
  const r = await llamar(falso, "GET desbloqueo/gate", { query: { app: "tiktok" } });
  assert.equal(r.estado, 401);
  assert.equal(falso.tablas.apps_eventos, undefined, "anotó algo sin token");
});

test("registros atrasados → cerrado, dice qué falta y anota la apertura bloqueada", async () => {
  const falso = base();
  const token = await conToken(falso);
  const r = await llamarCon(falso, "GET desbloqueo/gate", {
    token,
    query: { app: "TikTok" },
    ahora: en("16:00"),
    encabezados: { host: "goat.example.app" },
  });
  assert.equal(r.estado, 200);
  const d = r.cuerpo.datos;
  assert.equal(d.permitido, false);
  assert.equal(d.accion, "bloquear");
  assert.equal(d.minutos_restantes, 0);
  assert.equal(r.cuerpo.mensaje, "🔒 Falta: desayuno y almuerzo (+1)");
  assert.deepEqual(
    d.faltan.map((p) => p.clave),
    ["desayuno", "almuerzo", "checkin_finanzas"],
  );
  assert.equal(d.faltan[0].abrir, "https://goat.example.app/index.html#registrar=comida");
  assert.equal(d.abrir, d.faltan[0].abrir);
  assert.equal(d.faltan[2].atajo, "💸 Movimiento");
  assert.match(d.faltan[2].abrir, /^shortcuts:\/\/run-shortcut\?name=/);
  assert.equal(d.pase_disponible, true);
  sinMontos(r);

  assert.equal(falso.tablas.apps_eventos.length, 1);
  const [fila] = falso.tablas.apps_eventos;
  assert.equal(fila.user_id, A);
  assert.equal(fila.app, "tiktok");
  assert.equal(fila.evento, "abrir");
  assert.equal(fila.permitido, false);
  assert.equal(fila.origen, "automatizacion");
  assert.equal(fila.fecha, F);
});

test("al día → 30 min; con el uso de hoy quedan los restantes", async () => {
  const falso = base({
    apps_eventos: [
      { user_id: A, app: "tiktok", evento: "abrir", momento: iso("08:00"), fecha: F },
      { user_id: A, app: "tiktok", evento: "cerrar", momento: iso("08:18"), fecha: F },
      // Lo de otra cuenta no cuenta.
      { user_id: B, app: "tiktok", evento: "abrir", momento: iso("08:00"), fecha: F },
      { user_id: B, app: "tiktok", evento: "cerrar", momento: iso("09:30"), fecha: F },
    ],
  });
  const token = await conToken(falso);
  const r = await llamar(falso, "GET desbloqueo/gate", { token, query: { app: "tiktok" }, ahora: en("09:40") });
  const d = r.cuerpo.datos;
  assert.equal(d.permitido, true);
  assert.equal(d.accion, "pasar");
  assert.equal(d.minutos_ganados, 30);
  assert.equal(d.minutos_usados, 18);
  assert.equal(d.minutos_restantes, 12);
  assert.equal(r.cuerpo.mensaje, "✅ 12 min en TikTok");
  assert.deepEqual(d.faltan, []);
  assert.equal(d.abrir, null);
  assert.equal(falso.tablas.apps_eventos.filter((e) => e.user_id === A).length, 3);
  // Otra app tiene su propia bolsa.
  const ig = await llamar(falso, "GET desbloqueo/gate", { token, query: { app: "instagram" }, ahora: en("09:41") });
  assert.equal(ig.cuerpo.datos.minutos_restantes, 30);
  sinMontos(r);
});

test("se acabó el tiempo (al día): bloquea sin 'Falta' y 'Registrar ahora' abre Tu tiempo", async () => {
  const falso = base({
    apps_eventos: [
      { user_id: A, app: "tiktok", evento: "abrir", momento: iso("06:00"), fecha: F },
      { user_id: A, app: "tiktok", evento: "cerrar", momento: iso("07:00"), fecha: F },
    ],
  });
  const token = await conToken(falso);
  const r = await llamarCon(falso, "GET desbloqueo/gate", {
    token,
    query: { app: "tiktok" },
    ahora: en("09:00"),
    encabezados: { "x-forwarded-host": "goat.example.app", host: "interno" },
  });
  assert.equal(r.cuerpo.mensaje, "⏳ Se acabó TikTok por hoy");
  assert.equal(r.cuerpo.datos.accion, "bloquear");
  assert.equal(r.cuerpo.datos.abrir, "https://goat.example.app/desbloqueo.html");
  // Un Host raro no se usa para armar enlaces.
  const raro = await llamarCon(falso, "GET desbloqueo/gate", { token, query: { app: "tiktok" }, ahora: en("09:01"), encabezados: { host: "evil.com/x?y" } });
  assert.equal(raro.cuerpo.datos.abrir, null);
});

test("puntaje 100 → 90 min y un solo aviso 🎉 por día y nivel", async () => {
  const falso = base(DIA_COMPLETO);
  const token = await conToken(falso);
  const ahora = en("01:30", "2026-10-03");
  const r = await llamar(falso, "GET desbloqueo/gate", { token, query: { app: "youtube" }, ahora });
  assert.equal(r.cuerpo.datos.puntaje, 100);
  assert.equal(r.cuerpo.datos.minutos_ganados, 90);
  assert.equal(r.cuerpo.mensaje, "✅ 90 min en YouTube");
  assert.equal(r.cuerpo.datos.siguiente, null);
  await llamar(falso, "GET desbloqueo/gate", { token, query: { app: "tiktok" }, ahora });
  const avisos = falso.tablas.notificaciones ?? [];
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].clave, `desbloqueo:nivel:${F}:100`);
  assert.equal(avisos[0].modulo, "desbloqueo");
  assert.doesNotMatch(`${avisos[0].titulo} ${avisos[0].cuerpo}`, /\$/);
});

test("app vacía o inválida → 400 con mensaje humano y no anota nada", async () => {
  const falso = base();
  const token = await conToken(falso);
  for (const app of [undefined, "", "   ", "!!!"]) {
    const r = await llamar(falso, "GET desbloqueo/gate", { token, query: app === undefined ? {} : { app }, ahora: en("09:00") });
    assert.equal(r.estado, 400);
    assert.equal(r.cuerpo.mensaje, "⚠️ Revisa: app");
    assert.equal(r.cuerpo.datos, undefined, "un error no debe traer accion");
  }
  assert.equal((falso.tablas.apps_eventos ?? []).length, 0);
});

test("cerrar la app: anota el cierre, devuelve los minutos de hoy y no duplica reintentos", async () => {
  const falso = base();
  const token = await conToken(falso);
  await llamar(falso, "GET desbloqueo/gate", { token, query: { app: "tiktok" }, ahora: en("09:00") });
  const cierre = { app: "tiktok", evento: "cerrar" };
  const r = await llamar(falso, "POST desbloqueo/evento", { token, cuerpo: cierre, ahora: en("09:20") });
  assert.equal(r.estado, 201);
  assert.equal(r.cuerpo.mensaje, "👋 20 min hoy en TikTok");
  assert.equal(r.cuerpo.datos.minutos_usados, 20);
  // El atajo reintenta (misma hora): no se duplica.
  await llamar(falso, "POST desbloqueo/evento", { token, cuerpo: cierre, ahora: en("09:20") });
  assert.equal(falso.tablas.apps_eventos.length, 2);
  // Siguiente apertura: quedan 10.
  const g = await llamar(falso, "GET desbloqueo/gate", { token, query: { app: "tiktok" }, ahora: en("09:25") });
  assert.equal(g.cuerpo.datos.minutos_restantes, 10);
  sinMontos(r);
});

test("evento inválido o con una hora absurda → 400", async () => {
  const falso = base();
  const token = await conToken(falso);
  const ahora = en("09:00");
  const malo = await llamar(falso, "POST desbloqueo/evento", { token, cuerpo: { app: "tiktok", evento: "pausar" }, ahora });
  assert.equal(malo.estado, 400);
  const futuro = await llamar(falso, "POST desbloqueo/evento", { token, cuerpo: { app: "tiktok", momento: iso("12:00") }, ahora });
  assert.equal(futuro.estado, 400);
  const id = await llamar(falso, "POST desbloqueo/evento", { token, cuerpo: { app: "tiktok", id_cliente: "no-es-uuid" }, ahora });
  assert.equal(id.estado, 400);
});

test("pase de emergencia: 10 min para esa app, una sola vez al día", async () => {
  const falso = base();
  const token = await conToken(falso);
  const r = await llamar(falso, "POST desbloqueo/pase", { token, cuerpo: { app: "Instagram" }, ahora: en("16:00") });
  assert.equal(r.estado, 201);
  assert.equal(r.cuerpo.mensaje, "🆘 10 min en Instagram");
  assert.equal(falso.tablas.desbloqueo_pases.length, 1);
  assert.equal(falso.tablas.desbloqueo_pases[0].user_id, A);

  // Con registros atrasados, el pase abre esa app (y solo esa).
  const ig = await llamar(falso, "GET desbloqueo/gate", { token, query: { app: "instagram" }, ahora: en("16:01") });
  assert.equal(ig.cuerpo.datos.permitido, true);
  assert.equal(ig.cuerpo.datos.minutos_restantes, 10);
  assert.equal(ig.cuerpo.datos.pase_disponible, false);
  const tk = await llamar(falso, "GET desbloqueo/gate", { token, query: { app: "tiktok" }, ahora: en("16:02") });
  assert.equal(tk.cuerpo.datos.permitido, false);

  // El atajo reintenta a los 20 s: responde igual, sin crear otro.
  const reintento = await llamar(falso, "POST desbloqueo/pase", { token, cuerpo: { app: "instagram" }, ahora: new Date(en("16:00").getTime() + 20_000) });
  assert.equal(reintento.estado, 201);
  assert.equal(falso.tablas.desbloqueo_pases.length, 1);

  // Otro pase ese día: no.
  const otro = await llamar(falso, "POST desbloqueo/pase", { token, cuerpo: { app: "tiktok" }, ahora: en("18:00") });
  assert.equal(otro.estado, 409);
  assert.equal(otro.cuerpo.mensaje, "🔒 Ya usaste el pase de hoy");
  assert.equal(falso.tablas.desbloqueo_pases.length, 1);

  // Al día siguiente vuelve a haber.
  const manana = await llamar(falso, "POST desbloqueo/pase", { token, cuerpo: { app: "tiktok" }, ahora: en("10:00", "2026-10-03") });
  assert.equal(manana.estado, 201);
  sinMontos(r);
});

test("pase con id_cliente: el mismo id no crea dos; uno inválido → 400", async () => {
  const falso = base();
  const token = await conToken(falso);
  const id = "44444444-4444-4444-8444-444444444444";
  const uno = await llamar(falso, "POST desbloqueo/pase", { token, cuerpo: { app: "youtube", id_cliente: id }, ahora: en("12:00") });
  assert.equal(uno.estado, 201);
  const dos = await llamar(falso, "POST desbloqueo/pase", { token, cuerpo: { app: "youtube", id_cliente: id }, ahora: en("12:05") });
  assert.equal(dos.estado, 201);
  assert.equal(falso.tablas.desbloqueo_pases.length, 1);
  const malo = await llamar(falso, "POST desbloqueo/pase", { token, cuerpo: { app: "youtube", id_cliente: "x" }, ahora: en("12:06") });
  assert.equal(malo.estado, 400);
});

test("estado de hoy: todas las apps (con los juegos de Samuel) sin anotar aperturas", async () => {
  const falso = base();
  falso.tablas.perfil[0].ajustes = { desbloqueo: { juegos: [{ id: "clash-royale", nombre: "Clash Royale" }] }, otra: { x: 1 } };
  const token = await conToken(falso);
  const r = await llamar(falso, "GET desbloqueo/estado", { token, ahora: en("09:00") });
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.mensaje, "✅ 30 min por app");
  assert.deepEqual(
    r.cuerpo.datos.apps.map((a) => a.app),
    ["tiktok", "instagram", "youtube", "clash-royale"],
  );
  assert.equal(r.cuerpo.datos.abierto, true);
  assert.equal((falso.tablas.apps_eventos ?? []).length, 0);
  const tarde = await llamar(falso, "GET desbloqueo/estado", { token, ahora: en("16:00") });
  assert.equal(tarde.cuerpo.mensaje, "🔒 Falta: desayuno y almuerzo (+1)");
  sinMontos(tarde);
});

test("las consultas del desbloqueo van siempre filtradas por el usuario", async () => {
  const falso = base();
  const token = await conToken(falso);
  falso.llamadas.length = 0;
  await llamar(falso, "GET desbloqueo/gate", { token, query: { app: "tiktok" }, ahora: en("09:00") });
  await llamar(falso, "POST desbloqueo/pase", { token, cuerpo: { app: "tiktok" }, ahora: en("09:01") });
  const propias = falso.llamadas.filter((l) => /\/rest\/v1\/(apps_eventos|desbloqueo_pases)/.test(l.ruta) && l.metodo === "GET");
  assert.ok(propias.length >= 3);
  for (const l of propias) assert.match(l.ruta, new RegExp(`user_id=eq.${A}`));
});
