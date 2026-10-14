// Guías de los atajos del iPhone (web/js/conectar/guias.js, D-063): formato, rutas reales, nombres de acciones
// como salen en el iPhone de Samuel, palabras que entiende «🐐 Goat» y nada de montos ni claves.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ATAJOS, GRUPOS, RETIRADOS, atajosDe } from "../web/js/conectar/guias.js";
import { agruparAtajos } from "../web/js/conectar/logica.js";
import { RUTAS } from "../api/_lib/rutas.js";
import { FLUJOS, _pruebas } from "../api/_lib/asistente.js";
import { FUENTES } from "../web/js/sueno/logica.js";
import { GUIA } from "../web/js/desbloqueo/atajos.js";

const pasosDe = (a) => [...a.pasos, ...a.automatizaciones.flatMap((auto) => auto.pasos)];
const textoDe = (a) => JSON.stringify({ ...a, prueba: null });
const rutasApi = Object.keys(RUTAS).map((clave) => clave.split(" ")[1]);

test("cada guía tiene el formato: qué hace, cómo se usa, si corre sola y pasos en piezas cortas", () => {
  const ids = new Set();
  for (const a of ATAJOS) {
    assert.ok(!ids.has(a.id), `id repetido ${a.id}`);
    ids.add(a.id);
    assert.ok(GRUPOS.some((g) => g.id === a.grupo), `${a.id}: grupo ${a.grupo}`);
    for (const campo of ["emoji", "nombre", "para", "uso", "tiempo"]) assert.ok(typeof a[campo] === "string" && a[campo].trim(), `${a.id}.${campo}`);
    assert.ok(a.pasos.length + a.automatizaciones.length > 0, `${a.id}: sin pasos`);
    assert.ok(Array.isArray(a.mapa) && a.mapa.length > 0, `${a.id}: falta «Así debe quedar»`);
    for (const p of pasosDe(a)) {
      assert.ok(typeof p.titulo === "string" && p.titulo.length <= 60, `${a.id}: título largo o vacío «${p.titulo}»`);
      assert.ok(Array.isArray(p.hacer) && p.hacer.length > 0 && p.hacer.length <= 10, `${a.id} › ${p.titulo}: «hacer» vacío o muy largo`);
      // Frases cortas: nada de párrafos en el iPhone (falla 3).
      for (const linea of p.hacer) assert.ok(linea.length <= 190, `${a.id} › ${p.titulo}: línea larga (${linea.length}): ${linea}`);
      for (const t of p.escribir ?? []) assert.equal(typeof t, "string");
    }
  }
  assert.deepEqual(
    agruparAtajos().map((g) => g.modulo),
    GRUPOS.map((g) => g.id),
  );
});

test("los atajos que se arman empiezan creando el atajo nuevo con su nombre y usan «⚙️ Goat»", () => {
  for (const a of ATAJOS.filter((x) => x.pasos.length > 0)) {
    assert.equal(a.pasos[0].titulo, "Crea el atajo", a.id);
    if (a.id !== "goat-botones") assert.ok(a.pasos[0].escribir?.[0]?.includes(a.nombre), `${a.id}: el primer paso no da el nombre`);
    if (!["conectar-goat", "goat-botones"].includes(a.id)) assert.match(textoDe(a), /Ejecutar atajo.*⚙️ Goat/, `${a.id} no usa ⚙️ Goat`);
  }
});

test("los nombres de acciones son los del iPhone (fallas 4–8 y 16)", () => {
  const todo = JSON.stringify(ATAJOS);
  for (const prohibido of [/Mostrar al ejecutar/, /Definir variable/, /tiene algún valor/, /Reproducir sonido/, /Obtener fechas de/, /Renómbrala|Renombrar la variable/]) {
    assert.doesNotMatch(todo, prohibido, `aparece ${prohibido}`);
  }
  assert.match(todo, /Establecer variable/);
  assert.match(todo, /Seleccionar variable/);
});

test("cada /api/v1/<ruta> que nombran las guías existe en la API", () => {
  for (const a of ATAJOS) {
    for (const [, ruta] of textoDe(a).matchAll(/\/api\/v1\/([a-z_/]+[a-z_])/g)) {
      assert.ok(rutasApi.includes(ruta), `${a.id}: /api/v1/${ruta} no existe`);
    }
  }
});

test("«Probar» desde la web nunca guarda nada (GET, o el asistente sin respuesta)", () => {
  for (const a of ATAJOS.filter((x) => x.prueba)) {
    assert.ok(RUTAS[`${a.prueba.metodo} ${a.prueba.ruta}`], `${a.id}: ruta de prueba inexistente`);
    assert.ok(a.prueba.metodo === "GET" || a.prueba.ruta === "asistente", `${a.id}: Probar escribiría (${a.prueba.metodo} ${a.prueba.ruta})`);
  }
});

test("las palabras que las automatizaciones le pasan a «🐐 Goat» abren el flujo correcto", () => {
  const { empezar } = _pruebas;
  const palabras = ATAJOS.flatMap((a) =>
    pasosDe(a)
      .filter((p) => p.hacer.some((l) => /Ejecutar atajo.*🐐 Goat/.test(l)) && p.hacer.some((l) => /«Texto»/.test(l)))
      .flatMap((p) => p.escribir ?? []),
  );
  // Los botones directos: un texto por botón.
  const botones = ATAJOS.find((x) => x.id === "goat-botones").pasos.slice(1, 3).flatMap((p) => p.escribir);
  palabras.push(...botones);
  assert.ok(palabras.length >= 10, `pocas: ${palabras}`);
  for (const palabra of palabras) {
    const { f, a } = empezar(palabra);
    assert.notEqual(f, "menu", `«${palabra}» no abre ningún flujo`);
    assert.ok(FLUJOS[f], palabra);
    if (f === "dormir" || f === "desperte") assert.ok(FUENTES.includes(a), `fuente «${a}» que sueño no acepta`);
  }
});

test("el motor de la guía tiene un «Si» por cada tipo que responde la API", () => {
  const motor = ATAJOS.find((a) => a.id === "goat-motor");
  const mapa = motor.mapa.join("\n");
  for (const tipo of ["fin", "silencio", "inicio", "lista", "numero", "texto"]) assert.match(mapa, new RegExp(`Si tipo es ${tipo}\\b`));
  for (const campo of ["flujo", "estado", "respuesta"]) assert.match(textoDe(motor), new RegExp(`Clave: ${campo}\\.`));
});

test("Plan del día usa minutos desde ahora (no «Obtener fechas de»: falla 9)", () => {
  const plan = ATAJOS.find((a) => a.id === "rutina-plan");
  assert.match(textoDe(plan), /en_minutos/);
  assert.match(textoDe(plan), /Ajustar fecha/);
  assert.match(textoDe(plan), /rutina\/plan/);
});

test("sin montos ni claves en las guías; los atajos retirados dicen qué los reemplaza", () => {
  const todo = JSON.stringify({ ATAJOS, RETIRADOS, GUIA });
  assert.doesNotMatch(todo, /\$\s?\d/);
  assert.doesNotMatch(todo, /sb_secret_|service_role|eyJ[A-Za-z0-9_-]{10,}\./);
  for (const r of RETIRADOS) assert.match(r.motivo, /🐐 Goat/);
  assert.match(GUIA.friccion.join(" "), /no un candado/);
});

test("cada sección recibe sus atajos", () => {
  assert.deepEqual(atajosDe("sueno").map((a) => a.id), ["sueno-acostarse", "sueno-desperte"]);
  assert.deepEqual(atajosDe("rutina").map((a) => a.id), ["rutina-plan", "rutina-cierre"]);
  assert.deepEqual(atajosDe("desbloqueo").map((a) => a.id), ["desbloqueo-puerta"]);
  assert.deepEqual(atajosDe("widgets").map((a) => a.id), ["goat-botones"]);
});
