// Atajos base de Conectar («⚙️ Goat», «🧪 Goat · Probar») y reglas de seguridad de la página (token, CSP).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { ATAJOS } from "../web/js/conectar/atajos.js";
import { cargarAtajos, todosLosAtajos } from "../web/js/conectar/logica.js";
import { RUTAS } from "../api/_lib/rutas.js";

const RAIZ = new URL("..", import.meta.url);
const leer = (ruta) => readFile(new URL(ruta, RAIZ), "utf8");

test("los dos atajos base tienen el formato común", () => {
  assert.deepEqual(
    ATAJOS.map((a) => a.id),
    ["conectar-goat", "conectar-probar"],
  );
  for (const a of ATAJOS) {
    for (const campo of ["emoji", "nombre", "para"]) assert.ok(typeof a[campo] === "string" && a[campo].length > 0, `${a.id}.${campo}`);
    assert.ok(Array.isArray(a.pasos) && a.pasos.length >= 5, `${a.id}: pocos pasos`);
    assert.ok(Array.isArray(a.permisos));
    assert.equal(a.automatizacion, null);
  }
});

test("«⚙️ Goat» devuelve un diccionario { url, token } con url sin barra final ni /api/v1", () => {
  const goat = ATAJOS.find((a) => a.id === "conectar-goat");
  const texto = goat.pasos.join("\n");
  assert.match(texto, /⚙️ Goat/);
  assert.match(texto, /«Diccionario»/);
  assert.match(texto, /Clave: url/);
  assert.match(texto, /Clave: token/);
  assert.match(texto, /sin barra al final y sin \/api\/v1/);
  assert.match(texto, /Detener y generar salida/);
  assert.match(texto, /No compartas/);
  assert.equal(goat.prueba, null);
});

test("«🧪 Goat · Probar» llama a /api/v1/ping con la llave (eso anota ultimo_uso)", () => {
  const probar = ATAJOS.find((a) => a.id === "conectar-probar");
  const texto = probar.pasos.join("\n");
  assert.match(texto, /Ejecutar atajo» y elige «⚙️ Goat»/);
  assert.match(texto, /\/api\/v1\/ping/);
  assert.match(texto, /Authorization/);
  assert.match(texto, /Bearer/);
  assert.match(texto, /✅ Conectado/);
  assert.deepEqual(probar.prueba, { metodo: "GET", ruta: "ping" });
  assert.ok(RUTAS["GET ping"]);
});

test("ningún texto de Conectar trae montos ni algo con forma de clave", async () => {
  const textos = JSON.stringify(ATAJOS) + (await leer("web/conectar.html"));
  assert.doesNotMatch(textos, /\$\s?\d/);
  assert.doesNotMatch(textos, /sb_secret_|service_role|eyJ[A-Za-z0-9_-]{10,}\./);
});

// ── El token se ve una sola vez: nunca se guarda en el navegador ni en la base ──

test("el código de Conectar solo guarda la marca de bienvenida en el navegador", async () => {
  const carpeta = new URL("web/js/conectar/", RAIZ);
  for (const archivo of await readdir(carpeta)) {
    const codigo = await readFile(new URL(archivo, carpeta), "utf8");
    assert.doesNotMatch(codigo, /sessionStorage|indexedDB|document\.cookie/, `${archivo} usa otro almacenamiento`);
    for (const [, clave] of codigo.matchAll(/setItem\(([^,]+),/g)) {
      assert.equal(clave.trim(), "CLAVE_BIENVENIDA", `${archivo} guarda ${clave} en el navegador`);
    }
    assert.doesNotMatch(codigo, /\.from\("api_tokens"\)\.(insert|update|upsert)/, `${archivo} escribe en api_tokens`);
    assert.doesNotMatch(codigo, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/, `${archivo} pinta HTML con texto`);
  }
});

test("conectar.html respeta la CSP: sin scripts, estilos ni eventos en línea", async () => {
  const html = await leer("web/conectar.html");
  for (const [, atributos] of html.matchAll(/<script([^>]*)>/g)) assert.match(atributos, /src=/, "hay un <script> en línea");
  assert.doesNotMatch(html, /<style/);
  assert.doesNotMatch(html, /\sstyle=/);
  assert.doesNotMatch(html, /\son[a-z]+=/);
  // Los campos del token no se autocompletan ni se corrigen.
  for (const id of ["llave-token", "otra-token"]) {
    const campo = html.match(new RegExp(`<input id="${id}"[^>]*>`))?.[0] ?? "";
    assert.match(campo, /readonly/, `${id} no es de solo lectura`);
    assert.match(campo, /autocomplete="off"/, `${id} se autocompleta`);
  }
});

// ── Todas las guías arman la dirección igual: url de «⚙️ Goat» + /api/v1/<ruta> ──

/**
 * Rutas de la API escritas en los pasos sin el /api/v1 delante (asumen que url ya lo trae).
 * "(…/ejercicio/menu)" es una abreviatura de una dirección completa de antes: no cuenta.
 * Un tramo pegado a una palabra ("/rutina/hoy") es parte de otra ruta, no la ruta "hoy".
 */
function rutasSinApi(atajo, modulosApi) {
  const textos = [...atajo.pasos, ...atajo.automatizaciones.flatMap((a) => a.pasos ?? [])];
  const patron = new RegExp(`(/api/v1)?/(${modulosApi.join("|")})(?=[/?\\s.,»"']|$)`, "g");
  return textos.flatMap((t) => [...t.matchAll(patron)].filter((m) => !m[1] && t[m.index - 1] !== "…" && !/[\p{L}\d_]/u.test(t[m.index - 1] ?? "")).map((m) => m[0]));
}

const modulosApi = [...new Set(Object.keys(RUTAS).map((clave) => clave.split(" ")[1].split("/")[0]))];
const atajos = todosLosAtajos(await cargarAtajos());
const conProblema = atajos.filter((a) => rutasSinApi(a, modulosApi).length > 0).map((a) => a.id);

test("la detección de rutas sin /api/v1 funciona", () => {
  const ejemplo = {
    pasos: ["la variable url y luego /desbloqueo/gate?app=", "url + /api/v1/finanzas/menu", "Goat › Tu noche", "repite (…/ejercicio/menu)"],
    automatizaciones: [],
  };
  assert.deepEqual(rutasSinApi(ejemplo, modulosApi), ["/desbloqueo"]);
});

test(
  "todas las guías escriben url + /api/v1/<ruta> (url de «⚙️ Goat» va sin /api/v1)",
  { todo: conProblema.length ? `Pendiente en SOLICITUDES › B: ${conProblema.join(", ")}` : false },
  () => {
    assert.deepEqual(conProblema, []);
  },
);
