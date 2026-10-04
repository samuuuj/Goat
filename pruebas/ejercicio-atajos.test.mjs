// Guía de atajos de Movimiento (web/js/ejercicio/atajos.js): formato común, rutas que existen y fechas ISO 8601.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ATAJOS } from "../web/js/ejercicio/atajos.js";
import { RUTAS } from "../api/_lib/rutas.js";

test("cada atajo tiene el formato de la guía y su botón Probar apunta a una ruta real", () => {
  assert.deepEqual(ATAJOS.map((a) => a.id), ["ejercicio-entreno", "ejercicio-actividad"]);
  for (const a of ATAJOS) {
    for (const campo of ["id", "emoji", "nombre", "para"]) assert.equal(typeof a[campo], "string", `${a.id}.${campo}`);
    assert.ok(a.pasos.length >= 5 && a.pasos.every((p) => typeof p === "string" && p.length > 10));
    assert.ok(Array.isArray(a.permisos) && a.permisos.length > 0);
    assert.ok(a.automatizacion?.disparador && a.automatizacion.pasos.length > 0);
    assert.ok(RUTAS[`${a.prueba.metodo} ${a.prueba.ruta}`], `no existe ${a.prueba.metodo} ${a.prueba.ruta}`);
    assert.ok(!JSON.stringify(a).includes("$"), "sin montos");
  }
});

test("los pasos usan las rutas de ejercicio que existen, el atajo base y fechas ISO 8601", () => {
  const texto = JSON.stringify(ATAJOS);
  for (const ruta of ["ejercicio/menu", "ejercicio/inicio", "ejercicio/fin", "ejercicio/sesion", "ejercicio/actividad"]) {
    assert.ok(texto.includes(`/api/v1/${ruta}`), `falta ${ruta}`);
    const metodo = ruta === "ejercicio/menu" ? "GET" : "POST";
    assert.ok(RUTAS[`${metodo} ${ruta}`], `${metodo} ${ruta} no existe en la API`);
  }
  assert.match(texto, /⚙️ Goat/);
  assert.match(texto, /ISO 8601/);
  assert.match(texto, /Buscar muestras de salud/);
  assert.match(texto, /21:30/);
});
