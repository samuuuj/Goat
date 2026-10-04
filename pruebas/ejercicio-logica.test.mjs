// Reglas de ejercicio (web/js/ejercicio/logica.js): duración, día lógico, ritmo, en curso, semana vs meta,
// historial y cubreBloque (lo usa la integración con la Rutina).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agrupar,
  combinar,
  cubreBloque,
  decimalFlexible,
  detalleSesion,
  duracion,
  enCurso,
  enteroFlexible,
  etiquetaSemana,
  fechaCalendario,
  fechaDe,
  formatoCronometro,
  formatoRitmo,
  fraseSemana,
  horarioSugerido,
  instantesDesdeHoras,
  instantesRecientes,
  lunesDe,
  mensajeGuardada,
  nuevaEnCurso,
  rangoHoras,
  resumenSemana,
  ritmo,
  terminar,
  tipoDesdeTexto,
  rutinaDesdeTexto,
  tituloSesion,
  validarSesion,
} from "../web/js/ejercicio/logica.js";

const bogota = (texto) => new Date(`${texto}-05:00`);
const AHORA = bogota("2026-10-03T12:00:00");

test("sesión 07:10–08:05 → 55 min, del 2 de octubre", () => {
  const { fila } = validarSesion(
    { tipo: "fuerza", rutina: "empuje", inicio: bogota("2026-10-02T07:10:00"), fin: bogota("2026-10-02T08:05:00") },
    AHORA,
  );
  assert.equal(fila.duracion_min, 55);
  assert.equal(duracion(fila), 55);
  assert.equal(fechaDe(fila), "2026-10-02");
  assert.equal(fila.momento, fila.inicio);
  assert.equal(rangoHoras(fila), "07:10–08:05");
  assert.equal(tituloSesion(fila), "Fuerza · Empuje");
  assert.equal(mensajeGuardada(fila), "✅ 55 min");
});

test("entreno que cruza la medianoche antes de las 04:00 → día lógico anterior", () => {
  const r = instantesDesdeHoras("2026-10-02", "23:30", "00:40");
  assert.equal(r.inicio.toISOString(), bogota("2026-10-02T23:30:00").toISOString());
  assert.equal(r.fin.toISOString(), bogota("2026-10-03T00:40:00").toISOString());
  const { fila } = validarSesion({ tipo: "trote", inicio: r.inicio, fin: r.fin }, AHORA);
  assert.equal(fila.duracion_min, 70);
  assert.equal(fechaDe(fila), "2026-10-02");

  // Empezar a la 01:00 sigue siendo el día lógico anterior.
  const madrugada = instantesDesdeHoras("2026-10-02", "01:00", "01:45");
  assert.equal(madrugada.inicio.toISOString(), bogota("2026-10-03T01:00:00").toISOString());
  assert.equal(fechaDe({ inicio: madrugada.inicio }), "2026-10-02");

  // 03:30 → 04:20 cruza el corte: termina al otro lado, mismo entreno.
  const corte = instantesDesdeHoras("2026-10-02", "03:30", "04:20");
  assert.equal((corte.fin - corte.inicio) / 60000, 50);
});

test("hoja de Hoy: sugiere fin = ahora e inicio = ahora − 60 min, y entiende 'lo de anoche'", () => {
  assert.deepEqual(horarioSugerido(bogota("2026-10-02T18:42:31")), { fecha: "2026-10-02", inicio: "17:42", fin: "18:42" });
  assert.deepEqual(horarioSugerido(bogota("2026-10-03T00:30:00")), { fecha: "2026-10-02", inicio: "23:30", fin: "00:30" });
  const anoche = instantesRecientes(bogota("2026-10-03T10:00:00"), "23:00", "23:45");
  assert.equal(anoche.inicio.toISOString(), bogota("2026-10-02T23:00:00").toISOString());
  const hoy = instantesRecientes(bogota("2026-10-03T10:00:00"), "07:00", "08:00");
  assert.equal(hoy.inicio.toISOString(), bogota("2026-10-03T07:00:00").toISOString());
});

test("validar: fin antes del inicio, más de 6 h, en el futuro, tipo y rutina", () => {
  const base = { tipo: "fuerza", inicio: bogota("2026-10-02T07:00:00"), fin: bogota("2026-10-02T08:00:00") };
  assert.ok(validarSesion(base, AHORA).fila);
  assert.match(validarSesion({ ...base, tipo: "yoga" }, AHORA).error, /tipo/);
  assert.match(validarSesion({ ...base, fin: bogota("2026-10-02T06:00:00") }, AHORA).error, /antes/);
  assert.match(validarSesion({ ...base, fin: bogota("2026-10-02T13:30:00") }, AHORA).error, /6 horas/);
  assert.match(validarSesion({ ...base, fin: bogota("2026-10-03T13:00:00"), inicio: bogota("2026-10-03T12:30:00") }, AHORA).error, /futuro/);
  assert.match(validarSesion({ ...base, rutina: "brazo de mono" }, AHORA).error, /rutina/);
  // La rutina solo aplica a fuerza; caminata no la guarda.
  assert.equal(validarSesion({ ...base, tipo: "caminata", rutina: "empuje" }, AHORA).fila.rutina, null);
  // Texto de los atajos.
  assert.equal(validarSesion({ ...base, tipo: "🏋️ Fuerza", rutina: "Tirón" }, AHORA).fila.rutina, "tiron");
  assert.match(validarSesion({ ...base, notas: "x".repeat(501) }, AHORA).error, /notas/);
  assert.match(validarSesion({ ...base, tipo: "trote", distancia_km: "200" }, AHORA).error, /distancia/);
});

test("caminata con km → ritmo; fuerza ignora la distancia", () => {
  const { fila } = validarSesion(
    { tipo: "caminata", inicio: bogota("2026-10-02T06:00:00"), fin: bogota("2026-10-02T06:45:00"), distancia_km: "4,5" },
    AHORA,
  );
  assert.equal(fila.distancia_km, 4.5);
  assert.equal(ritmo(4.5, 45), 10);
  assert.equal(formatoRitmo(ritmo(4.5, 45)), "10:00 /km");
  assert.equal(formatoRitmo(ritmo(5, 32.5)), "6:30 /km");
  assert.equal(detalleSesion(fila), "4,5 km · 10:00 /km");
  assert.equal(mensajeGuardada(fila), "✅ 45 min · 4,5 km");
  assert.equal(ritmo(0, 30), null);
  assert.equal(ritmo(3, 0), null);
  const fuerza = validarSesion(
    { tipo: "fuerza", inicio: bogota("2026-10-02T06:00:00"), fin: bogota("2026-10-02T06:45:00"), distancia_km: 3 },
    AHORA,
  ).fila;
  assert.equal(fuerza.distancia_km, null);
});

test("en curso → terminar: duración y fin; olvidada a las +6 h queda sin fin (no se inventa)", () => {
  const { fila } = nuevaEnCurso({ tipo: "trote" }, bogota("2026-10-03T06:00:00"));
  assert.equal(fila.en_curso, true);
  assert.equal(fila.fin, null);
  const activa = enCurso([{ tipo: "fuerza", inicio: bogota("2026-10-01T06:00:00").toISOString(), fin: bogota("2026-10-01T07:00:00").toISOString() }, fila], bogota("2026-10-03T06:25:10"));
  assert.equal(activa.sesion, fila);
  assert.equal(activa.olvidada, false);
  assert.equal(formatoCronometro(activa.transcurridoMs), "25:10");
  assert.equal(duracion(fila, bogota("2026-10-03T06:25:10")), 25);

  const fin = terminar(fila, bogota("2026-10-03T06:40:00"), { distancia_km: 6.2 });
  assert.equal(fin.olvidada, false);
  assert.deepEqual(fin.cambios, { en_curso: false, fin: bogota("2026-10-03T06:40:00").toISOString(), duracion_min: 40, distancia_km: 6.2 });

  assert.match(terminar(fila, bogota("2026-10-03T05:00:00")).error, /antes/);
  const tarde = terminar(fila, bogota("2026-10-03T13:00:00"));
  assert.equal(tarde.olvidada, true);
  assert.equal(tarde.cambios.fin, null);
  assert.equal(enCurso([fila], bogota("2026-10-03T13:00:00")).olvidada, true);
  assert.equal(enCurso([], AHORA), null);
  assert.equal(formatoCronometro(3_909_000), "1:05:09");
});

test("semana contra la meta: caminata y movilidad no suman entrenos; pasos promedio", () => {
  const lunes = "2026-09-28";
  assert.equal(lunesDe("2026-10-03"), lunes);
  const s = (dia, tipo, desde, hasta, km) => ({
    tipo,
    inicio: bogota(`${dia}T${desde}:00`).toISOString(),
    fin: bogota(`${dia}T${hasta}:00`).toISOString(),
    distancia_km: km ?? null,
  });
  const sesiones = [
    s("2026-09-28", "fuerza", "17:00", "18:00"),
    s("2026-09-29", "caminata", "06:00", "06:45", 4),
    s("2026-09-30", "trote", "06:00", "06:30", 5),
    s("2026-10-01", "fuerza", "17:00", "18:10"),
    s("2026-10-02", "movilidad", "21:00", "21:15"),
    s("2026-09-27", "fuerza", "17:00", "18:00"), // domingo anterior: otra semana
    { rutina: "pierna", momento: bogota("2026-10-03T09:00:00").toISOString() }, // registro viejo de Hoy
  ];
  const actividad = [
    { fecha: "2026-09-28", pasos: 8000, distancia_km: 6 },
    { fecha: "2026-09-29", pasos: 10000, distancia_km: 7.5 },
    { fecha: "2026-09-20", pasos: 99999 },
  ];
  const r = resumenSemana(sesiones, { gym_semana: 4 }, lunes, actividad);
  assert.equal(r.domingo, "2026-10-04");
  assert.equal(r.sesiones, 6);
  assert.equal(r.entrenos, 4); // fuerza ×2, trote y el viejo (fuerza)
  assert.equal(r.faltan, 0);
  assert.equal(r.cumplimiento, 1);
  assert.equal(r.minutos, 60 + 45 + 30 + 70 + 15);
  assert.equal(r.km, 9);
  assert.equal(r.pasosPromedio, 9000);
  assert.equal(r.kmCaminando, 13.5);
  assert.deepEqual(r.porTipo.map((t) => [t.tipo, t.total]), [["fuerza", 3], ["caminata", 1], ["trote", 1], ["movilidad", 1]]);
  assert.equal(r.dias[1].minutos, 45);
  assert.equal(fraseSemana(r), "Semana cumplida 🏋️");

  const poco = resumenSemana(sesiones.slice(0, 2), { gym_semana: 4 }, lunes);
  assert.equal(poco.entrenos, 1);
  assert.equal(poco.faltan, 3);
  assert.equal(fraseSemana(poco), "Te faltan 3 entrenos esta semana.");
  assert.equal(poco.pasosPromedio, null);
  // Sin meta guardada usa 4.
  assert.equal(resumenSemana([], {}, lunes).meta, 4);
});

test("historial agrupado por semana y por tipo", () => {
  const s = (inicio, tipo, minutos) => ({
    tipo,
    inicio: bogota(inicio).toISOString(),
    fin: new Date(bogota(inicio).getTime() + minutos * 60000).toISOString(),
  });
  const lista = [
    s("2026-09-22T07:00:00", "fuerza", 60),
    s("2026-10-01T07:00:00", "caminata", 45),
    s("2026-09-29T07:00:00", "fuerza", 50),
    s("2026-09-28T03:00:00", "trote", 30), // madrugada del lunes = domingo lógico → semana anterior
  ];
  const semanas = agrupar(lista, "semana");
  assert.deepEqual(semanas.map((g) => [g.clave, g.total, g.minutos]), [["2026-09-28", 2, 95], ["2026-09-21", 2, 90]]);
  assert.equal(semanas[0].sesiones[0].tipo, "caminata"); // lo más reciente primero
  const tipos = agrupar(lista, "tipo");
  assert.deepEqual(tipos.map((g) => g.clave), ["fuerza", "caminata", "trote"]);
  assert.equal(etiquetaSemana("2026-09-28", "2026-09-28"), "Esta semana");
  assert.equal(etiquetaSemana("2026-09-21", "2026-09-28"), "Semana pasada");
  assert.match(etiquetaSemana("2026-09-14", "2026-09-28"), /^Semana del 14 sept?$/);
});

test("cubreBloque: solape de 80% sí, de 50% no; tipos compatibles", () => {
  const sesion = (tipo, desde, hasta) => ({
    tipo,
    inicio: bogota(`2026-10-02T${desde}:00`).toISOString(),
    fin: bogota(`2026-10-02T${hasta}:00`).toISOString(),
  });
  const caminar = { tipo: "caminar", inicio: bogota("2026-10-02T06:00:00").toISOString(), fin: bogota("2026-10-02T06:50:00").toISOString() };
  assert.equal(cubreBloque(sesion("caminata", "06:10", "06:55"), caminar), true); // 40 de 50 = 80%
  assert.equal(cubreBloque(sesion("caminata", "06:25", "06:50"), caminar), false); // 25 de 50 = 50%
  assert.equal(cubreBloque(sesion("trote", "06:00", "06:50"), caminar), true);
  assert.equal(cubreBloque(sesion("fuerza", "06:00", "06:50"), caminar), false); // tipo incompatible
  // Bloque de plantilla (hora + duración) en el día de la sesión.
  const ejercicio = { tipo: "ejercicio", hora_inicio: "17:00:00", duracion_min: 60, dias: [5] }; // viernes
  assert.equal(cubreBloque(sesion("fuerza", "16:55", "17:50"), ejercicio), true);
  assert.equal(cubreBloque(sesion("cardio", "17:30", "18:30"), ejercicio), false);
  assert.equal(cubreBloque(sesion("fuerza", "16:55", "17:50"), { ...ejercicio, dias: [1, 2] }), false);
  // En curso (sin fin) todavía no cubre nada.
  assert.equal(cubreBloque({ tipo: "caminata", inicio: caminar.inicio, en_curso: true }, caminar), false);
});

test("lo que mandan los atajos: tipos, rutinas y números del iPhone", () => {
  assert.equal(tipoDesdeTexto("🏃 Trote"), "trote");
  assert.equal(tipoDesdeTexto("CAMINATA"), "caminata");
  assert.equal(tipoDesdeTexto("natación"), null);
  assert.equal(rutinaDesdeTexto("Full body"), "full");
  assert.equal(enteroFlexible(8432.4), 8432);
  assert.equal(enteroFlexible("8.432"), 8432);
  assert.equal(enteroFlexible("8432.0"), 8432);
  assert.equal(enteroFlexible("12.345.678"), 12345678);
  assert.equal(enteroFlexible("hola"), null);
  assert.equal(decimalFlexible("3,25"), 3.25);
  assert.equal(decimalFlexible("1.234,5"), 1234.5);
  assert.equal(decimalFlexible(""), null);
  assert.equal(fechaCalendario(bogota("2026-10-03T00:30:00")), "2026-10-03");
});

test("combinar: lo pendiente en el teléfono gana y lo borrado desaparece", () => {
  const servidor = [
    { id: "1", id_cliente: "a", tipo: "fuerza", en_curso: true },
    { id: "2", id_cliente: "b", tipo: "trote" },
    { id: "3", tipo: "fuerza" },
  ];
  const r = combinar(servidor, [
    { fila: { id_cliente: "a", en_curso: false, fin: "x" } },
    { fila: { id: "3" }, borrar: true },
    { fila: { id_cliente: "c", tipo: "caminata" } },
  ]);
  assert.equal(r.length, 3);
  assert.equal(r.find((s) => s.id_cliente === "a").en_curso, false);
  assert.equal(r.find((s) => s.id_cliente === "a").id, "1");
  assert.ok(r.find((s) => s.id_cliente === "c").pendiente);
  assert.ok(!r.some((s) => s.id === "3"));
});
