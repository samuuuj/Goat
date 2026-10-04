// Widgets (widgets.html): vista previa de cada tamaño con tus datos de hoy y guía para instalarlos.
// Los datos se arman como en GET /api/v1/widget (js/widgets/datos.js); si no se pueden leer, salen los de ejemplo.

import { iniciarPagina } from "../piezas/pagina.js";
import { avisar, clonar } from "../piezas/ui.js";
import { SesionVencida } from "../supabase/datos.js";
import { cargarWidget } from "./datos.js";
import { ejemploWidget } from "./logica.js";
import { pintarVitrina, widgetAtajos } from "./vista.js";
import { ATAJOS, GUIA_BLOQUEO, GUIA_SCRIPTABLE } from "./atajos.js";

const $ = (id) => document.getElementById(id);
const pagina = await iniciarPagina({ alReintentar: () => location.reload() });

let datos = null;
let verDinero = false;

// ── Vitrina ──────────────────────────────────────────────────────────────

function pintar(animar) {
  pintarVitrina(datos, { animar, verDinero });
  $("frase-dia").textContent = datos.frase;
  $("vitrina-fuente").textContent = datos.ejemplo ? "Datos de ejemplo" : `Tus datos · ${datos.hora}`;
}

$("ver-dinero").addEventListener("click", () => {
  verDinero = !verDinero;
  $("ver-dinero").setAttribute("aria-checked", String(verDinero));
  pintar(false);
});

// ── Script de Scriptable: se trae al cargar para copiarlo al instante (iOS pide el toque "en caliente"). ──

let script = null;
const traerScript = () =>
  fetch("scriptable/goat.js", { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`goat.js ${r.status}`);
    return r.text();
  });
const scriptListo = traerScript().then((texto) => (script = texto));

async function copiar(texto, promesa) {
  if (texto !== null) return navigator.clipboard.writeText(texto);
  // Safari acepta una promesa en ClipboardItem: copia cuando llega el archivo sin perder el toque.
  if (window.ClipboardItem && navigator.clipboard.write) {
    return navigator.clipboard.write([new ClipboardItem({ "text/plain": promesa.then((t) => new Blob([t], { type: "text/plain" })) })]);
  }
  return navigator.clipboard.writeText(await promesa);
}

async function copiarScript() {
  try {
    await copiar(script, scriptListo);
    avisar("📋 Script copiado");
  } catch (error) {
    console.warn("[widgets] copiar", error);
    avisar("⚠️ No se pudo copiar");
  }
}

// ── Guías ────────────────────────────────────────────────────────────────

function accionDelPaso(i) {
  if (i === 0) return clonar("plantilla-accion-tienda");
  if (i === 1) {
    const accion = clonar("plantilla-accion-copiar");
    accion.querySelector("[data-copiar-script]").addEventListener("click", copiarScript);
    const nota = accion.querySelector("[data-script-nota]");
    nota.textContent = "goat.js";
    scriptListo
      .then((texto) => (nota.textContent = `goat.js · ${Math.max(1, Math.round(texto.length / 1024))} KB · sin tu llave adentro`))
      .catch(() => (nota.textContent = "No se pudo traer el archivo. Usa «Ver el archivo»."));
    return accion;
  }
  if (i === 3) {
    const accion = clonar("plantilla-accion-direccion");
    accion.querySelector("[data-direccion]").textContent = location.origin;
    accion.querySelector("[data-copiar-direccion]").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(location.origin);
        avisar("📋 Dirección copiada");
      } catch {
        avisar("⚠️ No se pudo copiar");
      }
    });
    return accion;
  }
  return null;
}

function pintarGuias() {
  $("pasos-scriptable").replaceChildren(
    ...GUIA_SCRIPTABLE.map((paso, i) => {
      const li = clonar("plantilla-paso");
      li.style.setProperty("--i", i);
      li.querySelector(".paso-numero").textContent = String(i + 1);
      li.querySelector(".paso-titulo").textContent = paso.titulo;
      li.querySelector(".paso-texto").textContent = paso.texto;
      const accion = accionDelPaso(i);
      if (accion) li.querySelector(".paso-acciones").append(accion);
      else li.querySelector(".paso-acciones").remove();
      return li;
    }),
  );

  const cortos = (lista, pasos) =>
    lista.replaceChildren(
      ...pasos.map((texto, i) => {
        const li = clonar("plantilla-paso-corto");
        li.querySelector(".paso-numero").textContent = String(i + 1);
        li.querySelector(".paso-texto").textContent = texto;
        return li;
      }),
    );
  cortos($("pasos-bloqueo"), GUIA_BLOQUEO);
  const botones = ATAJOS.find((a) => a.id === "widgets-botones");
  cortos($("pasos-atajos"), botones.pasos);

  $("guias-atajos").replaceChildren(
    ...ATAJOS.filter((a) => a.id !== "widgets-botones").map((atajo) => {
      const guia = clonar("plantilla-guia");
      guia.querySelector(".guia-emoji").textContent = atajo.emoji;
      guia.querySelector(".guia-nombre").textContent = `Atajo “${atajo.emoji} ${atajo.nombre}”`;
      guia.querySelector(".guia-para").textContent = atajo.para;
      guia.querySelector(".guia-pasos").replaceChildren(
        ...atajo.pasos.map((texto) => {
          const li = document.createElement("li");
          li.textContent = texto;
          return li;
        }),
      );
      return guia;
    }),
  );

  $("w-atajo").replaceChildren(widgetAtajos(1));
  $("w-atajos-mediano").replaceChildren(widgetAtajos(4));
}

// ── Arranque ─────────────────────────────────────────────────────────────

try {
  datos = await cargarWidget(pagina.sesion.user.id, new Date());
} catch (error) {
  if (error instanceof SesionVencida) {
    pagina.manejarError(error);
  } else {
    // Sin tablas o sin conexión: la guía igual sirve, con datos de ejemplo.
    console.warn("[widgets] vista previa con datos de ejemplo:", error?.message ?? error);
  }
  datos = ejemploWidget();
}

pintarGuias();
pagina.mostrar("contenido");
pintar(true);

// La frase y la hora cambian solas: se vuelve a armar cada 5 minutos mientras la página está abierta.
window.setInterval(async () => {
  if (document.hidden || datos.ejemplo) return;
  try {
    datos = await cargarWidget(pagina.sesion.user.id, new Date());
    pintar(false);
  } catch (error) {
    if (error instanceof SesionVencida) pagina.manejarError(error);
  }
}, 5 * 60_000);
