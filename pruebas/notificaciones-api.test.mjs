// /api/v1 del centro de notificaciones con el Supabase falso: token primero, mensaje corto sin montos,
// avisos guardados sin duplicar, lista para Scriptable y marcar leídas.

import { test } from "node:test";
import assert from "node:assert/strict";
import { crearSupabaseFalso, jwtFalso, llamar } from "./ayuda/supabase-falso.mjs";
import { tieneMontos } from "../web/js/notificaciones/logica.js";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const SESION_A = jwtFalso("a");
const f = "2026-10-02";
const a = (hora) => new Date(`${f}T${hora}:00-05:00`);

function base(datos = {}) {
  return crearSupabaseFalso({
    datos: { perfil: [{ user_id: A, metas: {} }], api_tokens: [], ...datos },
    sesiones: { [SESION_A]: A },
  });
}

async function conToken(falso) {
  const r = await llamar(falso, "POST tokens", { token: SESION_A, cuerpo: { nombre: "iPhone" } });
  assert.equal(r.estado, 201);
  return r.cuerpo.datos.token;
}

/** Día con todo lo de la mañana registrado (nada pendiente a las 13:30). */
const diaAlDia = () => ({
  comidas: [{ user_id: A, tipo: "desayuno", kcal: 500, proteina_g: 30, omitida: false, fecha: f, momento: `${f}T07:30:00-05:00` }],
  finanzas_movimientos: [{ user_id: A, tipo: "egreso", monto: 25000, fecha: f, momento: `${f}T12:50:00-05:00` }],
});

test("sin token → 401 (el token se pide antes de todo)", async () => {
  const falso = base();
  const r = await llamar(falso, "GET notificaciones/ahora");
  assert.equal(r.estado, 401);
  assert.equal(r.cuerpo.codigo, "SIN_TOKEN");
  assert.equal((await llamar(falso, "GET notificaciones")).estado, 401);
  assert.equal((await llamar(falso, "POST notificaciones/leidas", { cuerpo: { todas: true } })).estado, 401);
});

test("ahora: nada pendiente → notificar:false", async () => {
  const falso = base(diaAlDia());
  const token = await conToken(falso);
  const r = await llamar(falso, "GET notificaciones/ahora", { token, ahora: a("13:30") });
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.datos.notificar, false);
  assert.equal(r.cuerpo.datos.aviso, null);
  assert.equal(r.cuerpo.mensaje, "✅ Todo al día");
});

test("ahora: con pendientes → mensaje corto, sin dígitos de dinero, y queda en el centro de notificaciones", async () => {
  const falso = base(diaAlDia());
  const token = await conToken(falso);
  // 16:00: falta el almuerzo y el check-in de la tarde (el último gasto fue a las 12:50… dentro de las 5 h: no falta).
  const r = await llamar(falso, "GET notificaciones/ahora", { token, ahora: a("16:00") });
  assert.equal(r.estado, 200);
  const { notificar, mensaje, aviso, pendientes } = r.cuerpo.datos;
  assert.equal(notificar, true);
  assert.equal(pendientes, 1);
  assert.equal(mensaje, "🍽️ Almuerzo pendiente");
  assert.equal(aviso, mensaje);
  assert.equal(r.cuerpo.mensaje, mensaje);
  assert.ok(mensaje.split(" ").length <= 3);
  assert.ok(!tieneMontos(mensaje) && !/\$|25/.test(mensaje));

  const guardadas = falso.tablas.notificaciones;
  assert.deepEqual(guardadas.map((n) => n.clave), [`pendiente:almuerzo:${f}`]);
  assert.equal(guardadas[0].user_id, A);
  assert.equal(guardadas[0].origen, "automatizacion");
  assert.equal(guardadas[0].modulo, "comidas");
  for (const n of guardadas) assert.ok(!tieneMontos(`${n.titulo} ${n.cuerpo}`));
});

test("ahora: la automatización corre varias veces al día sin duplicar avisos", async () => {
  const falso = base();
  const token = await conToken(falso);
  await llamar(falso, "GET notificaciones/ahora", { token, ahora: a("16:00") });
  const despues = falso.tablas.notificaciones.length;
  await llamar(falso, "GET notificaciones/ahora", { token, ahora: a("16:05") });
  assert.equal(falso.tablas.notificaciones.length, despues, "repitió avisos con la misma clave");
  // A las 22:15 se suman solo los nuevos (cena y cierre).
  const noche = await llamar(falso, "GET notificaciones/ahora", { token, ahora: a("22:15") });
  assert.equal(noche.cuerpo.datos.mensaje, "🍳 4 pendientes");
  const claves = falso.tablas.notificaciones.map((n) => n.clave);
  assert.equal(new Set(claves).size, claves.length);
  assert.ok(claves.includes(`pendiente:cena:${f}`));
  assert.ok(claves.includes(`pendiente:cierre_finanzas:${f}`));
});

test("lista para Scriptable: sin borradas, con no leídas, solo del usuario", async () => {
  const fila = (id, extra) => ({ id, user_id: A, modulo: "sueno", emoji: "🌙", titulo: id, cuerpo: null, url: "sueno.html", clave: id, leida_en: null, descartada_en: null, momento: `${f}T0${id.length}:00:00-05:00`, ...extra });
  const falso = base({
    notificaciones: [
      fila("a"),
      fila("bb", { leida_en: `${f}T10:00:00-05:00` }),
      fila("ccc", { descartada_en: `${f}T10:00:00-05:00` }),
      { ...fila("dddd"), user_id: B },
    ],
  });
  const token = await conToken(falso);
  const r = await llamar(falso, "GET notificaciones", { token });
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.datos.no_leidas, 1);
  assert.equal(r.cuerpo.mensaje, "🔔 1 sin leer");
  assert.deepEqual(r.cuerpo.datos.notificaciones.map((n) => n.titulo), ["bb", "a"]);
  assert.deepEqual(r.cuerpo.datos.notificaciones.map((n) => n.leida), [true, false]);
  assert.ok(!("clave" in r.cuerpo.datos.notificaciones[0]));

  const soloNoLeidas = await llamar(falso, "GET notificaciones", { token, query: { no_leidas: "1", limite: "5" } });
  assert.deepEqual(soloNoLeidas.cuerpo.datos.notificaciones.map((n) => n.titulo), ["a"]);
  assert.equal((await llamar(falso, "GET notificaciones", { token, query: { limite: "500" } })).estado, 400);
});

test("marcar leídas por ids o todas; ids inválidos → 400", async () => {
  const id1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const id2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const id3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const fila = (id, usuario = A) => ({ id, user_id: usuario, modulo: "finanzas", emoji: "💸", titulo: "x", leida_en: null, descartada_en: null, momento: `${f}T09:00:00-05:00` });
  const falso = base({ notificaciones: [fila(id1), fila(id2), fila(id3, B)] });
  const token = await conToken(falso);

  const una = await llamar(falso, "POST notificaciones/leidas", { token, cuerpo: { ids: [id1] }, ahora: a("10:00") });
  assert.equal(una.estado, 200);
  assert.equal(una.cuerpo.datos.marcadas, 1);
  assert.ok(falso.tablas.notificaciones.find((n) => n.id === id1).leida_en);
  assert.equal(falso.tablas.notificaciones.find((n) => n.id === id2).leida_en, null);

  // "todas" nunca toca las de otra cuenta.
  const todas = await llamar(falso, "POST notificaciones/leidas", { token, cuerpo: { todas: true } });
  assert.equal(todas.cuerpo.datos.marcadas, 1);
  assert.equal(falso.tablas.notificaciones.find((n) => n.id === id3).leida_en, null);

  assert.equal((await llamar(falso, "POST notificaciones/leidas", { token, cuerpo: { ids: ["x"] } })).estado, 400);
  assert.equal((await llamar(falso, "POST notificaciones/leidas", { token, cuerpo: {} })).estado, 400);
});
