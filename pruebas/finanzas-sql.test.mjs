// Finanzas en supabase/schema.sql (sección 2): retiro, cuentas, deudas y sus protecciones.
// PGlite con schema.sql corrido 2 veces (debe poder repetirse sin romper nada).

import { test } from "node:test";
import assert from "node:assert/strict";
import { USUARIO_A, USUARIO_B, comoAnon, comoUsuario, crearBase, una } from "./ayuda/sql.mjs";

const { db, tablas } = await crearBase({ veces: 2 });

const nombres = tablas.map((t) => t.tabla);

test("las 3 tablas de finanzas existen con RLS después de correr schema.sql 2 veces", () => {
  for (const tabla of ["finanzas_movimientos", "finanzas_cuentas", "finanzas_deudas"]) {
    assert.ok(nombres.includes(tabla), `falta ${tabla}`);
    assert.equal(tablas.find((t) => t.tabla === tabla).rls_activado, true);
  }
});

test("movimientos: se aceptan los 4 tipos y nada más", async () => {
  await comoUsuario(db, USUARIO_A, async () => {
    for (const tipo of ["egreso", "ingreso", "transferencia", "retiro"]) {
      await db.query(`insert into finanzas_movimientos (tipo, monto, categoria) values ($1, 1000, 'prueba')`, [tipo]);
    }
    await assert.rejects(db.query(`insert into finanzas_movimientos (tipo, monto, categoria) values ('regalo', 1000, 'x')`));
    await assert.rejects(db.query(`insert into finanzas_movimientos (tipo, monto, categoria) values ('egreso', 0, 'x')`));
  });
});

test("cuentas: las 3 de siempre, nombre único por usuario y otra cuenta no las ve", async () => {
  await comoUsuario(db, USUARIO_A, async () => {
    await db.query(`insert into finanzas_cuentas (nombre, tipo, banco, orden) values
      ('Efectivo', 'efectivo', null, 0), ('Nu', 'banco', 'Nu', 1), ('Nequi', 'billetera', 'Nequi', 2)`);
    await assert.rejects(db.query(`insert into finanzas_cuentas (nombre) values ('Nu')`), "nombre repetido");
    await assert.rejects(db.query(`insert into finanzas_cuentas (nombre, tipo) values ('Rara', 'cripto')`));
    await db.query(`insert into finanzas_cuentas (nombre, tipo, banco, cupo, dia_pago) values ('Tarjeta Nu', 'tarjeta_credito', 'Nu', 2000000, 5)`);
  });
  await comoUsuario(db, USUARIO_B, async () => {
    assert.equal((await una(db, `select count(*)::int as n from finanzas_cuentas`)).n, 0);
    // B puede tener su propia "Nu": el nombre es único solo dentro de cada usuario.
    await db.query(`insert into finanzas_cuentas (nombre) values ('Nu')`);
    assert.equal((await db.query(`update finanzas_cuentas set nombre = 'x' where user_id = '${USUARIO_A}'`)).affectedRows, 0);
  });
});

test("un movimiento solo puede apuntar a cuentas y deudas del mismo usuario", async () => {
  const deB = await comoUsuario(db, USUARIO_B, () => una(db, `select id from finanzas_cuentas where nombre = 'Nu'`));
  const deA = await comoUsuario(db, USUARIO_A, () => una(db, `select id from finanzas_cuentas where nombre = 'Nequi'`));
  await comoUsuario(db, USUARIO_A, async () => {
    await assert.rejects(
      db.query(`insert into finanzas_movimientos (tipo, monto, categoria, cuenta_id) values ('egreso', 5000, 'comida', $1)`, [deB.id]),
      "A usó una cuenta de B",
    );
    await db.query(`insert into finanzas_movimientos (tipo, monto, categoria, cuenta, cuenta_id) values ('egreso', 25000, 'comida', 'Nequi', $1)`, [
      deA.id,
    ]);
  });
});

test("retiro y transferencia: destino distinto del origen; gastos e ingresos sin destino", async () => {
  await comoUsuario(db, USUARIO_A, async () => {
    const { id: nu } = await una(db, `select id from finanzas_cuentas where nombre = 'Nu'`);
    const { id: efectivo } = await una(db, `select id from finanzas_cuentas where nombre = 'Efectivo'`);
    await db.query(
      `insert into finanzas_movimientos (tipo, monto, categoria, cuenta_id, cuenta_destino_id) values ('retiro', 50000, 'retiro', $1, $2)`,
      [nu, efectivo],
    );
    await assert.rejects(
      db.query(`insert into finanzas_movimientos (tipo, monto, categoria, cuenta_id, cuenta_destino_id) values ('transferencia', 1, 't', $1, $1)`, [nu]),
    );
    await assert.rejects(
      db.query(`insert into finanzas_movimientos (tipo, monto, categoria, cuenta_id, cuenta_destino_id) values ('egreso', 1, 'c', $1, $2)`, [nu, efectivo]),
    );
  });
});

test("deudas: debo / me deben, abonos ligados y otra cuenta no las ve", async () => {
  await comoUsuario(db, USUARIO_A, async () => {
    const { id } = await una(
      db,
      `insert into finanzas_deudas (direccion, tipo, nombre, monto_inicial, cuota, dia_pago, tasa_mensual)
       values ('debo', 'persona', 'Tía', 200000, 50000, 15, 0) returning id`,
    );
    await assert.rejects(db.query(`insert into finanzas_deudas (direccion, nombre, monto_inicial) values ('presto', 'X', 1000)`));
    await assert.rejects(db.query(`insert into finanzas_deudas (direccion, nombre, monto_inicial) values ('debo', 'X', 0)`));
    const { id: nu } = await una(db, `select id from finanzas_cuentas where nombre = 'Nu'`);
    await db.query(
      `insert into finanzas_movimientos (tipo, monto, categoria, cuenta_id, deuda_id) values ('transferencia', 50000, 'abono_deuda', $1, $2)`,
      [nu, id],
    );
    // Borrar la deuda no borra el abono (el dinero sí salió de Nu): solo lo desliga.
    await db.query(`delete from finanzas_deudas where id = $1`, [id]);
    const abono = await una(db, `select deuda_id, cuenta_id from finanzas_movimientos where categoria = 'abono_deuda'`);
    assert.equal(abono.deuda_id, null);
    assert.equal(abono.cuenta_id, nu);
    await db.query(`insert into finanzas_deudas (direccion, nombre, monto_inicial) values ('me_deben', 'Juan', 30000)`);
  });
  await comoUsuario(db, USUARIO_B, async () => {
    assert.equal((await una(db, `select count(*)::int as n from finanzas_deudas`)).n, 0);
    assert.equal((await db.query(`delete from finanzas_deudas`)).affectedRows, 0);
    await assert.rejects(db.query(`insert into finanzas_deudas (user_id, direccion, nombre, monto_inicial) values ('${USUARIO_A}', 'debo', 'X', 1)`));
  });
});

test("borrar una cuenta deja sus movimientos (sin cuenta) y no toca el usuario", async () => {
  await comoUsuario(db, USUARIO_A, async () => {
    const { id } = await una(db, `insert into finanzas_cuentas (nombre, tipo) values ('Temporal', 'banco') returning id`);
    await db.query(`insert into finanzas_movimientos (tipo, monto, categoria, cuenta, cuenta_id) values ('ingreso', 7000, 'venta', 'Temporal', $1)`, [id]);
    await db.query(`delete from finanzas_cuentas where id = $1`, [id]);
    const mov = await una(db, `select user_id, cuenta_id, cuenta from finanzas_movimientos where categoria = 'venta'`);
    assert.equal(mov.user_id, USUARIO_A);
    assert.equal(mov.cuenta_id, null);
    assert.equal(mov.cuenta, "Temporal");
  });
});

test("anon no puede leer ni escribir nada de finanzas", async () => {
  await comoAnon(db, async () => {
    for (const tabla of ["finanzas_movimientos", "finanzas_cuentas", "finanzas_deudas"]) {
      await assert.rejects(db.query(`select * from public.${tabla}`), `${tabla} legible por anon`);
    }
    await assert.rejects(db.query(`insert into finanzas_cuentas (user_id, nombre) values ('${USUARIO_A}', 'x')`));
  });
});
