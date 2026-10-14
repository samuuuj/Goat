// Motor del atajo "🐐 Goat" (POST /api/v1/asistente): se simula el bucle del atajo de punta a punta.
// Cada vuelta manda { flujo, estado, respuesta } y recibe la siguiente pregunta (lista, número, texto) o el final.

import { test } from "node:test";
import assert from "node:assert/strict";
import { crearSupabaseFalso, jwtFalso, llamar } from "./ayuda/supabase-falso.mjs";
import { plantillaSamuel } from "./ayuda/rutina.mjs";
import { leerMonto, _pruebas } from "../api/_lib/asistente.js";

const A = "11111111-1111-4111-8111-111111111111";
const SESION_A = jwtFalso("a");
const a = (fecha, hora) => new Date(`${fecha}T${hora}:00-05:00`);
const MARTES = "2026-10-06";

function base() {
  return crearSupabaseFalso({
    datos: {
      perfil: [{ user_id: A, metas: {}, ajustes: {} }],
      api_tokens: [],
      rutina_bloques: plantillaSamuel(A),
      rutina_checks: [],
      uni_tareas: [],
      festivos: [],
    },
    sesiones: { [SESION_A]: A },
    unicas: { finanzas_cuentas: [["user_id", "nombre"]], rutina_checks: [["bloque_id", "fecha"]] },
  });
}

async function conToken(falso) {
  const r = await llamar(falso, "POST tokens", { token: SESION_A, cuerpo: { nombre: "iPhone" } });
  return r.cuerpo.datos.token;
}

/**
 * Hace lo mismo que el atajo: repite hasta "fin"/"silencio". `responder(vuelta)` contesta cada pregunta
 * (un texto de la lista, un número o un texto). Devuelve todas las vueltas.
 */
async function conversar(falso, token, flujo, responder, ahora) {
  const vueltas = [];
  let estado = "";
  let respuesta = "";
  for (let i = 0; i < 20; i++) {
    const r = await llamar(falso, "POST asistente", { token, cuerpo: { flujo, estado, respuesta }, ahora });
    const c = r.cuerpo;
    vueltas.push(c);
    if (c.tipo === "fin" || c.tipo === "silencio") return vueltas;
    if (c.tipo === "inicio") {
      estado = c.estado;
      continue;
    }
    assert.ok(["lista", "numero", "texto"].includes(c.tipo), `tipo raro: ${c.tipo}`);
    if (c.tipo === "lista") assert.ok(Array.isArray(c.opciones) && c.opciones.length > 0, c.pregunta);
    estado = c.estado;
    respuesta = responder(c);
  }
  throw new Error("El atajo daría más de 20 vueltas");
}

/** Contesta en orden: cada elemento es un texto exacto, una función (vuelta) => texto o un RegExp de opción. */
const enOrden = (...respuestas) => {
  let i = 0;
  return (vuelta) => {
    const r = respuestas[i++];
    if (r instanceof RegExp) {
      const opcion = vuelta.opciones?.find((o) => r.test(o));
      assert.ok(opcion, `no hay opción ${r} en ${JSON.stringify(vuelta.opciones)}`);
      return opcion;
    }
    return typeof r === "function" ? r(vuelta) : r;
  };
};

const final = (vueltas) => vueltas.at(-1);
const preguntas = (vueltas) => vueltas.slice(0, -1).map((v) => v.pregunta);

test("sin token: el atajo recibe un final (no da vueltas)", async () => {
  const falso = base();
  const r = await llamar(falso, "POST asistente", { cuerpo: {} });
  assert.equal(r.estado, 401);
  assert.equal(r.cuerpo.tipo, "fin");
  assert.match(r.cuerpo.mensaje, /token/i);
});

test("💸 Gasto (lógica de Samuel): tipo → valor → categoría → cómo pagaste → descripción", async () => {
  const falso = base();
  const token = await conToken(falso);
  const vueltas = await conversar(falso, token, "dinero", enOrden(/Gasto/, "25000", /Comida/, "Nequi", "Cena"), a(MARTES, "19:42"));
  assert.deepEqual(
    vueltas.slice(0, -1).map((v) => v.tipo),
    ["lista", "numero", "lista", "lista", "texto"],
  );
  assert.match(vueltas[2].pregunta, /En qué fue/);
  assert.match(vueltas[3].pregunta, /Cómo pagaste/);
  assert.equal(final(vueltas).mensaje, "💸 Guardado · Comida");
  const [mov] = falso.tablas.finanzas_movimientos;
  assert.deepEqual({ tipo: mov.tipo, monto: mov.monto, categoria: mov.categoria, cuenta: mov.cuenta, descripcion: mov.descripcion }, {
    tipo: "egreso",
    monto: 25000,
    categoria: "comida",
    cuenta: "Nequi",
    descripcion: "Cena",
  });
});

test("💰 Ingreso: pregunta categorías de INGRESO (nunca las de gasto) y dónde entró", async () => {
  const falso = base();
  const token = await conToken(falso);
  const vueltas = await conversar(falso, token, "dinero", enOrden(/Ingreso/, "100.000", /Trabajo/, "Nu", "-"), a(MARTES, "10:00"));
  const categorias = vueltas[2].opciones;
  assert.ok(categorias.some((c) => /Trabajo/.test(c)));
  assert.ok(!categorias.some((c) => /Comida|Transporte/.test(c)), `salieron categorías de gasto: ${categorias}`);
  assert.match(vueltas[2].pregunta, /De dónde vino/);
  assert.match(vueltas[3].pregunta, /Dónde ingresó/);
  const [mov] = falso.tablas.finanzas_movimientos;
  assert.equal(mov.tipo, "ingreso");
  assert.equal(mov.monto, 100000);
  assert.equal(mov.descripcion, null);
});

test("🔁 Transferencia: sin categoría; el destino no repite el origen", async () => {
  const falso = base();
  const token = await conToken(falso);
  const vueltas = await conversar(falso, token, "dinero", enOrden(/Transferencia/, "100k", "Nu", "Nequi", "Pasar"), a(MARTES, "10:00"));
  assert.ok(!preguntas(vueltas).some((p) => /categor|En qué fue/i.test(p)));
  assert.ok(!vueltas[3].opciones.includes("Nu"), "el destino no debe ofrecer la misma cuenta");
  const [mov] = falso.tablas.finanzas_movimientos;
  assert.equal(mov.tipo, "transferencia");
  assert.equal(mov.monto, 100000);
});

test("🏧 Retiro: valor → de qué cuenta → descripción (llega solo a Efectivo)", async () => {
  const falso = base();
  const token = await conToken(falso);
  const vueltas = await conversar(falso, token, "dinero", enOrden(/Retiro/, "50 mil", "Nu", ""), a(MARTES, "10:00"));
  assert.equal(vueltas.length, 5);
  assert.ok(!vueltas[2].opciones.includes("Efectivo"));
  const efectivo = falso.tablas.finanzas_cuentas.find((c) => c.nombre === "Efectivo");
  const [mov] = falso.tablas.finanzas_movimientos;
  assert.equal(mov.tipo, "retiro");
  assert.equal(mov.cuenta_destino_id, efectivo.id);
});

test("Otro…: escribe la categoría a mano", async () => {
  const falso = base();
  const token = await conToken(falso);
  await conversar(falso, token, "gasto", enOrden(/Gasto/, "35000", /Otro…/, "Cita", "Nequi", ""), a(MARTES, "20:00"));
  const [mov] = falso.tablas.finanzas_movimientos;
  assert.equal(mov.categoria, "Cita");
  assert.equal(mov.categoria_libre, true);
});

test("una respuesta que no sirve repite la misma pregunta con un aviso", async () => {
  const falso = base();
  const token = await conToken(falso);
  const vueltas = await conversar(falso, token, "dinero", enOrden(/Gasto/, "mucho", "20000", /Transporte/, "Efectivo", "Bus"), a(MARTES, "08:00"));
  assert.equal(vueltas[2].tipo, "numero");
  assert.match(vueltas[2].pregunta, /^⚠️ Escribe solo el número/);
  assert.equal(final(vueltas).mensaje, "💸 Guardado · Transporte");
});

test("🙅 Hoy no he gastado: cuenta como registro (principio 4)", async () => {
  const falso = base();
  const token = await conToken(falso);
  const vueltas = await conversar(falso, token, "dinero", enOrden(/no he gastado/), a(MARTES, "14:00"));
  assert.match(final(vueltas).mensaje, /sin gastos/);
  assert.equal(falso.tablas.checkins[0].tipo, "nada_que_registrar");
});

test("sin flujo abre el menú; desde el menú se llega a cualquier flujo", async () => {
  const falso = base();
  const token = await conToken(falso);
  const vueltas = await conversar(falso, token, "", enOrden(/Comí/, /Almuerzo/, /Corrientazo/), a(MARTES, "13:00"));
  assert.match(vueltas[0].pregunta, /Qué hacemos/);
  assert.equal(final(vueltas).mensaje, "🍽️ Guardado · Almuerzo");
  const [comida] = falso.tablas.comidas;
  assert.equal(comida.tipo, "almuerzo");
  assert.equal(comida.kcal, 950);
});

test("el menú pone primero lo que falta registrar", async () => {
  const falso = base();
  const token = await conToken(falso);
  const r = await llamar(falso, "POST asistente", { token, cuerpo: {}, ahora: a(MARTES, "16:00") });
  assert.match(r.cuerpo.opciones[0], /Falta: Desayuno/);
});

test("🍽️ a esta hora sugiere primero la comida que toca, y «No comí» también es registro", async () => {
  const falso = base();
  const token = await conToken(falso);
  const vueltas = await conversar(falso, token, "comida", enOrden(/Desayuno/, /No comí/), a(MARTES, "07:30"));
  assert.match(vueltas[0].opciones[0], /Desayuno/);
  assert.match(final(vueltas).mensaje, /sin desayuno/);
  assert.equal(falso.tablas.comidas[0].omitida, true);
});

test("✅ Terminé algo: muestra lo que ya empezó y marca el elegido", async () => {
  const falso = base();
  const token = await conToken(falso);
  const ahora = a(MARTES, "06:50");
  const vueltas = await conversar(falso, token, "hecho", enOrden((v) => v.opciones[0]), ahora);
  assert.match(vueltas[0].pregunta, /Qué terminaste/);
  assert.match(final(vueltas).mensaje, /^✅ Hecho · /);
  assert.equal(falso.tablas.rutina_checks.length, 1);
  assert.equal(falso.tablas.rutina_checks[0].estado, "hecho");
});

test("📝 Tengo que hacer algo → 🎯 ¿Qué hago ahora? la propone con su primer paso", async () => {
  const falso = base();
  const token = await conToken(falso);
  const ahora = a(MARTES, "21:30");
  await conversar(falso, token, "pendiente", enOrden("Taller de cálculo", /Mañana/, "abrir el PDF"), ahora);
  assert.equal(falso.tablas.uni_tareas[0].primer_paso, "abrir el PDF");

  const vueltas = await conversar(
    falso,
    token,
    "ahora",
    (v) => (/Taller/.test(v.pregunta) ? "▶️ Voy" : "⏭️ Otra cosa"),
    ahora,
  );
  assert.match(final(vueltas).mensaje, /Vamos: abrir el PDF/);
  assert.equal(falso.tablas.uni_tareas[0].estado, "en_progreso");
});

test("🏋️ Entreno: empieza y luego termina", async () => {
  const falso = base();
  const token = await conToken(falso);
  const inicio = await conversar(falso, token, "entreno", enOrden(/Fuerza/), a(MARTES, "17:00"));
  assert.match(final(inicio).mensaje, /A darle/);
  const finEntreno = await conversar(falso, token, "entreno", enOrden(/Terminé/), a(MARTES, "18:05"));
  assert.match(finEntreno[0].pregunta, /en curso/);
  assert.equal(falso.tablas.gym_sesiones[0].en_curso, false);
});

test("🌙 dormir desde la automatización del cargador de día: silencio (no molesta)", async () => {
  const falso = base();
  const token = await conToken(falso);
  const vueltas = await conversar(falso, token, "dormir cargador", () => "", a(MARTES, "15:00"));
  assert.equal(final(vueltas).tipo, "silencio");
  const noche = await conversar(falso, token, "dormir cargador", () => "", a(MARTES, "22:40"));
  assert.match(final(noche).mensaje, /Buenas noches/);
});

test("🔔 aviso: con algo pendiente avisa; sin nada, silencio", async () => {
  const falso = base();
  const token = await conToken(falso);
  const temprano = await conversar(falso, token, "aviso", () => "", a(MARTES, "05:00"));
  assert.equal(final(temprano).tipo, "silencio");
  const tarde = await conversar(falso, token, "aviso", () => "", a(MARTES, "16:00"));
  assert.equal(final(tarde).tipo, "fin");
});

test("🌙 repaso: pregunta cada bloque sin marcar y los guarda todos", async () => {
  const falso = base();
  const token = await conToken(falso);
  const vueltas = await conversar(falso, token, "repaso", (v) => (/Sí|No/.test(v.opciones.join()) && v.opciones.includes("✅ Sí") ? "✅ Sí" : v.opciones[0]), a(MARTES, "23:00"));
  assert.ok(vueltas.length > 3);
  assert.ok(falso.tablas.rutina_checks.length >= 3);
  assert.ok(falso.tablas.rutina_checks.every((c) => c.estado === "hecho"));
});

test("un estado dañado no rompe: pide empezar otra vez", async () => {
  const falso = base();
  const token = await conToken(falso);
  const r = await llamar(falso, "POST asistente", { token, cuerpo: { estado: "basura!!", respuesta: "x" } });
  assert.equal(r.cuerpo.tipo, "fin");
});

test("ningún mensaje final lleva montos", async () => {
  const falso = base();
  const token = await conToken(falso);
  const vueltas = await conversar(falso, token, "dinero", enOrden(/Gasto/, "25000", /Comida/, "Nequi", "Cena"), a(MARTES, "19:00"));
  assert.doesNotMatch(final(vueltas).mensaje, /\d/);
});

test("leerMonto entiende cómo se escribe la plata en Colombia", () => {
  const casos = {
    25000: 25000,
    "25000": 25000,
    "25.000": 25000,
    "$25.000": 25000,
    "25k": 25000,
    "25 mil": 25000,
    "1.500.000": 1500000,
    "1,5 millones": 1500000,
    "2m": 2000000,
    "12,50": 13,
    "": null,
    abc: null,
    "0": null,
  };
  for (const [entrada, esperado] of Object.entries(casos)) assert.equal(leerMonto(entrada), esperado, entrada);
});

test("flujo escrito con mayúsculas, tildes o alias", () => {
  const { empezar } = _pruebas;
  assert.equal(empezar("Dinero").f, "dinero");
  assert.equal(empezar("gasto").f, "dinero");
  assert.deepEqual([empezar("Comida Almuerzo").f, empezar("Comida Almuerzo").a], ["comida", "almuerzo"]);
  assert.equal(empezar("me_acuesto").f, "dormir");
  assert.equal(empezar("cualquier cosa").f, "menu");
});

test("🔒 puerta: con registros al día deja pasar en silencio", async () => {
  const falso = base();
  const token = await conToken(falso);
  const vueltas = await conversar(falso, token, "puerta tiktok", () => "", a(MARTES, "05:30"));
  assert.equal(final(vueltas).tipo, "silencio");
  assert.equal(falso.tablas.apps_eventos.length, 1);
});

test("🔒 puerta: si falta algo, va al inicio, ofrece registrarlo y lo registra ahí mismo", async () => {
  const falso = base();
  const token = await conToken(falso);
  const vueltas = await conversar(falso, token, "puerta tiktok", enOrden(/Desayuno/, /Pericos/), a(MARTES, "16:00"));
  assert.equal(vueltas[0].tipo, "inicio");
  assert.match(vueltas[1].pregunta, /primero lo que falta/);
  assert.ok(vueltas[1].opciones.some((o) => /pase/.test(o)));
  assert.equal(final(vueltas).mensaje, "🍽️ Guardado · Desayuno");
  // La puerta se consultó una sola vez (una apertura anotada).
  assert.equal(falso.tablas.apps_eventos.length, 1);
});

test("🔒 puerta: el pase de emergencia", async () => {
  const falso = base();
  const token = await conToken(falso);
  const vueltas = await conversar(falso, token, "puerta tiktok", enOrden(/pase/), a(MARTES, "16:00"));
  assert.match(final(vueltas).mensaje, /10 min/);
  assert.equal(falso.tablas.desbloqueo_pases.length, 1);
});

test("🔓 cerré la app: anota el cierre en silencio", async () => {
  const falso = base();
  const token = await conToken(falso);
  const vueltas = await conversar(falso, token, "cerre tiktok", () => "", a(MARTES, "08:30"));
  assert.equal(final(vueltas).tipo, "silencio");
  assert.equal(falso.tablas.apps_eventos[0].evento, "cerrar");
});
