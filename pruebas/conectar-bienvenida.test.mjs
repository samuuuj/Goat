// Primer uso: ¿Hoy manda a conectar.html? (web/js/conectar/bienvenida.js)

import { test } from "node:test";
import assert from "node:assert/strict";
import { CLAVE_BIENVENIDA, marcarDispositivo, revisarBienvenida } from "../web/js/conectar/bienvenida.js";

const SESION = { user: { id: "11111111-1111-4111-8111-111111111111" } };

/** localStorage de mentira. `roto`: lanza como en un modo privado estricto. */
function almacen(inicial = {}, { roto = false } = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    getItem(clave) {
      if (roto) throw new Error("SecurityError");
      return datos.has(clave) ? datos.get(clave) : null;
    },
    setItem(clave, valor) {
      if (roto) throw new Error("QuotaExceededError");
      datos.set(clave, String(valor));
    },
  };
}

/** leerAjustes de mentira que cuenta cuántas veces se llamó. */
function ajustes(valor) {
  const leer = async (userId) => {
    leer.llamadas.push(userId);
    if (valor instanceof Error) throw valor;
    return valor;
  };
  leer.llamadas = [];
  return leer;
}

test("sin marca local y sin perfil.ajustes.bienvenida → al asistente", async () => {
  const leer = ajustes({});
  assert.equal(await revisarBienvenida(SESION, { almacen: almacen(), leerAjustes: leer }), true);
  assert.deepEqual(leer.llamadas, [SESION.user.id]);
});

test("con la marca de este dispositivo → Hoy, sin preguntar a la base", async () => {
  const leer = ajustes({});
  assert.equal(await revisarBienvenida(SESION, { almacen: almacen({ [CLAVE_BIENVENIDA]: "1" }), leerAjustes: leer }), false);
  assert.equal(leer.llamadas.length, 0);
});

test("terminado en otro dispositivo → Hoy, y este dispositivo queda marcado", async () => {
  const local = almacen();
  const leer = ajustes({ bienvenida: { completada: true, fecha: "2026-10-04T12:00:00Z" }, atajos: { "conectar-goat": true } });
  assert.equal(await revisarBienvenida(SESION, { almacen: local, leerAjustes: leer }), false);
  assert.equal(local.datos.get(CLAVE_BIENVENIDA), "1");
});

test("perfil con otros ajustes pero sin terminar → al asistente", async () => {
  const leer = ajustes({ desbloqueo: { juegos: [] }, bienvenida: { completada: false } });
  assert.equal(await revisarBienvenida(SESION, { almacen: almacen(), leerAjustes: leer }), true);
});

test("ajustes null (perfil recién creado) → al asistente", async () => {
  assert.equal(await revisarBienvenida(SESION, { almacen: almacen(), leerAjustes: ajustes(null) }), true);
});

test("si leer la base falla, Hoy sigue normal (nunca lanza)", async () => {
  assert.equal(await revisarBienvenida(SESION, { almacen: almacen(), leerAjustes: ajustes(new Error("sin red")) }), false);
});

test("sin localStorage (modo privado estricto) no se insiste: no hay dónde guardar «Ahora no»", async () => {
  const leer = ajustes({});
  assert.equal(await revisarBienvenida(SESION, { almacen: almacen({}, { roto: true }), leerAjustes: leer }), false);
  assert.equal(await revisarBienvenida(SESION, { almacen: null, leerAjustes: leer }), false);
  assert.equal(leer.llamadas.length, 0);
});

test("marcarDispositivo guarda la marca y no lanza si el almacenamiento falla", () => {
  const local = almacen();
  marcarDispositivo(local);
  assert.equal(local.datos.get(CLAVE_BIENVENIDA), "1");
  assert.doesNotThrow(() => marcarDispositivo(almacen({}, { roto: true })));
  assert.doesNotThrow(() => marcarDispositivo(null));
});

test("la clave es la misma que pone el simulador del navegador", () => {
  assert.equal(CLAVE_BIENVENIDA, "goat:bienvenida");
});
