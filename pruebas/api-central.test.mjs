// /api/v1 de Central: token primero, llaves solo con la sesión web, resumen, check-ins sin duplicar.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ENTORNO, crearSupabaseFalso, jwtFalso, llamar } from "./ayuda/supabase-falso.mjs";
import { hashToken } from "../api/_lib/auth.js";

const A = "11111111-1111-4111-8111-111111111111";
const SESION_A = jwtFalso("a");

function base() {
  return crearSupabaseFalso({
    datos: { perfil: [{ user_id: A, metas: {} }], api_tokens: [] },
    sesiones: { [SESION_A]: A },
  });
}

async function conToken(falso) {
  const r = await llamar(falso, "POST tokens", { token: SESION_A, cuerpo: { nombre: "iPhone" } });
  assert.equal(r.estado, 201);
  return r.cuerpo.datos.token;
}

test("ping responde sin token y confirma con token", async () => {
  const falso = base();
  const sin = await llamar(falso, "GET ping");
  assert.equal(sin.estado, 200);
  assert.equal(sin.cuerpo.datos.conectado, false);
  const token = await conToken(falso);
  const con = await llamar(falso, "GET ping", { token });
  assert.equal(con.cuerpo.datos.conectado, true);
});

test("sin token → 401; token falso → 401; sin clave secreta → 503", async () => {
  const falso = base();
  assert.equal((await llamar(falso, "GET hoy")).cuerpo.codigo, "SIN_TOKEN");
  assert.equal((await llamar(falso, "GET hoy", { token: "x".repeat(43) })).estado, 401);
  const sinClave = await llamar(falso, "GET hoy", { token: "x".repeat(43), entorno: { ...ENTORNO, SUPABASE_SECRET_KEY: "" } });
  assert.equal(sinClave.estado, 503);
  assert.equal(sinClave.cuerpo.codigo, "SERVIDOR_SIN_CONFIGURAR");
});

test("crear llave: solo con la sesión web, se guarda solo el hash y el token se ve una vez", async () => {
  const falso = base();
  const token = await conToken(falso);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  const [fila] = falso.tablas.api_tokens;
  assert.equal(fila.token_hash, hashToken(token));
  assert.ok(!JSON.stringify(falso.tablas.api_tokens).includes(token), "el token quedó guardado en claro");
  // Con un token de atajo no se pueden crear más llaves.
  assert.equal((await llamar(falso, "POST tokens", { token })).estado, 401);
  // La lista no trae hashes.
  const lista = await llamar(falso, "GET tokens", { token: SESION_A });
  assert.ok(!("token_hash" in lista.cuerpo.datos.tokens[0]));
});

test("una llave revocada deja de funcionar", async () => {
  const falso = base();
  const token = await conToken(falso);
  assert.equal((await llamar(falso, "GET hoy", { token })).estado, 200);
  const id = falso.tablas.api_tokens[0].id;
  assert.equal((await llamar(falso, "DELETE tokens", { token: SESION_A, cuerpo: { id } })).estado, 200);
  assert.equal((await llamar(falso, "GET hoy", { token })).estado, 401);
});

test("GET hoy devuelve el mismo resumen que la pantalla de inicio", async () => {
  const falso = base();
  const token = await conToken(falso);
  const r = await llamar(falso, "GET hoy", { token, ahora: new Date("2026-10-02T16:00:00-05:00") });
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.datos.fecha, "2026-10-02");
  assert.deepEqual(
    r.cuerpo.datos.pendientes.map((p) => p.clave),
    ["desayuno", "almuerzo", "checkin_finanzas"],
  );
  assert.ok(!/\$/.test(r.cuerpo.mensaje));
  assert.ok(falso.tablas.api_tokens[0].ultimo_uso, "no anotó el último uso");
});

test("check-in sin id_cliente: un reintento en menos de 60 s no duplica", async () => {
  const falso = base();
  const token = await conToken(falso);
  const cuerpo = { modulo: "finanzas", tipo: "nada_que_registrar" };
  assert.equal((await llamar(falso, "POST checkins", { token, cuerpo })).estado, 201);
  assert.equal((await llamar(falso, "POST checkins", { token, cuerpo })).estado, 201);
  assert.equal(falso.tablas.checkins.length, 1);
  assert.equal(falso.tablas.checkins[0].user_id, A);
});

test("datos inválidos → 400 con mensaje humano; ruta inexistente → 404", async () => {
  const falso = base();
  const token = await conToken(falso);
  const malo = await llamar(falso, "POST checkins", { token, cuerpo: { modulo: "nada", tipo: "cierre" } });
  assert.equal(malo.estado, 400);
  assert.match(malo.cuerpo.mensaje, /Revisa/);
  assert.equal((await llamar(falso, "GET no/existe", { token })).estado, 404);
});

test("cada llamada queda en log_api sin el cuerpo", async () => {
  const falso = base();
  const token = await conToken(falso);
  await llamar(falso, "POST checkins", { token, cuerpo: { modulo: "finanzas", tipo: "cierre" } });
  const registro = falso.tablas.log_api.at(-1);
  assert.equal(registro.ruta, "checkins");
  assert.equal(registro.estado, 201);
  assert.ok(!("cuerpo" in registro) || registro.cuerpo == null);
});

test("las consultas del servidor siempre van filtradas por el usuario", async () => {
  const falso = base();
  const token = await conToken(falso);
  falso.llamadas.length = 0;
  await llamar(falso, "GET hoy", { token });
  const deDatos = falso.llamadas.filter((l) => l.ruta.startsWith("/rest/v1/") && !l.ruta.includes("api_tokens") && !l.ruta.includes("festivos"));
  assert.ok(deDatos.length >= 6);
  for (const l of deDatos) if (l.metodo === "GET") assert.match(l.ruta, new RegExp(`user_id=eq.${A}`));
});
