// Movimiento (ejercicio.html): entreno en curso con cronómetro, la semana contra la meta, pasos de Salud,
// historial agrupado y la guía de los atajos. Las reglas están en ./logica.js (las mismas que usa la API).
// Todo cambio se anota primero en este teléfono (./datos.js › cola) y se sube cuando hay internet.

import { iniciarPagina } from "../piezas/pagina.js";
import { cerrarSesion } from "../supabase/sesion.js";
import { BaseSinInstalar, SesionVencida } from "../supabase/datos.js";
import { alVerse, avisar, clonar, contar, limitar, nuevoId, reducirMovimiento } from "../piezas/ui.js";
import { chips } from "../piezas/chips.js";
import { diaLogico, diaYMes, horaBogota, nombreDia } from "../logica/dia.js";
import { formatoDuracion, formatoMiles } from "../logica/formato.js";
import { leerMetas } from "../logica/calculo.js";
import { RUTINAS, TIPOS_EJERCICIO } from "../logica/catalogos.js";
import {
  TIPOS_CON_DISTANCIA,
  agrupar,
  combinar,
  detalleSesion,
  duracion,
  emojiTipo,
  enCurso,
  etiquetaSemana,
  fechaCalendario,
  fechaDe,
  formatoCronometro,
  fraseSemana,
  lunesDe,
  mensajeGuardada,
  nombreTipo,
  nuevaEnCurso,
  rangoHoras,
  resumenSemana,
  sumarDias,
  terminar,
  textoTotales,
  tituloSesion,
} from "./logica.js";
import { cargar, encolar, leerCola, sincronizar } from "./datos.js";
import { crearFormulario } from "./formulario.js";
import { ATAJOS } from "./atajos.js";
import { marcarCubiertos } from "../rutina/datos.js";

const $ = (id) => document.getElementById(id);
const CLAVE_ULTIMO_TIPO = "goat:ejercicio:ultimo-tipo";
const LETRAS = ["L", "M", "M", "J", "V", "S", "D"];
const km1 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

const pagina = await iniciarPagina({ alReintentar: () => recargar(true) });
const userId = pagina.sesion.user.id;

const estado = {
  servidor: [], // Lo último que llegó de Supabase.
  metas: leerMetas(null),
  actividad: [],
  modo: "semana",
  semanas: 8,
  cargado: false,
  animado: false,
};
let ultimaCarga = 0;
let rafCrono = 0;
let confirmarDescarte = 0;

/** Sesiones de Supabase + cambios de este teléfono que aún no suben. */
const sesiones = () => combinar(estado.servidor, leerCola());

const formulario = crearFormulario({ alGuardar: guardar, alTerminar: terminarCon, alBorrar: borrar });

// ── Empezar: tipo y rutina ───────────────────────────────────────────────

const tipoInicio = chips($("chips-tipo"), (valor) => {
  $("campo-rutina").hidden = valor !== "fuerza";
  recordarTipo(valor);
});
const rutinaInicio = chips($("chips-rutina"));
tipoInicio.opciones(TIPOS_EJERCICIO.filter((t) => t.valor !== "otro").map((t) => ({ valor: t.valor, texto: `${t.emoji} ${t.texto}` })));
rutinaInicio.opciones(RUTINAS);
tipoInicio.poner(ultimoTipo());
$("campo-rutina").hidden = tipoInicio.valor !== "fuerza";

$("boton-empezar").addEventListener("click", empezar);
$("boton-terminar").addEventListener("click", pedirTerminar);
$("boton-descartar").addEventListener("click", descartar);
$("boton-registrar").addEventListener("click", () => formulario.nuevo());
$("flotante-registrar").addEventListener("click", () => formulario.nuevo());
$("sin-subir").addEventListener("click", () => subir(true));
$("ver-mas").addEventListener("click", () => {
  estado.semanas += 8;
  pintarHistorial();
});
document.querySelectorAll(".pestanas [data-modo]").forEach((boton) => boton.addEventListener("click", () => cambiarModo(boton.dataset.modo)));

pintarAtajos();
await recargar(true);

window.addEventListener("online", () => subir());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (Date.now() - ultimaCarga > 60_000) recargar();
  else pintar();
});

// ── Cargar y subir ───────────────────────────────────────────────────────

async function recargar(primera = false) {
  try {
    if (leerCola().length) await sincronizar();
    const datos = await cargar(userId, diaLogico(new Date()));
    estado.servidor = datos.sesiones;
    estado.metas = datos.metas;
    estado.actividad = datos.actividad;
    estado.cargado = true;
    ultimaCarga = Date.now();
    pagina.mostrar("contenido");
    pintar();
  } catch (error) {
    if (error instanceof SesionVencida || error instanceof BaseSinInstalar) return pagina.manejarError(error);
    // Sin conexión: si ya se veía la página o hay un entreno guardado en este teléfono, se sigue con eso.
    if (estado.cargado || leerCola().length) {
      pagina.mostrar("contenido");
      pintar();
      if (primera || navigator.onLine === false) avisar("📴 Sin conexión · se guarda al volver");
      return;
    }
    pagina.manejarError(error);
  }
}

/** Sube lo anotado en el teléfono. `manual`: el usuario tocó "sin subir". */
async function subir(manual = false) {
  try {
    const r = await sincronizar();
    if (r.descartadas) avisar("⚠️ Un cambio no se pudo guardar");
    else if (manual && r.quedan) avisar("📴 Sigue sin conexión");
    pintarNube();
    if (r.subidas) await recargar();
  } catch (error) {
    if (error instanceof SesionVencida) cerrarSesion();
  }
}

// ── Acciones ─────────────────────────────────────────────────────────────

async function empezar() {
  if (enCurso(sesiones(), new Date())) return pintar();
  const tipo = tipoInicio.valor;
  const r = nuevaEnCurso({ tipo, rutina: tipo === "fuerza" ? rutinaInicio.valor : null }, new Date());
  if (r.error) return avisar(r.error);
  encolar({ ...r.fila, id_cliente: nuevoId(), origen: "web" });
  avisar(`${emojiTipo(tipo)} A darle`);
  pintar();
  rutinaInicio.poner(null);
  await subir();
}

function pedirTerminar() {
  const activa = enCurso(sesiones(), new Date());
  if (!activa) return pintar();
  if (activa.olvidada) return formulario.editar(activa.sesion);
  if (TIPOS_CON_DISTANCIA.has(activa.sesion.tipo)) return formulario.terminar(activa.sesion);
  terminarCon(activa.sesion, {});
}

async function terminarCon(sesion, extra) {
  const r = terminar(sesion, new Date(), extra);
  if (r.error) return avisar(r.error);
  const fila = { ...sesion, ...r.cambios };
  encolar(fila);
  avisar(r.olvidada ? "⚠️ Pon la hora de fin" : mensajeGuardada(fila));
  pintar();
  if (r.olvidada) formulario.editar(fila);
  await subir();
  if (!r.olvidada) marcarCubiertos(fila);
}

async function descartar() {
  const activa = enCurso(sesiones(), new Date());
  if (!activa) return pintar();
  const boton = $("boton-descartar");
  if (Date.now() - confirmarDescarte > 3000) {
    confirmarDescarte = Date.now();
    boton.textContent = "¿Descartar? Toca otra vez";
    window.setTimeout(() => (boton.textContent = "Descartar"), 3000);
    return;
  }
  confirmarDescarte = 0;
  boton.textContent = "Descartar";
  encolar(activa.sesion, { borrar: true });
  avisar("🗑️ Descartado");
  pintar();
  await subir();
}

async function guardar(fila, original) {
  encolar(fila);
  avisar(original ? "✅ Guardado" : mensajeGuardada(fila));
  pintar();
  await subir();
  marcarCubiertos(fila); // Si cubre un bloque de la rutina (caminar, ejercicio), queda hecho.
}

async function borrar(original) {
  encolar(original, { borrar: true });
  avisar("🗑️ Borrado");
  pintar();
  await subir();
}

function cambiarModo(modo) {
  estado.modo = modo;
  document.querySelectorAll(".pestanas [data-modo]").forEach((boton) => {
    boton.setAttribute("aria-selected", String(boton.dataset.modo === modo));
    if (boton.dataset.modo === modo) $("historial-grupos").setAttribute("aria-labelledby", boton.id);
  });
  pintarHistorial();
}

// ── Pintar ───────────────────────────────────────────────────────────────

function pintar() {
  const ahora = new Date();
  const todas = sesiones();
  const hoy = diaLogico(ahora);
  const lunes = lunesDe(hoy);
  const animar = !estado.animado && !reducirMovimiento();
  pintarEntreno(todas, ahora, hoy);
  pintarSemana(resumenSemana(todas, estado.metas, lunes, estado.actividad), hoy, animar);
  pintarPasos(ahora, lunes, animar);
  pintarHistorial(todas, lunes);
  pintarNube();
  estado.animado = true;
}

function pintarNube() {
  const n = leerCola().length;
  const boton = $("sin-subir");
  boton.hidden = n === 0;
  boton.textContent = `☁️ ${n} sin subir`;
  boton.setAttribute("aria-label", `${n} ${n === 1 ? "cambio" : "cambios"} sin subir. Tocar para reintentar`);
}

// 1 · Entreno en curso

function pintarEntreno(todas, ahora, hoy) {
  const activa = enCurso(todas, ahora);
  $("empezar").hidden = Boolean(activa);
  $("corriendo").hidden = !activa;
  window.cancelAnimationFrame(rafCrono);

  if (!activa) {
    const deHoy = todas.filter((s) => fechaDe(s) === hoy && !s.en_curso);
    const minutos = deHoy.reduce((total, s) => total + (duracion(s) ?? 0), 0);
    $("hoy-llevas").hidden = deHoy.length === 0;
    $("hoy-llevas").textContent = `Hoy: ${deHoy.length} ${deHoy.length === 1 ? "sesión" : "sesiones"}${minutos ? ` · ${formatoDuracion(minutos)}` : ""}`;
    return;
  }

  const s = activa.sesion;
  $("corriendo").classList.toggle("olvidado", activa.olvidada);
  $("corriendo-tipo").textContent = activa.olvidada ? `Sin terminar · ${tituloSesion(s)}` : `En curso · ${tituloSesion(s)}`;
  $("corriendo-desde").textContent =
    `Desde las ${horaBogota(new Date(s.inicio))}${fechaDe(s) !== hoy ? ` del ${diaYMes(fechaDe(s))}` : ""}` +
    (s.pendiente ? " · guardado en este teléfono" : "");
  $("corriendo-olvido").hidden = !activa.olvidada;
  $("terminar-icono").textContent = activa.olvidada ? "✎" : "■";
  $("terminar-texto").textContent = activa.olvidada ? "Poner hora de fin" : "Terminar";
  correrCrono(Date.parse(s.inicio), activa.olvidada);
}

/** Cronómetro: escribe solo cuando cambia el segundo; requestAnimationFrame se pausa solo con la app en segundo plano. */
function correrCrono(inicio, detenido) {
  const crono = $("crono");
  const relleno = $("segundero-relleno");
  let ultimo = -1;
  const paso = () => {
    const ms = Date.now() - inicio;
    const segundo = Math.floor(ms / 1000);
    if (segundo !== ultimo) {
      if (ultimo === -1 || segundo % 60 === 0) crono.setAttribute("aria-label", `Llevas ${formatoDuracion(Math.floor(ms / 60000))}`);
      ultimo = segundo;
      crono.textContent = formatoCronometro(ms);
      crono.classList.toggle("largo", ms >= 3_600_000);
    }
    if (!detenido) rafCrono = window.requestAnimationFrame(paso);
  };
  // El segundero (CSS) da una vuelta por minuto; se sincroniza con el segundo real.
  relleno.style.setProperty("--retraso", `-${(((Date.now() - inicio) % 60_000) / 1000).toFixed(2)}s`);
  relleno.classList.toggle("quieto", detenido);
  paso();
}

// 2 · Semana

function pintarSemana(r, hoy, animar) {
  $("semana-rango").textContent = `${diaYMes(r.lunes)} – ${diaYMes(r.domingo)}`;
  $("meta-hechos").textContent = String(r.entrenos);
  $("meta-total").textContent = String(r.meta);
  $("meta-frase").textContent = fraseSemana(r);
  $("anillo-meta").setAttribute("aria-label", `${r.entrenos} de ${r.meta} entrenos esta semana`);

  const largo = 2 * Math.PI * 50;
  const anillos = [
    [$("anillo-meta-progreso"), limitar(r.cumplimiento, 0, 1)],
    [$("anillo-meta-extra"), limitar(r.cumplimiento - 1, 0, 1)],
  ];
  for (const [circulo, avance] of anillos) {
    circulo.style.strokeDasharray = `${largo}`;
    circulo.classList.toggle("sin-avance", avance === 0);
    const final = `${largo * (1 - avance)}`;
    if (animar) {
      circulo.style.strokeDashoffset = `${largo}`;
      alVerse($("anillo-meta"), () => requestAnimationFrame(() => (circulo.style.strokeDashoffset = final)));
    } else circulo.style.strokeDashoffset = final;
  }

  $("semana-minutos").textContent = r.minutos ? formatoDuracion(r.minutos) : "0";
  $("semana-km").textContent = km1.format(r.km);
  $("semana-pasos").textContent = r.pasosPromedio == null ? "—" : formatoMiles(r.pasosPromedio);

  const maximo = Math.max(60, ...r.dias.map((d) => d.minutos));
  pintarBarras(
    $("semana-dias"),
    r.dias.map((d) => ({ fecha: d.fecha, valor: d.minutos, texto: d.minutos ? String(d.minutos) : "" })),
    maximo,
    hoy,
    animar,
  );
  $("semana-dias").setAttribute(
    "aria-label",
    `Minutos por día: ${r.dias.map((d) => `${nombreDia(d.fecha)} ${d.minutos}`).join(", ")}`,
  );

  $("semana-tipos").replaceChildren(
    ...r.porTipo.map((t) => {
      const item = clonar("plantilla-tipo");
      item.querySelector(".tipo-emoji").textContent = t.emoji;
      item.querySelector(".tipo-nombre").textContent = t.texto;
      item.querySelector(".tipo-valor").textContent = textoTotales(t);
      return item;
    }),
  );
}

/** Barras verticales L–D. `dias`: [{ fecha, valor, texto }]. Hoy en naranja. */
function pintarBarras(contenedor, dias, maximo, hoy, animar) {
  contenedor.replaceChildren(
    ...dias.map((d, i) => {
      const col = clonar("plantilla-barra");
      col.classList.toggle("hoy", d.fecha === hoy);
      col.classList.toggle("futuro", d.fecha > hoy);
      col.querySelector(".dia-valor").textContent = d.texto;
      col.querySelector(".dia-letra").textContent = LETRAS[i];
      const barra = col.querySelector(".dia-barra");
      barra.style.setProperty("--alto", `${d.valor > 0 ? Math.max(4, (d.valor / maximo) * 100) : 0}%`);
      barra.style.setProperty("--i", i);
      return col;
    }),
  );
  if (animar) alVerse(contenedor, () => contenedor.classList.add("visto"));
  else contenedor.classList.add("visto");
}

// 3 · Pasos

function pintarPasos(ahora, lunes, animar) {
  const hoyCal = fechaCalendario(ahora);
  const conDatos = estado.actividad.length > 0;
  $("pasos-con-datos").hidden = !conDatos;
  $("pasos-vacio").hidden = conDatos;
  if (!conDatos) return;

  const fila = estado.actividad.find((a) => a.fecha === hoyCal);
  const pasos = Number(fila?.pasos ?? 0);
  const numero = $("pasos-hoy");
  if (animar) {
    numero.textContent = "0";
    alVerse(numero, () => contar(numero, pasos, formatoMiles));
  } else numero.textContent = formatoMiles(pasos);

  const semana = estado.actividad.filter((a) => a.fecha >= lunes && a.fecha <= sumarDias(lunes, 6) && a.pasos != null);
  const promedio = semana.length ? Math.round(semana.reduce((t, a) => t + Number(a.pasos), 0) / semana.length) : null;
  const partes = [];
  if (Number(fila?.distancia_km) > 0) partes.push(`${km1.format(Number(fila.distancia_km))} km hoy`);
  if (promedio != null) partes.push(`promedio de ${formatoMiles(promedio)} esta semana`);
  $("pasos-detalle").textContent = fila
    ? partes.join(" · ") || "Llegan de Salud con el atajo de las 21:30."
    : `Hoy todavía no llegan. ${promedio != null ? `Promedio de ${formatoMiles(promedio)} esta semana.` : ""}`.trim();

  const dias = Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDias(lunes, i);
    const valor = Number(estado.actividad.find((a) => a.fecha === fecha)?.pasos ?? 0);
    return { fecha, valor, texto: valor ? `${km1.format(Math.round(valor / 100) / 10)}k` : "" };
  });
  pintarBarras($("pasos-dias"), dias, Math.max(8000, ...dias.map((d) => d.valor)), hoyCal, animar);
  $("pasos-dias").setAttribute("aria-label", `Pasos por día: ${dias.map((d) => `${nombreDia(d.fecha)} ${d.valor}`).join(", ")}`);
}

// 4 · Historial

function pintarHistorial(todas = sesiones(), lunesActual = lunesDe(diaLogico(new Date()))) {
  const ahora = new Date();
  const activa = enCurso(todas, ahora)?.sesion;
  let grupos = agrupar(todas.filter((s) => s !== activa), estado.modo);
  const hayMas = estado.modo === "semana" && grupos.length > estado.semanas;
  if (estado.modo === "semana") grupos = grupos.slice(0, estado.semanas);
  $("ver-mas").hidden = !hayMas;
  $("historial-vacio").hidden = grupos.length > 0;
  $("historial-grupos").replaceChildren(...grupos.map((g) => crearGrupo(g, lunesActual)));
}

function crearGrupo(grupo, lunesActual) {
  const el = clonar("plantilla-grupo");
  el.querySelector(".grupo-titulo").textContent =
    estado.modo === "tipo" ? `${emojiTipo(grupo.clave)} ${nombreTipo(grupo.clave)}` : etiquetaSemana(grupo.clave, lunesActual);
  el.querySelector(".grupo-total").textContent = textoTotales(grupo);
  const visibles = estado.modo === "tipo" ? grupo.sesiones.slice(0, 40) : grupo.sesiones;
  el.querySelector(".lista-agrupada").append(...visibles.map(crearFila));
  return el;
}

function crearFila(s) {
  const fila = clonar("plantilla-sesion");
  const fecha = fechaDe(s);
  const minutos = duracion(s);
  const sinFin = !s.fin && s.inicio;
  const cuando = `${nombreDia(fecha).slice(0, 3)} ${diaYMes(fecha)} · ${rangoHoras(s)}${sinFin ? " · sin hora de fin" : ""}`;
  const extra = [detalleSesion(s), s.pendiente ? "☁️ sin subir" : ""].filter(Boolean).join(" · ");
  fila.querySelector(".fila-icono").textContent = emojiTipo(s.tipo);
  fila.querySelector(".fila-titulo").textContent = tituloSesion(s);
  fila.querySelector(".sesion-cuando").textContent = cuando;
  fila.querySelector(".sesion-duracion").textContent = minutos ? formatoDuracion(minutos) : "—";
  fila.querySelector(".sesion-extra").textContent = extra;
  fila.classList.toggle("sin-fin", Boolean(sinFin));
  fila.setAttribute("aria-label", `${tituloSesion(s)}, ${cuando}${minutos ? `, ${formatoDuracion(minutos)}` : ""}${extra ? `, ${extra}` : ""}. Editar`);
  fila.addEventListener("click", () => formulario.editar(s));
  return fila;
}

// 5 · Atajos del iPhone

function pintarAtajos() {
  const lista = (ol, pasos) =>
    ol.replaceChildren(
      ...pasos.map((texto) => {
        const li = document.createElement("li");
        li.textContent = texto;
        return li;
      }),
    );
  $("atajos-lista").replaceChildren(
    ...ATAJOS.map((atajo) => {
      const el = clonar("plantilla-atajo");
      el.querySelector(".atajo-emoji").textContent = atajo.emoji;
      el.querySelector(".atajo-nombre").textContent = atajo.nombre;
      el.querySelector(".atajo-para").textContent = atajo.para;
      lista(el.querySelector(".atajo-pasos"), atajo.pasos);
      if (atajo.automatizacion) {
        el.querySelector(".atajo-auto").hidden = false;
        el.querySelector(".atajo-auto .atajo-subtitulo").textContent = `Automatización · ${atajo.automatizacion.disparador}`;
        lista(el.querySelector(".atajo-auto-pasos"), atajo.automatizacion.pasos);
      }
      lista(el.querySelector(".atajo-permisos"), atajo.permisos.length ? atajo.permisos : ["Ninguno"]);
      return el;
    }),
  );
}

// ── Preferencias de este teléfono ────────────────────────────────────────

function ultimoTipo() {
  try {
    const guardado = localStorage.getItem(CLAVE_ULTIMO_TIPO);
    return TIPOS_EJERCICIO.some((t) => t.valor === guardado) ? guardado : "fuerza";
  } catch {
    return "fuerza";
  }
}

function recordarTipo(tipo) {
  try {
    if (tipo) localStorage.setItem(CLAVE_ULTIMO_TIPO, tipo);
  } catch {
    // Sin almacenamiento: no pasa nada.
  }
}
