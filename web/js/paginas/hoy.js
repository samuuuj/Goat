// Pantalla de inicio (index.html): lo primero que ves al abrir la app.
// Lee tus registros, calcula el resumen del día (logica/calculo.js) y lo pinta en las plantillas del HTML.

import { cerrarSesion, requerirSesion } from "../supabase/sesion.js";
import { BaseSinInstalar, SesionVencida, cargarRegistros } from "../supabase/datos.js";
import { construirResumen } from "../logica/calculo.js";
import { diaYMes, horaBogota, nombreDia } from "../logica/dia.js";
import { formatearValor, unidad } from "../logica/formato.js";
import { ajustarAlAncho, alVerse, avisar, clonar, contar, iniciarDiscreto, limitar, reducirMovimiento } from "../piezas/ui.js";
import { iniciarRegistros } from "../piezas/registros.js";
import { revisarBienvenida } from "../conectar/bienvenida.js";
import { iniciarCampana } from "../notificaciones/campana.js";

const $ = (id) => document.getElementById(id);

const VERBO_PENDIENTE = {
  desayuno: "desayunar.",
  almuerzo: "almorzar.",
  merienda: "merendar.",
  cena: "cenar.",
  checkin_finanzas: "tu check-in.",
  cierre_finanzas: "cerrar gastos.",
  sueno: "tu sueño.",
};

const COLOR_ANILLO = {
  registro: "var(--anillo-registro)",
  cuerpo: "var(--anillo-cuerpo)",
  mente: "var(--anillo-mente)",
};

/** En pantallas grandes las líneas de la portada no crecen más que esto (px). */
const TAMANO_MAXIMO_PORTADA = 240;

const sesion = await requerirSesion();

// La primera vez en este dispositivo, el asistente "Conectar iPhone" (js/conectar/bienvenida.js).
if (await revisarBienvenida(sesion).catch(() => false)) {
  location.replace("conectar.html");
  await new Promise(() => {});
}

let registros = null; // Lo último que llegó de Supabase.
let resumen = null; // Lo último que se pintó.
let pintado = ""; // El mismo resumen en texto, para no repintar si nada cambió.
let ultimaCarga = 0;
let reajustarPortada = null;
let scrollProgramado = false;

iniciarDiscreto($("boton-discreto"));
document.querySelectorAll("#cerrar-sesion, [data-cerrar-sesion]").forEach((boton) => boton.addEventListener("click", cerrarSesion));
$("reintentar").addEventListener("click", () => cargar());
iniciarCampana($("campana"), $("campana-contador"));

const registro = iniciarRegistros({
  alGuardar: async (mensaje) => {
    avisar(mensaje);
    await cargar();
  },
});
document.querySelectorAll("#dock [data-accion]").forEach((boton) =>
  boton.addEventListener("click", () => registro.abrir(boton.dataset.accion)),
);

await cargar();
pintarMinis();

// El reloj de la barra y lo que falta cambian con la hora, aunque no registres nada.
window.setInterval(() => {
  if (!registros) return;
  pintar(construirResumen(registros, new Date()));
  pintarHora();
}, 15_000);

// Al volver a la app después de un rato, trae lo que hayan registrado los atajos.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Date.now() - ultimaCarga > 60_000) cargar();
});

window.addEventListener("scroll", programarScroll, { passive: true });
window.addEventListener("resize", programarScroll);

// ── Carga ────────────────────────────────────────────────────────────────

async function cargar() {
  try {
    registros = await cargarRegistros(sesion.user.id);
    ultimaCarga = Date.now();
    mostrar("hoy");
    pintar(construirResumen(registros, new Date()));
  } catch (error) {
    if (error instanceof SesionVencida) return cerrarSesion();
    if (error instanceof BaseSinInstalar) return mostrar("falta-base");
    console.error(error);
    // Si ya estabas viendo tus datos, no los quita: solo avisa.
    if (resumen) avisar("⚠️ No se pudo actualizar.");
    else mostrar("fallo");
  }
}

function mostrar(vista) {
  $("cargando").hidden = true;
  $("hoy").hidden = vista !== "hoy";
  $("dock").hidden = vista !== "hoy";
  $("falta-base").hidden = vista !== "falta-base";
  $("fallo").hidden = vista !== "fallo";
}

function pintar(nuevo) {
  const texto = JSON.stringify(nuevo);
  if (texto === pintado) return;
  const animar = resumen === null; // Las entradas animadas, solo la primera vez.
  pintado = texto;
  resumen = nuevo;

  pintarHora();
  pintarPortada(nuevo);
  pintarAnillos(nuevo.anillos, animar);
  pintarPendientes(nuevo.pendientes, animar);
  pintarMetricas(nuevo.metricas, animar);
  pintarSemana(nuevo, animar);
  programarScroll();
  // Para la campana y otras piezas que necesitan el resumen sin recalcularlo.
  document.dispatchEvent(new CustomEvent("goat:resumen", { detail: nuevo }));
}

// ── Portada ──────────────────────────────────────────────────────────────

function titulares(datos) {
  const base = [{ texto: `${nombreDia(datos.fecha)}.` }, { texto: `${datos.score} puntos.` }];
  const [primero] = datos.pendientes;
  if (!primero) return [...base, { texto: "Todo" }, { texto: "al día.", acento: true }];
  return [...base, { texto: "Te falta" }, { texto: VERBO_PENDIENTE[primero.clave] ?? `${primero.texto}.`, acento: true }];
}

function pintarHora() {
  if (!resumen) return;
  $("fecha-hora").textContent = `${nombreDia(resumen.fecha).slice(0, 3)} ${diaYMes(resumen.fecha)} · ${horaBogota(new Date())}`;
}

function pintarPortada(datos) {
  const lineas = titulares(datos);
  const titulo = $("titulares");
  titulo.setAttribute("aria-label", lineas.map((l) => l.texto).join(" "));

  // Solo se reemplazan las líneas que cambiaron: esas vuelven a entrar deslizando.
  lineas.forEach((linea, i) => {
    const previa = titulo.children[i];
    const firma = `${linea.texto}|${Boolean(linea.acento)}`;
    if (previa?.dataset.firma === firma) return;
    const nueva = clonar("plantilla-linea");
    nueva.dataset.linea = linea.texto;
    nueva.dataset.firma = firma;
    nueva.querySelector(".linea-cinetica").classList.toggle("acento", Boolean(linea.acento));
    const texto = nueva.querySelector(".linea-texto");
    texto.textContent = linea.texto;
    texto.style.setProperty("--i", i);
    if (previa) previa.replaceWith(nueva);
    else titulo.append(nueva);
  });
  while (titulo.children.length > lineas.length) titulo.lastElementChild.remove();

  $("portada").style.setProperty("--retraso-pie", `${0.35 + lineas.length * 0.09}s`);
  // Llenan el ancho, pero todas juntas caben en ~60% del alto (pantallas anchas o iPhone acostado).
  const tope = () => Math.min(TAMANO_MAXIMO_PORTADA, (window.innerHeight * 0.6) / Math.max(titulo.children.length, 3) / 0.92);
  if (reajustarPortada) reajustarPortada();
  else reajustarPortada = ajustarAlAncho(titulo, tope);

  const restantes = Math.max(datos.pendientes.length - 1, 0);
  $("restantes").hidden = restantes === 0;
  $("restantes").textContent = `y ${restantes} ${restantes === 1 ? "cosa" : "cosas"} más`;
  $("descripcion-dia").textContent = datos.descripcionDia;
  $("racha-corta").textContent = `🔥 ${datos.racha} ${datos.racha === 1 ? "día" : "días"}`;
}

// ── Anillos ──────────────────────────────────────────────────────────────

function pintarAnillos(anillos, animar) {
  const svg = $("anillos-svg");
  svg.setAttribute("aria-label", anillos.map((a) => `${a.nombre} ${Math.round(a.progreso * 100)}%`).join(", "));

  $("anillos-lista").replaceChildren(
    ...anillos.map((anillo) => {
      const item = clonar("plantilla-anillo");
      item.querySelector(".anillo-color").style.setProperty("--color", COLOR_ANILLO[anillo.clave]);
      item.querySelector(".anillo-porcentaje").textContent = `${Math.round(anillo.progreso * 100)}%`;
      item.querySelector(".anillo-nombre").textContent = anillo.nombre;
      item.querySelector(".anillo-detalle").textContent = anillo.detalle;
      return item;
    }),
  );

  for (const anillo of anillos) {
    const circulo = svg.querySelector(`[data-anillo="${anillo.clave}"]`);
    const largo = 2 * Math.PI * Number(circulo.getAttribute("r"));
    const avance = limitar(anillo.progreso, 0, 1);
    const final = `${largo * (1 - avance)}`;
    circulo.style.strokeDasharray = `${largo}`;
    circulo.classList.toggle("vacio", avance === 0);
    if (!animar) {
      circulo.style.strokeDashoffset = final;
      continue;
    }
    circulo.style.strokeDashoffset = `${largo}`;
    alVerse(svg, () => requestAnimationFrame(() => (circulo.style.strokeDashoffset = final)), "0px 0px -15% 0px");
  }
}

// ── Lo que falta ─────────────────────────────────────────────────────────

function pintarPendientes(pendientes, animar) {
  $("pendientes-titulo").textContent = pendientes.length > 0 ? "Lo que falta" : "Estado";
  $("todo-al-dia").hidden = pendientes.length > 0;
  const lista = $("pendientes-lista");
  lista.replaceChildren(
    ...pendientes.map((pendiente, i) => {
      const item = clonar("plantilla-pendiente");
      item.style.setProperty("--i", i);
      item.querySelector(".pendiente-emoji").textContent = pendiente.emoji;
      item.querySelector(".pendiente-texto").textContent = pendiente.texto;
      item.querySelector("button").addEventListener("click", () => registro.abrir(pendiente.accion, pendiente.clave));
      if (!animar) item.classList.add("visto");
      return item;
    }),
  );
  if (animar) for (const item of lista.children) alVerse(item, () => item.classList.add("visto"));
}

// ── Métricas ─────────────────────────────────────────────────────────────

function pintarMetricas(metricas, animar) {
  const entradas = [];
  $("metricas").replaceChildren(...metricas.map((metrica, i) => crearMetrica(metrica, i, animar, entradas)));
  entradas.forEach(([seccion, accion]) => alVerse(seccion, accion));
}

/** `entradas` recibe [sección, animación] para correrla cuando la sección aparezca en pantalla. */
function crearMetrica(metrica, indice, animar, entradas) {
  const seccion = clonar("plantilla-metrica");
  const formatear = (n) => formatearValor(n, metrica.formato);
  const sufijo = unidad(metrica.formato);
  const largo = Math.max(formatear(metrica.valor).length, 3);

  seccion.querySelector(".metrica-etiqueta").textContent = metrica.etiqueta;
  seccion.querySelector(".metrica-orden").textContent = String(indice + 1).padStart(2, "0");
  seccion.querySelector(".metrica-numero").style.fontSize =
    `min(calc(var(--ancho-cifra) / ${(largo * 0.66).toFixed(2)}), var(--tope-cifra))`;
  seccion.querySelector(".metrica-unidad").textContent = sufijo;
  seccion.querySelector(".metrica-unidad").hidden = !sufijo;
  seccion.querySelector(".metrica-frase").textContent = metrica.frase;
  if (metrica.sensible) seccion.querySelector(".metrica-valor-caja").classList.add("sensible");

  const valor = seccion.querySelector(".metrica-valor");
  const relleno = seccion.querySelector(".progreso-relleno");
  const progreso = metrica.meta ? limitar(metrica.valor / metrica.meta, 0, 1) : null;
  if (progreso !== null) {
    seccion.querySelector(".metrica-meta").hidden = false;
    seccion.querySelector(".metrica-meta-texto").textContent = `Meta ${formatear(metrica.meta)} ${sufijo}`.trim();
  }

  if (animar) {
    valor.textContent = formatear(0);
    entradas.push([
      seccion,
      () => {
        contar(valor, metrica.valor, formatear);
        if (progreso !== null) relleno.style.transform = `scaleX(${progreso})`;
      },
    ]);
  } else {
    valor.textContent = formatear(metrica.valor);
    if (progreso !== null) relleno.style.transform = `scaleX(${progreso})`;
  }
  return seccion;
}

// ── Semana ───────────────────────────────────────────────────────────────

function pintarSemana(datos, animar) {
  $("racha").textContent = String(datos.racha);
  $("racha-texto").textContent = `${datos.racha === 1 ? "día" : "días"} de racha 🔥`;

  const diferencia = datos.scoreAyer === null ? null : datos.score - datos.scoreAyer;
  $("diferencia-bloque").hidden = diferencia === null;
  if (diferencia !== null) {
    $("diferencia").textContent = `${diferencia >= 0 ? "+" : "−"}${Math.abs(diferencia)}`;
    $("diferencia").classList.toggle("positivo", diferencia >= 0);
  }

  const barras = $("barras");
  barras.replaceChildren(
    ...datos.semana.map((dia, i) => {
      const columna = clonar("plantilla-dia");
      columna.classList.toggle("hoy", i === datos.semana.length - 1);
      columna.querySelector(".dia-puntos").textContent = dia.score ?? "—";
      const barra = columna.querySelector(".dia-barra");
      barra.style.height = `${dia.score ?? 0}%`;
      barra.style.setProperty("--i", i);
      columna.querySelector(".dia-letra").textContent = nombreDia(dia.fecha).charAt(0);
      return columna;
    }),
  );
  if (animar) alVerse(barras, () => barras.classList.add("visto"));
  else barras.classList.add("visto");
}

// ── Secciones ────────────────────────────────────────────────────────────

/** Dato corto de cada sección (js/<modulo>/mini.js), sin montos. Si un módulo falla, su tarjeta queda sin dato. */
function pintarMinis() {
  document.querySelectorAll(".seccion-tarjeta[data-modulo]").forEach(async (tarjeta) => {
    try {
      const { miniDato } = await import(`../${tarjeta.dataset.modulo}/mini.js`);
      const texto = await miniDato(sesion);
      if (texto) tarjeta.querySelector("[data-mini]").textContent = texto;
    } catch (error) {
      console.warn(`[secciones] ${tarjeta.dataset.modulo}`, error);
    }
  });
}

// ── Efectos al hacer scroll ──────────────────────────────────────────────
// La portada se desplaza, se comprime y se desvanece; los números de las métricas flotan un poco.

function programarScroll() {
  if (scrollProgramado) return;
  scrollProgramado = true;
  requestAnimationFrame(() => {
    scrollProgramado = false;
    if (reducirMovimiento() || $("hoy").hidden) return;
    const alto = window.innerHeight;

    const portada = $("portada");
    const caja = portada.getBoundingClientRect();
    portada.style.setProperty("--p", limitar(-caja.top / caja.height, 0, 1).toFixed(4));

    for (const seccion of $("metricas").children) {
      const m = seccion.getBoundingClientRect();
      seccion.style.setProperty("--q", limitar((alto - m.top) / (alto + m.height), 0, 1).toFixed(4));
    }
  });
}
