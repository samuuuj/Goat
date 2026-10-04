// Conectar iPhone (conectar.html): asistente de primer uso estilo "Configura tu iPhone" y Ajustes (⚙️ en Hoy).
// Una web no puede pedir permisos del iPhone: el asistente crea tu llave, guía cada atajo, explica lo que iOS
// pedirá y comprueba que llegue (api_tokens.ultimo_uso y log_api, leídos con RLS).
// El token solo vive en memoria de esta página: no va a localStorage ni a la base (allá solo está su hash).
//
// Rutas: #paso-<id> (asistente en ese paso) · #asistente (desde el principio) · #ajustes ·
//        sin nada: el asistente si no lo has terminado, Ajustes si ya.

import { iniciarPagina } from "../piezas/pagina.js";
import { alVerse, avisar, clonar } from "../piezas/ui.js";
import { chips } from "../piezas/chips.js";
import { crearHoja } from "../piezas/hoja.js";
import { BaseSinInstalar, SesionVencida } from "../supabase/datos.js";
import { leerMetas } from "../logica/calculo.js";
import { APPS_FIJAS, APP_VALIDA, MAX_JUEGOS, MAX_NOMBRE_JUEGO, ajustesDesbloqueo, slugApp } from "../desbloqueo/logica.js";
import { guardarDesbloqueo } from "../desbloqueo/datos.js";
import { marcarDispositivo } from "./bienvenida.js";
import { ATAJOS as ATAJOS_BASE } from "./atajos.js";
import { PASOS, PERMISOS, indicePaso } from "./pasos.js";
import {
  cargarConectar,
  completarBienvenida,
  crearLlave,
  guardarAtajosHechos,
  guardarMeta,
  leerLlaves,
  logsDesde,
  probarRuta,
  revocarLlave,
  ultimoLog,
} from "./datos.js";
import {
  cargarAtajos,
  conexionProbada,
  contarHechos,
  detalleLlave,
  estadoLlave,
  marcarAtajo,
  plataforma,
  pruebaRecibida,
  resumenListo,
  tiempoRelativo,
  todosLosAtajos,
  urlBase,
} from "./logica.js";

const $ = (id) => document.getElementById(id);
const ESPERA_MS = 3000; // Cada cuánto se mira si llegó algo del iPhone.
const ESPERA_MAX_MS = 5 * 60_000;
const NOMBRES_LLAVE = ["iPhone", "Widget", "iPad", "Otro"];
const ICONO_LLAVE = { iPhone: "📱", Widget: "🧩", iPad: "📲", Otro: "🔑" };
const OPCIONES_GYM = [1, 2, 3, 4, 5, 6, 7];

let espera = null; // La prueba que está esperando al iPhone (ver esperar()).

const pagina = await iniciarPagina({ alReintentar: () => location.reload() });
const userId = pagina.sesion.user.id;

const estado = {
  perfil: { nombre: null, metas: {}, ajustes: {} },
  tokens: [],
  grupos: [],
  recien: null, // { id, nombre, token } de la llave recién creada: solo en memoria.
  paso: 0,
  atajoAbierto: null,
  ocupado: false,
};

const instalada = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;

// ── Hoja inferior (detalle de un atajo · crear otra llave) ───────────────

const hoja = crearHoja({ hoja: $("hoja"), velo: $("velo"), manija: $("hoja-manija"), fondo: [$("contenido")], alCerrar: alCerrarHoja });
const nombreLlave = chips(document.querySelector('[data-chips="nombre"]'));
nombreLlave.opciones(NOMBRES_LLAVE.map((n) => ({ valor: n, texto: n })));
const metaGym = chips($("meta-gym"), (valor) => cambiarGym(Number(valor)));
metaGym.opciones(OPCIONES_GYM.map((n) => ({ valor: String(n), texto: String(n) })));

pintarFijos();
conectarEventos();
await cargar();

// ── Carga y rutas ────────────────────────────────────────────────────────

async function cargar() {
  try {
    const [datos, grupos] = await Promise.all([cargarConectar(userId), cargarAtajos()]);
    estado.perfil = datos.perfil;
    estado.tokens = datos.tokens;
    estado.grupos = grupos;
    pagina.mostrar("contenido");
    enrutar();
  } catch (error) {
    pagina.manejarError(error);
  }
}

function terminado() {
  return estado.perfil.ajustes?.bienvenida?.completada === true;
}

function enrutar() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (hash === "ajustes") return mostrarAjustes();
  if (hash === "asistente") return mostrarAsistente(0);
  if (hash.startsWith("paso-")) return mostrarAsistente(indicePaso(hash.slice(5)));
  return terminado() ? mostrarAjustes() : mostrarAsistente(0);
}

function mostrarAsistente(indice) {
  hoja.cerrar();
  $("ajustes").hidden = true;
  $("asistente").hidden = false;
  document.title = "Goat · Conectar iPhone";
  irA(indice, 1, false);
}

function mostrarAjustes() {
  hoja.cerrar();
  detenerEspera();
  $("asistente").hidden = true;
  $("ajustes").hidden = false;
  document.title = "Goat · Ajustes";
  if (location.hash !== "#ajustes") history.replaceState(null, "", "#ajustes");
  pintarAjustes();
  window.scrollTo(0, 0);
  actualizarLlaves().then(pintarLlaves);
}

// ══ Asistente ═════════════════════════════════════════════════════════════

function irA(indice, direccion = 1, enfocar = true) {
  detenerEspera();
  estado.paso = Math.min(Math.max(indice, 0), PASOS.length - 1);
  const paso = PASOS[estado.paso];
  const ultimo = estado.paso === PASOS.length - 1;

  for (const seccion of document.querySelectorAll(".paso")) {
    const activa = seccion.dataset.paso === paso.id;
    seccion.hidden = !activa;
    seccion.classList.toggle("desde-atras", activa && direccion < 0);
  }

  const avance = $("avance");
  avance.style.setProperty("--avance", String((estado.paso + 1) / PASOS.length));
  avance.setAttribute("aria-valuenow", String(estado.paso + 1));
  avance.setAttribute("aria-valuetext", `Paso ${estado.paso + 1} de ${PASOS.length}`);
  $("atras").classList.toggle("oculto", estado.paso === 0);
  $("salir").classList.toggle("oculto", estado.paso === 0 || ultimo);
  $("siguiente").textContent = paso.principal;
  $("siguiente").disabled = false;
  $("ahora-no").hidden = estado.paso !== 0;

  history.replaceState(null, "", `#paso-${paso.id}`);
  pintarPaso(paso.id);
  window.scrollTo(0, 0);
  if (enfocar) document.querySelector(`[data-paso="${paso.id}"] .paso-titular`)?.focus({ preventScroll: true });
}

function pintarPaso(id) {
  if (id === "hola") pintarHola();
  if (id === "instala") pintarInstala();
  if (id === "conecta") {
    pintarLlave();
    actualizarLlaves().then(() => estado.paso === indicePaso("conecta") && pintarLlave());
  }
  if (id === "atajos") pintarAtajos();
  if (id === "listo") {
    pintarListo();
    actualizarLlaves().then(() => estado.paso === indicePaso("listo") && pintarListo());
  }
}

/** Lo que no cambia: permisos, pasos de los atajos base y la dirección de Goat. */
function pintarFijos() {
  $("url-goat").value = urlBase(location.origin);
  const base = Object.fromEntries(ATAJOS_BASE.map((a) => [a.id, a]));
  llenarLista($("pasos-goat"), base["conectar-goat"]?.pasos ?? []);
  llenarLista($("pasos-probar"), base["conectar-probar"]?.pasos ?? []);

  $("permisos-lista").replaceChildren(
    ...PERMISOS.map((permiso, i) => {
      const item = clonar("plantilla-permiso");
      item.style.setProperty("--i", String(i));
      item.querySelector(".permiso-emoji").textContent = permiso.emoji;
      item.querySelector(".permiso-titulo").textContent = permiso.titulo;
      item.querySelector(".permiso-que").textContent = permiso.que;
      item.querySelector(".permiso-para").textContent = permiso.para;
      item.querySelector(".permiso-tocar").textContent = permiso.tocar;
      alVerse(item, () => item.classList.add("visto"), "0px");
      return item;
    }),
  );
}

function llenarLista(lista, textos) {
  lista.replaceChildren(
    ...textos.map((texto) => {
      const item = clonar("plantilla-item");
      item.textContent = texto;
      return item;
    }),
  );
}

// ── 1. Hola ──────────────────────────────────────────────────────────────

function pintarHola() {
  const nombre = String(estado.perfil.nombre ?? "").trim().split(/\s+/)[0] ?? "";
  const caja = $("hola-nombre").parentElement;
  if (nombre) {
    $("hola-saludo").textContent = "Hola,";
    $("hola-nombre").textContent = `${nombre}.`;
    $("hola-nombre").classList.toggle("nombre-largo", nombre.length > 8);
    caja.hidden = false;
  } else {
    $("hola-saludo").textContent = "Hola.";
    caja.hidden = true;
  }
}

// ── 2. Instálala ─────────────────────────────────────────────────────────

function pintarInstala() {
  const ios = plataforma(navigator.userAgent, navigator.maxTouchPoints) === "ios";
  $("instala-hecho").hidden = !instalada;
  $("instala-guia").hidden = instalada;
  $("instala-otro").hidden = instalada || ios;
  $("instala-sesion").hidden = instalada;
  $("instala-texto").textContent = instalada
    ? "Goat ya se abre como una app, a pantalla completa."
    : "Así Goat se abre como una app: a pantalla completa y sin la barra de Safari.";
}

// ── 3. Tu llave ──────────────────────────────────────────────────────────

function pintarLlave() {
  const e = estadoLlave({ tokens: estado.tokens, recien: estado.recien });
  $("llave-crear").hidden = e.vista !== "crear";
  $("llave-nueva").hidden = e.vista !== "nueva";
  $("llave-activas").hidden = e.vista !== "activas";
  $("llave-token").value = e.token ?? "";
  if (e.vista === "activas") {
    const [una] = e.activas;
    $("llave-activas-texto").textContent =
      e.activas.length === 1
        ? `Ya tienes una llave: ${una.nombre}, ${una.ultimo_uso ? `usada ${tiempoRelativo(una.ultimo_uso)}` : "sin usar todavía"}. Si no la guardaste en «⚙️ Goat», crea otra.`
        : `Ya tienes ${e.activas.length} llaves activas. Si no guardaste ninguna en «⚙️ Goat», crea otra.`;
  }
}

async function crearLlaveAsistente(boton) {
  await trabajar(boton, async () => {
    const r = await crearLlave("iPhone");
    if (!r.ok || !r.datos?.token) return avisar(r.mensaje ?? "⚠️ No se pudo crear");
    recordarLlave(r.datos);
    avisar("🔑 Llave creada");
    pintarLlave();
  });
}

/** Guarda en memoria la llave recién creada (el token se ve solo mientras esta página esté abierta). */
function recordarLlave(datos) {
  estado.recien = { id: datos.id, nombre: datos.nombre, token: datos.token };
  estado.tokens = [
    { id: datos.id, nombre: datos.nombre, ultimo_uso: null, revocado: false, creado_en: new Date().toISOString() },
    ...estado.tokens.filter((t) => t.id !== datos.id),
  ];
}

/** Al salir de la página el token se olvida (tampoco queda en la caché de "atrás"). */
function olvidarToken() {
  estado.recien = null;
  $("llave-token").value = "";
  $("otra-token").value = "";
}

async function actualizarLlaves() {
  try {
    estado.tokens = await leerLlaves(userId);
  } catch (error) {
    console.warn("[conectar] llaves", error);
  }
}

/** "Probar conexión": espera a que «🧪 Goat · Probar» llame a /ping con alguna llave (api_tokens.ultimo_uso). */
async function probarConexion(salida) {
  let filas;
  try {
    filas = await leerLlaves(userId);
  } catch (error) {
    return manejar(error);
  }
  estado.tokens = filas;
  if (!filas.some((f) => !f.revocado)) {
    mostrarEstado(salida, "Primero crea tu llave y guárdala en «⚙️ Goat».");
    return;
  }
  const antes = Object.fromEntries(filas.map((f) => [f.id, f.ultimo_uso ?? null]));
  const desde = Date.now();
  esperar({
    salida,
    texto: "Corre «🧪 Goat · Probar» en tu iPhone. Te espero aquí…",
    revisar: async () => {
      const ahora = await leerLlaves(userId);
      estado.tokens = ahora;
      return conexionProbada(ahora, antes, desde);
    },
    alListo: async (llave) => {
      mostrarEstado(salida, `✅ Conectado: tu llave «${llave.nombre}» ya habla con Goat.`, "bien");
      if (estado.paso === indicePaso("conecta")) pintarLlave();
      await marcarVarios(["conectar-goat", "conectar-probar"], true);
    },
    alAgotar: () =>
      mostrarEstado(
        salida,
        "⌛ No llegó nada. Revisa en «⚙️ Goat» que url no termine en / y que la llave esté completa. Luego prueba otra vez.",
      ),
  });
}

// ── 5. Atajos ────────────────────────────────────────────────────────────

function pintarAtajos() {
  pintarAvance();
  const marcados = estado.perfil.ajustes?.atajos ?? {};
  $("grupos").replaceChildren(
    ...estado.grupos.map((grupo) => {
      const caja = clonar("plantilla-grupo");
      const hechos = grupo.atajos.filter((a) => marcados[a.id] === true).length;
      caja.querySelector(".grupo-nombre").textContent = `${grupo.emoji} ${grupo.nombre}`;
      caja.querySelector(".grupo-cuenta").textContent = `${hechos} de ${grupo.atajos.length}`;
      caja.querySelector(".grupo-lista").replaceChildren(
        ...grupo.atajos.map((atajo) => {
          const item = clonar("plantilla-atajo");
          const boton = item.querySelector(".atajo-fila");
          const hecho = marcados[atajo.id] === true;
          boton.dataset.atajo = atajo.id;
          boton.classList.toggle("hecho", hecho);
          item.querySelector(".atajo-emoji").textContent = atajo.emoji;
          item.querySelector(".atajo-nombre").textContent = atajo.nombre;
          item.querySelector(".atajo-para").textContent = atajo.para;
          item.querySelector(".atajo-estado").textContent = hecho ? "Hecho" : "Pendiente";
          return item;
        }),
      );
      return caja;
    }),
  );
}

/** "5/14 · 9 por armar" en el asistente y en Ajustes. */
function pintarAvance() {
  const { hechos, total } = contarHechos(estado.grupos, estado.perfil.ajustes?.atajos);
  for (const caja of document.querySelectorAll("[data-avance]")) {
    caja.querySelector("[data-hechos]").textContent = String(hechos);
    caja.querySelector("[data-total]").textContent = String(total);
    caja.querySelector("[data-relleno]").style.setProperty("transform", `scaleX(${total ? hechos / total : 0})`);
    caja.querySelector("[data-avance-texto]").textContent =
      total === 0
        ? "Todavía no hay atajos"
        : hechos >= total
          ? "Todos listos"
          : hechos === 0
            ? "Empieza por «⚙️ Goat»"
            : `Listos · faltan ${total - hechos}`;
  }
}

function abrirAtajo(id) {
  const atajo = todosLosAtajos(estado.grupos).find((a) => a.id === id);
  if (!atajo) return;
  detenerEspera();
  estado.atajoAbierto = atajo;
  $("form-llave").hidden = true;
  $("hoja-atajo").hidden = false;
  $("hoja").classList.add("con-acciones");
  $("hoja-emoji").textContent = atajo.emoji;
  $("hoja-titulo").textContent = `${atajo.nombre}.`;
  $("atajo-para").textContent = atajo.para;

  const requisitos = $("atajo-requisitos");
  requisitos.hidden = atajo.requisitos.length === 0;
  llenarLista(requisitos.querySelector(".puntos"), atajo.requisitos);

  llenarLista($("atajo-pasos"), atajo.pasos);

  $("atajo-autos").replaceChildren(
    ...atajo.automatizaciones.map((auto, i, todas) => {
      const caja = clonar("plantilla-auto");
      caja.querySelector(".auto-etiqueta").textContent = todas.length > 1 ? `Automatización ${i + 1} de ${todas.length}` : "Automatización";
      caja.querySelector(".auto-disparador").textContent = auto.disparador;
      llenarLista(caja.querySelector(".pasos-lista"), Array.isArray(auto.pasos) ? auto.pasos : []);
      return caja;
    }),
  );

  const permisos = $("atajo-permisos");
  permisos.hidden = atajo.permisos.length === 0;
  llenarLista(permisos.querySelector(".puntos"), atajo.permisos);

  $("atajo-probar").hidden = !atajo.prueba;
  $("atajo-probar").disabled = false;
  mostrarEstado($("atajo-prueba"), "");
  $("atajo-hecho").checked = estado.perfil.ajustes?.atajos?.[atajo.id] === true;
  hoja.abrir();
}

/**
 * "Probar" de un atajo: primero la web llama a su ruta de prueba (¿Goat responde?); después espera a que
 * llegue una llamada del iPhone a esa parte de la API (log_api, más nueva que la de la web).
 */
async function probarAtajo(atajo) {
  const salida = $("atajo-prueba");
  if (!atajo?.prueba) return;
  if (atajo.prueba.ruta === "ping") return probarConexion(salida);

  const boton = $("atajo-probar");
  boton.disabled = true;
  mostrarEstado(salida, "Revisando que Goat responda…", "esperando");
  try {
    const r = await probarRuta(atajo.prueba);
    if (estado.atajoAbierto?.id !== atajo.id) return;
    if (!r.ok) {
      const pista = r.codigo === "SERVIDOR_SIN_CONFIGURAR" ? " Falta la clave del servidor en Vercel." : "";
      mostrarEstado(salida, `${r.mensaje ?? "⚠️ Goat no respondió"}.${pista}`.replace(/\.\./g, "."));
      return;
    }
    const base = await ultimoLog(userId);
    if (estado.atajoAbierto?.id !== atajo.id) return;
    esperar({
      salida,
      texto: `Goat responde. Ahora corre «${atajo.emoji} ${atajo.nombre}» en tu iPhone…`,
      revisar: async () => {
        const recibida = pruebaRecibida(await logsDesde(userId, base), atajo.prueba);
        if (recibida?.error) {
          mostrarEstado(salida, `Llegó, pero Goat respondió con error (${recibida.error.estado}). Revisa los pasos; sigo esperando…`, "esperando");
        }
        return recibida?.ok ?? null;
      },
      alListo: async () => {
        mostrarEstado(salida, "✅ Llegó desde tu iPhone. Funciona.", "bien");
        $("atajo-hecho").checked = true;
        await marcarVarios([atajo.id], true);
      },
      alAgotar: () => mostrarEstado(salida, "⌛ No llegó nada todavía. Revisa que use «⚙️ Goat» y vuelve a probar."),
    });
  } catch (error) {
    manejar(error);
  } finally {
    boton.disabled = false;
  }
}

/** Marca o desmarca atajos en perfil.ajustes.atajos. Si falla, deja todo como estaba. */
async function marcarVarios(ids, hecho) {
  const antes = estado.perfil.ajustes?.atajos ?? {};
  let nuevo = antes;
  for (const id of ids) nuevo = marcarAtajo(nuevo, id, hecho);
  if (JSON.stringify(nuevo) === JSON.stringify(marcarAtajo(antes, "", false))) return;
  estado.perfil.ajustes = { ...estado.perfil.ajustes, atajos: nuevo };
  repintarMarcas();
  try {
    await guardarAtajosHechos(nuevo);
  } catch (error) {
    estado.perfil.ajustes = { ...estado.perfil.ajustes, atajos: antes };
    repintarMarcas();
    manejar(error);
  }
}

function repintarMarcas() {
  pintarAvance();
  if (!$("asistente").hidden && estado.paso === indicePaso("atajos")) pintarAtajos();
  if (estado.atajoAbierto) $("atajo-hecho").checked = estado.perfil.ajustes?.atajos?.[estado.atajoAbierto.id] === true;
}

// ── 7. Listo ─────────────────────────────────────────────────────────────

function pintarListo() {
  const { hechos, total } = contarHechos(estado.grupos, estado.perfil.ajustes?.atajos);
  const filas = resumenListo({ instalada, tokens: estado.tokens, hechos, total });
  const todo = filas.every((f) => f.listo);
  $("listo-emoji").textContent = todo ? "✅" : "👍";
  $("listo-linea-1").textContent = todo ? "Listo." : "Casi";
  $("listo-linea-2-caja").hidden = todo;
  $("listo-linea-2").textContent = todo ? "" : "listo.";
  $("listo-texto").textContent = todo
    ? "Goat ya registra por ti. Tú solo confirmas."
    : "Lo pendiente te espera en Hoy › ⚙️ Ajustes. Sigue cuando quieras: nada se pierde.";
  $("listo-lista").replaceChildren(
    ...filas.map((fila) => {
      const item = clonar("plantilla-resumen");
      item.classList.toggle("listo", fila.listo);
      item.querySelector(".resumen-emoji").textContent = fila.emoji;
      item.querySelector(".resumen-titulo").textContent = fila.titulo;
      item.querySelector(".resumen-detalle").textContent = fila.detalle;
      const marca = item.querySelector(".resumen-marca");
      marca.textContent = fila.listo ? "✓" : "Pendiente";
      marca.setAttribute("aria-label", fila.listo ? "Listo" : "Pendiente");
      return item;
    }),
  );
}

/** "Ahora no" o "Salir": este dispositivo no vuelve a abrir el asistente solo. */
function salir() {
  marcarDispositivo();
  if (terminado()) {
    location.hash = "ajustes";
    return;
  }
  location.href = "index.html";
}

/** "Ir a Hoy": marca este dispositivo y guarda que terminaste (para los demás dispositivos). */
async function terminar() {
  marcarDispositivo();
  $("siguiente").disabled = true;
  try {
    await completarBienvenida();
    estado.perfil.ajustes = { ...estado.perfil.ajustes, bienvenida: { completada: true } };
  } catch (error) {
    console.warn("[conectar] bienvenida", error); // La marca local ya quedó: Hoy no vuelve a mandar aquí.
  }
  location.href = "index.html";
}

// ══ Ajustes ═══════════════════════════════════════════════════════════════

function pintarAjustes() {
  pintarAvance();
  pintarLlaves();
  pintarJuegos();
  metaGym.poner(String(leerMetas(estado.perfil.metas).gym_semana));
}

function pintarLlaves() {
  const activas = estado.tokens.filter((t) => !t.revocado);
  $("llaves-vacio").hidden = activas.length > 0;
  $("llaves-lista").hidden = activas.length === 0;
  $("llaves-lista").replaceChildren(
    ...activas.map((llave) => {
      const fila = clonar("plantilla-llave");
      fila.querySelector(".fila-icono").textContent = ICONO_LLAVE[llave.nombre] ?? "🔑";
      fila.querySelector(".llave-nombre").textContent = llave.nombre;
      fila.querySelector(".llave-detalle").textContent = detalleLlave(llave);
      const boton = fila.querySelector(".llave-revocar");
      boton.setAttribute("aria-label", `Revocar ${llave.nombre}`);
      boton.addEventListener("click", () => pedirRevocar(boton, llave));
      return fila;
    }),
  );
}

/** Primer toque: "¿Revocar?" (4 s para confirmar). Segundo toque: revoca. */
async function pedirRevocar(boton, llave) {
  if (!boton.classList.contains("confirmar")) {
    boton.classList.add("confirmar");
    boton.textContent = "¿Revocar?";
    window.setTimeout(() => {
      boton.classList.remove("confirmar");
      boton.textContent = "Revocar";
    }, 4000);
    return;
  }
  await trabajar(boton, async () => {
    const r = await revocarLlave(llave.id);
    if (!r.ok) return avisar(r.mensaje ?? "⚠️ No se pudo revocar");
    estado.tokens = estado.tokens.map((t) => (t.id === llave.id ? { ...t, revocado: true } : t));
    if (estado.recien?.id === llave.id) olvidarToken();
    avisar(r.mensaje ?? "🔒 Llave revocada");
    pintarLlaves();
  });
}

function abrirHojaLlave() {
  detenerEspera();
  estado.atajoAbierto = null;
  $("hoja-atajo").hidden = true;
  $("form-llave").hidden = false;
  $("hoja").classList.remove("con-acciones");
  $("hoja-emoji").textContent = "🔑";
  $("hoja-titulo").textContent = "Otra llave.";
  $("llave-opciones").hidden = false;
  $("crear-otra").hidden = false;
  $("otra-nueva").hidden = true;
  $("otra-token").value = "";
  nombreLlave.poner("iPhone");
  hoja.abrir();
}

async function crearOtraLlave(evento) {
  evento.preventDefault();
  await trabajar($("crear-otra"), async () => {
    const r = await crearLlave(nombreLlave.valor ?? "iPhone");
    if (!r.ok || !r.datos?.token) return avisar(r.mensaje ?? "⚠️ No se pudo crear");
    recordarLlave(r.datos);
    $("otra-token").value = r.datos.token;
    $("llave-opciones").hidden = true;
    $("crear-otra").hidden = true;
    $("otra-nueva").hidden = false;
    pintarLlaves();
    avisar("🔑 Llave creada");
  });
}

function alCerrarHoja() {
  detenerEspera();
  estado.atajoAbierto = null;
  $("otra-token").value = "";
}

// ── Juegos del desbloqueo (perfil.ajustes.desbloqueo.juegos, con las reglas de desbloqueo/logica.js) ──

function crudoDesbloqueo() {
  const crudo = estado.perfil.ajustes?.desbloqueo;
  return crudo && typeof crudo === "object" ? crudo : {};
}

function pintarJuegos() {
  const { juegos } = ajustesDesbloqueo(crudoDesbloqueo());
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
  const entrada = $("juego-nombre");
  entrada.disabled = lleno;
  entrada.placeholder = lleno ? `Máximo ${MAX_JUEGOS} juegos` : "Ej. Clash Royale";
}

async function agregarJuego(evento) {
  evento.preventDefault();
  const entrada = $("juego-nombre");
  const nombre = entrada.value.trim().replace(/\s+/g, " ").slice(0, MAX_NOMBRE_JUEGO);
  const id = slugApp(nombre);
  const { juegos } = ajustesDesbloqueo(crudoDesbloqueo());
  if (!nombre || !APP_VALIDA.test(id)) return avisar("⚠️ Escribe un nombre");
  if (APPS_FIJAS.some((a) => a.id === id) || juegos.some((j) => j.id === id)) return avisar("👌 Ya está en la lista");
  if (juegos.length >= MAX_JUEGOS) return avisar(`⚠️ Máximo ${MAX_JUEGOS}`);
  const lista = [...juegos.map(({ id: i, nombre: n }) => ({ id: i, nombre: n })), { id, nombre }];
  const listo = await guardarJuegos(evento.submitter ?? $("form-juego").querySelector("button"), lista, "🎮 Agregado");
  if (listo) entrada.value = "";
}

async function quitarJuego(id) {
  const { juegos } = ajustesDesbloqueo(crudoDesbloqueo());
  const lista = juegos.filter((j) => j.id !== id).map(({ id: i, nombre: n }) => ({ id: i, nombre: n }));
  await guardarJuegos(null, lista, "🗑️ Quitado");
}

/** Guarda los juegos sin pisar los niveles ni las demás claves de perfil.ajustes. */
async function guardarJuegos(boton, lista, mensaje) {
  let listo = false;
  await trabajar(boton, async () => {
    const actual = crudoDesbloqueo();
    await guardarDesbloqueo(actual, { juegos: lista });
    estado.perfil.ajustes = { ...estado.perfil.ajustes, desbloqueo: { ...actual, juegos: lista } };
    pintarJuegos();
    avisar(mensaje);
    listo = true;
  });
  return listo;
}

// ── Metas ────────────────────────────────────────────────────────────────

async function cambiarGym(valor) {
  const anterior = leerMetas(estado.perfil.metas).gym_semana;
  if (!Number.isInteger(valor) || valor === anterior) return;
  try {
    estado.perfil.metas = await guardarMeta(userId, estado.perfil.metas, "gym_semana", valor);
    avisar(`🏋️ ${valor} por semana`);
  } catch (error) {
    metaGym.poner(String(anterior));
    manejar(error);
  }
}

// ══ Piezas ════════════════════════════════════════════════════════════════

/** Texto de una prueba: "esperando" (punto que late), "bien" (✓) o normal. */
function mostrarEstado(salida, texto, clase = "") {
  salida.textContent = texto;
  salida.classList.toggle("esperando", clase === "esperando");
  salida.classList.toggle("bien", clase === "bien");
}

// Una sola espera a la vez (`espera`, arriba): revisa cada 3 s hasta que `revisar()` devuelva algo, o 5 min.
// iOS congela la página mientras estás en Atajos: al volver (visibilitychange) se revisa enseguida.
function esperar({ salida, texto, revisar, alListo, alAgotar }) {
  detenerEspera();
  const actual = { inicio: Date.now(), temporizador: 0, corriendo: false, salida };
  espera = actual;
  mostrarEstado(salida, texto, "esperando");

  actual.vuelta = async () => {
    if (espera !== actual || actual.corriendo) return;
    actual.corriendo = true;
    let resultado = null;
    try {
      resultado = await revisar();
    } catch (error) {
      if (error instanceof SesionVencida || error instanceof BaseSinInstalar) {
        detenerEspera();
        return manejar(error);
      }
      console.warn("[conectar] revisar", error);
    }
    actual.corriendo = false;
    if (espera !== actual) return;
    if (resultado) {
      espera = null;
      await alListo(resultado);
      return;
    }
    if (Date.now() - actual.inicio > ESPERA_MAX_MS) {
      espera = null;
      alAgotar();
      return;
    }
    actual.temporizador = window.setTimeout(actual.vuelta, ESPERA_MS);
  };
  actual.vuelta();
}

function detenerEspera() {
  if (!espera) return;
  window.clearTimeout(espera.temporizador);
  if (espera.salida.classList.contains("esperando")) mostrarEstado(espera.salida, "");
  espera = null;
}

function revisarYa() {
  if (!espera || espera.corriendo) return;
  window.clearTimeout(espera.temporizador);
  espera.vuelta();
}

/** Desactiva el botón mientras se guarda; los errores se muestran como en el resto de Goat. */
async function trabajar(boton, tarea) {
  if (estado.ocupado) return;
  estado.ocupado = true;
  if (boton) boton.disabled = true;
  try {
    await tarea();
  } catch (error) {
    manejar(error);
  } finally {
    estado.ocupado = false;
    if (boton) boton.disabled = false;
  }
}

function manejar(error) {
  if (error instanceof SesionVencida || error instanceof BaseSinInstalar) return pagina.manejarError(error);
  console.error(error);
  avisar("⚠️ No se pudo guardar");
}

async function copiar(boton) {
  const campo = $(boton.dataset.copiar);
  const valor = campo?.value ?? "";
  if (!valor) return;
  try {
    await navigator.clipboard.writeText(valor);
    boton.textContent = "Copiado";
    boton.classList.add("copiado");
    window.setTimeout(() => {
      boton.textContent = "Copiar";
      boton.classList.remove("copiado");
    }, 1800);
    avisar("📋 Copiado");
  } catch {
    // Sin permiso de portapapeles: deja el texto seleccionado para copiarlo a mano.
    campo.focus();
    campo.setSelectionRange(0, valor.length);
    avisar("Mantén presionado › Copiar");
  }
}

function conectarEventos() {
  // Asistente
  $("siguiente").addEventListener("click", () => {
    if (estado.paso === PASOS.length - 1) return terminar();
    irA(estado.paso + 1, 1);
  });
  $("atras").addEventListener("click", () => irA(estado.paso - 1, -1));
  $("salir").addEventListener("click", salir);
  $("ahora-no").addEventListener("click", salir);
  $("crear-llave").addEventListener("click", (e) => crearLlaveAsistente(e.currentTarget));
  $("otra-llave").addEventListener("click", (e) => crearLlaveAsistente(e.currentTarget));
  $("probar-conexion").addEventListener("click", () => probarConexion($("conexion-estado")));
  $("grupos").addEventListener("click", (evento) => {
    const fila = evento.target.closest("[data-atajo]");
    if (fila) abrirAtajo(fila.dataset.atajo);
  });

  // Hoja
  $("atajo-probar").addEventListener("click", () => probarAtajo(estado.atajoAbierto));
  $("atajo-hecho").addEventListener("change", (evento) => {
    if (estado.atajoAbierto) marcarVarios([estado.atajoAbierto.id], evento.target.checked);
  });
  $("form-llave").addEventListener("submit", crearOtraLlave);

  // Ajustes
  $("nueva-llave").addEventListener("click", abrirHojaLlave);
  $("form-juego").addEventListener("submit", agregarJuego);

  // Copiar (token y dirección)
  document.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-copiar]");
    if (boton) copiar(boton);
  });

  window.addEventListener("hashchange", enrutar);
  window.addEventListener("pagehide", olvidarToken);
  window.addEventListener("pageshow", (evento) => {
    if (evento.persisted) enrutar();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") revisarYa();
  });
}
