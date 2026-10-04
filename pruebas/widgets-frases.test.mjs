// Frases del widget (web/js/widgets/frases.js) y armado de la respuesta (web/js/widgets/logica.js).

import { test } from "node:test";
import assert from "node:assert/strict";
import { FRASES, contextosDe, elegirFrase, franjaDe } from "../web/js/widgets/frases.js";
import { MAXIMO_BYTES, armarWidget, desbloqueoCorto, ejemploWidget, rutinaCorta, suenoCorto } from "../web/js/widgets/logica.js";
import { sumarDias } from "../web/js/logica/calculo.js";

const TODAS = Object.values(FRASES).flat();
const FRANJAS = ["madrugada", "manana", "tarde", "noche"];
const base = (extra = {}) => ({ fecha: "2026-10-05", franja: "manana", score: 50, scoreAyer: 50, racha: 0, pendientes: 0, tipoDia: "habil", diaSemana: 1, dia: "lunes", ...extra });

test("hay más de 60 frases, cortas y sin montos ni regaños", () => {
  assert.ok(TODAS.length >= 60, `solo hay ${TODAS.length}`);
  assert.equal(new Set(TODAS).size, TODAS.length, "hay frases repetidas");
  for (const frase of TODAS) {
    assert.ok(frase.length <= 60, `muy larga: ${frase}`);
    assert.doesNotMatch(frase, /\$|\d/, `lleva cifras o montos: ${frase}`);
    assert.doesNotMatch(frase, /\b(deberías|fallaste|otra vez no|vergüenza|flojo de nuevo|perdiste)\b/i, `regaña: ${frase}`);
  }
  for (const contexto of ["racha", "pendientes", "puntaje_bajo", "puntaje_alto", "fin_de_semana", "festivo", ...FRANJAS]) {
    assert.ok(FRASES[contexto]?.length >= 3, `pocas frases de ${contexto}`);
  }
});

test("franjas: madrugada 0–4, mañana 5–11, tarde 12–18, noche 19–23", () => {
  assert.deepEqual([0, 4, 5, 11, 12, 18, 19, 23].map(franjaDe), ["madrugada", "madrugada", "manana", "manana", "tarde", "tarde", "noche", "noche"]);
});

test("contexto: pendientes, racha, puntaje, fin de semana y festivo", () => {
  assert.deepEqual(contextosDe(base({ pendientes: 2, racha: 5 })).slice(0, 2), ["pendientes", "racha"]);
  assert.ok(contextosDe(base({ score: 90 })).includes("puntaje_alto"));
  assert.ok(contextosDe(base({ franja: "noche", score: 20, scoreAyer: 60 })).includes("puntaje_bajo"));
  // Por la mañana un puntaje bajo es normal: no se le habla de eso.
  assert.ok(!contextosDe(base({ franja: "manana", score: 10 })).includes("puntaje_bajo"));
  assert.ok(contextosDe(base({ franja: "tarde", score: 70, scoreAyer: 50 })).includes("subiendo"));
  assert.ok(contextosDe(base({ tipoDia: "fin_de_semana", diaSemana: 6 })).includes("fin_de_semana"));
  assert.ok(contextosDe(base({ tipoDia: "festivo" })).includes("festivo"));
  assert.ok(contextosDe(base({ diaSemana: 5 })).includes("viernes"));
  assert.deepEqual(contextosDe(base({ franja: "madrugada", pendientes: 3 })), ["madrugada"]);
  assert.equal(contextosDe(base()).at(-1), "manana");
});

test("la frase cambia de un día a otro (mismo contexto) y no salta dentro del mismo día", () => {
  for (const extra of [{}, { racha: 6 }, { pendientes: 1 }, { franja: "noche", score: 85 }, { tipoDia: "fin_de_semana", diaSemana: 6 }, { franja: "madrugada" }]) {
    let anterior = null;
    for (let i = 0; i < 30; i++) {
      const d = base({ ...extra, fecha: sumarDias("2026-10-05", i) });
      const frase = elegirFrase(d);
      assert.notEqual(frase, anterior, `se repitió dos días seguidos: ${frase}`);
      assert.equal(elegirFrase(d), frase, "no es estable");
      anterior = frase;
    }
  }
});

test("variedad por franja y a lo largo de la semana", () => {
  const porFranja = Object.fromEntries(
    FRANJAS.map((franja) => [franja, new Set(Array.from({ length: 7 }, (_, i) => elegirFrase(base({ franja, fecha: sumarDias("2026-10-05", i) }))))]),
  );
  for (const franja of FRANJAS) assert.ok(porFranja[franja].size >= 4, `${franja}: poca variedad`);
  assert.notDeepEqual([...porFranja.manana], [...porFranja.noche]);
  // El mismo día, mañana y noche dicen cosas distintas.
  assert.notEqual(elegirFrase(base({ franja: "manana" })), elegirFrase(base({ franja: "noche" })));
});

test("la racha se escribe en la frase y nunca queda un marcador sin llenar", () => {
  const vistas = new Set();
  for (let i = 0; i < 40; i++) {
    const frase = elegirFrase(base({ racha: 7, pendientes: 0, fecha: sumarDias("2026-10-05", i), franja: "tarde", score: 60 }));
    assert.doesNotMatch(frase, /[{}]/);
    vistas.add(frase);
  }
  assert.ok([...vistas].some((f) => /\b7\b/.test(f)), "nunca habló de la racha");
});

test("rutinaCorta: ahora, siguiente y null si hoy no hay bloques", () => {
  const bloques = [
    { id: "a", titulo: "Caminar", tipo: "caminar", dias: [1, 2, 3, 4, 5, 6, 7], hora_inicio: "06:10", duracion_min: 45, activo: true },
    { id: "b", titulo: "Clase de cálculo", tipo: "clase_presencial", dias: [1], hora_inicio: "08:00", duracion_min: 120, activo: true },
  ];
  const lunes = "2026-10-05";
  const r = rutinaCorta({ bloques, checks: [], festivos: [], fecha: lunes }, new Date(`${lunes}T06:30:00-05:00`));
  assert.deepEqual(
    { ahora: r.ahora, emoji: r.emojiAhora, quedan: r.quedan, siguiente: r.siguiente, hora: r.hora },
    { ahora: "Caminar", emoji: "🚶", quedan: "25 min", siguiente: "Clase de cálculo", hora: "08:00" },
  );
  const tarde = rutinaCorta({ bloques, checks: [], festivos: [], fecha: lunes }, new Date(`${lunes}T21:00:00-05:00`));
  assert.equal(tarde.ahora, null);
  assert.equal(tarde.siguiente, null);
  assert.equal(tarde.mensaje, "🌙 Nada más por hoy");
  assert.equal(rutinaCorta({ bloques: [], checks: [], fecha: lunes }, new Date(`${lunes}T09:00:00-05:00`)), null);
});

test("suenoCorto y desbloqueoCorto toleran datos ausentes", () => {
  assert.equal(suenoCorto(null), null);
  assert.equal(suenoCorto({ ultimaNoche: null, enCurso: null }), null);
  assert.deepEqual(suenoCorto({ enCurso: { fecha: "x" }, indice: { valor: 80 } }), { duracion: null, indice: 80, etiqueta: "En cama", enCama: true });
  assert.deepEqual(suenoCorto({ ultimaNoche: { completa: true, duracionMin: 430, etiqueta: "Anoche" }, indice: { valor: null } }), {
    duracion: "7 h 10",
    indice: null,
    etiqueta: "Anoche",
    enCama: false,
  });
  assert.equal(desbloqueoCorto(null), null);
  assert.deepEqual(desbloqueoCorto({ abierto: true, nivel: { minutos: 60 }, apps: [] }), { abierto: true, minutos: 60, apps: [] });
});

test("armarWidget: anillos acotados, semana con letras, sin dinero por defecto y ≤ 4 KB", () => {
  const ahora = new Date("2026-10-02T15:20:00-05:00");
  const resumen = {
    fecha: "2026-10-02",
    tipoDia: "habil",
    score: 72.4,
    scoreAyer: 64,
    racha: 5,
    anillos: [
      { clave: "registro", nombre: "Registro", progreso: 0.75 },
      { clave: "cuerpo", nombre: "Cuerpo", progreso: 3.4 },
      { clave: "mente", nombre: "Mente", progreso: -1 },
    ],
    semana: Array.from({ length: 7 }, (_, i) => ({ fecha: sumarDias("2026-09-26", i), score: i === 2 ? null : 60 + i })),
    pendientes: [
      { clave: "almuerzo", emoji: "🍽️", texto: "Almuerzo", accion: "comida" },
      { clave: "rutina:x", emoji: "🚶", texto: "Caminar", accion: "rutina" },
    ],
    metricas: [{ clave: "disponible", valor: 19100 }],
  };
  const d = armarWidget({ resumen }, { ahora });
  assert.equal(d.score, 72);
  assert.deepEqual(d.anillos.map((a) => a.progreso), [0.75, 2, 0]);
  assert.deepEqual(d.semana.map((s) => s.dia).join(""), "SDLMMJV");
  assert.equal(d.semana[2].score, null);
  assert.equal(d.semana.at(-1).hoy, true);
  assert.equal(d.pendientes.primero, "🍽️ Almuerzo");
  assert.equal(d.bloqueo.detalle, "Falta almuerzo y caminar");
  assert.equal(d.bloqueo.titulo, "72 pts · 🔥5");
  assert.equal(d.rutina, null);
  assert.equal(d.dinero, undefined);
  assert.equal(armarWidget({ resumen }, { ahora, dinero: true }).dinero.disponibleHoy, 19100);
  assert.ok(Buffer.byteLength(JSON.stringify(armarWidget({ resumen }, { ahora, dinero: true }))) <= MAXIMO_BYTES);
});

test("los datos de ejemplo tienen todo lo que dibuja cada tamaño", () => {
  const d = ejemploWidget(new Date("2026-10-02T15:20:00-05:00"));
  for (const campo of ["score", "racha", "anillos", "semana", "pendientes", "rutina", "sueno", "desbloqueo", "frase", "bloqueo", "dinero"]) {
    assert.ok(d[campo] !== undefined && d[campo] !== null, campo);
  }
  assert.equal(d.ejemplo, true);
  assert.equal(d.dia, "viernes");
});
