// Cruces entre módulos (goat/integracion): rutina en "lo que falta", meta de entrenos y entreno → bloque de rutina.

import { test } from "node:test";
import assert from "node:assert/strict";
import { METAS_BASE, construirResumen } from "../web/js/logica/calculo.js";
import { bloquesCubiertos } from "../web/js/logica/cruces.js";
import { crearSupabaseFalso, jwtFalso, llamar } from "./ayuda/supabase-falso.mjs";

const A = "11111111-1111-4111-8111-111111111111";
const vacio = { metas: METAS_BASE, comidas: [], movimientos: [], checkins: [], estudio: [], gym: [], festivos: [] };
const bogota = (texto) => new Date(`${texto}-05:00`);
// 2026-10-02 es viernes (5); 2026-10-04 es domingo (7).
const caminar = { id: "b-caminar", titulo: "Caminar", tipo: "caminar", dias: [1, 2, 3, 4, 5], hora_inicio: "06:15", duracion_min: 45, obligatorio: true, orden: 1, activo: true };
const gym = { id: "b-gym", titulo: "Gym", tipo: "ejercicio", dias: [5, 7], hora_inicio: "17:00", duracion_min: 60, obligatorio: false, orden: 2, activo: true };

test("un bloque obligatorio vencido sin marcar aparece en lo que falta, con su módulo", () => {
  const r = construirResumen({ ...vacio, rutinaBloques: [caminar, gym], rutinaChecks: [] }, bogota("2026-10-02T09:00:00"));
  assert.deepEqual(
    r.pendientes.map((p) => [p.clave, p.accion, p.modulo]),
    [["rutina:b-caminar", "rutina", "rutina"]],
  );
});

test("marcar el bloque (hecho o saltado) lo quita de lo que falta", () => {
  for (const estado of ["hecho", "saltado"]) {
    const r = construirResumen(
      { ...vacio, rutinaBloques: [caminar], rutinaChecks: [{ bloque_id: "b-caminar", fecha: "2026-10-02", estado }] },
      bogota("2026-10-02T09:00:00"),
    );
    assert.deepEqual(r.pendientes, [], estado);
  }
});

test("sin rutina todo sigue igual que antes", () => {
  const r = construirResumen(vacio, bogota("2026-10-02T11:00:00"));
  assert.deepEqual(r.pendientes.map((p) => p.clave), ["desayuno"]);
});

test("la meta de entrenos de Hoy no cuenta caminata ni movilidad (igual que Movimiento)", () => {
  const gymSemana = (sesiones) =>
    construirResumen({ ...vacio, gym: sesiones }, bogota("2026-10-02T09:00:00")).metricas.find((m) => m.clave === "gym").valor;
  assert.equal(gymSemana([{ fecha: "2026-10-01", tipo: "caminata" }, { fecha: "2026-10-01", tipo: "movilidad" }]), 0);
  assert.equal(gymSemana([{ fecha: "2026-10-01", tipo: "fuerza" }, { fecha: "2026-09-30" }]), 2); // sin tipo = fuerza
});

test("un entreno cubre el bloque del mismo tipo si llena al menos el 70%", () => {
  const caminata = { tipo: "caminata", inicio: "2026-10-02T06:15:00-05:00", fin: "2026-10-02T07:00:00-05:00" };
  assert.deepEqual(bloquesCubiertos(caminata, [caminar, gym]), [{ bloque_id: "b-caminar", fecha: "2026-10-02" }]);
  const corta = { ...caminata, fin: "2026-10-02T06:30:00-05:00" };
  assert.deepEqual(bloquesCubiertos(corta, [caminar]), []);
  const fuerza = { ...caminata, tipo: "fuerza" };
  assert.deepEqual(bloquesCubiertos(fuerza, [caminar]), []);
  assert.deepEqual(bloquesCubiertos({ tipo: "caminata", inicio: caminata.inicio }, [caminar]), [], "en curso: no marca");
});

test("en festivo se usan los bloques del domingo", () => {
  const entreno = { tipo: "fuerza", inicio: "2026-10-12T17:00:00-05:00", fin: "2026-10-12T18:00:00-05:00" }; // lunes festivo
  assert.deepEqual(bloquesCubiertos(entreno, [gym]), []);
  assert.deepEqual(bloquesCubiertos(entreno, [gym], [{ fecha: "2026-10-12", nombre: "Festivo" }]), [{ bloque_id: "b-gym", fecha: "2026-10-12" }]);
});

test("API: un entreno registrado marca su bloque sin pisar lo que ya marcó Samuel", async () => {
  const SESION = jwtFalso("a");
  const falso = crearSupabaseFalso({
    datos: {
      perfil: [{ user_id: A, metas: { gym_semana: 3 } }],
      api_tokens: [],
      gym_sesiones: [],
      notificaciones: [],
      festivos: [],
      rutina_bloques: [
        { ...caminar, user_id: A },
        { ...gym, user_id: A },
      ],
      rutina_checks: [{ id: "c1", user_id: A, bloque_id: "b-gym", fecha: "2026-10-02", estado: "saltado" }],
    },
    sesiones: { [SESION]: A },
  });
  const token = (await llamar(falso, "POST tokens", { token: SESION, cuerpo: { nombre: "iPhone" } })).cuerpo.datos.token;

  const caminata = await llamar(falso, "POST ejercicio/sesion", {
    token,
    cuerpo: { tipo: "caminata", inicio: "2026-10-02T06:10:00-05:00", fin: "2026-10-02T07:00:00-05:00" },
    ahora: bogota("2026-10-02T07:05:00"),
  });
  assert.equal(caminata.estado, 201);
  assert.deepEqual(caminata.cuerpo.datos.rutina.map((f) => f.bloque_id), ["b-caminar"]);

  const fuerza = await llamar(falso, "POST ejercicio/sesion", {
    token,
    cuerpo: { tipo: "fuerza", inicio: "2026-10-02T17:00:00-05:00", fin: "2026-10-02T18:00:00-05:00" },
    ahora: bogota("2026-10-02T18:05:00"),
  });
  assert.equal(fuerza.estado, 201);

  const checks = falso.tablas.rutina_checks;
  assert.equal(checks.find((c) => c.bloque_id === "b-caminar")?.estado, "hecho");
  assert.equal(checks.find((c) => c.bloque_id === "b-caminar")?.origen, "automatizacion");
  assert.equal(checks.filter((c) => c.bloque_id === "b-gym").length, 1);
  assert.equal(checks.find((c) => c.bloque_id === "b-gym").estado, "saltado", "no pisa lo que marcó Samuel");
});

test("API: si la rutina no está instalada, el entreno se guarda igual", async () => {
  const SESION = jwtFalso("b");
  const falso = crearSupabaseFalso({
    datos: { perfil: [{ user_id: A, metas: {} }], api_tokens: [], gym_sesiones: [], notificaciones: [], festivos: [] },
    sesiones: { [SESION]: A },
  });
  const token = (await llamar(falso, "POST tokens", { token: SESION, cuerpo: { nombre: "iPhone" } })).cuerpo.datos.token;
  const r = await llamar(falso, "POST ejercicio/sesion", {
    token,
    cuerpo: { tipo: "caminata", inicio: "2026-10-02T06:10:00-05:00", fin: "2026-10-02T07:00:00-05:00" },
    ahora: bogota("2026-10-02T07:05:00"),
  });
  assert.equal(r.estado, 201);
  assert.equal(falso.tablas.gym_sesiones.length, 1);
});
