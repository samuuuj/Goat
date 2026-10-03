// Postgres en memoria (PGlite) con lo que Supabase trae: roles anon/authenticated, esquema auth,
// auth.users y auth.uid(). Sirve para probar supabase/schema.sql sin tocar la base de datos real.

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SCHEMA = readFileSync(fileURLToPath(new URL("../../supabase/schema.sql", import.meta.url)), "utf8");

export const USUARIO_A = "11111111-1111-4111-8111-111111111111";
export const USUARIO_B = "22222222-2222-4222-8222-222222222222";

const PREPARACION = `
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  create schema auth;
  grant usage on schema auth to anon, authenticated;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('prueba.uid', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
  -- Como Supabase: permisos por defecto para tablas y funciones nuevas (schema.sql debe quitarlos donde no van).
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
  insert into auth.users values ('${USUARIO_A}', 'a@ejemplo.com'), ('${USUARIO_B}', 'b@ejemplo.com');
`;

/** Base nueva con schema.sql corrido `veces` veces (debe poder repetirse). Devuelve { db, tablas }. */
export async function crearBase({ veces = 1 } = {}) {
  const db = new PGlite();
  await db.exec(PREPARACION);
  let tablas = [];
  for (let i = 0; i < veces; i++) {
    const resultado = await db.exec(SCHEMA);
    tablas = resultado.at(-1).rows;
  }
  return { db, tablas };
}

/** Corre `fn` con la sesión de un usuario (rol authenticated + auth.uid()). */
export async function comoUsuario(db, uid, fn) {
  await db.exec(`set role authenticated; select set_config('prueba.uid', '${uid}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('prueba.uid', '', false);`);
  }
}

/** Corre `fn` como visitante sin sesión (rol anon). */
export async function comoAnon(db, fn) {
  await db.exec(`set role anon; select set_config('prueba.uid', '', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role;`);
  }
}

/** Primera fila de una consulta. */
export async function una(db, sql, parametros = []) {
  return (await db.query(sql, parametros)).rows[0];
}
