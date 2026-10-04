// Rutina en supabase/schema.sql: rutina_bloques, rutina_checks y uni_tareas (secciones 8 y 4).
// Repetible, RLS "solo lo mío", anon bloqueado, un chequeo por bloque y fecha, y nada de apuntar a bloques ajenos.

import { test } from "node:test";
import assert from "node:assert/strict";
import { USUARIO_A, USUARIO_B, comoAnon, comoUsuario, crearBase, una } from "./ayuda/sql.mjs";

const { db, tablas } = await crearBase({ veces: 2 });
const TABLAS = ["rutina_bloques", "rutina_checks", "uni_tareas"];

/** Inserta un bloque como el usuario y devuelve su id. */
async function bloque(uid) {
  return comoUsuario(db, uid, async () => {
    const fila = await una(
      db,
      `insert into rutina_bloques (titulo, tipo, dias, hora_inicio, duracion_min, obligatorio)
       values ('Caminar', 'caminar', '{1,2,3,4,5}', '06:10', 45, true) returning id`,
    );
    return fila.id;
  });
}

test("las 3 tablas existen tras correr schema.sql 2 veces, con RLS", () => {
  for (const nombre of TABLAS) {
    const fila = tablas.find((t) => t.tabla === nombre);
    assert.ok(fila, `falta ${nombre}`);
    assert.equal(fila.rls_activado, true);
  }
});

test("anon no ve ni escribe nada de rutina", async () => {
  await comoAnon(db, async () => {
    for (const tabla of TABLAS) await assert.rejects(db.query(`select * from public.${tabla}`));
    await assert.rejects(db.query(`insert into uni_tareas (titulo) values ('x')`));
  });
});

test("rutina_bloques valida tipo, días 1..7, duración, aviso y enlace https", async () => {
  await comoUsuario(db, USUARIO_A, async () => {
    const insertar = (cols, vals) =>
      db.query(`insert into rutina_bloques (titulo, tipo, dias, hora_inicio, duracion_min${cols}) values ('X', ${vals})`);
    await insertar("", `'estudio', '{1,3}', '20:00', 90`);
    await assert.rejects(insertar("", `'siesta', '{1}', '14:00', 30`), "tipo fuera de la lista");
    await assert.rejects(insertar("", `'estudio', '{}', '20:00', 90`), "días vacíos");
    await assert.rejects(insertar("", `'estudio', '{0,8}', '20:00', 90`), "días fuera de 1..7");
    await assert.rejects(insertar("", `'estudio', '{1}', '20:00', 2`), "duración < 5");
    await assert.rejects(insertar("", `'estudio', '{1}', '20:00', 700`), "duración > 600");
    await assert.rejects(insertar(", aviso_min", `'estudio', '{1}', '20:00', 30, 200`), "aviso > 120");
    await assert.rejects(insertar(", enlace", `'clase_virtual', '{1}', '18:00', 60, 'http://inseguro.co'`), "enlace sin https");
    await assert.rejects(insertar(", enlace", `'clase_virtual', '{1}', '18:00', 60, 'javascript:alert(1)'`));
    await insertar(", enlace", `'clase_virtual', '{1,4}', '18:00', 60, 'https://meet.google.com/abc-defg-hij'`);
  });
});

test("rutina_checks: uno por bloque y fecha; marcar de nuevo es actualizar", async () => {
  const id = await bloque(USUARIO_A);
  await comoUsuario(db, USUARIO_A, async () => {
    await db.query(`insert into rutina_checks (bloque_id, fecha, estado) values ($1, '2026-10-06', 'hecho')`, [id]);
    await assert.rejects(
      db.query(`insert into rutina_checks (bloque_id, fecha, estado) values ($1, '2026-10-06', 'saltado')`, [id]),
      /unique|duplicate/i,
    );
    // Lo que hace la API (upsert por bloque_id, fecha).
    await db.query(
      `insert into rutina_checks (bloque_id, fecha, estado) values ($1, '2026-10-06', 'saltado')
       on conflict (bloque_id, fecha) do update set estado = excluded.estado`,
      [id],
    );
    const fila = await una(db, `select count(*)::int as n, max(estado) as estado from rutina_checks where bloque_id = $1`, [id]);
    assert.deepEqual(fila, { n: 1, estado: "saltado" });
    // Otro día sí se puede.
    await db.query(`insert into rutina_checks (bloque_id, fecha, estado) values ($1, '2026-10-07', 'hecho')`, [id]);
    await assert.rejects(db.query(`insert into rutina_checks (bloque_id, fecha, estado) values ($1, '2026-10-08', 'quizas')`, [id]));
  });
});

test("nadie puede chequear un bloque ajeno ni ver la rutina de otro", async () => {
  const deA = await bloque(USUARIO_A);
  await comoUsuario(db, USUARIO_B, async () => {
    assert.equal((await una(db, `select count(*)::int as n from rutina_bloques`)).n, 0);
    assert.equal((await una(db, `select count(*)::int as n from rutina_checks`)).n, 0);
    // Aunque B conozca el id del bloque de A, el chequeo no entra (llave foránea con user_id).
    await assert.rejects(db.query(`insert into rutina_checks (bloque_id, fecha, estado) values ($1, '2026-10-09', 'hecho')`, [deA]));
    assert.equal((await db.query(`update rutina_bloques set titulo = 'Hackeado'`)).affectedRows, 0);
    assert.equal((await db.query(`delete from rutina_bloques`)).affectedRows, 0);
  });
});

test("borrar un bloque borra sus chequeos; actualizado_en se toca solo", async () => {
  const id = await bloque(USUARIO_A);
  await comoUsuario(db, USUARIO_A, async () => {
    await db.query(`insert into rutina_checks (bloque_id, fecha, estado) values ($1, '2026-10-10', 'hecho')`, [id]);
    const antes = await una(db, `select actualizado_en from rutina_bloques where id = $1`, [id]);
    await db.query(`select pg_sleep(0.01)`);
    await db.query(`update rutina_bloques set duracion_min = 30 where id = $1`, [id]);
    const despues = await una(db, `select actualizado_en from rutina_bloques where id = $1`, [id]);
    assert.ok(despues.actualizado_en >= antes.actualizado_en);
    await db.query(`delete from rutina_bloques where id = $1`, [id]);
    assert.equal((await una(db, `select count(*)::int as n from rutina_checks where bloque_id = $1`, [id])).n, 0);
  });
});

test("uni_tareas: valores por defecto, estados y prioridad; fecha lógica", async () => {
  await comoUsuario(db, USUARIO_A, async () => {
    const t = await una(
      db,
      `insert into uni_tareas (titulo, materia, fecha_limite, primer_paso, momento)
       values ('Taller 3 de Cálculo', 'Cálculo', '2026-10-08T23:59:00-05:00', 'Abrir el PDF y leer el punto 1', '2026-10-07T01:30:00-05:00')
       returning estado, prioridad, fecha::text as fecha, user_id`,
    );
    assert.deepEqual(t, { estado: "pendiente", prioridad: 2, fecha: "2026-10-06", user_id: USUARIO_A });
    await assert.rejects(db.query(`insert into uni_tareas (titulo, estado) values ('x', 'olvidada')`));
    await assert.rejects(db.query(`insert into uni_tareas (titulo, prioridad) values ('x', 5)`));
    await assert.rejects(db.query(`insert into uni_tareas (titulo) values ('')`));
    await assert.rejects(db.query(`insert into uni_tareas (titulo, primer_paso) values ('x', $1)`, ["p".repeat(121)]));
  });
  await comoUsuario(db, USUARIO_B, async () => {
    assert.equal((await una(db, `select count(*)::int as n from uni_tareas`)).n, 0);
  });
});

test("festivos de 2028 cargados (el festivo usa la plantilla del domingo)", async () => {
  const f = await una(db, `select count(*)::int as n from festivos where fecha between '2028-01-01' and '2028-12-31'`);
  assert.equal(f.n, 18);
  assert.equal((await una(db, `select public.tipo_dia_base('2028-10-16') as t`)).t, "festivo");
});
