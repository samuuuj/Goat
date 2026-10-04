// Reglas de la rutina (web/js/rutina/logica.js): plantilla desde la encuesta, días, estados, vencidos y tareas.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ENCUESTA_BASE,
  aHora,
  aMinutos,
  ahoraYSiguiente,
  bloqueActual,
  bloqueParaMarcar,
  bloquesDelDia,
  choques,
  cumplimiento,
  estadoDelDia,
  generarPlantilla,
  isoBogota,
  obligatoriosVencidos,
  ordenarTareas,
  paraCuando,
  semana,
  siguiente,
  textoDias,
  tipoDia,
} from "../web/js/rutina/logica.js";
import { ENCUESTA_SAMUEL, plantillaSamuel } from "./ayuda/rutina.mjs";

const MARTES = "2026-10-06";
const LUNES = "2026-10-05";
const FESTIVO = "2026-10-12"; // Día de la Raza (lunes)
const FESTIVOS = [{ fecha: FESTIVO, nombre: "Día de la Raza" }];
const a = (fecha, hora) => new Date(`${fecha}T${hora}:00-05:00`);

const plantilla = () => plantillaSamuel();
const resumen = (lista) => lista.map((b) => `${aHora(b.inicioMin)} ${b.titulo}`);

test("horas: texto ↔ minutos, ISO con zona de Bogotá y nombres de días", () => {
  assert.equal(aMinutos("06:10"), 370);
  assert.equal(aMinutos("06:10:00"), 370);
  assert.equal(aMinutos("25:00"), null);
  assert.equal(aHora(1470), "00:30");
  assert.equal(isoBogota(Date.parse("2026-10-06T11:10:00Z")), "2026-10-06T06:10:00-05:00");
  assert.equal(textoDias([1, 2, 3, 4, 5]), "Lunes a viernes");
  assert.equal(textoDias([3, 2]), "Martes y miércoles");
  assert.equal(textoDias([1, 3, 5]), "Lun, Mié y Vie");
  assert.equal(textoDias([1, 2, 3, 4, 5, 6, 7]), "Todos los días");
  assert.equal(tipoDia(FESTIVO, FESTIVOS), "festivo");
  assert.equal(tipoDia("2026-10-10"), "fin_de_semana");
  assert.equal(tipoDia(MARTES), "habil");
});

test("la encuesta de Samuel arma una semana sin choques", () => {
  const filas = generarPlantilla(ENCUESTA_SAMUEL);
  assert.deepEqual(choques(filas), []);
  for (const f of filas) {
    assert.ok(f.titulo.length <= 60 && f.duracion_min >= 5 && f.duracion_min <= 600, f.titulo);
    assert.ok(f.dias.length >= 1 && f.dias.every((d) => d >= 1 && d <= 7));
    assert.match(f.hora_inicio, /^\d{2}:\d{2}$/);
  }
  // Caminatas y ejercicio son obligatorios (D-056); lo demás no.
  const obligatorios = [...new Set(filas.filter((f) => f.obligatorio).map((f) => f.tipo))].sort();
  assert.deepEqual(obligatorios, ["caminar", "ejercicio"]);
  // La clase virtual lleva su enlace; la presencial su lugar y aviso para llegar.
  assert.equal(filas.find((f) => f.tipo === "clase_virtual").enlace, "https://meet.google.com/abc-defg-hij");
  const calculo = filas.find((f) => f.tipo === "clase_presencial");
  assert.deepEqual([calculo.lugar, calculo.aviso_min, calculo.dias], ["Bloque 5", 15, [2, 3]]);
});

test("lunes: la secuencia que pidió Samuel, con trabajo útil 50/10", () => {
  const lunes = bloquesDelDia(plantilla(), LUNES, "habil");
  assert.deepEqual(resumen(lunes), [
    "06:00 Levantarte",
    "06:10 Caminar",
    "06:55 Preparar desayuno",
    "07:15 Desayunar",
    "08:00 Trabajo útil",
    "08:50 Pausa",
    "09:00 Trabajo útil",
    "09:50 Pausa",
    "10:00 Trabajo útil",
    "10:50 Pausa",
    "11:00 Trabajo útil",
    "12:30 Almuerzo",
    "14:00 Inglés",
    "17:00 Ejercicio",
    "19:00 Cena",
    "19:30 Caminar",
    "20:00 Estudiar",
    "22:00 A dormir",
  ]);
  assert.equal(lunes[1].duracion_min, 45);
});

test("martes y miércoles: clases presenciales y el trabajo útil se corre solo", () => {
  const martes = resumen(bloquesDelDia(plantilla(), MARTES, "habil"));
  assert.ok(martes.includes("09:00 Cálculo"));
  assert.ok(martes.includes("14:00 Trabajos de la U"));
  assert.ok(martes.includes("08:00 Trabajo útil"));
  assert.ok(!martes.includes("09:00 Trabajo útil"), "el trabajo útil se cruzaba con la clase");
  assert.ok(!martes.includes("08:50 Pausa"), "pausa sin trabajo después");
  const miercoles = resumen(bloquesDelDia(plantilla(), "2026-10-07", "habil"));
  assert.ok(miercoles.includes("09:00 Cálculo"));
  assert.ok(!miercoles.includes("14:00 Trabajos de la U"));
});

test("fin de semana y festivo usan la plantilla del domingo (otra hora de levantarse, sin trabajo útil)", () => {
  const domingo = resumen(bloquesDelDia(plantilla(), "2026-10-11", "fin_de_semana"));
  const festivo = resumen(bloquesDelDia(plantilla(), FESTIVO, tipoDia(FESTIVO, FESTIVOS)));
  assert.deepEqual(festivo, domingo);
  assert.equal(festivo[0], "07:00 Levantarte");
  assert.ok(!festivo.some((b) => b.includes("Trabajo útil") || b.includes("Inglés")));
  // Ese mismo lunes sin festivo sí tendría su clase virtual.
  assert.ok(resumen(bloquesDelDia(plantilla(), FESTIVO, "habil")).includes("14:00 Inglés"));
});

test("ritmo 25/5 y pausas intercaladas; sin caminata ni desayuno largo", () => {
  const filas = generarPlantilla({ ...ENCUESTA_BASE, trabajo: { activo: true, inicio: "08:00", horas: 2, ritmo: "25/5", dias: [1] }, caminata: { activa: false } });
  const lunes = bloquesDelDia(filas, LUNES, "habil").filter((b) => ["trabajo", "descanso"].includes(b.tipo));
  assert.deepEqual(resumen(lunes), [
    "08:00 Trabajo útil",
    "08:25 Pausa",
    "08:30 Trabajo útil",
    "08:55 Pausa",
    "09:00 Trabajo útil",
    "09:25 Pausa",
    "09:30 Trabajo útil",
  ]);
  assert.ok(!filas.some((f) => f.tipo === "caminar" && f.hora_inicio < "12:00"));
});

test("choques: detecta cruces del mismo día, no los que solo se tocan", () => {
  const b = (titulo, dias, hora, dur) => ({ titulo, tipo: "otro", dias, hora_inicio: hora, duracion_min: dur });
  const lista = choques([b("A", [1, 2], "08:00", 60), b("B", [2], "08:30", 60), b("C", [1], "09:00", 30), b("D", [3], "08:00", 60)]);
  assert.equal(lista.length, 1);
  assert.deepEqual([lista[0].a.titulo, lista[0].b.titulo, lista[0].dias, lista[0].desde, lista[0].hasta], ["A", "B", [2], "08:30", "09:00"]);
});

test("bloques después de medianoche siguen en el mismo día lógico", () => {
  const tarde = [{ id: "x", titulo: "Película", tipo: "libre", dias: [5], hora_inicio: "00:30", duracion_min: 60 }, { id: "y", titulo: "Cena", tipo: "cena", dias: [5], hora_inicio: "21:00", duracion_min: 30 }];
  const viernes = bloquesDelDia(tarde, "2026-10-09", "habil");
  assert.deepEqual(viernes.map((b) => b.id), ["y", "x"]);
  assert.equal(isoBogota(viernes[1].inicio), "2026-10-10T00:30:00-05:00");
  assert.equal(bloqueActual(viernes, a("2026-10-10", "01:00")).id, "x");
});

test("estados: pendiente, ahora, por marcar, vencido (+30 min), hecho y saltado", () => {
  const bloques = plantilla();
  const caminar = bloquesDelDia(bloques, MARTES, "habil").find((b) => b.titulo === "Caminar" && b.inicioMin < 600);
  const estado = (hora, checks = []) => estadoDelDia(bloques, checks, a(MARTES, hora)).find((b) => b.id === caminar.id);

  assert.equal(estado("06:00").estado, "pendiente");
  assert.equal(estado("06:30").estado, "ahora");
  const recien = estado("07:10");
  assert.equal(recien.estado, "pendiente");
  assert.equal(recien.porMarcar, true);
  assert.equal(estado("07:24").estado, "pendiente");
  assert.equal(estado("07:25").estado, "vencido");
  assert.equal(estado("07:25", [{ bloque_id: caminar.id, fecha: MARTES, estado: "hecho" }]).estado, "hecho");
  assert.equal(estado("07:25", [{ bloque_id: caminar.id, fecha: MARTES, estado: "saltado" }]).estado, "saltado");
  // Un chequeo de otro día no cuenta.
  assert.equal(estado("07:25", [{ bloque_id: caminar.id, fecha: LUNES, estado: "hecho" }]).estado, "vencido");
  // A la 01:00 del miércoles sigue siendo martes (día lógico).
  assert.equal(estadoDelDia(bloques, [], a("2026-10-07", "01:00")).find((b) => b.id === caminar.id).fecha, MARTES);
});

test("obligatoriosVencidos: solo obligatorios, 30 min después del fin y sin marcar (saltado también cuenta)", () => {
  const bloques = plantilla();
  const ids = (hora, checks = []) => obligatoriosVencidos(bloques, checks, a(MARTES, hora)).map((p) => p.texto);
  assert.deepEqual(ids("07:24"), []);
  assert.deepEqual(ids("07:25"), ["Caminar"]);
  const [pendiente] = obligatoriosVencidos(bloques, [], a(MARTES, "07:25"));
  assert.deepEqual(Object.keys(pendiente).sort(), ["accion", "bloque_id", "clave", "emoji", "fin", "texto"]);
  assert.equal(pendiente.clave, `rutina:${pendiente.bloque_id}`);
  assert.equal(pendiente.accion, "rutina");
  assert.equal(pendiente.emoji, "🚶");
  assert.equal(pendiente.fin, "2026-10-06T06:55:00-05:00");
  const caminar = pendiente.bloque_id;
  assert.deepEqual(ids("07:25", [{ bloque_id: caminar, fecha: MARTES, estado: "saltado" }]), []);
  // De noche: caminata de la mañana, ejercicio y caminata de la noche.
  assert.deepEqual(ids("22:00"), ["Caminar", "Ejercicio", "Caminar"]);
  // Festivo: se usa el domingo (sin ejercicio).
  assert.deepEqual(obligatoriosVencidos(bloques, [], a(FESTIVO, "22:00"), { festivos: FESTIVOS }).map((p) => p.texto), ["Caminar", "Caminar"]);
  // Sin rutina no hay nada pendiente.
  assert.deepEqual(obligatoriosVencidos([], [], a(MARTES, "22:00")), []);
});

test("bloque actual, siguiente y qué marca el atajo ✅ Hecho", () => {
  const bloques = plantilla();
  const dia = estadoDelDia(bloques, [], a(MARTES, "06:57"));
  assert.equal(bloqueActual(dia, a(MARTES, "06:57")).titulo, "Preparar desayuno");
  assert.equal(siguiente(dia, a(MARTES, "06:57")).titulo, "Desayunar");
  // Terminaste de caminar a las 06:57: marca Caminar, no el desayuno que acaba de empezar.
  assert.equal(bloqueParaMarcar(dia, a(MARTES, "06:57")).titulo, "Caminar");
  // A mitad del trabajo útil, el bloque en curso.
  const mas = estadoDelDia(bloques, [], a(MARTES, "08:40"));
  assert.equal(bloqueParaMarcar(mas, a(MARTES, "08:40")).titulo, "Trabajo útil");
  // Las pausas nunca se marcan.
  const lunes = estadoDelDia(bloques, [], a(LUNES, "08:55"));
  assert.notEqual(bloqueParaMarcar(lunes, a(LUNES, "08:55")).tipo, "descanso");
  // Antes de que empiece el día no hay nada que marcar.
  assert.equal(bloqueParaMarcar(estadoDelDia(bloques, [], a(MARTES, "05:00")), a(MARTES, "05:00")), null);
});

test("mensajes cortos para Atajos: ahora y siguiente", () => {
  const bloques = plantilla();
  const en = (hora) => ahoraYSiguiente(estadoDelDia(bloques, [], a(MARTES, hora)), a(MARTES, hora)).mensaje;
  assert.equal(en("06:10"), "🚶 Caminar · 45 min");
  assert.equal(en("05:30"), "⏰ Levantarte a las 06:00");
  assert.equal(en("23:00"), "🌙 Nada más por hoy");
  for (const hora of ["06:10", "13:00", "23:00"]) assert.ok(en(hora).length <= 40 && !/\$/.test(en(hora)));
});

test("cumplimiento del día y de la semana (las pausas no cuentan)", () => {
  const bloques = plantilla();
  const dia = estadoDelDia(bloques, [], a(MARTES, "12:00"));
  const marcar = (titulo, estado) => ({ bloque_id: dia.find((b) => b.titulo === titulo).id, fecha: MARTES, estado });
  const checks = [marcar("Caminar", "hecho"), marcar("Desayunar", "hecho"), marcar("Levantarte", "saltado")];
  const c = cumplimiento(estadoDelDia(bloques, checks, a(MARTES, "12:00")));
  const marcables = dia.filter((b) => b.tipo !== "descanso").length;
  assert.equal(c.total, marcables);
  assert.equal(c.hechos, 2);
  assert.equal(c.marcados, 3);
  assert.equal(c.obligatorios.total, 3);
  assert.equal(c.obligatorios.hechos, 1);
  assert.equal(c.obligatorios.pct, 1 / 3);
  assert.equal(cumplimiento([]).pct, null);

  const sem = semana(bloques, checks, a(MARTES, "12:00"), { festivos: FESTIVOS });
  assert.deepEqual(sem.map((d) => d.fecha), ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
  assert.deepEqual(sem.map((d) => d.esHoy), [false, true, false, false, false, false, false]);
  assert.equal(sem[1].cumplimiento.hechos, 2);
  assert.equal(sem[2].futuro, true);
});

test("tareas: vencidas arriba, luego por fecha límite; las hechas no salen", () => {
  const ahora = a(MARTES, "10:00");
  const tareas = [
    { id: "1", titulo: "Ensayo", fecha_limite: "2026-10-09T23:59:00-05:00", estado: "pendiente", prioridad: 2 },
    { id: "2", titulo: "Sin fecha", fecha_limite: null, estado: "pendiente", prioridad: 1 },
    { id: "3", titulo: "Taller vencido", fecha_limite: "2026-10-05T23:59:00-05:00", estado: "en_progreso", prioridad: 2 },
    { id: "4", titulo: "Hecha", fecha_limite: "2026-10-06T23:59:00-05:00", estado: "hecha", prioridad: 1 },
    { id: "5", titulo: "Quiz hoy", fecha_limite: "2026-10-06T18:00:00-05:00", estado: "pendiente", prioridad: 3 },
  ];
  const lista = ordenarTareas(tareas, ahora);
  assert.deepEqual(lista.map((t) => t.id), ["3", "5", "1", "2"]);
  assert.deepEqual(lista.map((t) => t.vence), ["Vencida · ayer", "Hoy 18:00", "Viernes 23:59", "Sin fecha"]);
  assert.deepEqual(lista.map((t) => t.vencida), [true, false, false, false]);
  assert.equal(paraCuando("hoy", ahora), "2026-10-06T23:59:00-05:00");
  assert.equal(paraCuando("manana", ahora), "2026-10-07T23:59:00-05:00");
  assert.equal(paraCuando("semana", ahora), "2026-10-11T23:59:00-05:00");
});
