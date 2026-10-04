// Lógica del sueño (web/js/sueno/logica.js): noches con el corte de las 04:00, fechas de Atajos, índice y semana.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  construirNoches,
  cuentaCargador,
  duracionCorta,
  ejeSemana,
  horaDe,
  indiceSueno,
  leerFecha,
  leerMetasSueno,
  leerMuestras,
  momentoDesdeHora,
  promedios,
  regularidad,
  resumenSueno,
  tipoMuestra,
} from "../web/js/sueno/logica.js";
import { sumarDias } from "../web/js/logica/calculo.js";

/** Momento ISO de Bogotá: m("2026-10-02", "23:40"). */
const m = (fecha, hora) => `${fecha}T${hora}:00-05:00`;
const ev = (tipo, fuente, fecha, hora, creado) => ({ tipo, fuente, momento: m(fecha, hora), creado_en: creado ?? m(fecha, hora) });
const cama = (f1, h1, f2, h2, tipo = "en_cama") => ({ inicio: m(f1, h1), fin: m(f2, h2), tipo });

const D = "2026-10-02";
const D1 = "2026-10-03";

test("noche normal: 23:40 → 06:05 son 6 h 25 y es del día en que te acostaste", () => {
  const [noche] = construirNoches([ev("acostarse", "cargador", D, "23:40"), ev("despertar", "alarma", D1, "06:05")]);
  assert.equal(noche.fecha, D);
  assert.equal(noche.duracionMin, 385);
  assert.equal(duracionCorta(noche.duracionMin), "6 h 25");
  assert.equal(horaDe(noche.acostarse), "23:40");
  assert.equal(horaDe(noche.despertar), "06:05");
  assert.equal(noche.fuente, "cargador");
  assert.equal(noche.fuenteDespertar, "alarma");
  assert.equal(noche.completa, true);
});

test("acostarse a la 01:10 pertenece al día anterior por el corte de las 04:00", () => {
  const [noche] = construirNoches([ev("acostarse", "manual", D1, "01:10"), ev("despertar", "despertar", D1, "07:00")]);
  assert.equal(noche.fecha, D);
  assert.equal(noche.duracionMin, 350);
});

test("varios eventos de cargador: toma el último antes de 'En cama'", () => {
  const noches = construirNoches(
    [ev("acostarse", "cargador", D, "21:10"), ev("acostarse", "cargador", D, "22:50"), ev("acostarse", "cargador", D, "23:30"), ev("acostarse", "cargador", D1, "01:00")],
    [cama(D, "23:45", D1, "06:20")],
  );
  assert.equal(noches.length, 1);
  assert.equal(horaDe(noches[0].acostarse), "23:30");
  assert.equal(noches[0].fuente, "cargador");
  // Sin "desperté", la mañana sale del fin de "En cama".
  assert.equal(horaDe(noches[0].despertar), "06:20");
  assert.equal(noches[0].fuenteDespertar, "salud");
});

test("solo muestras de Salud: la noche sale de 'En cama'", () => {
  const [noche] = construirNoches([], [cama(D, "23:50", D1, "06:20")]);
  assert.equal(noche.fecha, D);
  assert.equal(horaDe(noche.acostarse), "23:50");
  assert.equal(horaDe(noche.despertar), "06:20");
  assert.equal(noche.fuente, "salud");
  assert.equal(noche.duracionMin, 390);
  assert.deepEqual(noche.enCama, { inicio: new Date(m(D, "23:50")).toISOString(), fin: new Date(m(D1, "06:20")).toISOString() });
});

test("solo eventos: hora de dormir y alarma", () => {
  const [noche] = construirNoches([ev("acostarse", "hora_dormir", D, "22:30"), ev("despertar", "alarma", D1, "05:55")]);
  assert.equal(noche.duracionMin, 445);
  assert.equal(noche.enCama, null);
});

test("seguiste con el celular: si 'En cama' empieza mucho después de la hora de dormir, manda 'En cama'", () => {
  const [noche] = construirNoches(
    [ev("acostarse", "hora_dormir", D, "22:30"), ev("despertar", "alarma", D1, "07:05")],
    [cama(D1, "01:30", D1, "07:00")],
  );
  assert.equal(noche.fecha, D, "sigue siendo la noche del día en que empezó tu hora de dormir");
  assert.equal(horaDe(noche.acostarse), "01:30");
  assert.equal(noche.fuente, "salud");
  assert.equal(noche.celularMin, 180);
  assert.equal(horaDe(noche.despertar), "07:05");
});

test("'En cama' que empieza después de las 04:00 sigue siendo la noche anterior si ya te habías acostado", () => {
  const noches = construirNoches([ev("acostarse", "modo_sueno", D, "23:00")], [cama(D1, "04:30", D1, "10:00")]);
  assert.equal(noches.length, 1);
  assert.equal(noches[0].fecha, D);
  assert.equal(horaDe(noches[0].acostarse), "04:30");
  assert.equal(horaDe(noches[0].despertar), "10:00");
});

test("lo anotado a mano corrige lo automático (manda el último que escribiste)", () => {
  const [noche] = construirNoches([
    ev("acostarse", "hora_dormir", D, "22:30"),
    ev("acostarse", "manual", D, "23:15", m(D1, "08:00")),
    ev("acostarse", "manual", D, "23:50", m(D1, "08:01")),
    ev("despertar", "alarma", D1, "06:05"),
    ev("despertar", "manual", D1, "07:10", m(D1, "08:02")),
  ]);
  assert.equal(horaDe(noche.acostarse), "23:50");
  assert.equal(noche.fuente, "manual");
  assert.equal(horaDe(noche.despertar), "07:10");
  assert.equal(noche.fuenteDespertar, "manual");
  assert.equal(noche.celularMin, null);
});

test("un 'desperté' de madrugada no cuenta si hay uno después de las 04:00", () => {
  const [noche] = construirNoches([
    ev("acostarse", "cargador", D, "23:30"),
    ev("despertar", "alarma", D1, "02:00"),
    ev("despertar", "despertar", D1, "06:30"),
    ev("despertar", "alarma", D1, "06:31"),
  ]);
  assert.equal(horaDe(noche.despertar), "06:30");
});

test("te levantaste un rato a media noche: los dos ratos 'En cama' son la misma noche", () => {
  const noches = construirNoches([], [cama(D, "23:30", D1, "01:30"), cama(D1, "03:30", D1, "07:00")]);
  assert.equal(noches.length, 1);
  assert.equal(horaDe(noches[0].acostarse), "23:30");
  assert.equal(horaDe(noches[0].despertar), "07:00");
});

test("ratos 'En cama' de menos de 1 h no son una noche", () => {
  assert.deepEqual(construirNoches([], [cama(D, "15:00", D, "15:40")]), []);
});

test("solo 'desperté': noche a medias del día anterior (falta la hora de dormir)", () => {
  const [noche] = construirNoches([ev("despertar", "alarma", D1, "06:30")]);
  assert.equal(noche.fecha, D);
  assert.equal(noche.acostarse, null);
  assert.equal(horaDe(noche.despertar), "06:30");
  assert.equal(noche.completa, false);
});

test("varias noches seguidas: cada 'desperté' va con su noche", () => {
  const noches = construirNoches([
    ev("acostarse", "cargador", "2026-09-30", "23:00"),
    ev("despertar", "alarma", "2026-10-01", "06:00"),
    ev("acostarse", "cargador", "2026-10-01", "23:30"),
    ev("acostarse", "cargador", D, "22:45"),
    ev("despertar", "alarma", D1, "06:15"),
  ]);
  assert.deepEqual(
    noches.map((n) => [n.fecha, n.duracionMin]),
    [
      ["2026-09-30", 420],
      ["2026-10-01", null],
      ["2026-10-02", 450],
    ],
  );
});

test("fechas de Atajos: ISO 8601 y los formatos sin formatear", () => {
  const esperado = new Date("2026-10-02T23:40:00-05:00").getTime();
  for (const texto of [
    "2026-10-02T23:40:00-05:00",
    "2026-10-03T04:40:00Z",
    "2026-10-02T23:40:00-0500",
    "2026-10-02 23:40:00 -0500",
    "2026-10-02T23:40",
    "2 oct 2026, 23:40",
    "2 oct 2026, 11:40 p. m.",
    "2 de octubre de 2026, 11:40 p. m.",
    "2 oct. 2026 a las 23:40",
    "Oct 2, 2026 at 11:40 PM",
    "02/10/2026 23:40",
    "2/10/26, 11:40 p. m.",
  ]) {
    assert.equal(leerFecha(texto)?.getTime(), esperado, texto);
  }
  assert.equal(leerFecha("2026-10-03T00:30:00-05:00").getTime(), new Date("2026-10-03T05:30:00Z").getTime());
  assert.equal(leerFecha("12:30 a. m."), null);
  assert.equal(leerFecha("31/02/2026 10:00"), null);
  assert.equal(leerFecha("mañana"), null);
  assert.equal(leerFecha(""), null);
  assert.equal(leerFecha(null), null);
});

test("valores de 'Análisis del sueño' en español e inglés", () => {
  assert.equal(tipoMuestra("En cama"), "en_cama");
  assert.equal(tipoMuestra("In Bed"), "en_cama");
  assert.equal(tipoMuestra(""), "en_cama");
  assert.equal(tipoMuestra("Dormido"), "dormido");
  assert.equal(tipoMuestra("Núcleo"), "dormido");
  assert.equal(tipoMuestra("REM"), "dormido");
  assert.equal(tipoMuestra("Despierto"), "despierto");
  assert.equal(tipoMuestra("Awake"), "despierto");
  assert.equal(tipoMuestra(0), "en_cama");
  assert.equal(tipoMuestra("siesta larga"), null);
});

test("muestras: texto con una por línea, diccionarios, repetidas e inválidas", () => {
  const texto = [
    "2026-10-02T23:45:00-05:00;2026-10-03T06:10:00-05:00;En cama",
    "2026-10-02T23:45:00-05:00;2026-10-03T06:20:00-05:00;En cama", // misma muestra, más larga: se queda esta
    "2026-10-03T07:00:00-05:00;2026-10-03T06:00:00-05:00;En cama", // fin antes del inicio
    "basura",
    "",
  ].join("\n");
  const r = leerMuestras(texto);
  assert.equal(r.muestras.length, 1);
  assert.equal(r.muestras[0].fin, new Date("2026-10-03T06:20:00-05:00").toISOString());
  assert.equal(r.omitidas, 2);

  const dicts = leerMuestras([
    { "Fecha de inicio": "2 oct 2026, 11:45 p. m.", "Fecha de finalización": "3 oct 2026, 6:10 a. m.", Valor: "En cama" },
    { start: "2026-10-03T00:10:00-05:00", end: "2026-10-03T05:30:00-05:00", value: "Asleep" },
    { inicio: "2026-10-01T20:00:00-05:00", fin: "2026-10-02T13:00:00-05:00" }, // 17 h: no
  ]);
  assert.deepEqual(
    dicts.muestras.map((x) => x.tipo),
    ["en_cama", "dormido"],
  );
  assert.equal(dicts.omitidas, 1);
  assert.deepEqual(leerMuestras(undefined), { muestras: [], omitidas: 0 });
  assert.deepEqual(leerMuestras(""), { muestras: [], omitidas: 0 });
  assert.equal(leerMuestras(JSON.stringify([{ inicio: m(D, "23:00"), fin: m(D1, "06:00") }])).muestras.length, 1);
});

test("el cargador solo cuenta como 'me acuesto' de 21:00 a 03:00", () => {
  assert.equal(cuentaCargador(m(D, "21:00")), true);
  assert.equal(cuentaCargador(m(D, "23:59")), true);
  assert.equal(cuentaCargador(m(D1, "02:59")), true);
  assert.equal(cuentaCargador(m(D1, "03:00")), false);
  assert.equal(cuentaCargador(m(D, "15:00")), false);
});

test("hora escrita a mano: el momento más reciente que ya pasó", () => {
  const ahora = new Date(m(D1, "07:00"));
  const acoste = momentoDesdeHora("23:40", ahora);
  assert.equal(acoste.cuando, "ayer");
  assert.equal(acoste.momento.toISOString(), new Date(m(D, "23:40")).toISOString());
  const madrugada = momentoDesdeHora("01:10", ahora);
  assert.equal(madrugada.cuando, "hoy");
  assert.equal(madrugada.momento.toISOString(), new Date(m(D1, "01:10")).toISOString());
  assert.equal(momentoDesdeHora("25:00", ahora), null);
});

test("metas de sueño: con respaldo y validadas", () => {
  assert.deepEqual(leerMetasSueno(undefined), { sueno_horas: 7.5, hora_despertar: "06:00", hora_acostarse: "22:30" });
  assert.deepEqual(leerMetasSueno({ sueno_horas: "8", hora_despertar: "5:30", hora_acostarse: "medianoche" }), {
    sueno_horas: 8,
    hora_despertar: "05:30",
    hora_acostarse: "22:30",
  });
  assert.equal(leerMetasSueno({ sueno_horas: 30 }).sueno_horas, 7.5);
});

/** 7 noches seguidas terminando en D: [hora de acostarse, hora de levantarse] por noche. */
function semana(horas) {
  const eventos = [];
  horas.forEach(([acostarse, levantarse], i) => {
    const fecha = sumarDias(D, i - horas.length + 1);
    const fAcostarse = acostarse < "12:00" ? sumarDias(fecha, 1) : fecha;
    eventos.push(ev("acostarse", "cargador", fAcostarse, acostarse));
    eventos.push(ev("despertar", "alarma", sumarDias(fecha, 1), levantarse));
  });
  return construirNoches(eventos);
}

test("índice: una semana regular puntúa alto y una irregular bajo, con su frase", () => {
  const regular = semana(Array(7).fill(["23:00", "06:30"]));
  const r = indiceSueno(regular, {});
  assert.equal(r.noches, 7);
  assert.equal(r.partes.duracion, 100);
  assert.equal(r.partes.regularidad, 100);
  assert.equal(r.partes.hora, 83);
  assert.equal(r.valor, 97);
  assert.match(r.frase, /Te acuestas hacia las 23:00; tu meta es 22:30/);
  const sinTarde = indiceSueno(regular, { hora_acostarse: "23:00" });
  assert.equal(sinTarde.valor, 100);
  assert.match(sinTarde.frase, /sólidas/);

  const irregular = semana([
    ["22:00", "06:00"],
    ["02:00", "07:00"],
    ["22:00", "06:00"],
    ["02:00", "07:00"],
    ["22:00", "06:00"],
    ["02:00", "07:00"],
    ["22:00", "06:00"],
  ]);
  const i = indiceSueno(irregular, {});
  assert.equal(i.valor, 44);
  assert.match(i.frase, /cambia ±1 h 59/);
  assert.ok(!/\$/.test(i.frase));

  const corta = indiceSueno(semana(Array(7).fill(["22:15", "03:45"])), {});
  assert.equal(corta.partes.duracion, 33);
  assert.equal(corta.valor, 67);
  assert.match(corta.frase, /Duermes 5 h 30 en promedio; tu meta es 7 h 30/);
});

test("índice: sin noches completas no hay valor; con menos de 3 la regularidad no cuenta", () => {
  assert.equal(indiceSueno([], {}).valor, null);
  const dos = semana([
    ["23:00", "06:30"],
    ["23:00", "06:30"],
  ]);
  const r = indiceSueno(dos, {});
  assert.equal(r.partes.regularidad, null);
  assert.equal(r.valor, Math.round((100 * (50 + 20 * (1 - 15 / 90))) / 70));
});

test("regularidad y promedios cruzando la medianoche", () => {
  const noches = semana([
    ["23:30", "06:00"],
    ["00:30", "07:00"],
    ["23:30", "06:00"],
    ["00:30", "07:00"],
  ]);
  const p = promedios(noches, 7);
  assert.equal(p.acostarse, "00:00");
  assert.equal(p.despertar, "06:30");
  assert.equal(p.duracionMin, 390);
  assert.equal(p.noches, 4);
  const reg = regularidad(noches);
  assert.equal(reg.acostarseMin, 30);
  assert.equal(reg.texto, "Muy regular");
  assert.equal(regularidad(noches.slice(0, 2)).puntaje, null);
});

test("resumen: en la mañana muestra 'Anoche' y la semana termina en esa noche", () => {
  const eventos = [ev("acostarse", "cargador", D, "23:40"), ev("despertar", "alarma", D1, "06:05")];
  const r = resumenSueno({ eventos, muestras: [], metas: {} }, new Date(m(D1, "08:00")));
  assert.equal(r.fecha, D1);
  assert.equal(r.enCurso, null);
  assert.equal(r.ultimaNoche.etiqueta, "Anoche");
  assert.equal(r.ultimaNoche.duracionMin, 385);
  assert.equal(r.hasta, D);
  assert.equal(r.semana.length, 7);
  assert.equal(r.semana.at(-1).fecha, D);
  assert.equal(r.semana.at(-1).ultima, true);
  assert.equal(r.semana.at(-1).desdeH, 23.67);
  assert.equal(r.semana.at(-1).hastaH, 30.08);
  assert.equal(r.indice.valor > 0, true);
  assert.deepEqual(r.eje, { desde: 20, hasta: 34 });
  assert.ok(JSON.stringify(r), "se puede mandar como JSON");
});

test("resumen: de noche, si ya te acostaste, la noche de hoy va 'en curso' y no cuenta para el índice", () => {
  const eventos = [
    ev("acostarse", "cargador", D, "23:40"),
    ev("despertar", "alarma", D1, "06:05"),
    ev("acostarse", "hora_dormir", D1, "23:00"),
  ];
  const r = resumenSueno({ eventos }, new Date(m(D1, "23:30")));
  assert.equal(r.enCurso.fecha, D1);
  assert.equal(r.ultimaNoche.fecha, D);
  assert.equal(r.hasta, D1);
  const hoy = r.semana.at(-1);
  assert.equal(hoy.enCurso, true);
  assert.equal(hoy.desdeH, 23);
  assert.equal(hoy.hastaH, 23.5);
  assert.equal(r.indice.noches, 1);
});

test("resumen: si la última noche es vieja se llama 'Tu última noche'; el eje se ensancha si hace falta", () => {
  const eventos = [ev("acostarse", "manual", "2026-09-28", "19:10"), ev("despertar", "manual", "2026-09-29", "11:30")];
  const r = resumenSueno({ eventos }, new Date(m(D1, "09:00")));
  assert.equal(r.ultimaNoche.etiqueta, "Tu última noche");
  assert.deepEqual(ejeSemana([{ desdeH: 19.17, hastaH: 35.5 }]), { desde: 18, hasta: 36 });
  assert.equal(resumenSueno({}, new Date(m(D1, "09:00"))).ultimaNoche, null);
});
