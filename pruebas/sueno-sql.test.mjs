// Sección 6 · SUEÑO de supabase/schema.sql: tablas repetibles, día lógico, muestras sin duplicar, RLS y anon bloqueado.

import { test } from "node:test";
import assert from "node:assert/strict";
import { USUARIO_A, USUARIO_B, comoAnon, comoUsuario, crearBase, una } from "./ayuda/sql.mjs";

const { db, tablas } = await crearBase({ veces: 2 });

test("las tablas de sueño existen después de correr schema.sql dos veces, con RLS", () => {
  for (const nombre of ["sueno_eventos", "sueno_muestras"]) {
    const fila = tablas.find((t) => t.tabla === nombre);
    assert.ok(fila, `falta ${nombre}`);
    assert.equal(fila.rls_activado, true);
  }
});

test("un evento a la 01:10 pertenece al día lógico anterior (corte 04:00)", async () => {
  await comoUsuario(db, USUARIO_A, async () => {
    await db.query(`insert into sueno_eventos (tipo, fuente, momento) values ('acostarse', 'cargador', '2026-10-03T01:10:00-05:00')`);
    await db.query(`insert into sueno_eventos (tipo, fuente, momento) values ('despertar', 'alarma', '2026-10-03T06:05:00-05:00')`);
    const { rows } = await db.query(`select tipo, fecha::text as fecha, user_id from sueno_eventos order by momento`);
    assert.deepEqual(
      rows.map((r) => [r.tipo, r.fecha]),
      [
        ["acostarse", "2026-10-02"],
        ["despertar", "2026-10-03"],
      ],
    );
    assert.equal(rows[0].user_id, USUARIO_A);
  });
});

test("eventos: tipo y fuente solo de la lista cerrada", async () => {
  await comoUsuario(db, USUARIO_A, async () => {
    await assert.rejects(db.query(`insert into sueno_eventos (tipo, fuente) values ('siesta', 'manual')`));
    await assert.rejects(db.query(`insert into sueno_eventos (tipo, fuente) values ('acostarse', 'reloj')`));
    await db.query(`insert into sueno_eventos (tipo) values ('acostarse')`);
    const { fuente } = await una(db, `select fuente from sueno_eventos order by creado_en desc limit 1`);
    assert.equal(fuente, "manual");
  });
});

test("muestras: sincronizar dos veces no duplica (on conflict) y fin > inicio, máximo 16 h", async () => {
  await comoUsuario(db, USUARIO_A, async () => {
    const insertar = `insert into sueno_muestras (inicio, fin, tipo) values
        ('2026-10-02T23:45:00-05:00', '2026-10-03T06:10:00-05:00', 'en_cama')
      on conflict (user_id, inicio, tipo) do update set fin = excluded.fin`;
    await db.query(insertar);
    await db.query(insertar);
    const { n } = await una(db, `select count(*)::int as n from sueno_muestras`);
    assert.equal(n, 1);
    const { fecha } = await una(db, `select fecha::text as fecha from sueno_muestras`);
    assert.equal(fecha, "2026-10-02");
    // Sin on conflict, la misma muestra choca con la restricción única.
    await assert.rejects(
      db.query(`insert into sueno_muestras (inicio, fin) values ('2026-10-02T23:45:00-05:00', '2026-10-03T06:00:00-05:00')`),
    );
    await assert.rejects(
      db.query(`insert into sueno_muestras (inicio, fin) values ('2026-10-04T23:00:00-05:00', '2026-10-04T22:00:00-05:00')`),
      "fin antes del inicio",
    );
    await assert.rejects(
      db.query(`insert into sueno_muestras (inicio, fin) values ('2026-10-04T20:00:00-05:00', '2026-10-05T13:00:00-05:00')`),
      "más de 16 horas",
    );
    await assert.rejects(
      db.query(`insert into sueno_muestras (inicio, fin, tipo) values ('2026-10-05T23:00:00-05:00', '2026-10-06T06:00:00-05:00', 'rem')`),
    );
  });
});

test("otra cuenta no ve, no cambia ni borra el sueño de A", async () => {
  await comoUsuario(db, USUARIO_B, async () => {
    for (const tabla of ["sueno_eventos", "sueno_muestras"]) {
      assert.equal((await una(db, `select count(*)::int as n from ${tabla}`)).n, 0, `B ve ${tabla} de A`);
      assert.equal((await db.query(`update ${tabla} set creado_en = now()`)).affectedRows, 0);
      assert.equal((await db.query(`delete from ${tabla}`)).affectedRows, 0);
    }
    await assert.rejects(
      db.query(`insert into sueno_eventos (user_id, tipo) values ('${USUARIO_A}', 'acostarse')`),
      "B no puede escribir a nombre de A",
    );
  });
  const { n } = await una(db, `select count(*)::int as n from sueno_eventos where user_id = $1`, [USUARIO_A]);
  assert.ok(n >= 3);
});

test("anon no puede leer ni escribir sueño", async () => {
  await comoAnon(db, async () => {
    await assert.rejects(db.query(`select * from sueno_eventos`));
    await assert.rejects(db.query(`select * from sueno_muestras`));
    await assert.rejects(db.query(`insert into sueno_eventos (tipo) values ('acostarse')`));
  });
});
