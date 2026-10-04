// Sección 5. EJERCICIO de supabase/schema.sql: columnas nuevas repetibles, rutina opcional,
// momento = inicio, un solo entreno en curso, actividad única por fecha y RLS.

import { test } from "node:test";
import assert from "node:assert/strict";
import { USUARIO_A, USUARIO_B, comoAnon, comoUsuario, crearBase, una } from "./ayuda/sql.mjs";

const { db } = await crearBase({ veces: 2 });

const comoA = (fn) => comoUsuario(db, USUARIO_A, fn);
const comoB = (fn) => comoUsuario(db, USUARIO_B, fn);

test("gym_sesiones tiene las columnas nuevas (y correr el schema 2 veces no falla)", async () => {
  const { rows } = await db.query(
    `select column_name, is_nullable, column_default from information_schema.columns
      where table_schema = 'public' and table_name = 'gym_sesiones'`,
  );
  const col = Object.fromEntries(rows.map((r) => [r.column_name, r]));
  for (const nombre of ["tipo", "inicio", "fin", "duracion_min", "distancia_km", "pasos", "en_curso"]) {
    assert.ok(col[nombre], `falta la columna ${nombre}`);
  }
  assert.equal(col.rutina.is_nullable, "YES", "rutina debe ser opcional");
  assert.match(col.tipo.column_default, /fuerza/);
});

test("el registro viejo de Hoy (solo rutina) sigue funcionando y queda como fuerza", async () => {
  await comoA(async () => {
    const fila = await una(db, `insert into gym_sesiones (rutina) values ('pierna') returning tipo, en_curso, fecha`);
    assert.equal(fila.tipo, "fuerza");
    assert.equal(fila.en_curso, false);
    assert.ok(fila.fecha);
  });
});

test("caminata sin rutina: momento = inicio, fecha del día lógico y duración calculada", async () => {
  await comoA(async () => {
    const fila = await una(
      db,
      `insert into gym_sesiones (tipo, inicio, fin, distancia_km)
       values ('caminata', '2026-10-02T07:10:00-05:00', '2026-10-02T08:05:00-05:00', 4.2)
       returning rutina, momento, fecha::text as fecha, duracion_min, distancia_km::text as km`,
    );
    assert.equal(fila.rutina, null);
    assert.equal(new Date(fila.momento).toISOString(), "2026-10-02T12:10:00.000Z");
    assert.equal(fila.fecha, "2026-10-02");
    assert.equal(fila.duracion_min, 55);
    assert.equal(fila.km, "4.20");
  });
});

test("un trote que cruza la medianoche antes de las 04:00 pertenece al día anterior", async () => {
  await comoA(async () => {
    const fila = await una(
      db,
      `insert into gym_sesiones (tipo, inicio, fin)
       values ('trote', '2026-10-02T23:40:00-05:00', '2026-10-03T00:25:00-05:00')
       returning fecha::text as fecha, duracion_min`,
    );
    assert.equal(fila.fecha, "2026-10-02");
    assert.equal(fila.duracion_min, 45);
  });
});

test("checks: tipo cerrado, fin después del inicio, máximo 6 h, rangos", async () => {
  await comoA(async () => {
    const malos = [
      `insert into gym_sesiones (tipo) values ('yoga_extremo')`,
      `insert into gym_sesiones (tipo, inicio, fin) values ('fuerza', '2026-10-02T08:00:00-05:00', '2026-10-02T07:00:00-05:00')`,
      `insert into gym_sesiones (tipo, inicio, fin) values ('fuerza', '2026-10-02T08:00:00-05:00', '2026-10-02T15:00:00-05:00')`,
      `insert into gym_sesiones (tipo, fin) values ('fuerza', '2026-10-02T08:00:00-05:00')`,
      `insert into gym_sesiones (tipo, distancia_km) values ('trote', 250)`,
      `insert into gym_sesiones (tipo, pasos) values ('caminata', -5)`,
      `insert into gym_sesiones (tipo, en_curso) values ('fuerza', true)`,
      `insert into gym_sesiones (tipo, rutina) values ('fuerza', '')`,
    ];
    for (const sql of malos) await assert.rejects(db.query(sql), `debió fallar: ${sql}`);
  });
});

test("solo un entreno en curso por usuario; terminarlo deja empezar otro", async () => {
  await comoA(async () => {
    const { id } = await una(
      db,
      `insert into gym_sesiones (tipo, inicio, en_curso) values ('fuerza', '2026-10-03T17:00:00-05:00', true) returning id`,
    );
    await assert.rejects(
      db.query(`insert into gym_sesiones (tipo, inicio, en_curso) values ('trote', '2026-10-03T17:05:00-05:00', true)`),
    );
    const cerrada = await una(
      db,
      `update gym_sesiones set fin = '2026-10-03T18:02:00-05:00', en_curso = false where id = $1 returning duracion_min`,
      [id],
    );
    assert.equal(cerrada.duracion_min, 62);
    await db.query(`insert into gym_sesiones (tipo, inicio, en_curso) values ('trote', '2026-10-03T19:00:00-05:00', true)`);
  });
  // Otra cuenta puede tener su propio entreno en curso.
  await comoB(async () => {
    await db.query(`insert into gym_sesiones (tipo, inicio, en_curso) values ('fuerza', '2026-10-03T19:00:00-05:00', true)`);
  });
});

test("ejercicio_actividad: una fila por fecha, el upsert actualiza", async () => {
  await comoA(async () => {
    const upsert = `insert into ejercicio_actividad (fecha, pasos, distancia_km, energia_kcal)
                    values ('2026-10-02', $1, $2, 210)
                    on conflict (user_id, fecha) do update
                      set pasos = excluded.pasos, distancia_km = excluded.distancia_km
                    returning pasos`;
    assert.equal((await una(db, upsert, [4200, 3.1])).pasos, 4200);
    assert.equal((await una(db, upsert, [8432, 6.05])).pasos, 8432);
    const { n } = await una(db, `select count(*)::int as n from ejercicio_actividad where fecha = '2026-10-02'`);
    assert.equal(n, 1);
    await assert.rejects(db.query(`insert into ejercicio_actividad (fecha, pasos) values ('2026-10-02', 10)`));
    await assert.rejects(db.query(`insert into ejercicio_actividad (fecha, pasos) values ('2026-10-04', -1)`));
    const fila = await una(db, `select user_id, fuente, energia_kcal from ejercicio_actividad where fecha = '2026-10-02'`);
    assert.equal(fila.user_id, USUARIO_A);
    assert.equal(fila.fuente, "salud");
    assert.equal(fila.energia_kcal, 210);
  });
  // B puede tener su propia fila en la misma fecha.
  await comoB(async () => {
    await db.query(`insert into ejercicio_actividad (fecha, pasos) values ('2026-10-02', 3000)`);
  });
});

test("RLS: B no ve, no cambia ni borra lo de A; anon no entra", async () => {
  await comoB(async () => {
    for (const tabla of ["gym_sesiones", "ejercicio_actividad"]) {
      const { n } = await una(db, `select count(*)::int as n from ${tabla} where user_id = '${USUARIO_A}'`);
      assert.equal(n, 0, `B ve ${tabla} de A`);
    }
    assert.equal((await db.query(`update gym_sesiones set notas = 'x' where user_id = '${USUARIO_A}'`)).affectedRows, 0);
    assert.equal((await db.query(`delete from ejercicio_actividad where user_id = '${USUARIO_A}'`)).affectedRows, 0);
    await assert.rejects(db.query(`insert into ejercicio_actividad (user_id, fecha, pasos) values ('${USUARIO_A}', '2026-10-09', 1)`));
  });
  await comoAnon(db, async () => {
    await assert.rejects(db.query(`select * from ejercicio_actividad`));
    await assert.rejects(db.query(`select * from gym_sesiones`));
  });
});

test("la función del trigger no se puede llamar directo", async () => {
  const { rows } = await db.query(
    `select has_function_privilege('authenticated', 'public.gym_sesiones_preparar()', 'execute') as auth,
            has_function_privilege('anon', 'public.gym_sesiones_preparar()', 'execute') as anon`,
  );
  assert.deepEqual(rows[0], { auth: false, anon: false });
});
