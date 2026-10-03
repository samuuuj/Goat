// /api/v1 de Rutina con el Supabase simulado: token primero, fechas ISO con zona de Bogotá,
// un chequeo por bloque y fecha (upsert), cierre del día con las notas de Recordatorios y tareas de la U.

import { test } from "node:test";
import assert from "node:assert/strict";
import { crearSupabaseFalso, jwtFalso, llamar } from "./ayuda/supabase-falso.mjs";
import { plantillaSamuel } from "./ayuda/rutina.mjs";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const SESION_A = jwtFalso("a");
const BLOQUE_DE_B = "99999999-9999-4999-8999-999999999999";
const a = (fecha, hora) => new Date(`${fecha}T${hora}:00-05:00`);
const MARTES = "2026-10-06";

function base() {
  const ajeno = { ...plantillaSamuel(B)[1], id: BLOQUE_DE_B, user_id: B };
  return crearSupabaseFalso({
    datos: {
      perfil: [{ user_id: A, metas: {} }],
      api_tokens: [],
      rutina_bloques: [...plantillaSamuel(A), ajeno],
      rutina_checks: [],
      uni_tareas: [],
      festivos: [{ fecha: "2026-10-12", nombre: "Día de la Raza" }],
    },
    sesiones: { [SESION_A]: A },
    unicas: { rutina_checks: [["bloque_id", "fecha"]] },
  });
}

async function conToken(falso) {
  const r = await llamar(falso, "POST tokens", { token: SESION_A, cuerpo: { nombre: "iPhone" } });
  assert.equal(r.estado, 201);
  return r.cuerpo.datos.token;
}

/** Mensaje apto para el iPhone: corto, con emoji, sin montos. */
function mensajeCorto(r) {
  assert.ok(r.cuerpo.mensaje.length <= 60, r.cuerpo.mensaje);
  assert.ok(!/\$\s?\d/.test(r.cuerpo.mensaje), r.cuerpo.mensaje);
}

const idDe = (falso, titulo, n = 0) => falso.tablas.rutina_bloques.filter((b) => b.titulo === titulo && b.user_id === A)[n].id;

test("sin token no hay rutina (401) y el token se revisa antes de todo", async () => {
  const falso = base();
  for (const ruta of ["GET rutina/hoy", "GET rutina/ahora", "POST rutina/check", "POST rutina/checks", "GET uni/tareas", "POST uni/tareas"]) {
    const r = await llamar(falso, ruta);
    assert.equal(r.estado, 401, ruta);
    assert.equal(r.cuerpo.codigo, "SIN_TOKEN");
  }
  assert.ok(!falso.llamadas.some((l) => l.ruta.includes("rutina_")), "consultó datos sin token");
});

test("GET rutina/hoy: bloques del martes con ISO 8601 y zona de Bogotá, alertas y notas para Recordatorios", async () => {
  const falso = base();
  const token = await conToken(falso);
  const r = await llamar(falso, "GET rutina/hoy", { token, ahora: a(MARTES, "05:50") });
  assert.equal(r.estado, 200);
  mensajeCorto(r);
  const { fecha, tipo_dia, bloques, recordatorios, cumplimiento } = r.cuerpo.datos;
  assert.equal(fecha, MARTES);
  assert.equal(tipo_dia, "habil");
  assert.equal(bloques[0].inicio, "2026-10-06T06:00:00-05:00");
  assert.equal(bloques[0].fin, "2026-10-06T06:10:00-05:00");
  const calculo = bloques.find((b) => b.titulo === "Cálculo");
  assert.equal(calculo.inicio, "2026-10-06T09:00:00-05:00");
  assert.equal(calculo.alerta, "2026-10-06T08:45:00-05:00", "aviso de 15 min para llegar");
  assert.match(calculo.notas, /📍 Bloque 5/);
  assert.match(calculo.notas, new RegExp(`goat:${calculo.id}`));
  assert.equal(calculo.recordatorio, "🏫 Cálculo · 09:00–12:00");
  const caminar = bloques.find((b) => b.titulo === "Caminar");
  assert.equal(caminar.obligatorio, true);
  assert.equal(caminar.duracion_min, 45);
  // Las pausas no generan recordatorio; todo lo demás sí.
  assert.ok(!recordatorios.some((b) => b.tipo === "descanso"));
  assert.equal(recordatorios.length, bloques.filter((b) => b.tipo !== "descanso").length);
  assert.equal(cumplimiento.obligatorios.total, 3);
  for (const b of bloques) assert.match(b.inicio, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00-05:00$/);
});

test("GET rutina/hoy: la clase virtual trae su enlace; el festivo usa la plantilla del domingo", async () => {
  const falso = base();
  const token = await conToken(falso);
  const lunes = await llamar(falso, "GET rutina/hoy", { token, ahora: a("2026-10-05", "06:00") });
  const ingles = lunes.cuerpo.datos.bloques.find((b) => b.tipo === "clase_virtual");
  assert.equal(ingles.enlace, "https://meet.google.com/abc-defg-hij");
  assert.match(ingles.notas, /https:\/\/meet\.google\.com/);
  assert.equal(ingles.alerta, "2026-10-05T13:55:00-05:00");

  const festivo = await llamar(falso, "GET rutina/hoy", { token, ahora: a("2026-10-12", "06:00") });
  assert.equal(festivo.cuerpo.datos.tipo_dia, "festivo");
  assert.equal(festivo.cuerpo.datos.festivo, "Día de la Raza");
  assert.equal(festivo.cuerpo.datos.bloques[0].inicio, "2026-10-12T07:00:00-05:00");
  assert.ok(!festivo.cuerpo.datos.bloques.some((b) => b.tipo === "clase_virtual" || b.tipo === "trabajo"));
});

test("GET rutina/ahora: bloque en curso con lo que queda y el siguiente", async () => {
  const falso = base();
  const token = await conToken(falso);
  const r = await llamar(falso, "GET rutina/ahora", { token, ahora: a(MARTES, "06:30") });
  assert.equal(r.cuerpo.mensaje, "🚶 Caminar · 25 min");
  assert.equal(r.cuerpo.datos.actual.titulo, "Caminar");
  assert.equal(r.cuerpo.datos.actual.quedan_min, 25);
  assert.equal(r.cuerpo.datos.siguiente.titulo, "Preparar desayuno");
  const noche = await llamar(falso, "GET rutina/ahora", { token, ahora: a(MARTES, "23:30") });
  assert.equal(noche.cuerpo.mensaje, "🌙 Nada más por hoy");
  assert.equal(noche.cuerpo.datos.actual, null);
});

test("POST rutina/check 'actual': marca lo que acabas de terminar; marcar de nuevo actualiza (único por bloque y fecha)", async () => {
  const falso = base();
  const token = await conToken(falso);
  const r = await llamar(falso, "POST rutina/check", { token, cuerpo: { bloque_id: "actual", estado: "hecho" }, ahora: a(MARTES, "06:57") });
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.mensaje, "✅ Hecho · Caminar");
  mensajeCorto(r);
  assert.equal(falso.tablas.rutina_checks.length, 1);
  const [check] = falso.tablas.rutina_checks;
  assert.deepEqual([check.bloque_id, check.fecha, check.estado, check.user_id, check.origen], [idDe(falso, "Caminar"), MARTES, "hecho", A, "atajo"]);

  // Sin bloque_id = "actual"; el mismo bloque otra vez → se actualiza, no se duplica.
  const otra = await llamar(falso, "POST rutina/check", {
    token,
    cuerpo: { bloque_id: idDe(falso, "Caminar"), estado: "saltado" },
    ahora: a(MARTES, "07:00"),
  });
  assert.equal(otra.cuerpo.mensaje, "⤼ Saltado · Caminar");
  assert.equal(falso.tablas.rutina_checks.length, 1);
  assert.equal(falso.tablas.rutina_checks[0].estado, "saltado");

  // GET rutina/hoy ya lo ve marcado.
  const hoy = await llamar(falso, "GET rutina/hoy", { token, ahora: a(MARTES, "07:05") });
  assert.equal(hoy.cuerpo.datos.bloques.find((b) => b.id === idDe(falso, "Caminar")).estado, "saltado");
});

test("POST rutina/check: nada que marcar, bloque ajeno, pausa, fecha futura o estado raro → error claro", async () => {
  const falso = base();
  const token = await conToken(falso);
  const temprano = await llamar(falso, "POST rutina/check", { token, cuerpo: {}, ahora: a(MARTES, "05:00") });
  assert.equal(temprano.estado, 404);
  assert.equal(temprano.cuerpo.mensaje, "🤷 Nada que marcar ahora");
  const ajeno = await llamar(falso, "POST rutina/check", { token, cuerpo: { bloque_id: BLOQUE_DE_B }, ahora: a(MARTES, "07:00") });
  assert.equal(ajeno.estado, 404);
  const pausa = falso.tablas.rutina_bloques.find((b) => b.tipo === "descanso").id;
  assert.equal((await llamar(falso, "POST rutina/check", { token, cuerpo: { bloque_id: pausa }, ahora: a("2026-10-05", "09:00") })).estado, 400);
  const futuro = await llamar(falso, "POST rutina/check", { token, cuerpo: { bloque_id: "actual", fecha: "2026-10-07" }, ahora: a(MARTES, "07:00") });
  assert.equal(futuro.estado, 400);
  const raro = await llamar(falso, "POST rutina/check", { token, cuerpo: { estado: "quizas" }, ahora: a(MARTES, "07:00") });
  assert.equal(raro.estado, 400);
  assert.equal(falso.tablas.rutina_checks.length, 0);
});

test("POST rutina/checks (cierre del día): toma los ids de las notas, ignora lo ajeno y avisa lo que falta confirmar", async () => {
  const falso = base();
  const token = await conToken(falso);
  const caminar = idDe(falso, "Caminar");
  const desayuno = idDe(falso, "Desayunar");
  const notas = [`🚶 Caminar\ngoat:${caminar}`, `goat:${desayuno}`, `goat:${BLOQUE_DE_B}`, "goat:12345678-1234-4234-8234-123456789012"].join("\n");
  const r = await llamar(falso, "POST rutina/checks", {
    token,
    cuerpo: { hechos: notas, items: [{ bloque_id: idDe(falso, "Estudiar"), estado: "saltado" }] },
    ahora: a(MARTES, "21:45"),
  });
  assert.equal(r.estado, 200);
  mensajeCorto(r);
  assert.equal(r.cuerpo.datos.marcados, 3);
  assert.equal(r.cuerpo.datos.ignorados, 2);
  assert.deepEqual(r.cuerpo.datos.por_confirmar, ["🏋️ Ejercicio", "🚶 Caminar"]);
  assert.equal(r.cuerpo.mensaje, "✅ 3 marcados · 2 por confirmar");
  const estados = Object.fromEntries(falso.tablas.rutina_checks.map((c) => [c.bloque_id, c.estado]));
  assert.deepEqual(estados, { [caminar]: "hecho", [desayuno]: "hecho", [idDe(falso, "Estudiar")]: "saltado" });
  assert.ok(falso.tablas.rutina_checks.every((c) => c.user_id === A && c.fecha === MARTES));

  // Correrlo otra vez no duplica nada.
  await llamar(falso, "POST rutina/checks", { token, cuerpo: { hechos: notas }, ahora: a(MARTES, "21:50") });
  assert.equal(falso.tablas.rutina_checks.length, 3);

  // Sin nada completado: no es error.
  const vacio = await llamar(falso, "POST rutina/checks", { token, cuerpo: { hechos: "" }, ahora: a(MARTES, "21:55") });
  assert.equal(vacio.estado, 200);
  assert.match(vacio.cuerpo.mensaje, /^🤷 Nada nuevo que marcar/);
});

test("tareas de la U: crear (sin duplicar reintentos), listar por fecha límite y marcar hecha", async () => {
  const falso = base();
  const token = await conToken(falso);
  const nueva = await llamar(falso, "POST uni/tareas", {
    token,
    cuerpo: { titulo: "Taller 3", materia: "Cálculo", para: "manana", primer_paso: "Abrir el PDF y leer el punto 1" },
  });
  assert.equal(nueva.estado, 201);
  assert.equal(nueva.cuerpo.mensaje, "📚 Tarea guardada");
  assert.match(nueva.cuerpo.datos.fecha_limite, /T23:59:00-05:00$/);
  await llamar(falso, "POST uni/tareas", { token, cuerpo: { titulo: "Taller 3", para: "manana" } });
  assert.equal(falso.tablas.uni_tareas.length, 1, "un reintento del atajo duplicó la tarea");
  falso.tablas.uni_tareas.push({
    id: "33333333-3333-4333-8333-333333333333",
    user_id: A,
    titulo: "Informe atrasado",
    estado: "pendiente",
    prioridad: 2,
    fecha_limite: "2020-01-01T23:59:00-05:00",
  });
  falso.tablas.uni_tareas.push({ id: "44444444-4444-4444-8444-444444444444", user_id: B, titulo: "De otro", estado: "pendiente", prioridad: 1, fecha_limite: null });

  const lista = await llamar(falso, "GET uni/tareas", { token });
  assert.equal(lista.cuerpo.mensaje, "📚 2 pendientes · 1 vencida");
  assert.deepEqual(lista.cuerpo.datos.tareas.map((t) => t.titulo), ["Informe atrasado", "Taller 3"]);
  assert.equal(lista.cuerpo.datos.tareas[1].primer_paso, "Abrir el PDF y leer el punto 1");
  assert.match(lista.cuerpo.datos.tareas[0].texto, /^⚠️ Informe atrasado · Vencida/);

  const hecha = await llamar(falso, "POST uni/tareas/hecha", { token, cuerpo: { id: "33333333-3333-4333-8333-333333333333" } });
  assert.equal(hecha.cuerpo.mensaje, "✅ Tarea hecha");
  assert.ok(falso.tablas.uni_tareas.find((t) => t.titulo === "Informe atrasado").hecha_en);
  assert.equal((await llamar(falso, "GET uni/tareas", { token })).cuerpo.datos.total, 1);
  // La tarea de otra cuenta no se puede tocar.
  const ajena = await llamar(falso, "POST uni/tareas/hecha", { token, cuerpo: { id: "44444444-4444-4444-8444-444444444444" } });
  assert.equal(ajena.estado, 404);
  assert.equal((await llamar(falso, "POST uni/tareas", { token, cuerpo: { titulo: "" } })).estado, 400);
  assert.equal((await llamar(falso, "POST uni/tareas", { token, cuerpo: { titulo: "x", para: "ayer" } })).estado, 400);
});

test("las consultas de rutina y tareas siempre van filtradas por el usuario", async () => {
  const falso = base();
  const token = await conToken(falso);
  falso.llamadas.length = 0;
  await llamar(falso, "GET rutina/hoy", { token, ahora: a(MARTES, "10:00") });
  await llamar(falso, "POST rutina/check", { token, cuerpo: {}, ahora: a(MARTES, "10:00") });
  await llamar(falso, "GET uni/tareas", { token });
  const deDatos = falso.llamadas.filter((l) => /\/rest\/v1\/(rutina_|uni_)/.test(l.ruta));
  assert.ok(deDatos.length >= 5);
  for (const l of deDatos) if (l.metodo === "GET") assert.match(l.ruta, new RegExp(`user_id=eq.${A}`));
  for (const l of deDatos.filter((x) => x.metodo === "POST")) assert.match(l.ruta, /on_conflict=bloque_id%2Cfecha/);
});
