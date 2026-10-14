// Guía de Widgets (web/js/widgets/atajos.js) y la página widgets.html: formato común, rutas que existen,
// nada de claves y nada que rompa la CSP (scripts o estilos en línea, innerHTML).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ATAJOS, BOTONES_ATAJOS, GUIA_BLOQUEO, GUIA_SCRIPTABLE } from "../web/js/widgets/atajos.js";
import { RUTAS } from "../api/_lib/rutas.js";

const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");

test("Widgets: botones directos de 🐐 Goat, guía de Scriptable y de la pantalla bloqueada", () => {
  assert.deepEqual(ATAJOS.map((a) => a.id), ["goat-botones"]);
  assert.deepEqual(BOTONES_ATAJOS.map((b) => b.nombre), ["Dinero", "Comí", "Terminé", "¿Qué hago?"]);
  assert.equal(GUIA_SCRIPTABLE.length, 5);
  assert.ok(GUIA_BLOQUEO.length >= 3);
  assert.doesNotMatch(JSON.stringify({ ATAJOS, GUIA_SCRIPTABLE, GUIA_BLOQUEO }), /sb_secret_|service_role|\$\s?\d/);
  assert.ok(RUTAS["POST asistente"]);
});

test("widgets.html respeta la CSP: sin scripts ni estilos en línea, y la página no usa innerHTML", () => {
  const html = leer("web/widgets.html");
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, "hay un <script> en línea");
  assert.doesNotMatch(html, /\sstyle=/, "hay un style= en línea");
  assert.doesNotMatch(html, /\son[a-z]+=/, "hay un manejador en línea (onclick=…)");
  assert.match(html, /<h1 class="titular">Widgets\.<\/h1>/);
  for (const archivo of ["pagina.js", "vista.js", "datos.js", "mini.js", "logica.js", "frases.js", "atajos.js"]) {
    const js = leer(`web/js/widgets/${archivo}`);
    assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function/, `${archivo} arma HTML con texto`);
    assert.doesNotMatch(js, /setAttribute\(\s*["']style["']/, `${archivo} pone estilos en línea`);
  }
});

test("las plantillas que usa la página existen en widgets.html", () => {
  const html = leer("web/widgets.html");
  const js = ["pagina.js", "vista.js"].map((a) => leer(`web/js/widgets/${a}`)).join("\n");
  const usadas = new Set([...js.matchAll(/clonar\("([a-z-]+)"\)/g)].map((m) => m[1]));
  assert.ok(usadas.size >= 8);
  for (const id of usadas) assert.match(html, new RegExp(`<template id="${id}">`), `falta la plantilla ${id}`);
  const ids = [...js.matchAll(/(?:\$|getElementById)\("([a-z-]+)"\)/g)].map((m) => m[1]);
  for (const id of new Set(ids)) assert.match(html, new RegExp(`id="${id}"`), `falta #${id}`);
});
