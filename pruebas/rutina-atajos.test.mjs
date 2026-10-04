// Guía de atajos de Rutina (web/js/rutina/atajos.js): formato común, rutas que existen y nada de claves.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ATAJOS } from "../web/js/rutina/atajos.js";
import { RUTAS } from "../api/_lib/rutas.js";

test("los 4 atajos de rutina tienen el formato de la guía y sus rutas existen", () => {
  assert.deepEqual(ATAJOS.map((a) => a.id), ["rutina-plan", "rutina-hecho", "rutina-cierre", "rutina-tarea"]);
  for (const atajo of ATAJOS) {
    for (const campo of ["id", "emoji", "nombre", "para"]) assert.equal(typeof atajo[campo], "string", `${atajo.id}.${campo}`);
    assert.ok(atajo.pasos.length >= 5 && atajo.pasos.every((p) => typeof p === "string" && p.length > 10));
    assert.ok(atajo.pasos.some((p) => p.includes("⚙️ Goat")), `${atajo.id} no usa el atajo base`);
    assert.ok(Array.isArray(atajo.permisos));
    assert.ok(RUTAS[`${atajo.prueba.metodo} ${atajo.prueba.ruta}`], `${atajo.id}: ruta de prueba inexistente`);
    if (atajo.automatizacion) assert.ok(atajo.automatizacion.disparador && atajo.automatizacion.pasos.length > 0);
    const texto = JSON.stringify(atajo);
    assert.ok(!/sb_secret_|service_role|\$\s?\d/.test(texto), `${atajo.id} lleva algo que no debe`);
  }
});

test("las rutas que nombran los pasos existen en la API", () => {
  const nombradas = new Set(ATAJOS.flatMap((a) => a.pasos.join(" ").match(/\/(rutina|uni)\/[a-z/]+/g) ?? []).map((r) => r.slice(1)));
  assert.ok(nombradas.size >= 3);
  for (const ruta of nombradas) assert.ok(RUTAS[`GET ${ruta}`] || RUTAS[`POST ${ruta}`], ruta);
});
