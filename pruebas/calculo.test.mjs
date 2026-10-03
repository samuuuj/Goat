// Cálculo del día (web/js/logica/calculo.js): los 5 escenarios de referencia (D-039).

import { test } from "node:test";
import assert from "node:assert/strict";
import { METAS_BASE, construirResumen } from "../web/js/logica/calculo.js";
import { diaLogico } from "../web/js/logica/dia.js";

const vacio = { metas: METAS_BASE, comidas: [], movimientos: [], checkins: [], estudio: [], gym: [], festivos: [] };
const f = "2026-10-02";

test("día vacío a las 09:00: nada pendiente, solo puntos de finanzas", () => {
  const r = construirResumen(vacio, new Date("2026-10-02T09:00:00-05:00"));
  assert.equal(r.fecha, f);
  assert.deepEqual(r.pendientes, []);
  assert.equal(r.score, 15);
  assert.equal(r.racha, 0);
  assert.equal(r.descripcionDia, "Día hábil");
});

test("requisitos progresivos según la hora", () => {
  const claves = (hora) => construirResumen(vacio, new Date(`2026-10-02T${hora}:00-05:00`)).pendientes.map((p) => p.clave);
  assert.deepEqual(claves("11:00"), ["desayuno"]);
  assert.deepEqual(claves("16:00"), ["desayuno", "almuerzo", "checkin_finanzas"]);
  assert.deepEqual(claves("22:30"), ["desayuno", "almuerzo", "cena", "cierre_finanzas"]);
});

test("día completo visto a la 01:30 sigue siendo el día lógico anterior", () => {
  const lleno = {
    ...vacio,
    comidas: ["desayuno", "almuerzo", "cena"].map((tipo) => ({ tipo, kcal: 870, proteina_g: 45, omitida: false, fecha: f })),
    checkins: [{ tipo: "cierre", fecha: f, momento: "2026-10-02T23:00:00-05:00" }],
    estudio: [{ minutos: 120, fecha: f }],
    gym: [{ fecha: f }],
  };
  const madrugada = new Date("2026-10-03T01:30:00-05:00");
  assert.equal(diaLogico(madrugada), f);
  const r = construirResumen(lleno, madrugada);
  assert.deepEqual(r.pendientes, []);
  assert.equal(r.score, 100);
  assert.equal(r.racha, 1);
  assert.equal(r.anillos[0].progreso, 1);
});

test("pasarse del presupuesto: disponible negativo, sin puntos de finanzas, frase sin montos", () => {
  const gasto = { ...vacio, movimientos: [{ tipo: "egreso", monto: 90000, fecha: f, momento: "2026-10-02T12:00:00-05:00" }] };
  const r = construirResumen(gasto, new Date("2026-10-02T12:30:00-05:00"));
  assert.ok(r.metricas[0].valor < 0);
  assert.equal(r.score, 0);
  assert.ok(!r.metricas[0].frase.includes("$"));
});

test("festivo y fin de semana", () => {
  let r = construirResumen({ ...vacio, festivos: [{ fecha: "2026-10-12", nombre: "Día de la Raza" }] }, new Date("2026-10-12T10:00:00-05:00"));
  assert.equal(r.tipoDia, "festivo");
  assert.equal(r.descripcionDia, "Festivo · Día de la Raza");
  r = construirResumen(vacio, new Date("2026-10-03T10:00:00-05:00"));
  assert.equal(r.tipoDia, "fin_de_semana");
});
