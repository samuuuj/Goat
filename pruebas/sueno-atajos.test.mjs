// Guía de atajos de Sueño (web/js/sueno/atajos.js): formato común, fuentes válidas y rutas que existen en la API.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ATAJOS } from "../web/js/sueno/atajos.js";
import { FUENTES } from "../web/js/sueno/logica.js";
import { RUTAS } from "../api/_lib/rutas.js";

test("los dos atajos tienen el formato común y sus automatizaciones", () => {
  assert.deepEqual(
    ATAJOS.map((a) => a.id),
    ["sueno-acostarse", "sueno-desperte"],
  );
  for (const atajo of ATAJOS) {
    for (const campo of ["id", "emoji", "nombre", "para"]) assert.equal(typeof atajo[campo], "string", `${atajo.id}.${campo}`);
    assert.ok(atajo.pasos.length >= 8 && atajo.pasos.every((p) => typeof p === "string" && p.length > 10));
    assert.ok(Array.isArray(atajo.permisos));
    assert.ok(atajo.automatizaciones.length >= 2);
    assert.equal(atajo.automatizacion, atajo.automatizaciones[0]);
    for (const auto of atajo.automatizaciones) {
      assert.match(auto.disparador, /›/);
      assert.ok(auto.pasos.some((p) => p.includes("Ejecutar inmediatamente")));
    }
    const { metodo, ruta } = atajo.prueba;
    assert.ok(RUTAS[`${metodo} ${ruta}`], `la ruta de prueba ${metodo} ${ruta} no existe`);
    assert.ok(!/\$\s?\d/.test(JSON.stringify(atajo)), "sin montos");
  }
});

test("las fechas que se envían usan Formatear fecha › ISO 8601 y apuntan a sueno/evento", () => {
  for (const atajo of ATAJOS) {
    const texto = atajo.pasos.join("\n");
    assert.match(texto, /Formatear fecha.*ISO 8601/);
    assert.match(texto, /\/api\/v1\/sueno\/evento/);
    assert.match(texto, /Authorization/);
    assert.ok(RUTAS["POST sueno/evento"]);
  }
  assert.match(ATAJOS[1].pasos.join("\n"), /Buscar muestras de salud.*Análisis del sueño.*18 horas/);
});

test("cada automatización manda una fuente que la API acepta", () => {
  const fuentes = ATAJOS.flatMap((a) =>
    a.automatizaciones.map((auto) => /escribe (\w+) \(/.exec(auto.pasos.join(" "))?.[1]),
  );
  assert.deepEqual(fuentes, ["hora_dormir", "modo_sueno", "cargador", "despertar", "alarma"]);
  for (const fuente of fuentes) assert.ok(FUENTES.includes(fuente), fuente);
});
