// Réplicas en HTML/CSS de los widgets (lo mismo que dibuja web/scriptable/goat.js) a partir de la respuesta de
// GET /api/v1/widget. Solo <template> + textContent; los valores dinámicos van por CSSOM (stroke-dashoffset, --h).

import { alVerse, clonar } from "../piezas/ui.js";
import { formatoCOP } from "../logica/formato.js";
import { BOTONES_ATAJOS } from "./atajos.js";

const capital = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "");
const limitar = (x) => Math.min(Math.max(Number(x) || 0, 0), 1);

function poner(raiz, selector, texto) {
  const el = raiz.querySelector(selector);
  if (el) el.textContent = texto ?? "";
  return el;
}

/** Anillos con el puntaje en el centro. Se llenan al verse (o de una vez si no hay que animar). */
function anillos(d, animar) {
  const caja = clonar("plantilla-anillos");
  caja.querySelector("[data-puntaje]").textContent = String(d.score);
  caja.classList.toggle("tres-cifras", String(d.score).length > 2);
  const arcos = [...caja.querySelectorAll("[data-anillo]")];
  const llenar = () =>
    arcos.forEach((arco) => {
      const p = limitar(d.anillos.find((a) => a.clave === arco.dataset.anillo)?.progreso);
      arco.classList.toggle("vacio", p === 0);
      // pathLength = 100: el arco mide 100 y se corre lo que falta.
      arco.style.strokeDashoffset = String(100 - p * 100);
    });
  if (animar) alVerse(caja, () => requestAnimationFrame(llenar));
  else llenar();
  return caja;
}

function racha(raiz, d) {
  poner(raiz, "[data-racha]", d.racha > 0 ? `🔥${d.racha}` : "");
}

function avisos(raiz, d) {
  poner(raiz, "[data-avisos]", d.avisos?.sinLeer > 0 ? `🔔${d.avisos.sinLeer}` : "");
}

function pendiente(raiz, d) {
  const falta = d.pendientes?.total > 0;
  const el = poner(raiz, "[data-pendiente]", falta ? `● Falta ${d.pendientes.texto}` : "✓ Todo al día");
  el?.classList.toggle("falta", falta);
}

/** Las 2 líneas de la rutina (igual que rutina() en goat.js). */
function rutina(raiz, d) {
  const r = d.rutina;
  let uno;
  let dos;
  if (r?.ahora) {
    uno = `${r.emojiAhora ?? ""} ${r.ahora}`.trim();
    dos = r.siguiente ? `${r.quedan} · luego ${r.hora} ${r.siguiente}` : `Quedan ${r.quedan}`;
  } else if (r?.siguiente) {
    uno = `${r.emojiSiguiente ?? ""} ${r.siguiente}`.trim();
    dos = `Siguiente · ${r.hora}`;
  } else if (r) {
    uno = "Nada más por hoy";
    dos = "Lo que queda es descansar 🌙";
  } else {
    uno = "Sin rutina hoy";
    dos = "Ármala en Goat › Tu día";
  }
  poner(raiz, "[data-rutina-1]", uno);
  poner(raiz, "[data-rutina-2]", dos);
}

function desbloqueo(raiz, d) {
  const b = d.desbloqueo;
  const el = poner(raiz, "[data-desbloqueo]", b ? (b.abierto ? `🔓 ${b.minutos} min por app` : "🔒 Registra para abrir") : "");
  if (el) el.hidden = !b;
}

function sueno(raiz, d) {
  const s = d.sueno;
  let linea = "";
  if (s) {
    linea = s.enCama ? "🌙 En cama" : `🌙 ${s.etiqueta}${s.duracion ? ` ${s.duracion}` : " a medias"}`;
    if (s.indice !== null && s.indice !== undefined) linea += ` · índice ${s.indice}`;
  }
  const el = poner(raiz, "[data-sueno]", linea);
  if (el) el.hidden = !s;
}

/** El dinero solo si lo pides (y borroso en modo discreto). Si sale, reemplaza la línea de minutos en el mediano. */
function dinero(raiz, d, ver, { reemplaza = false } = {}) {
  const linea = raiz.querySelector("[data-dinero]");
  const mostrar = Boolean(ver && d.dinero);
  linea.hidden = !mostrar;
  if (mostrar) linea.querySelector("[data-dinero-valor]").textContent = formatoCOP(d.dinero.disponibleHoy);
  if (mostrar && reemplaza) raiz.querySelector("[data-desbloqueo]").hidden = true;
}

function pequeno(d, animar) {
  const w = clonar("plantilla-pequeno");
  w.href = d.abrir || "index.html";
  poner(w, "[data-dia]", capital(d.dia));
  racha(w, d);
  w.querySelector("[data-anillos]").append(anillos(d, animar));
  pendiente(w, d);
  return w;
}

function mediano(d, animar, verDinero) {
  const w = clonar("plantilla-mediano");
  w.querySelector("[data-anillos]").append(anillos(d, animar));
  poner(w, "[data-dia]", d.dia);
  avisos(w, d);
  racha(w, d);
  rutina(w, d);
  pendiente(w, d);
  desbloqueo(w, d);
  dinero(w, d, verDinero, { reemplaza: true });
  poner(w, "[data-frase]", d.frase);
  return w;
}

function semana(caja, d, animar) {
  caja.replaceChildren(
    ...(d.semana ?? []).map((dia) => {
      const el = clonar("plantilla-dia-semana");
      el.classList.toggle("hoy", Boolean(dia.hoy));
      el.classList.toggle("sin-dato", dia.score === null);
      el.querySelector(".w-dia-letra").textContent = dia.dia;
      el.querySelector(".w-barra-relleno").style.setProperty("--h", String(limitar((dia.score ?? 0) / 100)));
      return el;
    }),
  );
  caja.setAttribute("aria-label", `Puntaje de la semana: ${(d.semana ?? []).map((s) => s.score ?? "sin dato").join(", ")}`);
  if (animar) alVerse(caja, () => caja.classList.add("visto"));
  else caja.classList.add("visto");
}

function grande(d, animar, verDinero) {
  const w = clonar("plantilla-grande");
  poner(w, "[data-dia]", `${capital(d.dia)} ${d.fechaCorta ?? ""}`);
  avisos(w, d);
  racha(w, d);
  w.querySelector("[data-anillos]").append(anillos(d, animar));
  for (const fila of w.querySelectorAll("[data-leyenda]")) {
    const anillo = d.anillos.find((a) => a.clave === fila.dataset.leyenda);
    fila.querySelector(".w-leyenda-valor").textContent = `${Math.round((Number(anillo?.progreso) || 0) * 100)}%`;
  }
  poner(w, "[data-ayer]", d.scoreAyer === null || d.scoreAyer === undefined ? "" : `Ayer ${d.scoreAyer} · hoy ${d.score}`);
  rutina(w, d);
  pendiente(w, d);
  desbloqueo(w, d);
  semana(w.querySelector("[data-semana]"), d, animar);
  sueno(w, d);
  dinero(w, d, verDinero);
  poner(w, "[data-frase]", d.frase);
  return w;
}

/** Widget de la app Atajos con 4 botones (mediano) o 1 (pequeño). */
export function widgetAtajos(cuantos = 4) {
  const w = clonar("plantilla-atajos");
  w.classList.toggle("w-atajos-uno", cuantos === 1);
  w.append(
    ...BOTONES_ATAJOS.slice(0, cuantos).map((b) => {
      const boton = clonar("plantilla-boton-atajo");
      boton.querySelector(".w-boton-emoji").textContent = b.emoji;
      boton.querySelector(".w-boton-nombre").textContent = b.nombre;
      return boton;
    }),
  );
  return w;
}

// Como iOS: el widget en línea va junto a la fecha corta ("Dom 4 · Goat 72 · 🔥5").
const FECHA_CORTA = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "short", day: "numeric" });

/** Pantalla bloqueada: en línea (junto a la fecha), circular y rectangular. Nunca dinero. */
function bloqueo(d, animar) {
  const $ = (id) => document.getElementById(id);
  $("b-fecha").textContent = capital(FECHA_CORTA.format(new Date(`${d.fecha}T12:00:00-05:00`)).replace(/[.,]/g, ""));
  $("b-linea").textContent = d.bloqueo.linea;
  $("b-hora").textContent = d.hora;
  $("b-puntaje").textContent = String(d.score);
  $("b-titulo").textContent = d.bloqueo.titulo;
  $("b-detalle").textContent = d.bloqueo.detalle;
  $("b-extra").textContent = d.bloqueo.extra ?? "";
  $("b-extra").hidden = !d.bloqueo.extra;
  $("b-rectangular").href = d.abrir || "index.html";
  const medidor = $("b-medidor");
  const p = limitar(d.score / 100);
  medidor.classList.toggle("vacio", p === 0);
  // Medidor abierto abajo: 75 de 100 (270°).
  const llenar = () => (medidor.style.strokeDashoffset = String(75 - 75 * p));
  if (animar) alVerse(medidor, () => requestAnimationFrame(llenar));
  else llenar();
}

/** Pinta toda la vitrina. `verDinero`: mostrar el disponible del día en mediano y grande. */
export function pintarVitrina(d, { animar = true, verDinero = false } = {}) {
  document.getElementById("w-pequeno").replaceChildren(pequeno(d, animar));
  document.getElementById("w-mediano").replaceChildren(mediano(d, animar, verDinero));
  document.getElementById("w-grande").replaceChildren(grande(d, animar, verDinero));
  bloqueo(d, animar);
}
