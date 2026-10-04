// Conectar iPhone: lógica pura (web/js/conectar/logica.js y pasos.js).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MODULOS,
  cargarAtajos,
  conexionProbada,
  contarHechos,
  detalleLlave,
  estadoLlave,
  fechaCorta,
  marcarAtajo,
  moduloDeRuta,
  necesitaBienvenida,
  plataforma,
  pruebaRecibida,
  resumenListo,
  tiempoRelativo,
  todosLosAtajos,
  unirAtajos,
  urlBase,
} from "../web/js/conectar/logica.js";
import { PASOS, PERMISOS, indicePaso } from "../web/js/conectar/pasos.js";
import { RUTAS } from "../api/_lib/rutas.js";

const atajo = (id, extra = {}) => ({ id, emoji: "⚡", nombre: id, para: "Para algo.", pasos: ["Uno", "Dos"], ...extra });

// ── Primer uso ───────────────────────────────────────────────────────────

test("bienvenida: solo sin marca local y sin haberla completado en otro dispositivo", () => {
  assert.equal(necesitaBienvenida({ marcaLocal: false, ajustes: {} }), true);
  assert.equal(necesitaBienvenida({ marcaLocal: false, ajustes: { bienvenida: { completada: false } } }), true);
  assert.equal(necesitaBienvenida({ marcaLocal: true, ajustes: {} }), false);
  assert.equal(necesitaBienvenida({ marcaLocal: false, ajustes: { bienvenida: { completada: true, fecha: "2026-10-04T12:00:00Z" } } }), false);
  assert.equal(necesitaBienvenida({ marcaLocal: false, ajustes: null }), true);
  assert.equal(necesitaBienvenida(), true);
});

// ── Unir los ATAJOS de cada módulo ───────────────────────────────────────

test("unir: omite módulos vacíos, ordena por MODULOS y normaliza cada atajo", () => {
  const grupos = unirAtajos([
    { modulo: "finanzas", atajos: [atajo("finanzas-uno", { prueba: { metodo: "GET", ruta: "finanzas/menu" } })] },
    { modulo: "widgets", atajos: [] },
    { modulo: "sueno", atajos: null },
    { modulo: "conectar", atajos: [atajo("conectar-uno", { automatizacion: { disparador: "Hora del día", pasos: ["a"] } })] },
    { modulo: "nuevo", atajos: [atajo("nuevo-uno", { emoji: "" })] },
  ]);
  assert.deepEqual(
    grupos.map((g) => g.modulo),
    ["conectar", "finanzas", "nuevo"],
  );
  const [base, dinero, nuevo] = grupos;
  assert.equal(base.emoji, "⚙️");
  assert.equal(base.atajos[0].modulo, "conectar");
  assert.deepEqual(base.atajos[0].automatizaciones, [{ disparador: "Hora del día", pasos: ["a"] }]);
  assert.deepEqual(base.atajos[0].requisitos, []);
  assert.deepEqual(base.atajos[0].permisos, []);
  assert.equal(base.atajos[0].prueba, null);
  assert.deepEqual(dinero.atajos[0].prueba, { metodo: "GET", ruta: "finanzas/menu" });
  assert.equal(nuevo.nombre, "nuevo");
  assert.equal(nuevo.atajos[0].emoji, "⚡");
});

test("unir: `automatizaciones` (lista completa) manda sobre `automatizacion`", () => {
  const [grupo] = unirAtajos([
    {
      modulo: "sueno",
      atajos: [
        atajo("sueno-a", {
          automatizacion: { disparador: "Uno", pasos: [] },
          automatizaciones: [
            { disparador: "Uno", pasos: [] },
            { disparador: "Dos", pasos: [] },
            { pasos: ["sin disparador: se ignora"] },
          ],
        }),
      ],
    },
  ]);
  assert.deepEqual(
    grupo.atajos[0].automatizaciones.map((a) => a.disparador),
    ["Uno", "Dos"],
  );
});

test("unir: un id repetido es un error claro que nombra los dos módulos", () => {
  assert.throws(
    () =>
      unirAtajos([
        { modulo: "finanzas", atajos: [atajo("comun")] },
        { modulo: "rutina", atajos: [atajo("comun")] },
      ]),
    /Atajo repetido: "comun" está en finanzas y en rutina/,
  );
  assert.throws(() => unirAtajos([{ modulo: "rutina", atajos: [atajo("x"), atajo("x")] }]), /Atajo repetido: "x"/);
});

test("unir: atajos mal formados fallan con un mensaje que dice cuál", () => {
  assert.throws(() => unirAtajos([{ modulo: "finanzas", atajos: {} }]), /finanzas debe exportar ATAJOS como lista/);
  assert.throws(() => unirAtajos([{ modulo: "finanzas", atajos: [{ nombre: "Sin id", pasos: ["a"] }] }]), /atajo 1 de finanzas no tiene id/);
  assert.throws(() => unirAtajos([{ modulo: "finanzas", atajos: [atajo("f", { nombre: " " })] }]), /"f" no tiene nombre/);
  assert.throws(() => unirAtajos([{ modulo: "finanzas", atajos: [atajo("f", { pasos: [] })] }]), /"f" no tiene pasos/);
});

test("cargar: un módulo que no carga se omite sin romper el asistente", async () => {
  const avisos = [];
  const consola = console.warn;
  console.warn = (...args) => avisos.push(args.join(" "));
  try {
    const grupos = await cargarAtajos(async (modulo) => {
      if (modulo === "sueno") throw new Error("falla de red");
      if (modulo === "finanzas") return { ATAJOS: [atajo("finanzas-uno")] };
      return {};
    });
    assert.deepEqual(
      grupos.map((g) => g.modulo),
      ["finanzas"],
    );
    assert.ok(avisos.some((a) => a.includes("sueno")));
  } finally {
    console.warn = consola;
  }
});

test("cargar: los atajos reales de todos los módulos se unen sin ids repetidos y con pruebas que existen", async () => {
  const grupos = await cargarAtajos();
  const atajos = todosLosAtajos(grupos);
  assert.equal(grupos[0].modulo, "conectar", "la base va primero");
  assert.ok(atajos.length >= 14, `solo ${atajos.length} atajos`);
  assert.equal(new Set(atajos.map((a) => a.id)).size, atajos.length);
  for (const grupo of grupos) assert.ok(MODULOS.some((m) => m.id === grupo.modulo), `módulo sin nombre: ${grupo.modulo}`);
  for (const a of atajos) {
    if (a.prueba) {
      assert.ok(RUTAS[`${a.prueba.metodo} ${a.prueba.ruta}`], `${a.id}: la ruta de prueba no existe (${a.prueba.ruta})`);
      assert.equal(a.prueba.metodo, "GET", `${a.id}: probar no debe guardar nada`);
    }
    if (a.id !== "conectar-goat") assert.match(a.pasos.join(" "), /⚙️ Goat/, `${a.id} no usa el atajo base`);
  }
  // Sin montos en ningún texto (D-020).
  assert.doesNotMatch(JSON.stringify(atajos), /\$\s?\d/);
});

// ── Hechos ───────────────────────────────────────────────────────────────

test("hechos: cuenta solo los ids que existen y guarda solo los true", () => {
  const grupos = unirAtajos([{ modulo: "finanzas", atajos: [atajo("a"), atajo("b"), atajo("c")] }]);
  assert.deepEqual(contarHechos(grupos, { a: true, b: false, viejo: true }), { hechos: 1, total: 3 });
  assert.deepEqual(contarHechos(grupos, undefined), { hechos: 0, total: 3 });
  assert.deepEqual(marcarAtajo({ a: true, b: false }, "c", true), { a: true, c: true });
  assert.deepEqual(marcarAtajo({ a: true, c: true }, "a", false), { c: true });
  assert.deepEqual(marcarAtajo(null, "a", true), { a: true });
});

// ── Llaves ───────────────────────────────────────────────────────────────

test("llave: el token se ve solo recién creado; al recargar ya no existe", () => {
  const tokens = [{ id: "1", nombre: "iPhone", ultimo_uso: null, revocado: false }];
  const nueva = estadoLlave({ tokens, recien: { id: "1", nombre: "iPhone", token: "secreto-de-prueba" } });
  assert.equal(nueva.vista, "nueva");
  assert.equal(nueva.token, "secreto-de-prueba");
  // Al recargar la página solo queda lo que trae la base (sin token ni hash).
  const recargada = estadoLlave({ tokens, recien: null });
  assert.equal(recargada.vista, "activas");
  assert.equal(recargada.token, null);
  assert.ok(!JSON.stringify(recargada).includes("secreto"));
  assert.equal(estadoLlave({ tokens: [{ ...tokens[0], revocado: true }] }).vista, "crear");
  assert.equal(estadoLlave().vista, "crear");
});

test("probar conexión: cuenta un uso nuevo o muy reciente de una llave activa", () => {
  const desde = Date.parse("2026-10-04T15:00:00Z");
  const antes = { a: null, b: "2026-10-01T10:00:00Z" };
  const sinCambios = [
    { id: "a", nombre: "iPhone", ultimo_uso: null, revocado: false },
    { id: "b", nombre: "Widget", ultimo_uso: "2026-10-01T10:00:00Z", revocado: false },
  ];
  assert.equal(conexionProbada(sinCambios, antes, desde), null);
  // La API anota el uso (antes null): conectado.
  const usada = conexionProbada([{ ...sinCambios[0], ultimo_uso: "2026-10-04T15:00:20Z" }, sinCambios[1]], antes, desde);
  assert.equal(usada.id, "a");
  // Usada hace 40 s (la API solo anota una vez por minuto): también cuenta.
  const reciente = { id: "c", nombre: "iPhone", ultimo_uso: "2026-10-04T14:59:20Z", revocado: false };
  assert.equal(conexionProbada([reciente], { c: reciente.ultimo_uso }, desde)?.id, "c");
  // Una llave revocada nunca cuenta.
  assert.equal(conexionProbada([{ ...reciente, revocado: true }], {}, desde), null);
});

test("probar un atajo: busca llamadas nuevas a su parte de la API", () => {
  const prueba = { metodo: "GET", ruta: "sueno/resumen" };
  assert.equal(moduloDeRuta("sueno/resumen"), "sueno");
  assert.equal(pruebaRecibida([], prueba), null);
  assert.equal(pruebaRecibida([{ id: 5, ruta: "finanzas/menu", estado: 200 }], prueba), null);
  assert.deepEqual(pruebaRecibida([{ id: 6, ruta: "sueno/evento", estado: 201 }], prueba), { ok: { id: 6, ruta: "sueno/evento", estado: 201 } });
  assert.deepEqual(pruebaRecibida([{ id: 7, ruta: "sueno/evento", estado: 400 }], prueba), { error: { id: 7, ruta: "sueno/evento", estado: 400 } });
  assert.equal(pruebaRecibida([{ id: 8, ruta: "sueno/evento", estado: 200 }], null), null);
});

// ── Textos ───────────────────────────────────────────────────────────────

test("url de «⚙️ Goat»: el origen sin barra al final", () => {
  assert.equal(urlBase("https://goat.vercel.app"), "https://goat.vercel.app");
  assert.equal(urlBase("https://goat.vercel.app//"), "https://goat.vercel.app");
});

test("plataforma: iPhone, iPad (también el que dice Mac), Android y otro", () => {
  assert.equal(plataforma("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "ios");
  assert.equal(plataforma("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5), "ios");
  assert.equal(plataforma("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0), "otro");
  assert.equal(plataforma("Mozilla/5.0 (Linux; Android 14)"), "android");
  assert.equal(plataforma("Mozilla/5.0 (Windows NT 10.0)"), "otro");
});

test("tiempo relativo y fecha corta en español", () => {
  const ahora = new Date("2026-10-04T15:00:00-05:00");
  assert.equal(tiempoRelativo(null, ahora), "nunca");
  assert.equal(tiempoRelativo("2026-10-04T14:59:30-05:00", ahora), "hace un momento");
  assert.equal(tiempoRelativo("2026-10-04T14:35:00-05:00", ahora), "hace 25 min");
  assert.equal(tiempoRelativo("2026-10-04T12:00:00-05:00", ahora), "hace 3 h");
  assert.equal(tiempoRelativo("2026-10-03T10:00:00-05:00", ahora), "ayer");
  assert.equal(tiempoRelativo("2026-09-29T10:00:00-05:00", ahora), "hace 5 días");
  assert.equal(tiempoRelativo("2026-08-01T10:00:00-05:00", ahora), "1 ago");
  // Hora de Bogotá: las 02:00 UTC del 1 de octubre todavía son el 30 de septiembre.
  assert.match(fechaCorta("2026-10-01T02:00:00Z"), /^30 sept?$/);
  assert.equal(fechaCorta("2026-10-03T17:00:00Z"), "3 oct");
  assert.equal(
    detalleLlave({ nombre: "iPhone", creado_en: "2026-10-03T17:00:00Z", ultimo_uso: "2026-10-04T13:00:00-05:00" }, ahora),
    "Creada 3 oct · usada hace 2 h",
  );
  assert.equal(detalleLlave({ nombre: "iPhone", creado_en: "2026-10-03T17:00:00Z", ultimo_uso: null }, ahora), "Creada 3 oct · sin usar todavía");
});

test("listo: dice qué quedó y qué falta", () => {
  const vacio = resumenListo({ instalada: false, tokens: [], hechos: 0, total: 14 });
  assert.deepEqual(
    vacio.map((f) => f.listo),
    [false, false, false],
  );
  assert.match(vacio[1].detalle, /crear tu llave/);
  const sinProbar = resumenListo({ instalada: true, tokens: [{ id: "1", revocado: false, ultimo_uso: null }], hechos: 3, total: 14 });
  assert.match(sinProbar[1].detalle, /Goat · Probar/);
  assert.equal(sinProbar[2].detalle, "3 de 14 listos");
  const todo = resumenListo({ instalada: true, tokens: [{ id: "1", revocado: false, ultimo_uso: "2026-10-04T12:00:00Z" }], hechos: 14, total: 14 });
  assert.ok(todo.every((f) => f.listo));
});

// ── Pasos del asistente y permisos ───────────────────────────────────────

test("asistente: 7 pantallas en orden y un texto para el botón de cada una", () => {
  assert.deepEqual(
    PASOS.map((p) => p.id),
    ["hola", "instala", "conecta", "permisos", "atajos", "widgets", "listo"],
  );
  for (const paso of PASOS) assert.ok(paso.principal.length > 0);
  assert.equal(indicePaso("atajos"), 4);
  assert.equal(indicePaso("no-existe"), 0);
});

test("permisos: explica cada uno que iOS pedirá, con qué tocar y para qué", () => {
  const texto = JSON.stringify(PERMISOS);
  for (const palabra of ["Salud", "Análisis del sueño", "Pasos", "Distancia", "Recordatorios", "Permitir acceso completo", "Notificaciones", "Ejecutar inmediatamente", "Notificar al ejecutar", "Horario de sueño", "Permitir siempre"]) {
    assert.ok(texto.includes(palabra), `falta "${palabra}"`);
  }
  for (const p of PERMISOS) for (const campo of ["emoji", "titulo", "tocar", "que", "para"]) assert.ok(p[campo], `${p.titulo}: falta ${campo}`);
  assert.doesNotMatch(texto, /\$\s?\d/);
});
