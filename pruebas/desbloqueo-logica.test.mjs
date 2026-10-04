// Reglas del desbloqueo (web/js/desbloqueo/logica.js): niveles, minutos usados, pase y mensajes (D-054).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ajustesDesbloqueo,
  buscarApp,
  comoRegistrar,
  estadoApp,
  estadoDesbloqueo,
  listaApps,
  mensajeGate,
  minutosUsados,
  nivel,
  pista,
  sesionesDelDia,
  siguienteNivel,
  slugApp,
  usoPorHora,
} from "../web/js/desbloqueo/logica.js";

const F = "2026-10-02";
const en = (hora, fecha = F) => new Date(`${fecha}T${hora}:00-05:00`);
const ev = (app, evento, hora, extra = {}) => ({ app, evento, momento: en(hora).toISOString(), fecha: F, ...extra });
const pase = (app, hora, minutos = 10) => ({ app, minutos, momento: en(hora).toISOString(), fecha: F });

const PENDIENTE_ALMUERZO = { clave: "almuerzo", emoji: "🍽️", texto: "Almuerzo", accion: "comida" };
const alDia = (score) => ({ score, pendientes: [] });
const atrasado = (score = 90, pendientes = [PENDIENTE_ALMUERZO]) => ({ score, pendientes });

// ── Niveles ──────────────────────────────────────────────────────────────

test("niveles por defecto: atrasado 0 · al día 30 · 80+ 60 · 100 90", () => {
  assert.equal(nivel(atrasado(100)).minutos, 0);
  assert.equal(nivel(atrasado(100)).indice, -1);
  assert.equal(nivel(alDia(0)).minutos, 30);
  assert.equal(nivel(alDia(46)).minutos, 30);
  assert.equal(nivel(alDia(79)).minutos, 30);
  assert.equal(nivel(alDia(80)).minutos, 60);
  assert.equal(nivel(alDia(85)).minutos, 60);
  assert.equal(nivel(alDia(99)).minutos, 60);
  assert.equal(nivel(alDia(100)).minutos, 90);
  assert.equal(nivel(alDia(46)).nombre, "Registros al día");
  assert.equal(nivel(alDia(85)).nombre, "80+ puntos");
  assert.equal(nivel(alDia(100)).nombre, "100 puntos");
});

test("siguiente nivel: cuántos puntos faltan y qué se gana", () => {
  assert.deepEqual(siguienteNivel(alDia(68)), { puntaje: 80, minutos: 60, nombre: "80+ puntos", faltanPuntos: 12, requiereRegistros: false });
  assert.equal(siguienteNivel(alDia(85)).minutos, 90);
  assert.equal(siguienteNivel(alDia(100)), null);
  const trasAtraso = siguienteNivel(atrasado());
  assert.equal(trasAtraso.minutos, 30);
  assert.equal(trasAtraso.requiereRegistros, true);
});

test("niveles personalizados en perfil.ajustes.desbloqueo.niveles", () => {
  const ajustes = { niveles: [{ puntaje: 70, minutos: 45 }, { puntaje: 0, minutos: 20 }, { puntaje: 95, minutos: 120 }] };
  const { niveles } = ajustesDesbloqueo(ajustes);
  assert.deepEqual(niveles, [
    { puntaje: 0, minutos: 20 },
    { puntaje: 70, minutos: 45 },
    { puntaje: 95, minutos: 120 },
  ]);
  assert.equal(nivel(alDia(50), niveles).minutos, 20);
  assert.equal(nivel(alDia(70), niveles).minutos, 45);
  assert.equal(nivel(alDia(96), niveles).minutos, 120);
  const estado = estadoApp({ resumen: alDia(72), app: "tiktok", ajustes, ahora: en("20:00") });
  assert.equal(estado.ganados, 45);
});

test("niveles personalizados raros: se ignoran o se corrigen", () => {
  // Basura → los de siempre.
  assert.deepEqual(ajustesDesbloqueo({ niveles: "mucho" }).niveles, [
    { puntaje: 0, minutos: 30 },
    { puntaje: 80, minutos: 60 },
    { puntaje: 100, minutos: 90 },
  ]);
  assert.deepEqual(ajustesDesbloqueo({ niveles: [{ puntaje: 150, minutos: 10 }, { puntaje: 50, minutos: -5 }] }).niveles.length, 3);
  // Sin nivel 0: se agrega "al día" con 30 min. Un nivel más alto nunca da menos.
  assert.deepEqual(ajustesDesbloqueo({ niveles: [{ puntaje: 80, minutos: 20 }] }).niveles, [
    { puntaje: 0, minutos: 30 },
    { puntaje: 80, minutos: 30 },
  ]);
});

// ── Apps y juegos ────────────────────────────────────────────────────────

test("apps: TikTok, Instagram, YouTube + juegos limpios y sin repetir", () => {
  assert.equal(slugApp("Clash Royale"), "clash-royale");
  assert.equal(slugApp("  TikTok "), "tiktok");
  assert.equal(slugApp("Pokémon GO!"), "pokemon-go");
  const ajustes = {
    juegos: [
      { id: "clash-royale", nombre: "Clash Royale" },
      { nombre: "Clash Royale" }, // repetido
      { nombre: "TikTok" }, // ya es fija
      { nombre: "   " }, // vacío
      "Fortnite",
      { nombre: "x".repeat(80) }, // largo: se recorta
    ],
  };
  const apps = listaApps(ajustes);
  assert.deepEqual(
    apps.map((a) => a.id),
    ["tiktok", "instagram", "youtube", "clash-royale", "fortnite", "x".repeat(30)],
  );
  assert.equal(apps[3].emoji, "🎮");
  assert.equal(buscarApp("CLASH ROYALE", ajustes).nombre, "Clash Royale");
  // Una app que no está en la lista igual tiene su bolsa.
  assert.deepEqual(buscarApp("free-fire", ajustes), { id: "free-fire", nombre: "Free Fire", emoji: "🎮" });
  // Máximo 12 juegos.
  const muchos = { juegos: Array.from({ length: 20 }, (_, i) => ({ nombre: `Juego ${i}` })) };
  assert.equal(ajustesDesbloqueo(muchos).juegos.length, 12);
});

// ── Minutos usados ───────────────────────────────────────────────────────

test("minutos usados: suma los pares abrir → cerrar de esa app", () => {
  const eventos = [
    ev("tiktok", "abrir", "09:00"),
    ev("tiktok", "cerrar", "09:12"),
    ev("instagram", "abrir", "10:00"),
    ev("instagram", "cerrar", "10:40"),
    ev("tiktok", "abrir", "13:00"),
    ev("tiktok", "cerrar", "13:05"),
  ];
  assert.equal(minutosUsados(eventos, "tiktok", en("20:00")), 17);
  assert.equal(minutosUsados(eventos, "instagram", en("20:00")), 40);
  assert.equal(minutosUsados(eventos, "youtube", en("20:00")), 0);
  // Un par largo y cerrado cuenta completo (no tiene tope).
  assert.equal(minutosUsados([ev("youtube", "abrir", "14:00"), ev("youtube", "cerrar", "15:30")], "youtube", en("20:00")), 90);
});

test("apertura sin cierre: cuenta hasta ahora, como máximo 30 min", () => {
  const abierta = [ev("tiktok", "abrir", "20:00")];
  assert.equal(minutosUsados(abierta, "tiktok", en("20:10")), 10);
  assert.equal(minutosUsados(abierta, "tiktok", en("21:45")), 30);
  // Dos aperturas seguidas: la primera termina en la segunda (y con tope de 30).
  const dos = [ev("tiktok", "abrir", "18:00"), ev("tiktok", "abrir", "18:20"), ev("tiktok", "cerrar", "18:25")];
  assert.equal(minutosUsados(dos, "tiktok", en("20:00")), 25);
  const lejos = [ev("tiktok", "abrir", "08:00"), ev("tiktok", "abrir", "12:00"), ev("tiktok", "cerrar", "12:10")];
  assert.equal(minutosUsados(lejos, "tiktok", en("20:00")), 40);
  const [sesion] = sesionesDelDia(abierta, en("20:10"));
  assert.equal(sesion.enCurso, true);
  assert.equal(sesionesDelDia(abierta, en("21:00"))[0].enCurso, false);
});

test("cierres sin apertura, eventos de otro día y del futuro se ignoran", () => {
  const eventos = [
    ev("tiktok", "cerrar", "09:00"),
    { app: "tiktok", evento: "abrir", momento: en("22:00", "2026-10-01").toISOString(), fecha: "2026-10-01" },
    ev("tiktok", "abrir", "10:00"),
    ev("tiktok", "cerrar", "10:05"),
    ev("tiktok", "cerrar", "10:30"), // doble cierre
    ev("tiktok", "abrir", "23:00"), // todavía no pasa
  ];
  assert.equal(minutosUsados(eventos, "tiktok", en("20:00")), 5);
  // Sin `fecha` (como llega del servidor recién creado), se calcula con el día lógico.
  const sinFecha = [{ app: "tiktok", evento: "abrir", momento: en("02:00", "2026-10-03").toISOString() }];
  assert.equal(minutosUsados(sinFecha, "tiktok", en("02:10", "2026-10-03")), 10);
});

test("uso por hora: 24 columnas desde las 04:00, una sesión se reparte entre horas", () => {
  const sesiones = sesionesDelDia([ev("tiktok", "abrir", "09:50"), ev("tiktok", "cerrar", "10:20")], en("20:00"));
  const horas = usoPorHora(sesiones, en("20:00"));
  assert.equal(horas.length, 24);
  assert.equal(horas[5], 10); // 09:00–10:00
  assert.equal(horas[6], 20); // 10:00–11:00
  assert.equal(horas.reduce((a, b) => a + b, 0), 30);
});

// ── Restantes y pase ─────────────────────────────────────────────────────

test("restantes = ganados + pase − usados, nunca negativos", () => {
  const eventos = [ev("tiktok", "abrir", "09:00"), ev("tiktok", "cerrar", "09:18")];
  const e = estadoApp({ resumen: alDia(50), eventos, app: "TikTok", ahora: en("20:00") });
  assert.equal(e.app, "tiktok");
  assert.equal(e.ganados, 30);
  assert.equal(e.usados, 18);
  assert.equal(e.restantes, 12);
  assert.equal(e.permitido, true);
  // Se pasó del tiempo (la puerta no saca a nadie de la app): 0, no negativo.
  const largo = [ev("tiktok", "abrir", "09:00"), ev("tiktok", "cerrar", "10:15")];
  const pasado = estadoApp({ resumen: alDia(50), eventos: largo, app: "tiktok", ahora: en("20:00") });
  assert.equal(pasado.restantes, 0);
  assert.equal(pasado.permitido, false);
});

test("si el puntaje baja de nivel, lo usado no se devuelve", () => {
  const eventos = [ev("youtube", "abrir", "15:00"), ev("youtube", "cerrar", "15:50")];
  const arriba = estadoApp({ resumen: alDia(85), eventos, app: "youtube", ahora: en("16:00") });
  assert.equal(arriba.restantes, 10);
  const abajo = estadoApp({ resumen: alDia(60), eventos, app: "youtube", ahora: en("16:00") });
  assert.equal(abajo.restantes, 0);
});

test("cada app tiene su propia bolsa", () => {
  const eventos = [ev("tiktok", "abrir", "09:00"), ev("tiktok", "cerrar", "09:30")];
  const ajustes = { juegos: [{ nombre: "Clash Royale" }] };
  const todo = estadoDesbloqueo({ resumen: alDia(50), eventos, ajustes, ahora: en("20:00") });
  const por = Object.fromEntries(todo.apps.map((a) => [a.app, a.restantes]));
  assert.deepEqual(por, { tiktok: 0, instagram: 30, youtube: 30, "clash-royale": 30 });
});

test("pase de emergencia: suma 10 a esa app, solo 1 vez al día", () => {
  const resumen = atrasado();
  const sin = estadoApp({ resumen, app: "instagram", ahora: en("20:00") });
  assert.equal(sin.restantes, 0);
  assert.equal(sin.paseDisponible, true);

  const conPase = estadoApp({ resumen, pases: [pase("instagram", "19:00")], app: "instagram", ahora: en("20:00") });
  assert.equal(conPase.pase, 10);
  assert.equal(conPase.restantes, 10);
  assert.equal(conPase.permitido, true);
  assert.equal(conPase.paseDisponible, false);
  // Para otra app no suma, y ya no queda pase.
  const otra = estadoApp({ resumen, pases: [pase("instagram", "19:00")], app: "tiktok", ahora: en("20:00") });
  assert.equal(otra.restantes, 0);
  assert.equal(otra.paseDisponible, false);
  // Si por error hubiera dos el mismo día, solo vale el primero.
  const dos = estadoApp({ resumen, pases: [pase("instagram", "19:00"), pase("instagram", "19:30")], app: "instagram", ahora: en("20:00") });
  assert.equal(dos.pase, 10);
  // El de ayer no cuenta hoy.
  const ayer = { app: "instagram", minutos: 10, momento: en("21:00", "2026-10-01").toISOString(), fecha: "2026-10-01" };
  assert.equal(estadoApp({ resumen, pases: [ayer], app: "instagram", ahora: en("20:00") }).paseDisponible, true);
  // Pase + minutos usados: 10 de pase, 4 usados → 6.
  const usados = [ev("instagram", "abrir", "19:01"), ev("instagram", "cerrar", "19:05")];
  assert.equal(estadoApp({ resumen, eventos: usados, pases: [pase("instagram", "19:00")], app: "instagram", ahora: en("20:00") }).restantes, 6);
});

test("estado completo: abierto/cerrado, apps vistas hoy aunque no estén en la lista y pase usado", () => {
  const eventos = [ev("free-fire", "abrir", "11:00"), ev("free-fire", "cerrar", "11:10")];
  const todo = estadoDesbloqueo({ resumen: atrasado(), eventos, pases: [pase("tiktok", "12:00")], ahora: en("20:00") });
  assert.equal(todo.abierto, false);
  assert.ok(todo.apps.some((a) => a.app === "free-fire" && a.nombre === "Free Fire"));
  assert.deepEqual(todo.paseUsado.app, "tiktok");
  assert.equal(todo.usadosTotal, 10);
  assert.equal(todo.niveles.length, 3);
  assert.equal(estadoDesbloqueo({ resumen: alDia(90), ahora: en("20:00") }).abierto, true);
});

// ── Mensajes ─────────────────────────────────────────────────────────────

test("mensajes de la puerta: emoji + pocas palabras, sin montos", () => {
  const eventos = [ev("tiktok", "abrir", "09:00"), ev("tiktok", "cerrar", "09:18")];
  const si = estadoApp({ resumen: alDia(85), eventos, app: "tiktok", ahora: en("20:00") });
  assert.equal(mensajeGate(si), "✅ 42 min en TikTok");

  const falta = estadoApp({ resumen: atrasado(), app: "tiktok", ahora: en("20:00") });
  assert.equal(mensajeGate(falta), "🔒 Falta: almuerzo");
  const tres = atrasado(10, [
    { clave: "desayuno", texto: "Desayuno" },
    { clave: "almuerzo", texto: "Almuerzo" },
    { clave: "checkin_finanzas", texto: "Check-in de gastos" },
  ]);
  assert.equal(mensajeGate(estadoApp({ resumen: tres, app: "tiktok", ahora: en("20:00") })), "🔒 Falta: desayuno y almuerzo (+1)");

  const largo = [ev("tiktok", "abrir", "09:00"), ev("tiktok", "cerrar", "10:15")];
  const acabado = estadoApp({ resumen: alDia(50), eventos: largo, app: "tiktok", ahora: en("20:00") });
  assert.equal(mensajeGate(acabado), "⏳ Se acabó TikTok por hoy");

  for (const e of [si, falta, acabado]) {
    assert.doesNotMatch(mensajeGate(e), /\$/);
    assert.doesNotMatch(pista(e), /\$/);
  }
});

test("pista: cómo ganar más minutos", () => {
  assert.equal(pista(estadoApp({ resumen: alDia(68), app: "tiktok", ahora: en("20:00") })), "Te faltan 12 puntos para 60 min por app.");
  assert.equal(pista(estadoApp({ resumen: alDia(99), app: "tiktok", ahora: en("20:00") })), "Te falta 1 punto para 90 min por app.");
  assert.equal(pista(estadoApp({ resumen: alDia(100), app: "tiktok", ahora: en("20:00") })), "Nivel máximo. Hoy no hay más que ganar.");
  assert.equal(pista(estadoApp({ resumen: atrasado(), app: "tiktok", ahora: en("20:00") })), "Registra lo que falta y se abre con 30 min por app.");
});

test("cómo registrar: atajo de iPhone si existe; si no, la web", () => {
  const gasto = comoRegistrar({ clave: "cierre_finanzas", accion: "gasto" }, "https://goat.example");
  assert.equal(gasto.atajo, "💸 Movimiento");
  assert.equal(gasto.abrir, "shortcuts://run-shortcut?name=%F0%9F%92%B8%20Movimiento");
  const comida = comoRegistrar({ clave: "almuerzo", accion: "comida" }, "https://goat.example");
  assert.equal(comida.atajo, null);
  assert.equal(comida.abrir, "https://goat.example/index.html#registrar=comida");
  assert.equal(comoRegistrar({ accion: "comida" }).abrir, null);
  assert.equal(comoRegistrar({ accion: "rutina" }).web, "rutina.html");
});
