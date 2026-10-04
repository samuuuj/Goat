// GET /api/v1/widget: token primero, sin dinero salvo ?dinero=1, las partes que fallan se omiten y la respuesta es corta.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ENTORNO, crearSupabaseFalso, jwtFalso, llamar } from "./ayuda/supabase-falso.mjs";
import { construirResumen } from "../web/js/logica/calculo.js";
import { cargarRegistrosServidor } from "../api/_lib/registros.js";
import { baseDeDatos } from "../api/_lib/supabase.js";
import { leerConfig } from "../api/_lib/config.js";
import { MAXIMO_BYTES } from "../web/js/widgets/logica.js";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const SESION_A = jwtFalso("a");
const F = "2026-10-02"; // viernes
const en = (hora, fecha = F) => new Date(`${fecha}T${hora}:00-05:00`);
const iso = (hora, fecha = F) => en(hora, fecha).toISOString();
const AYER = "2026-10-01";

/** Un día con desayuno, gastos, sueño de anoche, rutina, apps abiertas y un aviso sin leer. */
function datosCompletos() {
  return {
    perfil: [{ user_id: A, metas: {}, ajustes: {} }],
    api_tokens: [],
    comidas: [
      { user_id: A, tipo: "desayuno", kcal: 520, proteina_g: 28, omitida: false, fecha: F, momento: iso("07:40") },
      ...["desayuno", "almuerzo", "cena"].map((tipo) => ({ user_id: A, tipo, kcal: 800, proteina_g: 40, omitida: false, fecha: AYER })),
    ],
    finanzas_movimientos: [{ user_id: A, tipo: "egreso", monto: 25000, fecha: F, momento: iso("08:10") }],
    checkins: [{ user_id: A, modulo: "finanzas", tipo: "cierre", fecha: AYER, momento: iso("22:30", AYER) }],
    uni_sesiones: [{ user_id: A, minutos: 50, fecha: F }],
    gym_sesiones: [],
    festivos: [],
    rutina_bloques: [
      { id: "b1", user_id: A, titulo: "Trabajo útil", tipo: "trabajo", dias: [1, 2, 3, 4, 5], hora_inicio: "09:00", duracion_min: 90, obligatorio: false, orden: 1, activo: true },
      { id: "b2", user_id: A, titulo: "Almuerzo", tipo: "almuerzo", dias: [1, 2, 3, 4, 5], hora_inicio: "12:30", duracion_min: 45, obligatorio: false, orden: 2, activo: true },
    ],
    rutina_checks: [],
    sueno_eventos: [
      { user_id: A, tipo: "acostarse", fuente: "hora_dormir", momento: iso("23:00", AYER), creado_en: iso("23:00", AYER) },
      { user_id: A, tipo: "despertar", fuente: "alarma", momento: iso("06:10"), creado_en: iso("06:10") },
    ],
    sueno_muestras: [],
    apps_eventos: [],
    desbloqueo_pases: [],
    notificaciones: [{ user_id: A, modulo: "rutina", emoji: "🗓️", titulo: "Caminar sin marcar", clave: "x:1", momento: iso("08:00"), fecha: F, leida_en: null, descartada_en: null }],
  };
}

function base(datos = datosCompletos()) {
  return crearSupabaseFalso({ datos, sesiones: { [SESION_A]: A } });
}

async function conToken(falso) {
  const r = await llamar(falso, "POST tokens", { token: SESION_A, cuerpo: { nombre: "iPhone" } });
  assert.equal(r.estado, 201);
  return r.cuerpo.datos.token;
}

/** Ninguna cifra con forma de plata: "$", "25.000", "19100"… (D-020). */
function sinDinero(objeto) {
  const texto = JSON.stringify(objeto);
  assert.doesNotMatch(texto, /\$/);
  // 25.000 o 19100 como cifra suelta (la hora "14:30:00.000Z" de `actualizado` no cuenta).
  assert.doesNotMatch(texto, /(?<![\d:])\d{1,3}(\.\d{3})+(?!\d)/);
  assert.doesNotMatch(texto, /(?<![\d.:-])\d{4,}(?![\d:-])/);
  assert.doesNotMatch(texto, /"dinero"/);
}

test("el widget exige token antes de todo (y no lee nada sin él)", async () => {
  const falso = base();
  const sin = await llamar(falso, "GET widget");
  assert.equal(sin.estado, 401);
  assert.equal(sin.cuerpo.codigo, "SIN_TOKEN");
  assert.equal(falso.llamadas.filter((l) => l.ruta.startsWith("/rest/v1/comidas")).length, 0);
  const malo = await llamar(falso, "GET widget", { token: "x".repeat(43) });
  assert.equal(malo.estado, 401);
  const sinClave = await llamar(falso, "GET widget", { token: "x".repeat(43), entorno: { ...ENTORNO, SUPABASE_SECRET_KEY: "" } });
  assert.equal(sinClave.estado, 503);
});

test("con token: puntaje, racha, anillos, semana, pendientes, rutina, sueño, desbloqueo, avisos y frase", async () => {
  const falso = base();
  const token = await conToken(falso);
  const ahora = en("09:30");
  const r = await llamar(falso, "GET widget", { token, ahora });
  assert.equal(r.estado, 200);
  const d = r.cuerpo.datos;

  // El mismo cálculo que Hoy (principio 1).
  const db = baseDeDatos(leerConfig(ENTORNO), A, { fetch: falso.fetch });
  const resumen = construirResumen(await cargarRegistrosServidor(db, ahora), ahora);
  assert.equal(d.fecha, F);
  assert.equal(d.dia, "viernes");
  assert.equal(d.score, resumen.score);
  assert.equal(d.racha, resumen.racha);
  assert.equal(d.scoreAyer, resumen.scoreAyer);
  assert.deepEqual(d.anillos.map((a) => a.clave), ["registro", "cuerpo", "mente"]);
  assert.equal(d.anillos[0].progreso, 0.25);
  assert.equal(d.semana.length, 7);
  assert.deepEqual(d.semana.at(-1), { dia: "V", score: resumen.score, hoy: true });

  assert.equal(d.pendientes.total, 0);
  assert.equal(d.abrir, "index.html");
  assert.deepEqual(
    { ahora: d.rutina.ahora, siguiente: d.rutina.siguiente, hora: d.rutina.hora, quedan: d.rutina.quedan },
    { ahora: "Trabajo útil", siguiente: "Almuerzo", hora: "12:30", quedan: "1h" },
  );
  assert.equal(d.sueno.etiqueta, "Anoche");
  assert.equal(d.sueno.duracion, "7 h 10");
  assert.deepEqual({ abierto: d.desbloqueo.abierto, minutos: d.desbloqueo.minutos }, { abierto: true, minutos: 30 });
  assert.equal(d.desbloqueo.apps[0].nombre, "TikTok");
  assert.equal(d.avisos.sinLeer, 1);
  assert.ok(d.frase.length > 5 && d.frase.length <= 60);

  assert.equal(r.cuerpo.mensaje, d.bloqueo.linea);
  assert.match(d.bloqueo.linea, /^Goat \d+/);
  assert.equal(d.bloqueo.detalle, "Todo al día");
  assert.equal(d.bloqueo.extra, "12:30 Almuerzo");
  sinDinero(r.cuerpo);
  assert.ok(Buffer.byteLength(JSON.stringify(r.cuerpo)) <= MAXIMO_BYTES, "la respuesta pasa de 4 KB");
});

test("sin ?dinero=1 no hay montos; con ?dinero=1 sí, pero nunca en los textos de pantalla bloqueada ni en la frase", async () => {
  const falso = base();
  const token = await conToken(falso);
  const ahora = en("16:00");
  const sin = await llamar(falso, "GET widget", { token, ahora });
  assert.equal(sin.cuerpo.datos.dinero, undefined);
  sinDinero(sin.cuerpo);

  const con = await llamar(falso, "GET widget", { token, ahora, query: { dinero: "1" } });
  assert.equal(con.estado, 200);
  const d = con.cuerpo.datos;
  assert.equal(typeof d.dinero.disponibleHoy, "number");
  const resumen = construirResumen(
    await cargarRegistrosServidor(baseDeDatos(leerConfig(ENTORNO), A, { fetch: falso.fetch }), ahora),
    ahora,
  );
  assert.equal(d.dinero.disponibleHoy, resumen.metricas.find((m) => m.clave === "disponible").valor);
  // Lo que se lee en la pantalla bloqueada, el mensaje y la frase siguen sin montos.
  sinDinero({ bloqueo: d.bloqueo, mensaje: con.cuerpo.mensaje, frase: d.frase, pendientes: d.pendientes });
  // ?dinero=0 o cualquier otra cosa = sin dinero.
  assert.equal((await llamar(falso, "GET widget", { token, ahora, query: { dinero: "0" } })).cuerpo.datos.dinero, undefined);
});

test("pendientes: el primero, cuántos faltan y qué se abre al tocar", async () => {
  const falso = base();
  const token = await conToken(falso);
  const r = await llamar(falso, "GET widget", { token, ahora: en("15:30") });
  const d = r.cuerpo.datos;
  assert.equal(d.pendientes.total, 2);
  assert.equal(d.pendientes.primero, "🍽️ Almuerzo");
  assert.equal(d.pendientes.texto, "almuerzo y check-in de gastos");
  assert.equal(d.abrir, "index.html#registrar=comida");
  assert.equal(d.bloqueo.detalle, "Falta almuerzo y check-in de gastos");
  assert.equal(d.desbloqueo.abierto, false);
  assert.equal(d.desbloqueo.minutos, 0);
});

test("las partes que fallan (tablas sin instalar) se omiten sin tumbar el widget", async () => {
  const falso = base();
  const token = await conToken(falso);
  // Supabase sin las tablas de sueño, desbloqueo y notificaciones: PostgREST responde PGRST205.
  const faltan = /\/rest\/v1\/(sueno_eventos|sueno_muestras|apps_eventos|desbloqueo_pases|notificaciones)\?/;
  const fetchReal = falso.fetch;
  falso.fetch = async (url, opciones) =>
    faltan.test(String(url)) ? new Response(JSON.stringify({ code: "PGRST205", message: "no existe" }), { status: 404 }) : fetchReal(url, opciones);

  const r = await llamar(falso, "GET widget", { token, ahora: en("09:30") });
  assert.equal(r.estado, 200);
  const d = r.cuerpo.datos;
  assert.equal(d.sueno, null);
  assert.equal(d.desbloqueo, null);
  assert.equal(d.avisos, null);
  assert.ok(Number.isInteger(d.score));
  assert.equal(d.rutina.ahora, "Trabajo útil");
  assert.ok(d.frase);
});

test("sin rutina ni sueño el widget responde igual (usuario nuevo)", async () => {
  const falso = base({ perfil: [{ user_id: A, metas: {}, ajustes: {} }], api_tokens: [] });
  const token = await conToken(falso);
  const r = await llamar(falso, "GET widget", { token, ahora: en("07:00") });
  assert.equal(r.estado, 200);
  const d = r.cuerpo.datos;
  // Un día vacío solo tiene los 10 puntos de finanzas (no gastó más de lo del día): 10 / 65 → 15.
  assert.equal(d.score, 15);
  assert.equal(d.racha, 0);
  assert.equal(d.rutina, null);
  assert.equal(d.sueno, null);
  assert.equal(d.bloqueo.linea, "Goat 15");
  assert.equal(d.bloqueo.extra, null);
  assert.ok(d.frase);
});

test("sin la base núcleo instalada: 503 'Falta actualizar la base de datos' (el script usa lo guardado)", async () => {
  const falso = base();
  const token = await conToken(falso);
  const fetchReal = falso.fetch;
  falso.fetch = async (url, opciones) =>
    /\/rest\/v1\/comidas\?/.test(String(url))
      ? new Response(JSON.stringify({ code: "PGRST205", message: "no existe" }), { status: 404 })
      : fetchReal(url, opciones);
  const r = await llamar(falso, "GET widget", { token, ahora: en("09:30") });
  assert.equal(r.estado, 503);
  assert.equal(r.cuerpo.codigo, "BASE_SIN_INSTALAR");
});

test("cada consulta se hace una sola vez aunque varias partes la pidan", async () => {
  const falso = base();
  const token = await conToken(falso);
  const antes = falso.llamadas.length;
  await llamar(falso, "GET widget", { token, ahora: en("09:30") });
  const comidas = falso.llamadas.slice(antes).filter((l) => l.metodo === "GET" && l.ruta.startsWith("/rest/v1/comidas?"));
  assert.equal(comidas.length, 1);
});

test("otra cuenta no ve los datos de A en su widget", async () => {
  const datos = datosCompletos();
  const SESION_B = jwtFalso("b");
  const falso = crearSupabaseFalso({ datos, sesiones: { [SESION_A]: A, [SESION_B]: B } });
  const r = await llamar(falso, "POST tokens", { token: SESION_B, cuerpo: { nombre: "iPhone B" } });
  const tokenB = r.cuerpo.datos.token;
  const w = await llamar(falso, "GET widget", { token: tokenB, ahora: en("09:30") });
  assert.equal(w.estado, 200);
  assert.equal(w.cuerpo.datos.score, 15);
  assert.equal(w.cuerpo.datos.racha, 0);
  assert.equal(w.cuerpo.datos.rutina, null);
  assert.equal(w.cuerpo.datos.sueno, null);
  assert.equal(w.cuerpo.datos.avisos.sinLeer, 0);
});

test("la sesión web también puede pedir el widget (vista previa)", async () => {
  const falso = base();
  const r = await llamar(falso, "GET widget", { token: SESION_A, ahora: en("09:30") });
  assert.equal(r.estado, 200);
  assert.ok(Number.isInteger(r.cuerpo.datos.score));
});
