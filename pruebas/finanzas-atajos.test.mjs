// Guía del atajo "💸 Movimiento" (web/js/finanzas/atajos.js): formato de 00-comun.md y ruta de prueba real.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ATAJOS } from "../web/js/finanzas/atajos.js";
import { RUTAS } from "../api/_lib/rutas.js";

test("la guía tiene el formato común y su botón Probar apunta a una ruta que existe", () => {
  assert.ok(ATAJOS.length >= 1);
  for (const atajo of ATAJOS) {
    for (const campo of ["id", "emoji", "nombre", "para"]) assert.equal(typeof atajo[campo], "string", campo);
    assert.ok(Array.isArray(atajo.pasos) && atajo.pasos.length >= 5);
    assert.ok(Array.isArray(atajo.permisos));
    assert.ok(atajo.automatizacion === null || typeof atajo.automatizacion === "object");
    assert.ok(RUTAS[`${atajo.prueba.metodo} ${atajo.prueba.ruta}`], `no existe ${atajo.prueba.ruta}`);
    assert.ok(atajo.pasos.some((p) => p.includes("⚙️ Goat")), "usa el atajo base ⚙️ Goat");
    assert.ok(!/\$\s?\d/.test(JSON.stringify(atajo)), "la guía no lleva montos");
  }
  const usadas = ATAJOS[0].pasos.join(" ");
  for (const ruta of ["finanzas/menu", "finanzas/movimientos"]) assert.ok(usadas.includes(ruta), ruta);
});
