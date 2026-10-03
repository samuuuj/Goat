// Guía de atajos del desbloqueo (web/js/desbloqueo/atajos.js): formato común, rutas que existen y sin montos.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ATAJOS, GUIA } from "../web/js/desbloqueo/atajos.js";
import { RUTAS } from "../api/_lib/rutas.js";

test("cada atajo tiene el formato de 00-comun.md", () => {
  assert.equal(ATAJOS.length, 2);
  const ids = new Set();
  for (const a of ATAJOS) {
    assert.match(a.id, /^desbloqueo-[a-z-]+$/);
    assert.ok(!ids.has(a.id), `id repetido: ${a.id}`);
    ids.add(a.id);
    for (const campo of ["emoji", "nombre", "para"]) assert.ok(typeof a[campo] === "string" && a[campo].length > 0, `${a.id}.${campo}`);
    assert.ok(Array.isArray(a.pasos) && a.pasos.length >= 5);
    assert.ok(a.automatizacion && typeof a.automatizacion.disparador === "string");
    assert.ok(a.automatizacion.pasos.length >= 4);
    assert.ok(Array.isArray(a.permisos));
    assert.ok(RUTAS[`${a.prueba.metodo} ${a.prueba.ruta}`], `la ruta de prueba no existe: ${a.prueba.ruta}`);
  }
});

test("los pasos usan el atajo base ⚙️ Goat y las rutas reales de la API", () => {
  const [puerta, cerre] = ATAJOS;
  const textoPuerta = puerta.pasos.join("\n");
  assert.match(textoPuerta, /⚙️ Goat/);
  assert.match(textoPuerta, /\/desbloqueo\/gate\?app=/);
  assert.match(textoPuerta, /datos\.accion/);
  assert.match(textoPuerta, /bloquear/);
  assert.match(textoPuerta, /Ir a la pantalla de inicio/);
  assert.match(textoPuerta, /\/desbloqueo\/pase/);
  assert.match(textoPuerta, /deja pasar/);
  assert.ok(RUTAS["GET desbloqueo/gate"] && RUTAS["POST desbloqueo/pase"] && RUTAS["POST desbloqueo/evento"]);
  const textoCerre = cerre.pasos.join("\n");
  assert.match(textoCerre, /\/desbloqueo\/evento/);
  assert.match(textoCerre, /cerrar/);
  assert.match(puerta.automatizacion.disparador, /Se abre/);
  assert.match(cerre.automatizacion.disparador, /Se cierra/);
});

test("la guía es honesta (fricción, no candado) y no lleva montos", () => {
  const todo = JSON.stringify({ ATAJOS, GUIA });
  assert.doesNotMatch(todo, /\$\s?\d/);
  assert.match(GUIA.friccion.join(" "), /no un candado/);
  assert.match(GUIA.candado.pasos.join(" "), /código/);
  assert.match(GUIA.safari.pasos.join(" "), /tiktok\.com/);
});
