// Reglas del centro de notificaciones (web/js/notificaciones/reglas.js): qué avisos salen del resumen del día,
// sin duplicar por clave, sin montos y con mensajes cortos para el iPhone.

import { test } from "node:test";
import assert from "node:assert/strict";
import { METAS_BASE, construirResumen, sumarDias } from "../web/js/logica/calculo.js";
import {
  HITOS_RACHA,
  generarNotificaciones,
  mensajeAhora,
  pendientesResueltas,
  sinDuplicar,
} from "../web/js/notificaciones/reglas.js";
import { tieneMontos, validarNotificacion } from "../web/js/notificaciones/logica.js";

const vacio = { metas: METAS_BASE, comidas: [], movimientos: [], checkins: [], estudio: [], gym: [], festivos: [] };
const f = "2026-10-02";
const a = (hora, fecha = f) => new Date(`${fecha}T${hora}:00-05:00`);

/** Días completos (4 registros) para armar rachas. */
function diasCompletos(hasta, cuantos, extra = {}) {
  const comidas = [];
  const checkins = [];
  for (let i = 0; i < cuantos; i++) {
    const fecha = sumarDias(hasta, -i);
    for (const tipo of ["desayuno", "almuerzo", "cena"]) comidas.push({ tipo, kcal: 870, proteina_g: 45, omitida: false, fecha });
    checkins.push({ tipo: "cierre", fecha, momento: `${fecha}T22:30:00-05:00` });
  }
  return { ...vacio, comidas, checkins, ...extra };
}

const claves = (avisos) => avisos.map((n) => n.clave);

test("mañana sin registros: solo el resumen del día, una vez", () => {
  const resumen = construirResumen(vacio, a("08:00"));
  const avisos = generarNotificaciones(resumen, a("08:00"));
  assert.deepEqual(claves(avisos), [`dia:${f}`]);
  assert.equal(avisos[0].titulo, "Tu día · 4 cosas por hacer");
  assert.equal(avisos[0].emoji, "☀️");
  // Por la tarde ya no sale el resumen de la mañana.
  assert.ok(!claves(generarNotificaciones(construirResumen(vacio, a("16:00")), a("16:00"))).includes(`dia:${f}`));
});

test("pendientes según la hora, con módulo y clave por día", () => {
  const avisos = generarNotificaciones(construirResumen(vacio, a("16:00")), a("16:00"));
  assert.deepEqual(claves(avisos), [
    `pendiente:desayuno:${f}`,
    `pendiente:almuerzo:${f}`,
    `pendiente:checkin_finanzas:${f}:b`,
  ]);
  const almuerzo = avisos.find((n) => n.clave.includes("almuerzo"));
  assert.equal(almuerzo.titulo, "Almuerzo pendiente");
  assert.equal(almuerzo.emoji, "🍽️");
  assert.equal(almuerzo.modulo, "comidas");
  assert.equal(avisos.find((n) => n.clave.includes("checkin")).modulo, "finanzas");
  // Nunca regañar: registrar "nada" también cuenta.
  assert.match(almuerzo.cuerpo, /también cuenta/);
});

test("el check-in de gastos avisa una vez por franja de la tarde", () => {
  const c = (hora) => claves(generarNotificaciones(construirResumen(vacio, a(hora)), a(hora))).find((k) => k.includes("checkin"));
  assert.equal(c("13:30"), `pendiente:checkin_finanzas:${f}:a`);
  assert.equal(c("16:00"), `pendiente:checkin_finanzas:${f}:b`);
  assert.equal(c("17:59"), `pendiente:checkin_finanzas:${f}:b`);
  assert.equal(c("19:00"), `pendiente:checkin_finanzas:${f}:c`);
});

test("sin duplicar: la misma clave no se vuelve a crear (aunque esté leída o borrada)", () => {
  const resumen = construirResumen(vacio, a("16:00"));
  const primera = generarNotificaciones(resumen, a("16:00"));
  const guardadas = primera.map((n, i) => ({ ...n, id: String(i), leida_en: i === 0 ? "x" : null, descartada_en: i === 1 ? "x" : null }));
  // 15 s después Hoy vuelve a pintar el mismo resumen: nada nuevo.
  assert.deepEqual(sinDuplicar(generarNotificaciones(resumen, a("16:00")), guardadas), []);
  // Repetidas dentro de la misma tanda tampoco.
  assert.equal(sinDuplicar([...primera, ...primera]).length, primera.length);
  // A las 22:30 aparecen solo las nuevas (cena, cierre).
  const noche = construirResumen(vacio, a("22:30"));
  assert.deepEqual(claves(sinDuplicar(generarNotificaciones(noche, a("22:30")), guardadas)), [
    `pendiente:cena:${f}`,
    `pendiente:cierre_finanzas:${f}`,
  ]);
});

test("racha: aviso en los hitos 3/7/14/30, identificado por el inicio de la racha", () => {
  assert.deepEqual(HITOS_RACHA, [3, 7, 14, 30]);
  // 7 días completos terminando hoy (hoy cuenta).
  const hoyCompleto = construirResumen(diasCompletos(f, 7), a("23:00"));
  assert.equal(hoyCompleto.racha, 7);
  const aviso = generarNotificaciones(hoyCompleto, a("23:00")).find((n) => n.clave.startsWith("racha:"));
  assert.equal(aviso.titulo, "7 días seguidos");
  assert.equal(aviso.emoji, "🔥");
  assert.equal(aviso.clave, `racha:7:${sumarDias(f, -6)}`);

  // Al día siguiente, antes de registrar nada, la racha sigue en 7: misma clave → no se repite.
  const manana = sumarDias(f, 1);
  const siguiente = construirResumen(diasCompletos(f, 7), a("11:00", manana));
  assert.equal(siguiente.racha, 7);
  const otra = generarNotificaciones(siguiente, a("11:00", manana)).find((n) => n.clave.startsWith("racha:"));
  assert.equal(otra.clave, aviso.clave);

  // Racha de 2: sin aviso. Racha de 9 (no abrió la app en el hito): avisa el último hito alcanzado.
  assert.ok(!generarNotificaciones(construirResumen(diasCompletos(f, 2), a("23:00")), a("23:00")).some((n) => n.clave.startsWith("racha:")));
  const nueve = generarNotificaciones(construirResumen(diasCompletos(f, 9), a("23:00")), a("23:00")).find((n) => n.clave.startsWith("racha:"));
  assert.equal(nueve.titulo, "7 días seguidos");
});

test("puntaje: 80 o más y día de 100", () => {
  const cien = construirResumen(diasCompletos(f, 1, { estudio: [{ minutos: 120, fecha: f }] }), a("23:00"));
  assert.equal(cien.score, 100);
  const avisos = generarNotificaciones(cien, a("23:00"));
  assert.ok(avisos.some((n) => n.clave === `puntaje:100:${f}` && n.titulo === "Día de 100"));
  assert.ok(!avisos.some((n) => n.clave === `puntaje:80:${f}`), "con 100 no hace falta el de 80");

  const ochenta = generarNotificaciones({ ...cien, score: 85 }, a("23:00"));
  assert.ok(ochenta.some((n) => n.clave === `puntaje:80:${f}`));
  assert.ok(!generarNotificaciones({ ...cien, score: 79 }, a("23:00")).some((n) => n.clave.startsWith("puntaje:")));
});

test("todos los avisos pasan la validación de la tabla y no llevan montos", () => {
  const casos = [
    construirResumen(vacio, a("08:00")),
    construirResumen(vacio, a("22:30")),
    construirResumen(diasCompletos(f, 30, { estudio: [{ minutos: 120, fecha: f }] }), a("09:00")),
    construirResumen({ ...vacio, movimientos: [{ tipo: "egreso", monto: 25000, fecha: f, momento: `${f}T13:00:00-05:00` }] }, a("16:00")),
  ];
  for (const resumen of casos) {
    for (const aviso of generarNotificaciones(resumen, a("09:00"))) {
      assert.doesNotThrow(() => validarNotificacion(aviso), aviso.clave);
      assert.ok(!tieneMontos(`${aviso.titulo} ${aviso.cuerpo}`), aviso.clave);
      assert.ok(aviso.clave.length <= 80);
    }
  }
});

test("un pendiente desconocido (p. ej. un bloque de rutina) también se avisa", () => {
  const resumen = { fecha: f, score: 40, racha: 0, anillos: [], pendientes: [{ clave: "rutina_bloque_123", emoji: "🗓️", texto: "Caminata de la mañana" }] };
  const [aviso] = generarNotificaciones(resumen, a("16:00"));
  assert.equal(aviso.modulo, "rutina");
  assert.equal(aviso.titulo, "Caminata de la mañana pendiente");
  assert.equal(aviso.url, "rutina.html");
  assert.doesNotThrow(() => validarNotificacion(aviso));
});

test("pendientes resueltos: se marcan leídos al registrar o al pasar el día", () => {
  const existentes = [
    { id: "1", clave: `pendiente:almuerzo:${f}`, leida_en: null },
    { id: "2", clave: `pendiente:desayuno:${f}`, leida_en: null },
    { id: "3", clave: `pendiente:cena:${sumarDias(f, -1)}`, leida_en: null },
    { id: "4", clave: `pendiente:checkin_finanzas:${f}:a`, leida_en: null },
    { id: "5", clave: `racha:7:${f}`, leida_en: null },
    { id: "6", clave: `pendiente:desayuno:${sumarDias(f, -1)}`, leida_en: "ya" },
  ];
  // A las 16:00 ya almorzó; sigue faltando desayuno y check-in (franja b).
  const resumen = { fecha: f, pendientes: [{ clave: "desayuno" }, { clave: "checkin_finanzas" }] };
  assert.deepEqual(pendientesResueltas(existentes, resumen, a("16:00")).sort(), ["1", "3", "4"]);
});

test("mensaje para el iPhone: emoji + 1–2 palabras, sin dígitos de dinero", () => {
  assert.deepEqual(mensajeAhora(construirResumen(vacio, a("09:00"))), { notificar: false, mensaje: "✅ Todo al día" });
  const uno = mensajeAhora(construirResumen(vacio, a("11:00")));
  assert.deepEqual(uno, { notificar: true, mensaje: "🍳 Desayuno pendiente" });
  const varios = mensajeAhora(construirResumen(vacio, a("22:30")));
  assert.equal(varios.notificar, true);
  assert.equal(varios.mensaje, "🍳 4 pendientes");
  for (const { mensaje } of [uno, varios]) {
    assert.ok(mensaje.split(" ").length <= 3, mensaje); // emoji + 2 palabras
    assert.ok(!tieneMontos(mensaje));
    assert.ok(!/\$/.test(mensaje));
  }
});
