// Reglas de finanzas (web/js/finanzas/logica.js) con los ejemplos del archivo de Samuel, tarjeta y deudas.
// También: Hoy sigue igual ("Disponible hoy" solo baja con gastos).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DatoInvalido,
  agrupar,
  aEntradaLocal,
  deEntradaLocal,
  deudasVista,
  efectoDe,
  enriquecer,
  etiquetaCategoria,
  filtrar,
  fraseMes,
  leerMonto,
  leerTipo,
  mensajeGuardado,
  menuAtajo,
  movimientoDePrestamo,
  ordenar,
  ordenarPorUso,
  prepararAbono,
  prepararCuenta,
  prepararDeuda,
  prepararMovimiento,
  proximaFecha,
  resumenMes,
  saldoDeuda,
  saldosPorCuenta,
  tituloDia,
  total,
  totalesDeudas,
} from "../web/js/finanzas/logica.js";
import { METAS_BASE, construirResumen } from "../web/js/logica/calculo.js";

const EFECTIVO = { id: "c-efectivo", nombre: "Efectivo", tipo: "efectivo", saldo_inicial: 0, orden: 0 };
const NU = { id: "c-nu", nombre: "Nu", tipo: "banco", banco: "Nu", saldo_inicial: 0, orden: 1 };
const NEQUI = { id: "c-nequi", nombre: "Nequi", tipo: "billetera", banco: "Nequi", saldo_inicial: 0, orden: 2 };
const TARJETA = { id: "c-tarjeta", nombre: "Tarjeta Nu", tipo: "tarjeta_credito", banco: "Nu", saldo_inicial: 0, cupo: 2_000_000, dia_pago: 5, orden: 3 };
const CUENTAS = [EFECTIVO, NU, NEQUI, TARJETA];

let n = 0;
/** Guarda como lo haría la base de datos: con id y momento. */
const guardado = (fila, momento = "2026-10-02T19:42:00-05:00") => ({ id: `m${++n}`, momento, ...fila });
const saldoDe = (saldos, id) => saldos.find((c) => c.id === id).saldo;

// ── Los 4 tipos, con los ejemplos de Samuel ──────────────────────────────

test("Gasto · Comida · Nequi · $25.000 «Cena»: Nequi baja y cuenta como gasto", () => {
  const fila = prepararMovimiento(
    { tipo: "gasto", monto: "25.000", categoria: "🍔 Comida", cuenta: "Nequi", descripcion: "Cena" },
    { cuentas: CUENTAS },
  );
  assert.deepEqual(
    { tipo: fila.tipo, monto: fila.monto, categoria: fila.categoria, cuenta_id: fila.cuenta_id, cuenta: fila.cuenta, descripcion: fila.descripcion },
    { tipo: "egreso", monto: 25000, categoria: "comida", cuenta_id: "c-nequi", cuenta: "Nequi", descripcion: "Cena" },
  );
  const saldos = saldosPorCuenta(CUENTAS, [guardado(fila)]);
  assert.equal(saldoDe(saldos, "c-nequi"), -25000);
  assert.equal(efectoDe(fila).clase, "gasto");
  assert.equal(resumenMes([guardado(fila)], "2026-10").gastos, 25000);
  assert.equal(mensajeGuardado(fila), "💸 Guardado · Comida");
});

test("Ingreso · Trabajo · Nu · $500.000: Nu sube y cuenta como ingreso", () => {
  const fila = prepararMovimiento({ tipo: "ingreso", monto: 500000, categoria: "trabajo", cuenta: "c-nu" }, { cuentas: CUENTAS });
  const saldos = saldosPorCuenta(CUENTAS, [guardado(fila)]);
  assert.equal(saldoDe(saldos, "c-nu"), 500000);
  const r = resumenMes([guardado(fila)], "2026-10");
  assert.equal(r.ingresos, 500000);
  assert.equal(r.gastos, 0);
  assert.equal(mensajeGuardado(fila), "💰 Ingreso guardado");
});

test("Transferencia Nu → Nequi $100.000: Nu −, Nequi +, el total no cambia y no es gasto", () => {
  const ingreso = guardado(prepararMovimiento({ tipo: "ingreso", monto: 500000, categoria: "salario", cuenta: "Nu" }, { cuentas: CUENTAS }));
  const fila = prepararMovimiento({ tipo: "transferencia", monto: 100000, cuenta: "Nu", cuenta_destino: "Nequi" }, { cuentas: CUENTAS });
  assert.equal(fila.categoria, "transferencia");
  const antes = total(saldosPorCuenta(CUENTAS, [ingreso]));
  const saldos = saldosPorCuenta(CUENTAS, [ingreso, guardado(fila)]);
  assert.equal(saldoDe(saldos, "c-nu"), 400000);
  assert.equal(saldoDe(saldos, "c-nequi"), 100000);
  assert.equal(total(saldos), antes);
  assert.equal(resumenMes([guardado(fila)], "2026-10").gastos, 0);
  assert.equal(mensajeGuardado(fila), "🔁 Transferencia guardada");
});

test("Retiro Nu → Efectivo $50.000: no es gasto y el destino es Efectivo aunque no se diga", () => {
  const fila = prepararMovimiento({ tipo: "retiro", monto: 50000, cuenta: "Nu" }, { cuentas: CUENTAS });
  assert.equal(fila.cuenta_destino_id, "c-efectivo");
  const saldos = saldosPorCuenta(CUENTAS, [guardado(fila)]);
  assert.equal(saldoDe(saldos, "c-nu"), -50000);
  assert.equal(saldoDe(saldos, "c-efectivo"), 50000);
  const r = resumenMes([guardado(fila)], "2026-10");
  assert.equal(r.gastos, 0);
  assert.equal(r.retiros, 50000);
  assert.equal(mensajeGuardado(fila), "🏧 Retiro guardado");
  // Retirar desde Efectivo, o hacia Nequi, no tiene sentido.
  assert.throws(() => prepararMovimiento({ tipo: "retiro", monto: 1, cuenta: "Efectivo" }, { cuentas: CUENTAS }), DatoInvalido);
  assert.throws(() => prepararMovimiento({ tipo: "retiro", monto: 1, cuenta: "Nu", cuenta_destino: "Nequi" }, { cuentas: CUENTAS }), DatoInvalido);
});

test("«Otro» → «Cita»: se guarda la categoría escrita con categoria_libre", () => {
  const fila = prepararMovimiento(
    { tipo: "gasto", monto: 35000, categoria: "✏️ Otro…", categoria_otra: "  Cita ", cuenta: "Nequi" },
    { cuentas: CUENTAS },
  );
  assert.equal(fila.categoria, "Cita");
  assert.equal(fila.categoria_libre, true);
  assert.deepEqual(etiquetaCategoria(fila), { texto: "Cita", emoji: "✏️" });
  assert.equal(mensajeGuardado(fila), "💸 Guardado · Cita");
  // Si escribe una que ya existe, se usa la del catálogo.
  const comida = prepararMovimiento({ tipo: "gasto", monto: 1, categoria: "otro", categoria_otra: "comida", cuenta: "Nu" }, { cuentas: CUENTAS });
  assert.deepEqual([comida.categoria, comida.categoria_libre], ["comida", false]);
  // "Otro" sin texto no sirve.
  assert.throws(() => prepararMovimiento({ tipo: "gasto", monto: 1, categoria: "otro", cuenta: "Nu" }, { cuentas: CUENTAS }), DatoInvalido);
});

test("validación por tipo: monto, categoría, cuentas y destino", () => {
  const malo = (entrada) => assert.throws(() => prepararMovimiento(entrada, { cuentas: CUENTAS }), DatoInvalido);
  malo({ tipo: "gasto", monto: 0, categoria: "comida", cuenta: "Nu" });
  malo({ tipo: "gasto", monto: "abc", categoria: "comida", cuenta: "Nu" });
  malo({ tipo: "gasto", monto: 1, categoria: "salario", cuenta: "Nu" }); // categoría de ingreso
  malo({ tipo: "gasto", monto: 1, categoria: "comida", cuenta: "Bancolombia" });
  malo({ tipo: "transferencia", monto: 1, cuenta: "Nu", cuenta_destino: "Nu" });
  malo({ tipo: "transferencia", monto: 1, cuenta: "Tarjeta Nu", cuenta_destino: "Nu" });
  malo({ tipo: "regalo", monto: 1 });
  assert.equal(leerTipo("💸 Gasto"), "egreso");
  assert.equal(leerTipo("📒 Deuda"), "deuda");
  assert.equal(leerMonto("$1.250.000"), 1_250_000);
  assert.equal(leerMonto(" 25000 "), 25000);
});

// ── Tarjeta de crédito ───────────────────────────────────────────────────

test("compra de $80.000 con la tarjeta Nu: es gasto y la deuda de la tarjeta sube; pagarla desde Nu es transferencia", () => {
  const ingreso = guardado(prepararMovimiento({ tipo: "ingreso", monto: 300000, categoria: "trabajo", cuenta: "Nu" }, { cuentas: CUENTAS }));
  const compra = guardado(prepararMovimiento({ tipo: "gasto", monto: 80000, categoria: "compras", cuenta: "Tarjeta Nu" }, { cuentas: CUENTAS }));
  let saldos = saldosPorCuenta(CUENTAS, [ingreso, compra]);
  const tarjeta = saldos.find((c) => c.id === "c-tarjeta");
  assert.equal(tarjeta.deuda, 80000);
  assert.equal(tarjeta.cupoUsado, 0.04);
  assert.equal(total(saldos), 300000, "la tarjeta no resta del dinero disponible");
  assert.equal(resumenMes([ingreso, compra], "2026-10").gastos, 80000);
  assert.equal(totalesDeudas(deudasVista([], saldos, [], "2026-10-02")).debo, 80000);

  const pagoFila = prepararMovimiento({ tipo: "transferencia", monto: 80000, cuenta: "Nu", cuenta_destino: "Tarjeta Nu" }, { cuentas: CUENTAS });
  assert.equal(pagoFila.categoria, "pago_tarjeta");
  assert.equal(mensajeGuardado(pagoFila), "💳 Pago de tarjeta guardado");
  const pago = guardado(pagoFila);
  saldos = saldosPorCuenta(CUENTAS, [ingreso, compra, pago]);
  assert.equal(saldos.find((c) => c.id === "c-tarjeta").deuda, 0);
  assert.equal(saldoDe(saldos, "c-nu"), 220000);
  assert.equal(resumenMes([ingreso, compra, pago], "2026-10").gastos, 80000, "pagar la tarjeta no es otro gasto");
});

test("la tarjeta aparece en «Debo» con su próximo pago", () => {
  const compra = guardado({ tipo: "egreso", monto: 50000, categoria: "ocio", cuenta_id: "c-tarjeta" });
  const vista = deudasVista([], saldosPorCuenta(CUENTAS, [compra]), [compra], "2026-10-02");
  const tarjeta = vista.find((d) => d.virtual);
  assert.equal(tarjeta.nombre, "Tarjeta Nu");
  assert.equal(tarjeta.saldo, 50000);
  assert.equal(tarjeta.proximoPago, "2026-10-05");
});

// ── Deudas ───────────────────────────────────────────────────────────────

test("debo $200.000 a una persona, abono $50.000 desde Nu: saldo 150.000, 25% pagado, no es gasto", () => {
  const deuda = { id: "d1", ...prepararDeuda({ direccion: "Debo", tipo: "persona", nombre: "Tía Marta", monto: "200.000", cuota: 50000, dia_pago: 15 }) };
  assert.equal(deuda.direccion, "debo");
  const fila = prepararAbono({ deuda: "Tía Marta · le debo", monto: 50000, cuenta: "Nu" }, { cuentas: CUENTAS, deudas: [deuda], movimientos: [] });
  assert.deepEqual([fila.tipo, fila.categoria, fila.cuenta_id, fila.cuenta_destino_id, fila.deuda_id], ["transferencia", "abono_deuda", "c-nu", null, "d1"]);
  const abono = guardado(fila);
  const estado = saldoDeuda(deuda, [abono], "2026-10-02");
  assert.equal(estado.saldo, 150000);
  assert.equal(estado.pct, 0.25);
  assert.equal(estado.estado, "activa");
  assert.equal(estado.proximoPago, "2026-10-15");
  assert.equal(saldoDe(saldosPorCuenta(CUENTAS, [abono]), "c-nu"), -50000);
  assert.equal(resumenMes([abono], "2026-10").gastos, 0);
  assert.equal(mensajeGuardado(fila), "📒 Abono guardado");
  // No se puede abonar más de lo que se debe.
  assert.throws(
    () => prepararAbono({ deuda: "d1", monto: 150001, cuenta: "Nu" }, { cuentas: CUENTAS, deudas: [deuda], movimientos: [abono] }),
    DatoInvalido,
  );
});

test("me deben $30.000 y me pagan todo a Nequi: saldo 0, pagada, y no es ingreso", () => {
  const deuda = { id: "d2", estado: "activa", ...prepararDeuda({ direccion: "me_deben", nombre: "Juan", monto: 30000 }) };
  const fila = prepararMovimiento({ tipo: "📒 Deuda", deuda: "Juan", monto: 30000, cuenta: "Nequi" }, { cuentas: CUENTAS, deudas: [deuda], movimientos: [] });
  assert.deepEqual([fila.categoria, fila.cuenta_id, fila.cuenta_destino_id], ["cobro_deuda", null, "c-nequi"]);
  const cobro = guardado(fila);
  const estado = saldoDeuda(deuda, [cobro]);
  assert.equal(estado.saldo, 0);
  assert.equal(estado.estado, "pagada");
  assert.equal(estado.pct, 1);
  assert.equal(saldoDe(saldosPorCuenta(CUENTAS, [cobro]), "c-nequi"), 30000);
  assert.equal(resumenMes([cobro], "2026-10").ingresos, 0);
  assert.equal(mensajeGuardado(fila, { saldada: true }), "🎉 Deuda saldada");
  // Una deuda pagada ya no recibe abonos.
  assert.throws(() => prepararAbono({ deuda: "d2", monto: 1, cuenta: "Nequi" }, { cuentas: CUENTAS, deudas: [{ ...deuda, estado: "pagada" }] }), DatoInvalido);
});

test("préstamo recibido: entra a la cuenta (no es ingreso) y crea la deuda; préstamo dado: sale (no es gasto)", () => {
  const recibido = movimientoDePrestamo({ id: "d3", direccion: "debo", nombre: "Bancolombia", monto_inicial: 1_000_000 }, NU);
  assert.deepEqual([recibido.cuenta_id, recibido.cuenta_destino_id, recibido.categoria], [null, "c-nu", "prestamo_recibido"]);
  const dado = movimientoDePrestamo({ id: "d4", direccion: "me_deben", nombre: "Juan", monto_inicial: 30000 }, EFECTIVO);
  assert.deepEqual([dado.cuenta_id, dado.cuenta_destino_id, dado.categoria], ["c-efectivo", null, "prestamo_dado"]);
  const movs = [guardado(recibido), guardado(dado)];
  const saldos = saldosPorCuenta(CUENTAS, movs);
  assert.equal(saldoDe(saldos, "c-nu"), 1_000_000);
  assert.equal(saldoDe(saldos, "c-efectivo"), -30000);
  const r = resumenMes(movs, "2026-10");
  assert.deepEqual([r.gastos, r.ingresos], [0, 0]);
  // El dinero del préstamo no cuenta como abono: la deuda sigue completa.
  assert.equal(saldoDeuda({ id: "d3", direccion: "debo", monto_inicial: 1_000_000 }, movs).saldo, 1_000_000);
});

// ── Resumen, lista y fechas ──────────────────────────────────────────────

const MES = [
  guardado({ tipo: "egreso", monto: 25000, categoria: "comida", cuenta_id: "c-nequi", descripcion: "Cena" }, "2026-10-02T19:42:00-05:00"),
  guardado({ tipo: "egreso", monto: 12000, categoria: "transporte", cuenta_id: "c-efectivo" }, "2026-10-02T08:10:00-05:00"),
  guardado({ tipo: "egreso", monto: 40000, categoria: "comida", cuenta_id: "c-nu", descripcion: "Mercado" }, "2026-10-01T18:00:00-05:00"),
  guardado({ tipo: "ingreso", monto: 500000, categoria: "trabajo", cuenta_id: "c-nu" }, "2026-10-01T09:00:00-05:00"),
  guardado({ tipo: "transferencia", monto: 100000, categoria: "transferencia", cuenta_id: "c-nu", cuenta_destino_id: "c-nequi" }, "2026-10-01T10:00:00-05:00"),
  guardado({ tipo: "egreso", monto: 99000, categoria: "ocio", cuenta_id: "c-nu" }, "2026-09-30T20:00:00-05:00"),
];

test("resumen del mes: gastos, ingresos, neto y categorías de mayor a menor", () => {
  const r = resumenMes(MES, "2026-10", CUENTAS);
  assert.equal(r.gastos, 77000);
  assert.equal(r.ingresos, 500000);
  assert.equal(r.neto, 423000);
  assert.equal(r.transferencias, 100000);
  assert.deepEqual(
    r.porCategoria.map((c) => [c.texto, c.total]),
    [
      ["Comida", 65000],
      ["Transporte", 12000],
    ],
  );
  assert.deepEqual(r.porDia.map((d) => [d.fecha, d.gastos]), [
    ["2026-10-01", 40000],
    ["2026-10-02", 37000],
  ]);
  assert.equal(r.porCuenta.find((c) => c.id === "c-nu").salidas, 140000);
  const frase = fraseMes(r);
  assert.match(frase, /Comida se lleva el 84%/);
  assert.ok(!/\$|\d{4,}/.test(frase), "la frase no lleva montos");
});

test("un movimiento de la 01:30 pertenece al día anterior (día lógico)", () => {
  const madrugada = guardado({ tipo: "egreso", monto: 8000, categoria: "comida", cuenta_id: "c-nu" }, "2026-10-01T01:30:00-05:00");
  assert.equal(resumenMes([madrugada], "2026-09").gastos, 8000);
});

test("lista: filtrar por tipo y texto, ordenar por monto y agrupar por día, categoría y cuenta", () => {
  const lista = enriquecer(MES, CUENTAS);
  assert.equal(filtrar(lista, { tipo: "egreso" }).length, 4);
  assert.deepEqual(filtrar(lista, { texto: "cená" }).map((m) => m.titulo), ["Cena"]);
  assert.deepEqual(filtrar(lista, { texto: "nequi" }).length, 2);
  assert.deepEqual(ordenar(lista, "monto").map((m) => m.monto).slice(0, 2), [500000, 100000]);

  const porDia = agrupar(ordenar(lista), "dia", { hoy: "2026-10-02" });
  assert.deepEqual(porDia.slice(0, 2).map((g) => g.titulo), ["Hoy", "Ayer"]);
  assert.match(porDia[2].titulo, /^mié 30 sept?$/);
  assert.equal(porDia[0].subtotal, -37000);
  assert.equal(porDia[1].subtotal, 460000);

  const porCategoria = agrupar(lista, "categoria");
  assert.equal(porCategoria[0].titulo, "Trabajo");
  assert.equal(porCategoria.find((g) => g.titulo === "Comida").subtotal, -65000);

  const porCuenta = agrupar(lista, "cuenta", { cuentas: CUENTAS });
  assert.deepEqual(porCuenta.map((g) => g.titulo), ["Efectivo", "Nu", "Nequi"]);
  // La transferencia sale de Nu y entra a Nequi: aparece en las dos.
  assert.equal(porCuenta.find((g) => g.titulo === "Nequi").subtotal, 75000);
  assert.equal(porCuenta.find((g) => g.titulo === "Nu").subtotal, 500000 - 100000 - 40000 - 99000);
});

test("movimientos viejos (solo con el nombre de la cuenta) se reconocen por nombre", () => {
  const viejo = { id: "v1", tipo: "egreso", monto: 12000, categoria: "comida_fuera", cuenta: "nequi", momento: "2026-10-02T08:10:00-05:00" };
  assert.equal(saldoDe(saldosPorCuenta(CUENTAS, [viejo]), "c-nequi"), -12000);
  assert.deepEqual(etiquetaCategoria(viejo), { texto: "Comida fuera", emoji: "🍔" });
});

test("categorías ordenadas por uso de los últimos 60 días", () => {
  const usos = [
    guardado({ tipo: "egreso", categoria: "transporte", monto: 1 }, "2026-10-01T10:00:00-05:00"),
    guardado({ tipo: "egreso", categoria: "transporte", monto: 1 }, "2026-10-02T10:00:00-05:00"),
    guardado({ tipo: "egreso", categoria: "ocio", monto: 1 }, "2026-10-02T11:00:00-05:00"),
    guardado({ tipo: "egreso", categoria: "comida", monto: 1 }, "2026-01-01T11:00:00-05:00"), // muy vieja
  ];
  const { CATEGORIAS } = { CATEGORIAS: { egreso: [{ valor: "comida" }, { valor: "transporte" }, { valor: "ocio" }] } };
  assert.deepEqual(ordenarPorUso(CATEGORIAS.egreso, usos, "egreso", "2026-08-04").map((c) => c.valor), ["transporte", "ocio", "comida"]);
});

test("fechas: próximo pago, títulos de día y hora de Bogotá", () => {
  assert.equal(proximaFecha(15, "2026-10-02"), "2026-10-15");
  assert.equal(proximaFecha(1, "2026-10-02"), "2026-11-01");
  assert.equal(proximaFecha(31, "2026-11-02"), "2026-11-30");
  assert.equal(proximaFecha(5, "2026-12-20"), "2027-01-05");
  assert.match(tituloDia("2026-09-29", "2026-10-02"), /^mar 29 sept?$/);
  assert.equal(tituloDia("2025-12-24", "2026-10-02"), "mié 24 dic 2025");
  assert.equal(aEntradaLocal(new Date("2026-10-03T00:42:00Z")), "2026-10-02T19:42");
  assert.equal(deEntradaLocal("2026-10-02T19:42").toISOString(), "2026-10-03T00:42:00.000Z");
  assert.equal(deEntradaLocal("ayer"), null);
});

test("cuentas y deudas: validación de formularios", () => {
  assert.deepEqual(prepararCuenta({ nombre: "Bancolombia", tipo: "Banco" }), { nombre: "Bancolombia", tipo: "banco", banco: null, cupo: null, dia_pago: null });
  const tarjeta = prepararCuenta({ nombre: "Visa", tipo: "tarjeta_credito", cupo: "1.000.000", dia_pago: "28" });
  assert.deepEqual([tarjeta.cupo, tarjeta.dia_pago], [1_000_000, 28]);
  assert.throws(() => prepararCuenta({ nombre: "", tipo: "banco" }), DatoInvalido);
  assert.throws(() => prepararDeuda({ direccion: "presté", nombre: "X", monto: 1 }), DatoInvalido);
  assert.throws(() => prepararDeuda({ direccion: "debo", nombre: "X", monto: 1, dia_pago: 40 }), DatoInvalido);
  assert.equal(prepararDeuda({ direccion: "debo", nombre: "Banco", monto: 1, tasa_mensual: "2,5%" }).tasa_mensual, 2.5);
});

test("menú del atajo: listas de texto por tipo, «Otro…» al final y sin la opción Deuda si no hay deudas", () => {
  const menu = menuAtajo({ cuentas: CUENTAS, deudas: [], movimientos: MES, hoy: "2026-10-02" });
  assert.deepEqual(menu.opciones_tipo, ["💸 Gasto", "💰 Ingreso", "🔁 Transferencia", "🏧 Retiro"]);
  const gasto = menu.preguntas["💸 Gasto"];
  assert.equal(gasto.categorias[0], "🍔 Comida", "la más usada primero");
  assert.equal(gasto.categorias.at(-1), "✏️ Otro…");
  assert.deepEqual(gasto.cuentas, ["Efectivo", "Nu", "Nequi", "Tarjeta Nu"]);
  assert.deepEqual(menu.preguntas["🔁 Transferencia"].cuentas, ["Efectivo", "Nu", "Nequi"]);
  assert.equal(menu.preguntas["🏧 Retiro"].destinos, null);
  const conDeuda = menuAtajo({ cuentas: CUENTAS, deudas: [{ id: "d1", nombre: "Tía", direccion: "debo", estado: "activa" }], hoy: "2026-10-02" });
  assert.deepEqual(conDeuda.preguntas["📒 Deuda"].deudas, ["Tía · le debo"]);
  assert.ok(!JSON.stringify(menu).match(/\$\d/), "el menú no lleva montos");
});

// ── Hoy sigue igual ──────────────────────────────────────────────────────

test("Hoy: «Disponible hoy» solo baja con gastos (ingresos, transferencias y retiros no lo tocan)", () => {
  const vacio = { metas: METAS_BASE, comidas: [], movimientos: [], checkins: [], estudio: [], gym: [], festivos: [] };
  const ahora = new Date("2026-10-02T20:00:00-05:00");
  const base = construirResumen(vacio, ahora).metricas[0].valor;
  const comoHoy = (filas) => filas.map((f, i) => ({ tipo: f.tipo, monto: f.monto, fecha: "2026-10-02", momento: `2026-10-02T1${i}:00:00-05:00` }));
  const neutros = comoHoy([
    prepararMovimiento({ tipo: "ingreso", monto: 500000, categoria: "trabajo", cuenta: "Nu" }, { cuentas: CUENTAS }),
    prepararMovimiento({ tipo: "transferencia", monto: 100000, cuenta: "Nu", cuenta_destino: "Nequi" }, { cuentas: CUENTAS }),
    prepararMovimiento({ tipo: "retiro", monto: 50000, cuenta: "Nu" }, { cuentas: CUENTAS }),
  ]);
  assert.equal(construirResumen({ ...vacio, movimientos: neutros }, ahora).metricas[0].valor, base);
  const conGasto = [...neutros, ...comoHoy([prepararMovimiento({ tipo: "gasto", monto: 25000, categoria: "comida", cuenta: "Nequi" }, { cuentas: CUENTAS })])];
  assert.equal(construirResumen({ ...vacio, movimientos: conGasto }, ahora).metricas[0].valor, base - 25000);
});
