// Tu tiempo (desbloqueo.html): minutos de recompensa por app según los registros y el puntaje de hoy (D-054).
// Lee tus datos con supabase-js (RLS), calcula con logica.js (la misma regla que usa la API) y pinta plantillas.

import { iniciarPagina } from "../piezas/pagina.js";
import { alVerse, avisar, clonar, contar, limitar } from "../piezas/ui.js";
import { chips } from "../piezas/chips.js";
import { crearHoja } from "../piezas/hoja.js";
import { construirResumen } from "../logica/calculo.js";
import { diaLogico, horaBogota } from "../logica/dia.js";
import { formatoDuracion } from "../logica/formato.js";
import { BaseSinInstalar, SesionVencida } from "../supabase/datos.js";
import { cargarDesbloqueo, guardarDesbloqueo, usarPase } from "./datos.js";
import {
  APPS_FIJAS,
  APP_VALIDA,
  MAX_JUEGOS,
  MAX_MINUTOS_NIVEL,
  MAX_NOMBRE_JUEGO,
  PASE,
  ajustesDesbloqueo,
  buscarApp,
  comoRegistrar,
  estadoDesbloqueo,
  nombreNivel,
  pista,
  slugApp,
} from "./logica.js";
import { ATAJOS, GUIA } from "./atajos.js";

const $ = (id) => document.getElementById(id);
const HORA_MS = 3_600_000;
const ICONO_NIVEL = ["📝", "⭐", "🏆", "💎", "🚀", "👑"];
const OPCIONES_MINUTOS = [0, 15, 30, 45, 60, 75, 90, 120, 150, 180, 240].filter((m) => m <= MAX_MINUTOS_NIVEL);

const pagina = await iniciarPagina({ alReintentar: () => cargar() });
const userId = pagina.sesion.user.id;

let datos = null; // Lo último que llegó de Supabase.
let estado = null; // Lo último que se pintó.
let pintado = "";
let primeraVez = true;
let ultimaCarga = 0;
let ocupado = false;

// ── Hoja inferior (pase y niveles) ───────────────────────────────────────

const hoja = crearHoja({ hoja: $("hoja"), velo: $("velo"), manija: $("hoja-manija"), fondo: [$("contenido")] });
const formPase = $("form-pase");
const formNiveles = $("form-niveles");
const elegirApp = chips(formPase.querySelector('[data-chips="app"]'), () => revisarPase());
let editores = []; // [{ puntaje, selector }] de la hoja de niveles.

pintarGuia();
conectarEventos();
await cargar();

// El uso de una app abierta y lo que falta cambian con la hora, aunque no llegue nada nuevo.
window.setInterval(() => datos && pintar(), 30_000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Date.now() - ultimaCarga > 60_000) cargar();
});

// ── Carga ────────────────────────────────────────────────────────────────

async function cargar() {
  try {
    datos = await cargarDesbloqueo(userId, new Date());
    ultimaCarga = Date.now();
    pagina.mostrar("contenido");
    pintar();
  } catch (error) {
    pagina.manejarError(error);
  }
}

/** perfil.ajustes.desbloqueo tal como está guardado ({} si no hay). */
function crudoDesbloqueo() {
  const crudo = datos?.ajustes?.desbloqueo;
  return crudo && typeof crudo === "object" ? crudo : {};
}

function pintar() {
  const ahora = new Date();
  const resumen = construirResumen(datos.registros, ahora);
  const nuevo = estadoDesbloqueo({ resumen, eventos: datos.eventos, pases: datos.pases, ajustes: crudoDesbloqueo(), ahora });
  const firma = JSON.stringify(nuevo);
  if (firma === pintado) return;
  pintado = firma;
  estado = nuevo;
  const animar = primeraVez;
  primeraVez = false;

  pintarEstado(nuevo, animar);
  pintarNiveles(nuevo, animar);
  pintarApps(nuevo, animar);
  pintarPase(nuevo);
  pintarJuegos();
  pintarUso(nuevo, ahora);
  pintarTextos(nuevo);
}

// ── 1. La puerta ─────────────────────────────────────────────────────────

function pintarEstado(e, animar) {
  $("estado-palabra").textContent = e.abierto ? "Abierto." : "Cerrado.";
  $("estado-titulo").classList.toggle("cerrado", !e.abierto);
  $("barra-estado").textContent = e.abierto ? `🔓 ${e.nivel.minutos} min` : "🔒 Cerrado";

  if (e.abierto) {
    $("estado-frase").textContent =
      e.nivel.minutos > 0
        ? `Registros al día. Cada app tiene ${e.nivel.minutos} min hoy.`
        : "Registros al día, pero este nivel no da minutos.";
  } else {
    const minutos = e.siguienteNivel?.minutos ?? 0;
    $("estado-frase").textContent = `Registra lo que falta y se abre con ${minutos} min por app. Algo "malo" también cuenta.`;
  }

  const lista = $("faltan-lista");
  lista.replaceChildren(
    ...e.faltan.map((pendiente, i) => {
      const fila = clonar("plantilla-falta");
      fila.style.setProperty("--i", i);
      const enlace = fila.querySelector("a");
      enlace.href = comoRegistrar(pendiente).web;
      enlace.setAttribute("aria-label", `Registrar ${pendiente.texto}`);
      fila.querySelector(".falta-emoji").textContent = pendiente.emoji ?? "📝";
      fila.querySelector(".falta-texto").textContent = pendiente.texto;
      if (!animar) fila.classList.add("visto");
      return fila;
    }),
  );
  if (animar) for (const fila of lista.children) alVerse(fila, () => fila.classList.add("visto"));
}

// ── 2. Niveles ───────────────────────────────────────────────────────────

function pintarNiveles(e, animar) {
  const numero = $("puntaje");
  if (animar) {
    numero.textContent = "0";
    contar(numero, e.score, String);
  } else numero.textContent = String(e.score);
  const relleno = $("puntaje-relleno");
  const avance = limitar(e.score / 100, 0, 1);
  if (animar) alVerse(relleno, () => requestAnimationFrame(() => (relleno.style.transform = `scaleX(${avance})`)));
  else relleno.style.transform = `scaleX(${avance})`;
  $("pista").textContent = pista(e);

  const filas = [
    { icono: "🔒", nombre: "Registros atrasados", detalle: "Falta algo que la hora ya pide", minutos: 0, actual: e.nivel.indice < 0 },
    ...e.niveles.map((n, i) => ({
      icono: ICONO_NIVEL[i] ?? "⭐",
      nombre: n.nombre,
      detalle: n.puntaje === 0 ? "Todo registrado a tiempo" : n.puntaje >= 100 ? "Día perfecto" : `Al día con ${n.puntaje} o más`,
      minutos: n.minutos,
      actual: e.nivel.indice === i,
    })),
  ];
  $("niveles-lista").replaceChildren(
    ...filas.map((f) => {
      const fila = clonar("plantilla-nivel");
      fila.querySelector(".nivel-icono").textContent = f.icono;
      fila.querySelector(".nivel-nombre").textContent = f.nombre;
      fila.querySelector(".nivel-ahora").hidden = !f.actual;
      fila.querySelector(".nivel-detalle").textContent = f.detalle;
      fila.querySelector(".nivel-minutos").textContent = `${f.minutos} min`;
      fila.classList.toggle("actual", f.actual);
      if (f.actual) fila.setAttribute("aria-current", "true");
      return fila;
    }),
  );
}

// ── 3. Apps ──────────────────────────────────────────────────────────────

function pintarApps(e, animar) {
  $("apps-nota").textContent = "Cada una, su bolsa";
  const lista = $("apps-lista");
  const entradas = [];
  lista.replaceChildren(
    ...e.apps.map((app, i) => {
      const tarjeta = clonar("plantilla-app");
      tarjeta.style.setProperty("--i", i);
      tarjeta.querySelector(".app-emoji").textContent = app.emoji;
      tarjeta.querySelector(".app-nombre").textContent = app.nombre;
      tarjeta.classList.toggle("con-pase", app.pase > 0);
      tarjeta.classList.toggle("agotada", app.restantes === 0);
      tarjeta.querySelector(".app-abierta").hidden = !e.sesiones.some((s) => s.app === app.app && s.enCurso);

      const numero = tarjeta.querySelector(".app-numero");
      const circulo = tarjeta.querySelector(".app-relleno");
      const largo = 2 * Math.PI * Number(circulo.getAttribute("r"));
      const avance = app.total > 0 ? limitar(app.restantes / app.total, 0, 1) : 0;
      const final = `${largo * (1 - avance)}`;
      circulo.style.strokeDasharray = `${largo}`;
      circulo.classList.toggle("vacio", avance === 0);

      tarjeta.querySelector(".app-detalle").textContent = detalleApp(app, e);
      tarjeta.querySelector(".app-centro").setAttribute("aria-label", `${app.restantes} minutos restantes`);

      const boton = tarjeta.querySelector(".app-pase");
      boton.hidden = !(app.restantes === 0 && e.paseDisponible);
      boton.setAttribute("aria-label", `Usar el pase de emergencia en ${app.nombre}`);
      boton.addEventListener("click", () => abrirPase(app.app));

      if (animar) {
        numero.textContent = "0";
        circulo.style.strokeDashoffset = `${largo}`;
        entradas.push([
          tarjeta,
          () => {
            tarjeta.classList.add("visto");
            contar(numero, app.restantes, String);
            requestAnimationFrame(() => (circulo.style.strokeDashoffset = final));
          },
        ]);
      } else {
        tarjeta.classList.add("visto");
        numero.textContent = String(app.restantes);
        circulo.style.strokeDashoffset = final;
      }
      return tarjeta;
    }),
  );
  entradas.forEach(([tarjeta, accion]) => alVerse(tarjeta, accion));
}

function detalleApp(app, e) {
  if (app.total === 0) return e.abierto ? "Este nivel no da minutos" : "Registra para abrir";
  const pase = app.pase > 0 ? " · con pase" : "";
  if (app.usados > app.total) return `Usaste ${app.usados} de ${app.total} min${pase}`;
  return `${app.usados} de ${app.total} min usados${pase}`;
}

// ── 4. Pase ──────────────────────────────────────────────────────────────

function pintarPase(e) {
  const boton = $("usar-pase");
  if (e.paseDisponible) {
    $("pase-titulo").textContent = "1 pase.";
    $("pase-frase").textContent = `${PASE.minutos} min extra para la app que elijas, aunque falte algo por registrar. Uno al día; se renueva a las 04:00.`;
    boton.hidden = false;
  } else {
    const usado = e.paseUsado;
    const nombre = usado ? buscarApp(usado.app, crudoDesbloqueo()).nombre : "una app";
    const hora = usado ? ` a las ${horaBogota(new Date(usado.momento))}` : "";
    $("pase-titulo").textContent = "Usado.";
    $("pase-frase").textContent = `Lo usaste en ${nombre}${hora}. Mañana tienes otro.`;
    boton.hidden = true;
  }
}

function abrirPase(app = null) {
  if (!estado) return;
  if (!estado.paseDisponible) return avisar("🔒 Ya usaste el pase de hoy");
  $("hoja-titulo").textContent = "Pase.";
  formNiveles.hidden = true;
  formPase.hidden = false;
  elegirApp.opciones(estado.apps.map((a) => ({ valor: a.app, texto: `${a.emoji} ${a.nombre}` })));
  elegirApp.poner(app);
  revisarPase();
  hoja.abrir();
}

function revisarPase() {
  formPase.querySelector("[data-guardar]").disabled = ocupado || !elegirApp.valor;
}

async function enviarPase(evento) {
  evento.preventDefault();
  const app = elegirApp.valor;
  if (!app || ocupado) return;
  await trabajar(formPase, async () => {
    const resultado = await usarPase(app);
    hoja.cerrar();
    avisar(resultado === "ok" ? `🆘 ${PASE.minutos} min en ${buscarApp(app, crudoDesbloqueo()).nombre}` : "🔒 Ya usaste el pase de hoy");
    await cargar();
  });
}

// ── Niveles editables ────────────────────────────────────────────────────

function abrirNiveles() {
  const { niveles } = ajustesDesbloqueo(crudoDesbloqueo());
  $("hoja-titulo").textContent = "Niveles.";
  formPase.hidden = true;
  formNiveles.hidden = false;
  editores = niveles.map((n) => {
    const bloque = clonar("plantilla-nivel-editar");
    const nombre = nombreNivel(n);
    bloque.querySelector(".etiqueta").textContent = nombre;
    const contenedor = bloque.querySelector(".chips");
    contenedor.setAttribute("aria-label", `Minutos con ${nombre}`);
    const selector = chips(contenedor);
    const opciones = [...new Set([...OPCIONES_MINUTOS, n.minutos])].sort((a, b) => a - b);
    selector.opciones(opciones.map((m) => ({ valor: String(m), texto: `${m} min` })));
    selector.poner(String(n.minutos));
    return { puntaje: n.puntaje, selector, bloque };
  });
  $("niveles-editar").replaceChildren(...editores.map((ed) => ed.bloque));
  hoja.abrir();
}

async function enviarNiveles(evento) {
  evento.preventDefault();
  if (ocupado) return;
  const elegidos = editores.map((ed) => ({ puntaje: ed.puntaje, minutos: Number(ed.selector.valor) }));
  const { niveles } = ajustesDesbloqueo({ niveles: elegidos });
  await guardarCambio(formNiveles, { niveles }, "✅ Niveles guardados");
}

async function restablecerNiveles() {
  if (ocupado) return;
  await guardarCambio(formNiveles, { niveles: undefined }, "↩️ 30 · 60 · 90");
}

async function guardarCambio(form, cambios, mensaje) {
  await trabajar(form, async () => {
    const nuevo = { ...crudoDesbloqueo(), ...cambios };
    await guardarDesbloqueo(crudoDesbloqueo(), cambios);
    datos.ajustes = { ...datos.ajustes, desbloqueo: JSON.parse(JSON.stringify(nuevo)) };
    hoja.cerrar();
    avisar(mensaje);
    pintar();
  });
}

// ── 5. Juegos ────────────────────────────────────────────────────────────

function pintarJuegos() {
  const { juegos } = ajustesDesbloqueo(crudoDesbloqueo());
  $("juegos-vacio").hidden = juegos.length > 0;
  $("juegos-lista").hidden = juegos.length === 0;
  $("juegos-lista").replaceChildren(
    ...juegos.map((juego) => {
      const fila = clonar("plantilla-juego");
      fila.querySelector(".juego-nombre").textContent = juego.nombre;
      fila.querySelector(".juego-texto").textContent = `Texto del atajo: ${juego.id}`;
      const quitar = fila.querySelector(".juego-quitar");
      quitar.setAttribute("aria-label", `Quitar ${juego.nombre}`);
      quitar.addEventListener("click", () => quitarJuego(juego.id));
      return fila;
    }),
  );
  const lleno = juegos.length >= MAX_JUEGOS;
  const form = $("form-juego");
  form.querySelector("input").disabled = lleno;
  form.querySelector("button").disabled = lleno;
  form.querySelector("input").placeholder = lleno ? `Máximo ${MAX_JUEGOS} juegos` : "Ej. Clash Royale";
}

async function agregarJuego(evento) {
  evento.preventDefault();
  if (ocupado) return;
  const entrada = $("juego-nombre");
  const nombre = entrada.value.trim().replace(/\s+/g, " ").slice(0, MAX_NOMBRE_JUEGO);
  const id = slugApp(nombre);
  const { juegos } = ajustesDesbloqueo(crudoDesbloqueo());
  if (!nombre || !APP_VALIDA.test(id)) return avisar("⚠️ Escribe un nombre");
  if (APPS_FIJAS.some((a) => a.id === id) || juegos.some((j) => j.id === id)) return avisar("👌 Ya está en la lista");
  if (juegos.length >= MAX_JUEGOS) return avisar(`⚠️ Máximo ${MAX_JUEGOS}`);
  const lista = [...juegos.map(({ id: i, nombre: n }) => ({ id: i, nombre: n })), { id, nombre }];
  await guardarCambio($("form-juego"), { juegos: lista }, "🎮 Agregado");
  entrada.value = "";
}

async function quitarJuego(id) {
  if (ocupado) return;
  const { juegos } = ajustesDesbloqueo(crudoDesbloqueo());
  const lista = juegos.filter((j) => j.id !== id).map(({ id: i, nombre: n }) => ({ id: i, nombre: n }));
  await guardarCambio($("form-juego"), { juegos: lista }, "🗑️ Quitado");
}

// ── 6. Uso de hoy ────────────────────────────────────────────────────────

function pintarUso(e, ahora) {
  $("uso-total").textContent = e.usadosTotal > 0 ? `${formatoDuracion(e.usadosTotal)} en total` : "";

  const inicioDia = Date.parse(`${diaLogico(ahora)}T04:00:00-05:00`);
  const horaActual = Math.floor((ahora.getTime() - inicioDia) / HORA_MS);
  const horas = $("uso-horas");
  horas.replaceChildren(
    ...e.usoPorHora.map((minutos, i) => {
      const columna = clonar("plantilla-hora");
      columna.style.setProperty("--alto", String(limitar(minutos / 60, 0, 1)));
      columna.classList.toggle("con-uso", minutos > 0);
      columna.classList.toggle("ahora", i === horaActual);
      columna.classList.toggle("futura", i > horaActual);
      return columna;
    }),
  );
  const maximo = Math.max(...e.usoPorHora);
  if (maximo > 0) {
    const i = e.usoPorHora.indexOf(maximo);
    const hora = String((4 + i) % 24).padStart(2, "0");
    horas.setAttribute("aria-label", `Uso por hora. La hora con más uso fue las ${hora}:00, con ${Math.round(maximo)} min.`);
  } else {
    horas.setAttribute("aria-label", "Uso por hora: sin uso hoy.");
  }

  const sesiones = [...e.sesiones].reverse();
  $("uso-vacio").hidden = sesiones.length > 0;
  $("uso-lista").hidden = sesiones.length === 0;
  $("uso-lista").replaceChildren(
    ...sesiones.map((s) => {
      const app = buscarApp(s.app, crudoDesbloqueo());
      const fila = clonar("plantilla-sesion");
      fila.querySelector(".sesion-emoji").textContent = app.emoji;
      fila.querySelector(".sesion-app").textContent = app.nombre;
      fila.querySelector(".sesion-horas").textContent = s.permitido === false ? `🔒 Sin minutos · ${horasSesion(s)}` : horasSesion(s);
      const minutos = Math.round(s.minutos);
      fila.querySelector(".sesion-minutos").textContent = s.minutos > 0 && minutos === 0 ? "<1 min" : `${minutos} min`;
      fila.classList.toggle("bloqueada", s.permitido === false);
      fila.classList.toggle("en-curso", s.enCurso);
      return fila;
    }),
  );
}

function horasSesion(s) {
  const inicio = horaBogota(s.inicio);
  if (s.cerrada) return `${inicio} – ${horaBogota(s.fin)}`;
  if (s.enCurso) return `Desde ${inicio} · abierta`;
  return `${inicio} · sin cierre (cuenta máx. 30 min)`;
}

// ── 7. Guía del iPhone ───────────────────────────────────────────────────

function pintarTextos(e) {
  $("guia-textos").replaceChildren(
    ...e.apps.map((app) => {
      const fila = clonar("plantilla-texto-app");
      fila.querySelector(".guia-texto-nombre").textContent = `${app.emoji} ${app.nombre}`;
      fila.querySelector(".guia-texto-valor").textContent = app.app;
      return fila;
    }),
  );
}

function pintarGuia() {
  $("guia-friccion").replaceChildren(
    ...GUIA.friccion.map((texto) => {
      const p = clonar("plantilla-parrafo");
      p.textContent = texto;
      return p;
    }),
  );

  const bloques = [
    ...ATAJOS.map((a) => ({
      emoji: a.emoji,
      nombre: a.nombre,
      para: a.para,
      pasos: a.pasos,
      automatizacion: a.automatizacion,
      permisos: a.permisos,
    })),
    { emoji: "🔐", nombre: GUIA.candado.titulo, para: "Un límite que no puedes saltarte, con código de Tiempo en pantalla.", pasos: GUIA.candado.pasos },
    { emoji: "🧭", nombre: GUIA.safari.titulo, para: "Para que la web de TikTok o Instagram no sea la salida fácil.", pasos: GUIA.safari.pasos },
  ];

  $("guia-atajos").replaceChildren(
    ...bloques.map((b) => {
      const detalle = clonar("plantilla-atajo");
      detalle.querySelector(".guia-emoji").textContent = b.emoji;
      detalle.querySelector(".guia-nombre").textContent = b.nombre;
      detalle.querySelector(".guia-para").textContent = b.para;
      llenarPasos(detalle.querySelector(".guia-pasos"), b.pasos);
      const auto = detalle.querySelector(".guia-automatizacion");
      auto.hidden = !b.automatizacion;
      if (b.automatizacion) {
        detalle.querySelector(".guia-disparador").textContent = b.automatizacion.disparador;
        llenarPasos(detalle.querySelector(".guia-pasos-auto"), b.automatizacion.pasos);
      }
      const permisos = detalle.querySelector(".guia-permisos");
      permisos.hidden = !b.permisos?.length;
      if (b.permisos?.length) permisos.textContent = `iOS te pedirá: ${b.permisos.join(" · ")}.`;
      return detalle;
    }),
  );
}

function llenarPasos(lista, pasos) {
  lista.replaceChildren(
    ...pasos.map((texto) => {
      const li = clonar("plantilla-paso");
      li.textContent = texto;
      return li;
    }),
  );
}

// ── Eventos y guardado ───────────────────────────────────────────────────

function conectarEventos() {
  $("usar-pase").addEventListener("click", () => abrirPase());
  $("editar-niveles").addEventListener("click", abrirNiveles);
  $("restablecer-niveles").addEventListener("click", restablecerNiveles);
  formPase.addEventListener("submit", enviarPase);
  formNiveles.addEventListener("submit", enviarNiveles);
  $("form-juego").addEventListener("submit", agregarJuego);
}

/** Corre `tarea` con los botones de `form` desactivados; un error se avisa sin perder la página. */
async function trabajar(form, tarea) {
  ocupado = true;
  const botones = [...form.querySelectorAll("button")];
  botones.forEach((b) => (b.disabled = true));
  form.setAttribute("aria-busy", "true");
  try {
    await tarea();
  } catch (error) {
    if (error instanceof SesionVencida || error instanceof BaseSinInstalar) return pagina.manejarError(error);
    console.error(error);
    avisar(navigator.onLine ? "⚠️ No se guardó. Intenta otra vez." : "⚠️ Sin conexión. Intenta otra vez.");
  } finally {
    ocupado = false;
    form.removeAttribute("aria-busy");
    botones.forEach((b) => (b.disabled = false));
    revisarPase();
    if (datos) pintarJuegos();
  }
}
