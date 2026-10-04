// /api/v1/finanzas: token primero, cuentas iniciales, los 4 tipos, deudas, mensajes sin montos e id_cliente.

import { test } from "node:test";
import assert from "node:assert/strict";
import { crearSupabaseFalso, jwtFalso, llamar } from "./ayuda/supabase-falso.mjs";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const SESION_A = jwtFalso("a");
const SESION_B = jwtFalso("b");
const AHORA = new Date("2026-10-02T19:42:00-05:00");

function base() {
  return crearSupabaseFalso({
    datos: { perfil: [{ user_id: A, metas: {} }, { user_id: B, metas: {} }], api_tokens: [] },
    sesiones: { [SESION_A]: A, [SESION_B]: B },
    unicas: { finanzas_cuentas: [["user_id", "nombre"]] },
  });
}

async function conToken(falso, sesion = SESION_A) {
  const r = await llamar(falso, "POST tokens", { token: sesion, cuerpo: { nombre: "iPhone" } });
  assert.equal(r.estado, 201);
  return r.cuerpo.datos.token;
}

/** Atajo: POST finanzas/movimientos (con la hora fija de las pruebas). */
const mover = (falso, token, cuerpo) => llamar(falso, "POST finanzas/movimientos", { token, cuerpo, ahora: AHORA });

const sinMontos = (r) => assert.ok(!/\d/.test(r.cuerpo.mensaje), `el mensaje lleva números: ${r.cuerpo.mensaje}`);
const movimientosDe = (falso, usuario = A) => (falso.tablas.finanzas_movimientos ?? []).filter((m) => m.user_id === usuario);

test("sin token no hay finanzas", async () => {
  const falso = base();
  for (const ruta of ["GET finanzas/menu", "POST finanzas/movimientos", "GET finanzas/resumen", "POST finanzas/deudas"]) {
    const r = await llamar(falso, ruta, { cuerpo: { tipo: "gasto", monto: 1 } });
    assert.equal(r.estado, 401, ruta);
  }
  assert.equal((falso.tablas.finanzas_movimientos ?? []).length, 0);
});

test("el menú crea Efectivo, Nu y Nequi la primera vez y no los duplica", async () => {
  const falso = base();
  const token = await conToken(falso);
  const r = await llamar(falso, "GET finanzas/menu", { token, ahora: AHORA });
  assert.equal(r.estado, 200);
  sinMontos(r);
  assert.deepEqual(r.cuerpo.datos.cuentas.map((c) => c.nombre), ["Efectivo", "Nu", "Nequi"]);
  assert.deepEqual(r.cuerpo.datos.opciones_tipo, ["💸 Gasto", "💰 Ingreso", "🔁 Transferencia", "🏧 Retiro"]);
  assert.equal(r.cuerpo.datos.preguntas["💸 Gasto"].categorias.at(-1), "✏️ Otro…");
  await llamar(falso, "GET finanzas/menu", { token, ahora: AHORA });
  assert.equal(falso.tablas.finanzas_cuentas.filter((c) => c.user_id === A).length, 3);
});

test("Gasto · Comida · Nequi $25.000 «Cena»: «💸 Guardado · Comida», sin montos", async () => {
  const falso = base();
  const token = await conToken(falso);
  const r = await mover(falso, token, { tipo: "💸 Gasto", monto: "25.000", categoria: "🍔 Comida", cuenta: "Nequi", descripcion: "Cena" });
  assert.equal(r.estado, 201);
  assert.equal(r.cuerpo.mensaje, "💸 Guardado · Comida");
  sinMontos(r);
  const [mov] = movimientosDe(falso);
  const nequi = falso.tablas.finanzas_cuentas.find((c) => c.nombre === "Nequi");
  assert.deepEqual(
    { tipo: mov.tipo, monto: mov.monto, categoria: mov.categoria, cuenta_id: mov.cuenta_id, cuenta: mov.cuenta, origen: mov.origen },
    { tipo: "egreso", monto: 25000, categoria: "comida", cuenta_id: nequi.id, cuenta: "Nequi", origen: "atajo" },
  );
  assert.equal(mov.fecha, "2026-10-02");
  // El registro de llamadas no guarda el cuerpo (tiene montos).
  assert.ok(falso.tablas.log_api.every((l) => l.cuerpo == null));
});

test("los textos del menú sirven de vuelta: «✏️ Otro…» + «Cita»", async () => {
  const falso = base();
  const token = await conToken(falso);
  const r = await mover(falso, token, { tipo: "💸 Gasto", monto: 35000, categoria: "✏️ Otro…", categoria_otra: "Cita", cuenta: "Nequi" });
  assert.equal(r.cuerpo.mensaje, "💸 Guardado · Cita");
  const [mov] = movimientosDe(falso);
  assert.deepEqual([mov.categoria, mov.categoria_libre], ["Cita", true]);
  // Una categoría escrita con números no se repite en el mensaje (podría ser un monto).
  const raro = await mover(falso, token, { tipo: "gasto", monto: 1000, categoria: "otro", categoria_otra: "Pago 2 de 3", cuenta: "Nu" });
  assert.equal(raro.cuerpo.mensaje, "💸 Guardado");
});

test("los 4 tipos: ingreso, transferencia, retiro (destino Efectivo solo) y sus mensajes", async () => {
  const falso = base();
  const token = await conToken(falso);
  const ingreso = await mover(falso, token, { tipo: "ingreso", monto: 500000, categoria: "Trabajo", cuenta: "Nu" });
  assert.equal(ingreso.cuerpo.mensaje, "💰 Ingreso guardado");
  const transferencia = await mover(falso, token, { tipo: "🔁 Transferencia", monto: 100000, cuenta: "Nu", cuenta_destino: "Nequi" });
  assert.equal(transferencia.cuerpo.mensaje, "🔁 Transferencia guardada");
  const retiro = await mover(falso, token, { tipo: "🏧 Retiro", monto: 50000, cuenta: "Nu" });
  assert.equal(retiro.cuerpo.mensaje, "🏧 Retiro guardado");
  for (const r of [ingreso, transferencia, retiro]) sinMontos(r);
  const efectivo = falso.tablas.finanzas_cuentas.find((c) => c.nombre === "Efectivo");
  assert.equal(movimientosDe(falso).find((m) => m.tipo === "retiro").cuenta_destino_id, efectivo.id);

  const resumen = await llamar(falso, "GET finanzas/resumen", { token, ahora: AHORA });
  assert.equal(resumen.estado, 200);
  sinMontos(resumen);
  const d = resumen.cuerpo.datos;
  assert.deepEqual([d.gastos, d.ingresos, d.transferencias, d.retiros], [0, 500000, 100000, 50000]);
  assert.equal(d.total, 500000, "transferir y retirar no cambian el total");
  assert.deepEqual(
    d.cuentas.map((c) => [c.nombre, c.saldo]),
    [
      ["Efectivo", 50000],
      ["Nu", 350000],
      ["Nequi", 100000],
    ],
  );
});

test("validación por tipo → 400 con mensaje humano, y no se guarda nada", async () => {
  const falso = base();
  const token = await conToken(falso);
  const casos = [
    [{ tipo: "gasto", monto: "abc", categoria: "comida", cuenta: "Nu" }, /valor/],
    [{ tipo: "gasto", monto: 1000, categoria: "salario", cuenta: "Nu" }, /categoría/],
    [{ tipo: "gasto", monto: 1000, categoria: "comida", cuenta: "Bancolombia" }, /cuenta/],
    [{ tipo: "gasto", monto: 1000, categoria: "otro", cuenta: "Nu" }, /categoría/],
    [{ tipo: "transferencia", monto: 1000, cuenta: "Nu", cuenta_destino: "Nu" }, /destino/],
    [{ tipo: "retiro", monto: 1000, cuenta: "Efectivo" }, /origen/],
    [{ tipo: "prestamo", monto: 1000 }, /tipo/],
    [{ tipo: "deuda", monto: 1000, deuda: "Nadie", cuenta: "Nu" }, /deuda/],
  ];
  for (const [cuerpo, mensaje] of casos) {
    const r = await mover(falso, token, cuerpo);
    assert.equal(r.estado, 400, JSON.stringify(cuerpo));
    assert.equal(r.cuerpo.codigo, "DATO_INVALIDO");
    assert.match(r.cuerpo.mensaje, /^⚠️ Revisa: /);
    assert.match(r.cuerpo.mensaje, mensaje);
  }
  assert.equal(movimientosDe(falso).length, 0);
});

test("id_cliente: el mismo id no duplica; sin id, un reintento idéntico en 60 s tampoco", async () => {
  const falso = base();
  const token = await conToken(falso);
  const cuerpo = { tipo: "gasto", monto: 12000, categoria: "transporte", cuenta: "Efectivo", id_cliente: "33333333-3333-4333-8333-333333333333" };
  assert.equal((await mover(falso, token, cuerpo)).estado, 201);
  const otra = await mover(falso, token, cuerpo);
  assert.equal(otra.estado, 201);
  assert.equal(otra.cuerpo.datos.repetido, true);
  assert.equal(movimientosDe(falso).length, 1);

  const sinId = { tipo: "gasto", monto: 5000, categoria: "comida", cuenta: "Nequi" };
  await mover(falso, token, sinId);
  await mover(falso, token, sinId);
  assert.equal(movimientosDe(falso).length, 2, "el reintento sin id_cliente se ignoró");
  await mover(falso, token, { ...sinId, monto: 5001 });
  assert.equal(movimientosDe(falso).length, 3, "un monto distinto sí es otro gasto");

  const malo = await mover(falso, token, { ...sinId, id_cliente: "no-es-uuid" });
  assert.equal(malo.estado, 400);
});

test("deudas: préstamo recibido a Nu, abonos y «🎉 Deuda saldada»", async () => {
  const falso = base();
  const token = await conToken(falso);
  const nueva = await llamar(falso, "POST finanzas/deudas", {
    token,
    ahora: AHORA,
    cuerpo: { direccion: "debo", tipo: "prestamo", nombre: "Tía Marta", monto: 200000, cuota: 50000, dia_pago: 15, cuenta: "Nu" },
  });
  assert.equal(nueva.estado, 201);
  assert.equal(nueva.cuerpo.mensaje, "📒 Deuda guardada");
  const [deuda] = falso.tablas.finanzas_deudas;
  assert.equal(deuda.user_id, A);
  const prestamo = movimientosDe(falso).find((m) => m.categoria === "prestamo_recibido");
  assert.equal(prestamo.deuda_id, deuda.id);
  assert.equal(prestamo.monto, 200000);

  const menu = await llamar(falso, "GET finanzas/menu", { token, ahora: AHORA });
  assert.deepEqual(menu.cuerpo.datos.preguntas["📒 Deuda"].deudas, ["Tía Marta · le debo"]);

  const abono = await llamar(falso, "POST finanzas/abonos", { token, ahora: AHORA, cuerpo: { deuda: "Tía Marta · le debo", monto: 50000, cuenta: "Nu" } });
  assert.equal(abono.cuerpo.mensaje, "📒 Abono guardado");
  const demas = await mover(falso, token, { tipo: "📒 Deuda", deuda: deuda.id, monto: 150001, cuenta: "Nu" });
  assert.equal(demas.estado, 400, "no se abona más de lo que se debe");
  const final = await mover(falso, token, { tipo: "📒 Deuda", deuda: deuda.id, monto: 150000, cuenta: "Nequi" });
  assert.equal(final.cuerpo.mensaje, "🎉 Deuda saldada");
  assert.equal(falso.tablas.finanzas_deudas[0].estado, "pagada");

  const luego = await llamar(falso, "GET finanzas/menu", { token, ahora: AHORA });
  assert.ok(!("📒 Deuda" in luego.cuerpo.datos.preguntas), "una deuda pagada ya no sale en el menú");
  const resumen = await llamar(falso, "GET finanzas/resumen", { token, ahora: AHORA });
  assert.deepEqual([resumen.cuerpo.datos.gastos, resumen.cuerpo.datos.ingresos], [0, 0], "préstamos y abonos no son gasto ni ingreso");
  assert.equal(resumen.cuerpo.datos.deudas.debo, 0);
});

test("me deben: préstamo dado desde Efectivo y cobro a Nequi", async () => {
  const falso = base();
  const token = await conToken(falso);
  await mover(falso, token, { tipo: "ingreso", monto: 100000, categoria: "regalo", cuenta: "Efectivo" });
  await llamar(falso, "POST finanzas/deudas", { token, ahora: AHORA, cuerpo: { direccion: "Me deben", nombre: "Juan", monto: 30000, cuenta: "Efectivo" } });
  const cobro = await llamar(falso, "POST finanzas/abonos", { token, ahora: AHORA, cuerpo: { deuda: "Juan", monto: 30000, cuenta: "Nequi" } });
  assert.equal(cobro.cuerpo.mensaje, "🎉 Deuda saldada");
  const resumen = await llamar(falso, "GET finanzas/resumen", { token, ahora: AHORA });
  const saldos = Object.fromEntries(resumen.cuerpo.datos.cuentas.map((c) => [c.nombre, c.saldo]));
  assert.deepEqual(saldos, { Efectivo: 70000, Nu: 0, Nequi: 30000 });
  assert.equal(resumen.cuerpo.datos.ingresos, 100000, "cobrar lo que me deben no es ingreso");
});

test("cada usuario solo usa sus cuentas", async () => {
  const falso = base();
  const tokenA = await conToken(falso, SESION_A);
  const tokenB = await conToken(falso, SESION_B);
  await llamar(falso, "GET finanzas/menu", { token: tokenA, ahora: AHORA });
  await llamar(falso, "GET finanzas/menu", { token: tokenB, ahora: AHORA });
  const nuDeA = falso.tablas.finanzas_cuentas.find((c) => c.user_id === A && c.nombre === "Nu");
  const r = await mover(falso, tokenB, { tipo: "gasto", monto: 1000, categoria: "comida", cuenta: nuDeA.id });
  assert.equal(r.estado, 400, "B no puede gastar desde la cuenta de A");
  const menuB = await llamar(falso, "GET finanzas/menu", { token: tokenB, ahora: AHORA });
  assert.ok(menuB.cuerpo.datos.cuentas.every((c) => falso.tablas.finanzas_cuentas.find((x) => x.id === c.id).user_id === B));
});
