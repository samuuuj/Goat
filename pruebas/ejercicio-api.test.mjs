// /api/v1/ejercicio/*: empezar y terminar con el atajo, registrar un entreno hecho, actividad de Salud (upsert)
// y la semana. Supabase simulado en memoria (nunca toca la base real).

import { test } from "node:test";
import assert from "node:assert/strict";
import { crearSupabaseFalso, jwtFalso, llamar } from "./ayuda/supabase-falso.mjs";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const SESION_A = jwtFalso("a");
const bogota = (texto) => new Date(`${texto}-05:00`);
const sinMontos = (r) => assert.ok(!/\$/.test(r.cuerpo.mensaje), `mensaje con monto: ${r.cuerpo.mensaje}`);

function base(extra = {}) {
  return crearSupabaseFalso({
    datos: {
      perfil: [{ user_id: A, metas: { gym_semana: 3 } }],
      api_tokens: [],
      gym_sesiones: [],
      ejercicio_actividad: [],
      notificaciones: [],
      ...extra,
    },
    sesiones: { [SESION_A]: A },
    unicas: { ejercicio_actividad: [["user_id", "fecha"]] },
  });
}

async function conToken(falso) {
  const r = await llamar(falso, "POST tokens", { token: SESION_A, cuerpo: { nombre: "iPhone" } });
  assert.equal(r.estado, 201);
  return r.cuerpo.datos.token;
}

test("sin token no se entra a ninguna ruta de ejercicio", async () => {
  const falso = base();
  for (const ruta of ["GET ejercicio/menu", "POST ejercicio/inicio", "POST ejercicio/fin", "POST ejercicio/sesion", "POST ejercicio/actividad", "GET ejercicio/semana"]) {
    const r = await llamar(falso, ruta, { cuerpo: { tipo: "fuerza" } });
    assert.equal(r.estado, 401, ruta);
  }
  assert.equal(falso.tablas.gym_sesiones.length, 0);
});

test("atajo 🏋️ Entreno: empezar → (no duplica) → terminar → 55 min", async () => {
  const falso = base();
  const token = await conToken(falso);
  const t0 = bogota("2026-10-02T07:10:00");

  const menu = await llamar(falso, "GET ejercicio/menu", { token, ahora: t0 });
  assert.equal(menu.cuerpo.datos.en_curso, false);
  assert.ok(menu.cuerpo.datos.tipos.includes("🏋️ Fuerza"));

  const inicio = await llamar(falso, "POST ejercicio/inicio", { token, cuerpo: { tipo: "🏋️ Fuerza", rutina: "Empuje" }, ahora: t0 });
  assert.equal(inicio.estado, 201);
  assert.equal(inicio.cuerpo.mensaje, "🏋️ A darle");
  const [fila] = falso.tablas.gym_sesiones;
  assert.equal(fila.user_id, A);
  assert.equal(fila.tipo, "fuerza");
  assert.equal(fila.rutina, "empuje");
  assert.equal(fila.en_curso, true);
  assert.equal(fila.inicio, t0.toISOString());
  assert.equal(fila.momento, fila.inicio);
  assert.equal(fila.origen, "atajo");
  assert.ok(fila.id_cliente);

  // Tocar "Empezar" otra vez no crea otra sesión.
  const otra = await llamar(falso, "POST ejercicio/inicio", { token, cuerpo: { tipo: "trote" }, ahora: bogota("2026-10-02T07:20:00") });
  assert.equal(otra.estado, 200);
  assert.equal(otra.cuerpo.datos.ya_estaba, true);
  assert.match(otra.cuerpo.mensaje, /Fuerza en curso · 10:00/);
  assert.equal(falso.tablas.gym_sesiones.length, 1);
  assert.equal((await llamar(falso, "GET ejercicio/menu", { token, ahora: bogota("2026-10-02T07:20:00") })).cuerpo.datos.en_curso, true);

  const fin = await llamar(falso, "POST ejercicio/fin", { token, cuerpo: {}, ahora: bogota("2026-10-02T08:05:00") });
  assert.equal(fin.estado, 200);
  assert.equal(fin.cuerpo.mensaje, "✅ 55 min");
  sinMontos(fin);
  assert.equal(falso.tablas.gym_sesiones[0].en_curso, false);
  assert.equal(falso.tablas.gym_sesiones[0].duracion_min, 55);
  assert.equal(fin.cuerpo.datos.semana.entrenos, 1);

  // Reintento del atajo al minuto: responde lo mismo. Mucho después: no hay nada en curso.
  const repetido = await llamar(falso, "POST ejercicio/fin", { token, cuerpo: {}, ahora: bogota("2026-10-02T08:06:00") });
  assert.equal(repetido.cuerpo.mensaje, "✅ 55 min");
  assert.equal(repetido.cuerpo.datos.ya_estaba, true);
  const tarde = await llamar(falso, "POST ejercicio/fin", { token, cuerpo: {}, ahora: bogota("2026-10-02T09:00:00") });
  assert.equal(tarde.estado, 404);
  assert.equal(tarde.cuerpo.codigo, "SIN_ENTRENO");
});

test("trote con distancia al terminar; olvidado más de 6 h queda sin fin y no bloquea el siguiente", async () => {
  const falso = base();
  const token = await conToken(falso);
  await llamar(falso, "POST ejercicio/inicio", { token, cuerpo: { tipo: "trote" }, ahora: bogota("2026-10-02T06:00:00") });
  const fin = await llamar(falso, "POST ejercicio/fin", { token, cuerpo: { distancia_km: "5,2" }, ahora: bogota("2026-10-02T06:32:00") });
  assert.equal(fin.cuerpo.mensaje, "✅ 32 min · 5,2 km");
  assert.equal(falso.tablas.gym_sesiones[0].distancia_km, 5.2);

  await llamar(falso, "POST ejercicio/inicio", { token, cuerpo: { tipo: "fuerza" }, ahora: bogota("2026-10-02T17:00:00") });
  const olvido = await llamar(falso, "POST ejercicio/fin", { token, cuerpo: {}, ahora: bogota("2026-10-03T00:30:00") });
  assert.match(olvido.cuerpo.mensaje, /6 h/);
  const olvidada = falso.tablas.gym_sesiones[1];
  assert.equal(olvidada.en_curso, false);
  assert.equal(olvidada.fin, null);

  // Otra olvidada: al empezar uno nuevo, la vieja se cierra sola (sin inventar la hora de fin).
  await llamar(falso, "POST ejercicio/inicio", { token, cuerpo: { tipo: "cardio" }, ahora: bogota("2026-10-03T06:00:00") });
  const nuevo = await llamar(falso, "POST ejercicio/inicio", { token, cuerpo: { tipo: "caminata" }, ahora: bogota("2026-10-03T13:00:00") });
  assert.equal(nuevo.estado, 201);
  const abiertas = falso.tablas.gym_sesiones.filter((s) => s.en_curso);
  assert.equal(abiertas.length, 1);
  assert.equal(abiertas[0].tipo, "caminata");
});

test("POST ejercicio/sesion: entreno ya hecho con inicio y fin (o duración), sin duplicar reintentos", async () => {
  const falso = base();
  const token = await conToken(falso);
  const ahora = new Date();
  const inicio = new Date(ahora.getTime() - 3 * 3_600_000);
  const fin = new Date(inicio.getTime() + 45 * 60_000);
  const cuerpo = { tipo: "caminata", inicio: inicio.toISOString(), fin: fin.toISOString(), distancia_km: 4.1 };

  const r = await llamar(falso, "POST ejercicio/sesion", { token, cuerpo });
  assert.equal(r.estado, 201);
  assert.equal(r.cuerpo.mensaje, "🚶 Caminata · 45 min");
  sinMontos(r);
  const [fila] = falso.tablas.gym_sesiones;
  assert.equal(fila.duracion_min, 45);
  assert.equal(fila.rutina, null);
  assert.equal(fila.momento, fila.inicio);
  assert.equal(fila.en_curso, false);

  // El atajo reintentó sin id_cliente: no duplica.
  assert.equal((await llamar(falso, "POST ejercicio/sesion", { token, cuerpo })).estado, 201);
  assert.equal(falso.tablas.gym_sesiones.length, 1);

  // Con duración en vez de fin.
  const conDuracion = await llamar(falso, "POST ejercicio/sesion", {
    token,
    cuerpo: { tipo: "fuerza", rutina: "pierna", inicio: new Date(ahora.getTime() - 2 * 3_600_000).toISOString(), duracion_min: "60" },
  });
  assert.equal(conDuracion.cuerpo.mensaje, "🏋️ Fuerza · 1h 00");
  assert.equal(falso.tablas.gym_sesiones[1].rutina, "pierna");
});

test("POST ejercicio/sesion: datos malos → 400 con mensaje humano", async () => {
  const falso = base();
  const token = await conToken(falso);
  const casos = [
    [{ tipo: "fuerza", inicio: "2026-10-02T08:00:00-05:00", fin: "2026-10-02T07:00:00-05:00" }, /antes/],
    [{ tipo: "natacion", inicio: "2026-10-02T07:00:00-05:00", fin: "2026-10-02T08:00:00-05:00" }, /tipo/],
    [{ tipo: "fuerza", inicio: "ayer temprano", fin: "2026-10-02T08:00:00-05:00" }, /Revisa/],
    [{ tipo: "fuerza", inicio: "2026-10-02T07:00:00-05:00" }, /fin/],
    [{ tipo: "fuerza", inicio: "2026-10-02T06:00:00-05:00", fin: "2026-10-02T13:00:00-05:00" }, /6 horas/],
  ];
  for (const [cuerpo, mensaje] of casos) {
    const r = await llamar(falso, "POST ejercicio/sesion", { token, cuerpo, ahora: bogota("2026-10-03T12:00:00") });
    assert.equal(r.estado, 400, JSON.stringify(cuerpo));
    assert.equal(r.cuerpo.codigo, "DATO_INVALIDO");
    assert.match(r.cuerpo.mensaje, mensaje);
  }
  assert.equal(falso.tablas.gym_sesiones.length, 0);
});

test("POST ejercicio/actividad: una fila por fecha (upsert), números del iPhone y fecha de calendario", async () => {
  const falso = base();
  const token = await conToken(falso);
  const noche = bogota("2026-10-02T21:30:00");

  const primero = await llamar(falso, "POST ejercicio/actividad", { token, cuerpo: { pasos: 6120.0, distancia_km: 4.3333 }, ahora: noche });
  assert.equal(primero.estado, 200);
  assert.equal(primero.cuerpo.mensaje, "📈 6.120 pasos");
  const segundo = await llamar(falso, "POST ejercicio/actividad", {
    token,
    cuerpo: { fecha: "2026-10-02", pasos: "8.432", distancia_km: "6,05", energia_kcal: "310,4" },
    ahora: noche,
  });
  assert.equal(segundo.cuerpo.mensaje, "📈 8.432 pasos");
  assert.equal(falso.tablas.ejercicio_actividad.length, 1);
  const [fila] = falso.tablas.ejercicio_actividad;
  assert.deepEqual(
    { user_id: fila.user_id, fecha: fila.fecha, pasos: fila.pasos, km: fila.distancia_km, kcal: fila.energia_kcal, fuente: fila.fuente },
    { user_id: A, fecha: "2026-10-02", pasos: 8432, km: 6.05, kcal: 310, fuente: "salud" },
  );

  // Fecha con hora ISO 8601 (lo que da "Formatear fecha" en Atajos) y la madrugada usa el calendario (como Salud).
  await llamar(falso, "POST ejercicio/actividad", { token, cuerpo: { fecha: "2026-10-03T00:20:00-05:00", pasos: 300 }, ahora: bogota("2026-10-03T00:25:00") });
  assert.equal(falso.tablas.ejercicio_actividad.length, 2);
  assert.equal(falso.tablas.ejercicio_actividad[1].fecha, "2026-10-03");

  for (const cuerpo of [{}, { pasos: -3 }, { pasos: "muchos" }, { pasos: 10, fecha: "2026-12-24" }]) {
    const r = await llamar(falso, "POST ejercicio/actividad", { token, cuerpo, ahora: noche });
    assert.equal(r.estado, 400, JSON.stringify(cuerpo));
  }
});

test("GET ejercicio/semana: entrenos contra la meta del perfil, pasos y en curso; meta cumplida avisa una vez", async () => {
  const falso = base({
    gym_sesiones: [
      // Otra cuenta: no cuenta.
      { user_id: B, tipo: "fuerza", inicio: "2026-09-29T22:00:00.000Z", fin: "2026-09-29T23:00:00.000Z", fecha: "2026-09-29", momento: "2026-09-29T22:00:00.000Z", en_curso: false },
    ],
  });
  const token = await conToken(falso);
  const sesion = (tipo, dia, desde, hasta) =>
    llamar(falso, "POST ejercicio/sesion", {
      token,
      cuerpo: { tipo, inicio: `${dia}T${desde}:00-05:00`, fin: `${dia}T${hasta}:00-05:00` },
      ahora: bogota("2026-10-02T20:00:00"),
    });
  await sesion("fuerza", "2026-09-28", "17:00", "18:00");
  await sesion("caminata", "2026-09-29", "06:00", "06:45");
  await sesion("trote", "2026-09-30", "06:00", "06:30");
  await llamar(falso, "POST ejercicio/actividad", { token, cuerpo: { pasos: 9000 }, ahora: bogota("2026-10-02T21:30:00") });

  let r = await llamar(falso, "GET ejercicio/semana", { token, ahora: bogota("2026-10-02T21:40:00") });
  assert.equal(r.cuerpo.mensaje, "🏋️ 2 de 3 entrenos");
  assert.equal(r.cuerpo.datos.semana.sesiones, 3);
  assert.equal(r.cuerpo.datos.semana.minutos, 135);
  assert.equal(r.cuerpo.datos.pasos_hoy, 9000);
  assert.equal(r.cuerpo.datos.en_curso, null);
  assert.equal(falso.tablas.notificaciones.length, 0);

  // El tercero cumple la meta → una notificación (sin montos), y no se repite.
  await sesion("deporte", "2026-10-01", "19:00", "20:30");
  await sesion("fuerza", "2026-10-02", "17:00", "18:00");
  const avisos = falso.tablas.notificaciones;
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].clave, "ejercicio:semana:2026-09-28");
  assert.equal(avisos[0].modulo, "ejercicio");
  assert.equal(avisos[0].url, "ejercicio.html");

  await llamar(falso, "POST ejercicio/inicio", { token, cuerpo: { tipo: "caminata" }, ahora: bogota("2026-10-02T21:00:00") });
  r = await llamar(falso, "GET ejercicio/semana", { token, ahora: bogota("2026-10-02T21:42:30") });
  assert.equal(r.cuerpo.mensaje, "⏱️ Caminata en curso · 42:30");
  assert.equal(r.cuerpo.datos.en_curso.transcurrido_min, 42);
});

test("Hoy sigue contando los entrenos de la semana con las sesiones nuevas", async () => {
  const falso = base();
  const token = await conToken(falso);
  await llamar(falso, "POST ejercicio/sesion", {
    token,
    cuerpo: { tipo: "fuerza", inicio: "2026-10-02T07:00:00-05:00", fin: "2026-10-02T08:00:00-05:00" },
    ahora: bogota("2026-10-02T09:00:00"),
  });
  const hoy = await llamar(falso, "GET hoy", { token, ahora: bogota("2026-10-02T09:00:00") });
  assert.equal(hoy.estado, 200);
  assert.equal(hoy.cuerpo.datos.metricas.find((m) => m.clave === "gym").valor, 1);
});

test("las consultas de ejercicio siempre van filtradas por el usuario", async () => {
  const falso = base();
  const token = await conToken(falso);
  falso.llamadas.length = 0;
  await llamar(falso, "GET ejercicio/semana", { token });
  await llamar(falso, "POST ejercicio/inicio", { token, cuerpo: { tipo: "fuerza" } });
  await llamar(falso, "POST ejercicio/fin", { token, cuerpo: {} });
  const deDatos = falso.llamadas.filter((l) => l.ruta.startsWith("/rest/v1/") && !l.ruta.includes("api_tokens"));
  for (const l of deDatos) {
    if (l.metodo !== "POST") assert.match(l.ruta, new RegExp(`user_id=eq.${A}`), l.ruta);
  }
  assert.ok(falso.tablas.gym_sesiones.every((s) => s.user_id === A));
});
