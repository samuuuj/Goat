// Guía de Widgets (web/js/widgets/atajos.js) y la página widgets.html: formato común, rutas que existen,
// nada de claves y nada que rompa la CSP (scripts o estilos en línea, innerHTML).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ATAJOS, BOTONES_ATAJOS, GUIA_BLOQUEO, GUIA_SCRIPTABLE } from "../web/js/widgets/atajos.js";
import { RUTAS } from "../api/_lib/rutas.js";

const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");

test("los atajos de Widgets tienen el formato común y su ruta de prueba existe", () => {
  assert.deepEqual(ATAJOS.map((a) => a.id), ["widgets-comi", "widgets-estudio", "widgets-botones"]);
  for (const atajo of ATAJOS) {
    for (const campo of ["id", "emoji", "nombre", "para"]) assert.equal(typeof atajo[campo], "string", `${atajo.id}.${campo}`);
    assert.ok(atajo.pasos.length >= 3 && atajo.pasos.every((p) => typeof p === "string" && p.length > 10), atajo.id);
    assert.ok(Array.isArray(atajo.permisos));
    assert.equal(atajo.automatizacion, null);
    assert.ok(RUTAS[`${atajo.prueba.metodo} ${atajo.prueba.ruta}`], `${atajo.id}: ruta de prueba inexistente`);
    assert.doesNotMatch(JSON.stringify(atajo), /sb_secret_|service_role|\$\s?\d/);
  }
  // Los dos atajos que abren una hoja usan el atajo base y una acción que Hoy entiende.
  for (const [id, accion] of [["widgets-comi", "comida"], ["widgets-estudio", "estudio"]]) {
    const pasos = ATAJOS.find((a) => a.id === id).pasos.join(" ");
    assert.match(pasos, /⚙️ Goat/);
    assert.match(pasos, new RegExp(`/index\\.html#registrar=${accion}`));
  }
  assert.equal(BOTONES_ATAJOS.length, 4);
  assert.equal(GUIA_SCRIPTABLE.length, 5);
  assert.ok(GUIA_BLOQUEO.length >= 3);
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
