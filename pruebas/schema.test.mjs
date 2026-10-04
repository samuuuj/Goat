// supabase/schema.sql: se puede correr 2 veces, toda tabla tiene RLS y "solo lo mío", anon no tiene permisos.
// Estas reglas valen para TODAS las tablas, también las que agreguen los módulos.

import { test } from "node:test";
import assert from "node:assert/strict";
import { USUARIO_A, USUARIO_B, comoAnon, comoUsuario, crearBase, una } from "./ayuda/sql.mjs";

const { db, tablas } = await crearBase({ veces: 2 });

test("schema.sql corre dos veces seguidas y todas las tablas tienen RLS", () => {
  assert.ok(tablas.length >= 10);
  for (const fila of tablas) assert.equal(fila.rls_activado, true, `${fila.tabla} sin RLS`);
});

test("anon no tiene ningún permiso sobre las tablas", async () => {
  const { rows } = await db.query(
    `select table_name, privilege_type from information_schema.role_table_grants
      where grantee = 'anon' and table_schema = 'public'`,
  );
  assert.deepEqual(rows, []);
  await comoAnon(db, async () => {
    for (const { tabla } of tablas) await assert.rejects(db.query(`select * from public.${tabla}`), `${tabla} legible por anon`);
  });
});

test("toda tabla con user_id tiene una política basada en auth.uid()", async () => {
  const { rows } = await db.query(`
    select c.table_name,
           exists (select 1 from pg_policies p
                    where p.schemaname = 'public' and p.tablename = c.table_name
                      and (p.qual like '%auth.uid()%' or p.with_check like '%auth.uid()%')) as con_politica
      from information_schema.columns c
     where c.table_schema = 'public' and c.column_name = 'user_id'`);
  assert.ok(rows.length >= 9);
  for (const fila of rows) assert.ok(fila.con_politica, `${fila.table_name} sin política propia`);
});

test("toda tabla con user_id lo llena sola con auth.uid() (salvo perfil y api_tokens, que llena el servidor)", async () => {
  const { rows } = await db.query(`
    select table_name, column_default from information_schema.columns
     where table_schema = 'public' and column_name = 'user_id'`);
  for (const fila of rows) {
    if (["perfil", "api_tokens", "log_api"].includes(fila.table_name)) continue;
    assert.match(fila.column_default ?? "", /auth\.uid\(\)/, `${fila.table_name}.user_id sin default auth.uid()`);
  }
});

test("el usuario existente tiene perfil con metas y ajustes", async () => {
  const perfil = await una(db, `select metas->>'proteina_g' as proteina, ajustes from perfil where user_id = $1`, [USUARIO_A]);
  assert.equal(perfil.proteina, "130");
  assert.deepEqual(perfil.ajustes, {});
});

test("ajustes_poner guarda una clave sin pisar las demás y solo en tu perfil", async () => {
  await comoUsuario(db, USUARIO_A, async () => {
    await db.query(`select public.ajustes_poner('bienvenida', '{"completada": true}'::jsonb)`);
    await db.query(`select public.ajustes_poner('atajos', '{"finanzas-movimiento": true}'::jsonb)`);
  });
  const a = await una(db, `select ajustes from perfil where user_id = $1`, [USUARIO_A]);
  assert.deepEqual(a.ajustes, { bienvenida: { completada: true }, atajos: { "finanzas-movimiento": true } });
  const b = await una(db, `select ajustes from perfil where user_id = $1`, [USUARIO_B]);
  assert.deepEqual(b.ajustes, {});
  await comoAnon(db, async () => {
    await assert.rejects(db.query(`select public.ajustes_poner('x', '1'::jsonb)`));
  });
});

test("notificaciones: cada quien ve las suyas, sin duplicar clave y sin enlaces externos", async () => {
  await comoUsuario(db, USUARIO_A, async () => {
    await db.query(`insert into notificaciones (modulo, emoji, titulo, clave, url) values ('rutina', '🚶', 'Caminar', 'prueba:1', 'rutina.html')`);
    await assert.rejects(db.query(`insert into notificaciones (modulo, titulo, clave) values ('rutina', 'Otra', 'prueba:1')`));
    await assert.rejects(db.query(`insert into notificaciones (modulo, titulo, url) values ('rutina', 'Mala', 'javascript:alert(1)')`));
    await assert.rejects(db.query(`insert into notificaciones (modulo, titulo, url) values ('rutina', 'Mala', '//otro.sitio')`));
  });
  await comoUsuario(db, USUARIO_B, async () => {
    assert.equal((await una(db, `select count(*)::int as n from notificaciones`)).n, 0);
    assert.equal((await db.query(`delete from notificaciones`)).affectedRows, 0);
  });
});

test("otra cuenta no ve ni borra los registros de A", async () => {
  await comoUsuario(db, USUARIO_A, async () => {
    await db.query(`insert into comidas (tipo, kcal, proteina_g) values ('almuerzo', 950, 40)`);
    await db.query(`insert into finanzas_movimientos (tipo, monto, categoria, cuenta) values ('egreso', 12000, 'comida', 'nequi')`);
    await db.query(`insert into checkins (modulo, tipo) values ('finanzas', 'cierre')`);
  });
  await comoUsuario(db, USUARIO_B, async () => {
    for (const tabla of ["comidas", "finanzas_movimientos", "checkins", "perfil"]) {
      const { n } = await una(db, `select count(*)::int as n from ${tabla} where user_id = '${USUARIO_A}'`);
      assert.equal(n, 0, `B ve ${tabla} de A`);
    }
    assert.equal((await db.query(`delete from comidas`)).affectedRows, 0);
    await assert.rejects(db.query(`insert into comidas (user_id, tipo, kcal) values ('${USUARIO_A}', 'cena', 500)`));
  });
});

test("la sesión no puede crear ni cambiar llaves (solo el servidor)", async () => {
  await comoUsuario(db, USUARIO_A, async () => {
    await assert.rejects(db.query(`insert into api_tokens (user_id, nombre, token_hash) values ('${USUARIO_A}', 'x', 'y')`));
  });
});
