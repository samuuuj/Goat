// Sección 7 de supabase/schema.sql (desbloqueo): tablas, reglas de datos, un pase por día y "solo lo mío".

import { test } from "node:test";
import assert from "node:assert/strict";
import { USUARIO_A, USUARIO_B, comoAnon, comoUsuario, crearBase, una } from "./ayuda/sql.mjs";

const { db, tablas } = await crearBase({ veces: 2 });

test("las tablas del desbloqueo existen con RLS después de correr schema.sql dos veces", () => {
  for (const nombre of ["apps_eventos", "desbloqueo_pases"]) {
    const fila = tablas.find((t) => t.tabla === nombre);
    assert.ok(fila, `falta ${nombre}`);
    assert.equal(fila.rls_activado, true);
  }
});

test("apps_eventos: guarda aperturas y cierres con su día lógico y rechaza datos raros", async () => {
  await comoUsuario(db, USUARIO_A, async () => {
    await db.query(
      `insert into apps_eventos (app, evento, permitido, momento, origen) values ('tiktok', 'abrir', true, '2026-10-03T01:30:00-05:00', 'automatizacion')`,
    );
    await db.query(`insert into apps_eventos (app, evento) values ('clash-royale', 'cerrar')`);
    const fila = await una(db, `select user_id, fecha::text as fecha from apps_eventos where app = 'tiktok'`);
    assert.equal(fila.user_id, USUARIO_A);
    assert.equal(fila.fecha, "2026-10-02", "la 01:30 sigue siendo el día anterior");

    await assert.rejects(db.query(`insert into apps_eventos (app, evento) values ('TikTok', 'abrir')`), "mayúsculas");
    await assert.rejects(db.query(`insert into apps_eventos (app, evento) values ('tik tok', 'abrir')`), "espacios");
    await assert.rejects(db.query(`insert into apps_eventos (app, evento) values ('${"a".repeat(41)}', 'abrir')`), "más de 40");
    await assert.rejects(db.query(`insert into apps_eventos (app, evento) values ('tiktok', 'pausar')`), "evento raro");
    await assert.rejects(db.query(`insert into apps_eventos (app, evento, origen) values ('tiktok', 'abrir', 'otro')`), "origen raro");
  });
});

test("apps_eventos: id_cliente repetido no duplica", async () => {
  const id = "33333333-3333-4333-8333-333333333333";
  await comoUsuario(db, USUARIO_A, async () => {
    await db.query(`insert into apps_eventos (app, evento, id_cliente) values ('youtube', 'abrir', $1)`, [id]);
    await assert.rejects(db.query(`insert into apps_eventos (app, evento, id_cliente) values ('youtube', 'abrir', $1)`, [id]));
  });
});

test("desbloqueo_pases: 10 min por defecto, entre 1 y 30, y solo uno por día lógico", async () => {
  await comoUsuario(db, USUARIO_A, async () => {
    await db.query(`insert into desbloqueo_pases (app, momento) values ('instagram', '2026-10-02T21:00:00-05:00')`);
    const fila = await una(db, `select minutos, fecha::text as fecha from desbloqueo_pases where app = 'instagram'`);
    assert.equal(fila.minutos, 10);
    assert.equal(fila.fecha, "2026-10-02");
    // Otro el mismo día lógico (02:00 del 3 = día 2): no.
    await assert.rejects(db.query(`insert into desbloqueo_pases (app, momento) values ('tiktok', '2026-10-03T02:00:00-05:00')`));
    // Al día siguiente, sí.
    await db.query(`insert into desbloqueo_pases (app, momento) values ('tiktok', '2026-10-03T09:00:00-05:00')`);
    await assert.rejects(db.query(`insert into desbloqueo_pases (app, minutos, momento) values ('tiktok', 0, '2026-10-05T09:00:00-05:00')`));
    await assert.rejects(db.query(`insert into desbloqueo_pases (app, minutos, momento) values ('tiktok', 31, '2026-10-05T09:00:00-05:00')`));
  });
  // El pase de un día es por persona: B también puede usar el suyo ese día.
  await comoUsuario(db, USUARIO_B, async () => {
    await db.query(`insert into desbloqueo_pases (app, momento) values ('tiktok', '2026-10-02T22:00:00-05:00')`);
  });
});

test("otra cuenta no ve, no cambia ni borra lo del desbloqueo de A", async () => {
  await comoUsuario(db, USUARIO_B, async () => {
    for (const tabla of ["apps_eventos", "desbloqueo_pases"]) {
      const { n } = await una(db, `select count(*)::int as n from ${tabla} where user_id = '${USUARIO_A}'`);
      assert.equal(n, 0, `B ve ${tabla} de A`);
      assert.equal((await db.query(`update ${tabla} set app = 'x' where user_id = '${USUARIO_A}'`)).affectedRows, 0);
      assert.equal((await db.query(`delete from ${tabla} where user_id = '${USUARIO_A}'`)).affectedRows, 0);
    }
    await assert.rejects(db.query(`insert into apps_eventos (user_id, app, evento) values ('${USUARIO_A}', 'tiktok', 'abrir')`));
    await assert.rejects(db.query(`insert into desbloqueo_pases (user_id, app) values ('${USUARIO_A}', 'tiktok')`));
  });
});

test("anon no puede leer ni escribir en las tablas del desbloqueo", async () => {
  await comoAnon(db, async () => {
    await assert.rejects(db.query(`select * from apps_eventos`));
    await assert.rejects(db.query(`insert into apps_eventos (app, evento) values ('tiktok', 'abrir')`));
    await assert.rejects(db.query(`select * from desbloqueo_pases`));
    await assert.rejects(db.query(`insert into desbloqueo_pases (app) values ('tiktok')`));
  });
});
