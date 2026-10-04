// El script de Scriptable (web/scriptable/goat.js): sintaxis válida, sin llaves dentro, y corrido de verdad en un
// Scriptable de mentira (ListWidget, DrawContext, Request, Keychain…) para cada tamaño, sin internet y con errores.

import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ejemploWidget } from "../web/js/widgets/logica.js";

const ARCHIVO = fileURLToPath(new URL("../web/scriptable/goat.js", import.meta.url));
const CODIGO = readFileSync(ARCHIVO, "utf8");
const BASE = "https://goat.test";
const TOKEN = "t".repeat(43);
const CONFIGURADO = { "goat.url": BASE, "goat.token": TOKEN };
const FAMILIAS = ["small", "medium", "large", "accessoryCircular", "accessoryRectangular", "accessoryInline"];

// ── Scriptable de mentira ────────────────────────────────────────────────

class Pila {
  constructor(tipo = "pila") {
    this.tipo = tipo;
    this.hijos = [];
  }
  addText(text) {
    const n = { tipo: "texto", text };
    this.hijos.push(n);
    return n;
  }
  addStack() {
    const p = new Pila();
    this.hijos.push(p);
    return p;
  }
  addSpacer(length) {
    const n = { tipo: "espacio", length };
    this.hijos.push(n);
    return n;
  }
  addImage(image) {
    const n = { tipo: "imagen", image, centerAlignImage() {}, leftAlignImage() {}, rightAlignImage() {} };
    this.hijos.push(n);
    return n;
  }
  addDate(date) {
    return this.addText(String(date));
  }
  setPadding() {}
  useDefaultPadding() {}
  layoutHorizontally() {}
  layoutVertically() {}
  centerAlignContent() {}
  topAlignContent() {}
  bottomAlignContent() {}
}

function scriptable({ familia = null, enApp = false, llavero = {}, responder, archivos = new Map(), parametro = null, alertas = [], pantalla = [390, 844] }) {
  const e = { peticiones: [], widget: null, presentado: [], alertas: [], completo: false, llavero: new Map(Object.entries(llavero)), archivos };

  class ListWidget extends Pila {
    constructor() {
      super("widget");
    }
  }
  for (const nombre of ["presentSmall", "presentMedium", "presentLarge", "presentAccessoryCircular", "presentAccessoryRectangular", "presentAccessoryInline"]) {
    ListWidget.prototype[nombre] = async function () {
      e.presentado.push([nombre, this]);
    };
  }
  class DrawContext {
    constructor() {
      this.textos = [];
    }
    getImage() {
      return { imagen: true, textos: this.textos };
    }
    drawTextInRect(t) {
      this.textos.push(t);
    }
    drawText(t) {
      this.textos.push(t);
    }
  }
  for (const nombre of ["setFont", "setTextColor", "setTextAlignedCenter", "setTextAlignedLeft", "setTextAlignedRight", "setStrokeColor", "setFillColor", "setLineWidth", "addPath", "strokePath", "fillPath", "fillEllipse", "strokeEllipse", "fillRect", "strokeRect"]) {
    DrawContext.prototype[nombre] = function () {};
  }
  class Path {}
  for (const nombre of ["move", "addLine", "addRoundedRect", "addEllipse", "addRect", "closeSubpath", "addCurve", "addQuadCurve"]) Path.prototype[nombre] = function () {};
  class Request {
    constructor(url) {
      this.url = url;
      e.peticiones.push(this);
    }
    async loadJSON() {
      const r = await responder(this);
      if (r instanceof Error) throw r;
      this.response = { statusCode: r.estado };
      return r.cuerpo;
    }
  }
  class Alert {
    constructor() {
      this.acciones = [];
      this.campos = [];
    }
    addTextField(placeholder, valor) {
      this.campos.push(valor ?? "");
    }
    addSecureTextField(placeholder, valor) {
      this.campos.push(valor ?? "");
    }
    addAction(t) {
      this.acciones.push(t);
    }
    addDestructiveAction(t) {
      this.acciones.push(t);
    }
    addCancelAction() {}
    async presentAlert() {
      e.alertas.push({ title: this.title, message: this.message, acciones: this.acciones });
      const r = alertas.shift() ?? { accion: 0 };
      this.respuesta = r.campos ?? this.campos;
      return r.accion;
    }
    async presentSheet() {
      return this.presentAlert();
    }
    textFieldValue(i) {
      return this.respuesta[i];
    }
  }
  const valores = (nombre) =>
    class {
      constructor(...a) {
        this.valores = a;
        this.nombre = nombre;
        if (nombre === "Size") [this.width, this.height] = a;
      }
    };

  const contexto = {
    console,
    ListWidget,
    DrawContext,
    Path,
    Request,
    Alert,
    Color: valores("Color"),
    Size: valores("Size"),
    Point: valores("Point"),
    Rect: valores("Rect"),
    LinearGradient: valores("LinearGradient"),
    Font: new Proxy({}, { get: (_, nombre) => (tam) => ({ nombre, tam }) }),
    Device: { screenSize: () => ({ width: pantalla[0], height: pantalla[1] }) },
    FileManager: {
      local: () => ({
        documentsDirectory: () => "/docs",
        joinPath: (a, b) => `${a}/${b}`,
        fileExists: (r) => archivos.has(r),
        readString: (r) => archivos.get(r),
        writeString: (r, t) => archivos.set(r, t),
        remove: (r) => archivos.delete(r),
      }),
    },
    Keychain: {
      contains: (k) => e.llavero.has(k),
      get: (k) => {
        if (!e.llavero.has(k)) throw new Error("No existe");
        return e.llavero.get(k);
      },
      set: (k, v) => e.llavero.set(k, v),
      remove: (k) => e.llavero.delete(k),
    },
    config: {
      runsInWidget: Boolean(familia) && !familia.startsWith("accessory"),
      runsInAccessoryWidget: Boolean(familia) && familia.startsWith("accessory"),
      runsInApp: enApp,
      runsWithSiri: false,
      widgetFamily: familia ?? undefined,
    },
    args: { widgetParameter: parametro },
    Script: {
      setWidget: (w) => (e.widget = w),
      complete: () => (e.completo = true),
    },
  };
  return { e, contexto };
}

async function correr(opciones) {
  const { e, contexto } = scriptable(opciones);
  await vm.runInContext(`(async () => {\n${CODIGO}\n})()`, vm.createContext(contexto), { filename: "goat.js" });
  assert.ok(e.completo, "no llamó Script.complete()");
  return e;
}

/** Todo lo que se lee en el widget: textos y números dibujados en las imágenes. */
function textos(nodo) {
  if (!nodo) return [];
  if (nodo.tipo === "texto") return [nodo.text];
  if (nodo.tipo === "imagen") return nodo.image?.textos ?? [];
  return (nodo.hijos ?? []).flatMap(textos);
}

/** La API: ejemplo completo; el dinero solo si lo pidieron con ?dinero=1. */
function apiOk(peticion) {
  const datos = ejemploWidget();
  if (!peticion.url.includes("dinero=1")) delete datos.dinero;
  return { estado: 200, cuerpo: { ok: true, mensaje: datos.bloqueo.linea, datos } };
}

const sinPlata = (lista) => {
  for (const t of lista) assert.doesNotMatch(String(t), /\$|19\.100|19100/, `lleva dinero: ${t}`);
};

// ── Pruebas ──────────────────────────────────────────────────────────────

test("node --check: la sintaxis es válida", () => {
  const r = spawnSync(process.execPath, ["--check", ARCHIVO], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});

test("el archivo publicado no trae llaves, tokens ni direcciones reales", () => {
  assert.doesNotMatch(CODIGO, /sb_secret_|sb_publishable_|service_role|eyJ[A-Za-z0-9_-]{10,}/);
  assert.doesNotMatch(CODIGO, /["'`][A-Za-z0-9_-]{32,64}["'`]/, "parece que hay un token pegado");
  const direcciones = (CODIGO.match(/https?:\/\/[^\s"'`)]+/g) ?? []).filter((d) => !d.includes("${"));
  for (const d of direcciones) assert.match(d, /^https:\/\/(scriptable\.app|tu-goat\.vercel\.app)/, d);
  assert.match(CODIGO, /Keychain/);
});

for (const familia of FAMILIAS) {
  test(`${familia}: dibuja con los datos de la API, se refresca en 15 min y abre Goat al tocar`, async () => {
    const antes = Date.now();
    const e = await correr({ familia, llavero: CONFIGURADO, responder: apiOk });
    assert.ok(e.widget, "no armó el widget");
    assert.equal(e.peticiones.length, 1);
    assert.equal(e.peticiones[0].url, `${BASE}/api/v1/widget`);
    assert.equal(e.peticiones[0].headers.Authorization, `Bearer ${TOKEN}`);
    const refresco = e.widget.refreshAfterDate.getTime() - antes;
    assert.ok(refresco >= 14 * 60_000 && refresco <= 16 * 60_000, `refresco de ${refresco} ms`);
    assert.ok(e.widget.url.startsWith(`${BASE}/`), e.widget.url);
    const t = textos(e.widget);
    assert.ok(t.length > 0);
    sinPlata(t);
    if (familia.startsWith("accessory")) assert.equal(e.widget.backgroundGradient, undefined, "la pantalla bloqueada no lleva fondo");
    else assert.ok(e.widget.backgroundGradient, "falta el fondo negro");
  });
}

test("lo que dice cada tamaño", async () => {
  const leer = async (familia) => textos((await correr({ familia, llavero: CONFIGURADO, responder: apiOk })).widget);
  const pequeno = await leer("small");
  assert.ok(pequeno.includes("72"), "el puntaje no está en el centro del anillo");
  assert.ok(pequeno.includes("🔥5"));
  assert.ok(pequeno.includes("● Falta almuerzo"));

  const mediano = await leer("medium");
  assert.ok(mediano.includes("🎯 Trabajo útil"));
  assert.ok(mediano.includes("40 min · luego 17:00 Ejercicio"));
  assert.ok(mediano.includes("🔒 Registra para abrir"));
  assert.ok(mediano.includes(ejemploWidget().frase));

  const grande = await leer("large");
  assert.ok(grande.includes("Ayer 64 · hoy 72"));
  assert.ok(grande.includes("🌙 Anoche 7 h 10 · índice 82"));
  assert.ok(["S", "D", "L", "M", "J", "V"].every((letra) => grande.includes(letra)), "faltan las letras de la semana");
  assert.ok(grande.includes(ejemploWidget().frase));

  assert.deepEqual(await leer("accessoryRectangular"), ["72 pts · 🔥5", "Falta almuerzo", "17:00 Ejercicio"]);
  assert.deepEqual(await leer("accessoryInline"), ["Goat 72 · 🔥5"]);
  assert.ok((await leer("accessoryCircular")).includes("72"));
});

test("dinero: solo en mediano y grande cuando se activa; nunca en el pequeño ni en la pantalla bloqueada", async () => {
  const llavero = { ...CONFIGURADO, "goat.dinero": "1" };
  for (const familia of ["medium", "large"]) {
    const e = await correr({ familia, llavero, responder: apiOk });
    assert.equal(e.peticiones[0].url, `${BASE}/api/v1/widget?dinero=1`);
    assert.ok(textos(e.widget).includes("$19.100"), `${familia} no muestra el dinero`);
  }
  for (const familia of ["small", "accessoryCircular", "accessoryRectangular", "accessoryInline"]) {
    const e = await correr({ familia, llavero, responder: apiOk, parametro: "dinero" });
    assert.equal(e.peticiones[0].url, `${BASE}/api/v1/widget`, `${familia} pidió dinero`);
    sinPlata(textos(e.widget));
  }
  // Apagado por defecto; el parámetro "dinero" lo enciende solo en ese widget.
  const sin = await correr({ familia: "medium", llavero: CONFIGURADO, responder: apiOk });
  sinPlata(textos(sin.widget));
  const conParametro = await correr({ familia: "large", llavero: CONFIGURADO, responder: apiOk, parametro: "dinero" });
  assert.ok(textos(conParametro.widget).includes("$19.100"));
});

test("sin internet usa la última respuesta guardada (sin el dinero) y lo dice sutil", async () => {
  const archivos = new Map();
  await correr({ familia: "medium", llavero: { ...CONFIGURADO, "goat.dinero": "1" }, responder: apiOk, archivos });
  const guardado = [...archivos.values()][0];
  assert.ok(guardado, "no guardó la respuesta");
  assert.doesNotMatch(guardado, /dinero|19100/, "guardó el dinero en el teléfono");

  const sinRed = async () => new Error("The Internet connection appears to be offline.");
  for (const familia of ["large", "accessoryRectangular"]) {
    const e = await correr({ familia, llavero: CONFIGURADO, responder: sinRed, archivos });
    const t = textos(e.widget);
    assert.ok(t.some((x) => /72/.test(x)), `${familia} no usó lo guardado`);
    sinPlata(t);
  }
  const grande = await correr({ familia: "large", llavero: CONFIGURADO, responder: sinRed, archivos });
  assert.ok(textos(grande.widget).some((x) => /hace \d+ min/.test(x)), "no avisa que es de hace un rato");

  const vacio = await correr({ familia: "small", llavero: CONFIGURADO, responder: sinRed });
  assert.ok(textos(vacio.widget).includes("📡 Sin conexión"));
});

test("token malo → 'Revisa el token' (aunque haya algo guardado); servidor caído → lo guardado", async () => {
  const archivos = new Map();
  await correr({ familia: "small", llavero: CONFIGURADO, responder: apiOk, archivos });
  const r401 = async () => ({ estado: 401, cuerpo: { ok: false, mensaje: "🔑 Token inválido o revocado", codigo: "TOKEN_INVALIDO" } });
  for (const familia of ["small", "medium", "accessoryInline"]) {
    const e = await correr({ familia, llavero: CONFIGURADO, responder: r401, archivos });
    assert.ok(textos(e.widget).includes("🔑 Revisa el token"), familia);
  }
  const r503 = async () => ({ estado: 503, cuerpo: { ok: false, mensaje: "🛠️ Falta actualizar la base de datos", codigo: "BASE_SIN_INSTALAR" } });
  const conGuardado = await correr({ familia: "small", llavero: CONFIGURADO, responder: r503, archivos });
  assert.ok(textos(conGuardado.widget).includes("72"));
  const sinGuardado = await correr({ familia: "medium", llavero: CONFIGURADO, responder: r503 });
  assert.ok(textos(sinGuardado.widget).includes("🛠️ Falta actualizar la base de datos"));
});

test("sin configurar: el widget pide abrir Scriptable y no llama a internet", async () => {
  for (const familia of ["small", "accessoryInline"]) {
    const e = await correr({ familia, responder: apiOk });
    assert.equal(e.peticiones.length, 0);
    assert.ok(textos(e.widget).includes("⚙️ Conecta Goat"));
  }
});

test("en la app, la primera vez: pide dirección y llave, limpia la URL, las guarda en el Llavero y muestra el mediano", async () => {
  const e = await correr({
    enApp: true,
    responder: apiOk,
    alertas: [{ accion: 0, campos: ["goat.test/api/v1/", ` ${TOKEN} `] }, { accion: 0 }],
  });
  assert.equal(e.llavero.get("goat.url"), BASE);
  assert.equal(e.llavero.get("goat.token"), TOKEN);
  assert.equal(e.alertas[1].title, "✅ Conectado");
  assert.equal(e.presentado.at(-1)[0], "presentMedium");
  assert.ok(e.presentado.at(-1)[1].hijos.length > 0);
});

test("en la app: una llave mal copiada no se guarda", async () => {
  const e = await correr({ enApp: true, responder: apiOk, alertas: [{ accion: 0, campos: [BASE, "muy-corta"] }, { accion: 0 }] });
  assert.equal(e.llavero.has("goat.token"), false);
  assert.equal(e.alertas[1].title, "Revisa los datos");
  assert.equal(e.presentado.length, 0);
});

test("en la app, ya conectado: el menú enciende el dinero, muestra tamaños y desconecta", async () => {
  const dinero = await correr({ enApp: true, llavero: CONFIGURADO, responder: apiOk, alertas: [{ accion: 4 }, { accion: 0 }] });
  assert.equal(dinero.llavero.get("goat.dinero"), "1");

  const pequeno = await correr({ enApp: true, llavero: CONFIGURADO, responder: apiOk, alertas: [{ accion: 1 }] });
  assert.equal(pequeno.presentado[0][0], "presentSmall");

  const bloqueo = await correr({ enApp: true, llavero: CONFIGURADO, responder: apiOk, alertas: [{ accion: 3 }] });
  assert.equal(bloqueo.presentado[0][0], "presentAccessoryRectangular");
  sinPlata(textos(bloqueo.presentado[0][1]));

  const archivos = new Map([["/docs/goat-widget.json", "{}"]]);
  const fuera = await correr({ enApp: true, llavero: CONFIGURADO, responder: apiOk, archivos, alertas: [{ accion: 6 }, { accion: 0 }] });
  assert.equal(fuera.llavero.size, 0);
  assert.equal(archivos.size, 0);
});

test("iPhone de pantalla baja (SE): anillos y barras más chicos para que quepan", async () => {
  const tamanos = async (pantalla) => {
    const e = await correr({ familia: "large", llavero: CONFIGURADO, responder: apiOk, pantalla });
    const imagenes = [];
    const recorrer = (n) => (n.tipo === "imagen" ? imagenes.push(n.imageSize) : (n.hijos ?? []).forEach(recorrer));
    recorrer(e.widget);
    return imagenes.map((s) => s.height);
  };
  const normal = await tamanos([390, 844]);
  const se = await tamanos([375, 667]);
  assert.ok(se.every((alto, i) => alto <= normal[i]) && se.some((alto, i) => alto < normal[i]));
});
