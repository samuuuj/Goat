// /api/v1 de Sueño con el Supabase falso: token primero, eventos, sync sin duplicar, resumen y mensajes sin montos.

import { test } from "node:test";
import assert from "node:assert/strict";
import { crearSupabaseFalso, jwtFalso, llamar } from "./ayuda/supabase-falso.mjs";

const A = "11111111-1111-4111-8111-111111111111";
const SESION_A = jwtFalso("a");
const m = (fecha, hora) => `${fecha}T${hora}:00-05:00`;
const D = "2026-10-02";
const D1 = "2026-10-03";

function base(datos = {}) {
  return crearSupabaseFalso({
    datos: { perfil: [{ user_id: A, metas: { sueno_horas: 7.5 } }], api_tokens: [], ...datos },
    sesiones: { [SESION_A]: A },
    unicas: { sueno_muestras: [["user_id", "inicio", "tipo"]] },
  });
}

async function conToken(falso) {
  const r = await llamar(falso, "POST tokens", { token: SESION_A, cuerpo: { nombre: "iPhone" } });
  assert.equal(r.estado, 201);
  return r.cuerpo.datos.token;
}

const sinMontos = (r) => assert.ok(!/\$\s?\d/.test(JSON.stringify(r.cuerpo.mensaje)), r.cuerpo.mensaje);

test("sin token → 401 en las tres rutas", async () => {
  const falso = base();
  for (const ruta of ["POST sueno/evento", "POST sueno/sync", "GET sueno/resumen"]) {
    const r = await llamar(falso, ruta, { cuerpo: { tipo: "acostarse" } });
    assert.equal(r.estado, 401, ruta);
    assert.equal(r.cuerpo.codigo, "SIN_TOKEN");
  }
  assert.equal(falso.tablas.sueno_eventos, undefined, "no guardó nada");
});

test("🌙 Me acuesto y ☀️ Desperté: buenas noches, buenos días con la duración y aviso en el centro", async () => {
  const falso = base();
  const token = await conToken(falso);
  const noche = await llamar(falso, "POST sueno/evento", {
    token,
    cuerpo: { tipo: "acostarse", fuente: "hora_dormir", momento: m(D, "23:40") },
    ahora: new Date(m(D, "23:41")),
  });
  assert.equal(noche.estado, 201);
  assert.equal(noche.cuerpo.mensaje, "🌙 Buenas noches");
  assert.equal(noche.cuerpo.datos.aviso, "🌙 Buenas noches");

  const manana = await llamar(falso, "POST sueno/evento", {
    token,
    cuerpo: { tipo: "despertar", fuente: "alarma", momento: m(D1, "06:05") },
    ahora: new Date(m(D1, "06:06")),
  });
  assert.equal(manana.estado, 201);
  assert.equal(manana.cuerpo.mensaje, "☀️ Buenos días · 6 h 25");
  assert.equal(manana.cuerpo.datos.aviso, "☀️ Buenos días · 6 h 25");
  assert.equal(manana.cuerpo.datos.noche.fecha, D);
  assert.equal(manana.cuerpo.datos.noche.duracionMin, 385);
  sinMontos(manana);

  const [evento] = falso.tablas.sueno_eventos;
  assert.equal(evento.user_id, A);
  assert.equal(evento.origen, "atajo");
  assert.ok(evento.id_cliente, "la API genera id_cliente");
  const [aviso] = falso.tablas.notificaciones;
  assert.equal(aviso.modulo, "sueno");
  assert.equal(aviso.titulo, "Dormiste 6 h 25");
  assert.equal(aviso.clave, `sueno:${D}`);
  assert.equal(aviso.url, "sueno.html");
});

test("dos automatizaciones a la vez (alarma + Despertar): se guardan ambas pero solo se avisa una vez", async () => {
  const falso = base({ sueno_eventos: [{ user_id: A, tipo: "acostarse", fuente: "cargador", momento: new Date(m(D, "23:00")).toISOString() }] });
  const token = await conToken(falso);
  const ahora = new Date(m(D1, "06:01"));
  const uno = await llamar(falso, "POST sueno/evento", { token, cuerpo: { tipo: "despertar", fuente: "alarma", momento: m(D1, "06:00") }, ahora });
  const dos = await llamar(falso, "POST sueno/evento", { token, cuerpo: { tipo: "despertar", fuente: "Despertar", momento: m(D1, "06:01") }, ahora });
  assert.equal(uno.cuerpo.datos.aviso, "☀️ Buenos días · 7 h");
  assert.equal(dos.cuerpo.datos.aviso, "");
  assert.equal(dos.cuerpo.mensaje, "☀️ Buenos días · 7 h");
  assert.equal(falso.tablas.sueno_eventos.length, 3);
  assert.equal(falso.tablas.notificaciones.length, 1);
});

test("el atajo reintenta sin id_cliente en menos de 60 s: no duplica", async () => {
  const falso = base();
  const token = await conToken(falso);
  const cuerpo = { tipo: "acostarse", fuente: "modo_sueno" };
  const primero = await llamar(falso, "POST sueno/evento", { token, cuerpo, ahora: new Date() });
  const segundo = await llamar(falso, "POST sueno/evento", { token, cuerpo, ahora: new Date() });
  assert.equal(primero.estado, 201);
  assert.equal(segundo.estado, 200);
  assert.equal(segundo.cuerpo.datos.guardado, false);
  assert.equal(segundo.cuerpo.datos.aviso, "");
  assert.equal(falso.tablas.sueno_eventos.length, 1);
  // Con id_cliente repetido tampoco.
  const id = "33333333-3333-4333-8333-333333333333";
  await llamar(falso, "POST sueno/evento", { token, cuerpo: { tipo: "despertar", fuente: "alarma", id_cliente: id } });
  await llamar(falso, "POST sueno/evento", { token, cuerpo: { tipo: "despertar", fuente: "alarma", id_cliente: id } });
  assert.equal(falso.tablas.sueno_eventos.length, 2);
});

test("el cargador de día no cuenta como 'me acuesto' y no avisa", async () => {
  const falso = base();
  const token = await conToken(falso);
  const r = await llamar(falso, "POST sueno/evento", {
    token,
    cuerpo: { tipo: "acostarse", fuente: "cargador" },
    ahora: new Date(m(D, "15:20")),
  });
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.datos.guardado, false);
  assert.equal(r.cuerpo.datos.aviso, "");
  assert.equal((falso.tablas.sueno_eventos ?? []).length, 0);
  const deNoche = await llamar(falso, "POST sueno/evento", {
    token,
    cuerpo: { tipo: "acostarse", fuente: "cargador" },
    ahora: new Date(m(D, "22:20")),
  });
  assert.equal(deNoche.cuerpo.datos.guardado, true);
});

test("fuente vacía = manual (atajo tocado a mano); tipo, fuente o fecha raros → 400 con mensaje humano", async () => {
  const falso = base();
  const token = await conToken(falso);
  const manual = await llamar(falso, "POST sueno/evento", { token, cuerpo: { tipo: "Acostarse", fuente: "" }, ahora: new Date(m(D, "23:00")) });
  assert.equal(manual.estado, 201);
  assert.equal(falso.tablas.sueno_eventos[0].fuente, "manual");
  const sueno = await llamar(falso, "POST sueno/evento", { token, cuerpo: { tipo: "acostarse", fuente: "Modo sueño" }, ahora: new Date(m(D, "23:05")) });
  assert.equal(sueno.estado, 201);
  assert.equal(falso.tablas.sueno_eventos[1].fuente, "modo_sueno");

  for (const cuerpo of [
    { tipo: "siesta" },
    { tipo: "acostarse", fuente: "reloj" },
    { tipo: "acostarse", momento: "ayer en la noche" },
    { tipo: "acostarse", momento: "2026-09-01T23:00:00-05:00" },
    { tipo: "despertar", momento: "2026-10-04T06:00:00-05:00" },
  ]) {
    const r = await llamar(falso, "POST sueno/evento", { token, cuerpo, ahora: new Date(m(D1, "08:00")) });
    assert.equal(r.estado, 400, JSON.stringify(cuerpo));
    assert.match(r.cuerpo.mensaje, /^⚠️ Revisa/);
  }
});

test("sync: lo que manda 'Buscar muestras de salud' se guarda una vez aunque se repita", async () => {
  const falso = base();
  const token = await conToken(falso);
  const texto = [
    "2026-10-02T23:45:00-05:00;2026-10-03T06:10:00-05:00;En cama",
    "3 oct 2026, 6:30 a. m.;3 oct 2026, 6:50 a. m.;En cama",
  ].join("\n");
  const primero = await llamar(falso, "POST sueno/sync", { token, cuerpo: { muestras: texto } });
  assert.equal(primero.estado, 200);
  assert.equal(primero.cuerpo.mensaje, "🛏️ Salud sincronizada");
  assert.deepEqual(primero.cuerpo.datos, { guardadas: 2, nuevas: 2, omitidas: 0 });
  const segundo = await llamar(falso, "POST sueno/sync", { token, cuerpo: { muestras: texto } });
  assert.equal(segundo.cuerpo.datos.nuevas, 0);
  assert.equal(falso.tablas.sueno_muestras.length, 2);
  assert.ok(falso.tablas.sueno_muestras.every((x) => x.user_id === A && x.fuente === "salud"));

  // Lista de diccionarios con las claves de Atajos.
  const dicts = await llamar(falso, "POST sueno/sync", {
    token,
    cuerpo: { muestras: [{ "Fecha de inicio": "2026-10-03T23:10:00-05:00", "Fecha de finalización": "2026-10-04T05:50:00-05:00", Valor: "En cama" }] },
  });
  assert.equal(dicts.cuerpo.datos.nuevas, 1);

  const vacio = await llamar(falso, "POST sueno/sync", { token, cuerpo: { muestras: "" } });
  assert.equal(vacio.cuerpo.mensaje, "🛏️ Nada nuevo de Salud");
  const malo = await llamar(falso, "POST sueno/sync", { token, cuerpo: { muestras: "esto no es una fecha;tampoco" } });
  assert.equal(malo.estado, 400);
});

test("☀️ Desperté con las muestras en la misma llamada: la noche usa 'En cama'", async () => {
  const falso = base();
  const token = await conToken(falso);
  const r = await llamar(falso, "POST sueno/evento", {
    token,
    cuerpo: {
      tipo: "despertar",
      fuente: "despertar",
      momento: m(D1, "06:20"),
      muestras: "2026-10-02T23:50:00-05:00;2026-10-03T06:15:00-05:00;En cama",
    },
    ahora: new Date(m(D1, "06:21")),
  });
  assert.equal(r.estado, 201);
  assert.equal(r.cuerpo.mensaje, "☀️ Buenos días · 6 h 30");
  assert.deepEqual(r.cuerpo.datos.muestras, { nuevas: 1, omitidas: 0 });
  assert.equal(r.cuerpo.datos.noche.fuente, "salud");
});

test("resumen: última noche, índice y semana; sin datos lo dice", async () => {
  const falso = base();
  const token = await conToken(falso);
  const ahora = new Date(m(D1, "09:00"));
  const vacio = await llamar(falso, "GET sueno/resumen", { token, ahora });
  assert.equal(vacio.estado, 200);
  assert.equal(vacio.cuerpo.mensaje, "🌙 Sin noches todavía");
  assert.equal(vacio.cuerpo.datos.semana.length, 7);

  await llamar(falso, "POST sueno/evento", { token, cuerpo: { tipo: "acostarse", fuente: "cargador", momento: m(D, "23:00") }, ahora });
  await llamar(falso, "POST sueno/evento", { token, cuerpo: { tipo: "despertar", fuente: "alarma", momento: m(D1, "06:30") }, ahora });
  const r = await llamar(falso, "GET sueno/resumen", { token, ahora });
  assert.match(r.cuerpo.mensaje, /^🌙 Anoche 7 h 30 · índice \d+$/);
  assert.equal(r.cuerpo.datos.ultimaNoche.duracionMin, 450);
  assert.equal(r.cuerpo.datos.semana.at(-1).fecha, D);
  sinMontos(r);
});

test("las consultas de sueño siempre van filtradas por el usuario", async () => {
  const falso = base();
  const token = await conToken(falso);
  falso.llamadas.length = 0;
  await llamar(falso, "GET sueno/resumen", { token });
  await llamar(falso, "POST sueno/evento", { token, cuerpo: { tipo: "despertar", fuente: "alarma", muestras: [] } });
  const deSueno = falso.llamadas.filter((l) => l.ruta.includes("/rest/v1/sueno_") && l.metodo === "GET");
  assert.ok(deSueno.length >= 3);
  for (const l of deSueno) assert.match(l.ruta, new RegExp(`user_id=eq.${A}`));
});
