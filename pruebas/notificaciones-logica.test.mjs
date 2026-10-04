// Centro de notificaciones (web/js/notificaciones/logica.js): agrupación por sección y por módulo,
// tiempo relativo, contador y validación (sin montos, url interna).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agrupar,
  contarNoLeidas,
  fechaLarga,
  seccionDe,
  textoContador,
  tieneMontos,
  tiempoRelativo,
  urlInterna,
  validarNotificacion,
} from "../web/js/notificaciones/logica.js";

const ahora = new Date("2026-10-03T12:40:00-05:00"); // sábado
const hace = (minutos) => new Date(ahora.getTime() - minutos * 60_000).toISOString();
const n = (id, modulo, minutos, extra = {}) => ({ id, modulo, emoji: "🔔", titulo: id, momento: hace(minutos), leida_en: null, descartada_en: null, ...extra });

test("tiempo relativo como en iOS", () => {
  assert.equal(tiempoRelativo(hace(0.5), ahora), "ahora");
  assert.equal(tiempoRelativo(hace(5), ahora), "hace 5 min");
  assert.equal(tiempoRelativo(hace(59), ahora), "hace 59 min");
  assert.equal(tiempoRelativo(hace(180), ahora), "hace 3 h");
  // Ayer por la noche (día lógico de ayer) → "ayer".
  assert.equal(tiempoRelativo("2026-10-02T21:00:00-05:00", ahora), "ayer");
  // Hace 4 días → nombre del día.
  assert.equal(tiempoRelativo("2026-09-29T10:00:00-05:00", ahora), "martes");
  // Hace más de una semana → fecha corta.
  assert.equal(tiempoRelativo("2026-09-12T10:00:00-05:00", ahora), "12 sept");
  // Un momento en el futuro (relojes desfasados) no da tiempos negativos.
  assert.equal(tiempoRelativo(new Date(ahora.getTime() + 60_000), ahora), "ahora");
});

test("de madrugada, lo de anoche sigue siendo de hoy (día lógico hasta las 04:00)", () => {
  const madrugada = new Date("2026-10-04T01:30:00-05:00");
  assert.equal(tiempoRelativo("2026-10-03T23:00:00-05:00", madrugada), "hace 2 h");
  assert.equal(seccionDe("2026-10-03", "2026-10-03"), "hoy");
});

test("fecha larga de la pantalla bloqueada", () => {
  assert.equal(fechaLarga(ahora), "sábado, 3 de octubre");
});

test("secciones Hoy · Esta semana · Antes", () => {
  assert.equal(seccionDe("2026-10-03", "2026-10-03"), "hoy");
  assert.equal(seccionDe("2026-10-02", "2026-10-03"), "semana");
  assert.equal(seccionDe("2026-09-27", "2026-10-03"), "semana");
  assert.equal(seccionDe("2026-09-26", "2026-10-03"), "antes");
});

test("agrupar: secciones en orden, pilas por módulo, lo más reciente arriba, sin descartadas", () => {
  const lista = [
    n("f1", "finanzas", 30),
    n("c1", "comidas", 10),
    n("f2", "finanzas", 5, { leida_en: hace(1) }),
    n("f3", "finanzas", 90),
    n("borrada", "comidas", 3, { descartada_en: hace(1) }),
    n("s1", "sueno", 60 * 24), // ayer
    n("viejo", "finanzas", 60 * 24 * 10), // hace 10 días
  ];
  const secciones = agrupar(lista, ahora);
  assert.deepEqual(secciones.map((s) => s.titulo), ["Hoy", "Esta semana", "Antes"]);

  const [hoy, semana, antes] = secciones;
  // Pila de finanzas primero (su última es de hace 5 min), luego comidas.
  assert.deepEqual(hoy.pilas.map((p) => p.modulo), ["finanzas", "comidas"]);
  assert.deepEqual(hoy.pilas[0].items.map((x) => x.id), ["f2", "f1", "f3"]);
  assert.equal(hoy.pilas[0].nombre, "Dinero");
  assert.equal(hoy.pilas[0].noLeidas, 2);
  assert.equal(hoy.pilas[0].id, "hoy:finanzas");
  assert.deepEqual(hoy.pilas[1].items.map((x) => x.id), ["c1"]);
  assert.deepEqual(semana.pilas.map((p) => p.modulo), ["sueno"]);
  assert.deepEqual(antes.pilas[0].items.map((x) => x.id), ["viejo"]);
});

test("agrupar sin nada (o solo descartadas) → sin secciones", () => {
  assert.deepEqual(agrupar([], ahora), []);
  assert.deepEqual(agrupar([n("x", "finanzas", 1, { descartada_en: hace(0) })], ahora), []);
});

test("contador: no leídas y no descartadas; desaparece en 0", () => {
  const lista = [n("a", "finanzas", 1), n("b", "finanzas", 2, { leida_en: hace(1) }), n("c", "comidas", 3, { descartada_en: hace(1) })];
  assert.equal(contarNoLeidas(lista), 1);
  assert.equal(textoContador(0), "");
  assert.equal(textoContador(7), "7");
  assert.equal(textoContador(150), "99+");
});

test("validación: sin montos, url interna, largos de la tabla", () => {
  assert.ok(tieneMontos("Gastaste $25.000"));
  assert.ok(tieneMontos("Te quedan 120.000"));
  assert.ok(tieneMontos("500 COP"));
  assert.ok(!tieneMontos("🔥 7 días seguidos"));
  assert.ok(!tieneMontos("Día de 100"));
  assert.ok(!tieneMontos("Tu día · 3 cosas por hacer"));

  assert.ok(urlInterna("finanzas.html"));
  assert.ok(urlInterna("index.html#anillos"));
  assert.ok(urlInterna(null));
  assert.ok(!urlInterna("https://otro.com"));
  assert.ok(!urlInterna("javascript:alert(1)"));
  assert.ok(!urlInterna("//otro.com"));

  const ok = validarNotificacion({ modulo: "sueno", titulo: "  Dormiste 7 h  ", url: "sueno.html", clave: "sueno:x" });
  assert.equal(ok.titulo, "Dormiste 7 h");
  assert.equal(ok.emoji, "🌙"); // el del módulo si no viene
  assert.equal(ok.cuerpo, null);

  assert.throws(() => validarNotificacion({ modulo: "banco", titulo: "x" }), /Módulo/);
  assert.throws(() => validarNotificacion({ modulo: "finanzas", titulo: "" }), /título/);
  assert.throws(() => validarNotificacion({ modulo: "finanzas", titulo: "x".repeat(61) }), /título/);
  assert.throws(() => validarNotificacion({ modulo: "finanzas", titulo: "Gasto", cuerpo: "$25.000 en comida" }), /montos/);
  assert.throws(() => validarNotificacion({ modulo: "finanzas", titulo: "Ver", url: "https://phishing.example" }), /interna/);
});
