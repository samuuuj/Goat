// Sueño (sueno.html): la última noche, la semana como en la app Salud, regularidad y registro a mano.
// Lee sueno_eventos y sueno_muestras con RLS y arma todo con logica.js (las mismas reglas que usa la API).

import { iniciarPagina } from "../piezas/pagina.js";
import { alVerse, avisar, clonar, limitar, reducirMovimiento } from "../piezas/ui.js";
import { chips } from "../piezas/chips.js";
import { crearHoja } from "../piezas/hoja.js";
import { diaLogico, diaYMes, nombreDia } from "../logica/dia.js";
import { sumarDias } from "../logica/calculo.js";
import { cargarSueno, guardarEvento, guardarMetas } from "./datos.js";
import { NOMBRE_FUENTE, duracionCorta, horaDe, momentoDesdeHora, resumenSueno } from "./logica.js";
import { ATAJOS } from "./atajos.js";

const $ = (id) => document.getElementById(id);
const HORA_MS = 3_600_000;
const RADIO_INDICE = 86;

const pagina = await iniciarPagina({ alReintentar: () => cargar() });
const userId = pagina.sesion.user.id;

let datos = null; // Lo último que llegó de Supabase.
let resumen = null; // Lo último que se pintó.
let pintado = "";
let primeraVez = true;
let ultimaCarga = 0;
let guardando = false;

// ── Hoja: anotar a mano y metas ──────────────────────────────────────────

const formEvento = $("form-evento");
const formMetas = $("form-metas");
const entradaHora = $("hora-evento");
const hoja = crearHoja({ hoja: $("hoja"), velo: $("velo"), manija: $("hoja-manija"), fondo: [$("contenido"), $("accion")] });

const tipo = chips(formEvento.querySelector('[data-chips="tipo"]'), (valor) => prepararHora(valor));
tipo.opciones([
  { valor: "acostarse", texto: "🌙 Me acosté" },
  { valor: "despertar", texto: "☀️ Me levanté" },
]);
const horas = chips(formMetas.querySelector('[data-chips="horas"]'));
horas.opciones([6.5, 7, 7.5, 8, 8.5, 9].map((h) => ({ valor: String(h), texto: duracionCorta(h * 60) })));

entradaHora.addEventListener("input", mostrarCuando);
formEvento.addEventListener("submit", (evento) => {
  evento.preventDefault();
  const elegido = momentoDesdeHora(entradaHora.value, new Date());
  if (!elegido) return avisar("⚠️ Escribe una hora");
  guardarMomento(elegido.momento);
});
$("ahora-mismo").addEventListener("click", () => guardarMomento(new Date()));
formMetas.addEventListener("submit", (evento) => {
  evento.preventDefault();
  guardarLasMetas();
});

$("boton-registrar").addEventListener("click", () => abrirEvento(sugerirTipo()));
document.querySelectorAll("[data-registrar]").forEach((boton) => boton.addEventListener("click", () => abrirEvento(boton.dataset.registrar)));
$("anoche-falta").addEventListener("click", (evento) => abrirEvento(evento.currentTarget.dataset.tipo));
$("abrir-metas").addEventListener("click", abrirMetas);

pintarGuias();
await cargar();

// La barra de "esta noche" crece con la hora; al volver a la app, trae lo que mandaron los atajos.
window.setInterval(() => {
  if (datos) pintar(resumenSueno(datos, new Date()));
}, 60_000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Date.now() - ultimaCarga > 60_000) cargar();
});

// ── Carga ────────────────────────────────────────────────────────────────

async function cargar() {
  try {
    datos = await cargarSueno(userId);
    ultimaCarga = Date.now();
    pagina.mostrar("contenido");
    pintar(resumenSueno(datos, new Date()));
  } catch (error) {
    pagina.manejarError(error);
  }
}

function pintar(nuevo) {
  const firma = JSON.stringify(nuevo);
  if (firma === pintado) return;
  const animar = primeraVez;
  primeraVez = false;
  pintado = firma;
  resumen = nuevo;

  pintarCabecera(nuevo);
  pintarAnoche(nuevo, animar);
  pintarSemana(nuevo, animar);
  pintarRegularidad(nuevo, animar);
  pintarEstado();
  if (animar) entradas();
}

// ── Textos de apoyo ──────────────────────────────────────────────────────

/** Fecha de calendario (sin el corte de las 04:00) de un momento. */
function fechaDe(t) {
  return diaLogico(new Date(t + 4 * HORA_MS));
}

/** "jue 02 oct" */
function diaCorto(fecha) {
  return `${nombreDia(fecha).slice(0, 3)} ${diaYMes(fecha)}`;
}

/** "hoy 06:05" · "ayer 23:40" · "lun 28 sep · 23:40" */
function cuando(iso) {
  const t = Date.parse(iso);
  const hoy = fechaDe(Date.now());
  const fecha = fechaDe(t);
  if (fecha === hoy) return `hoy ${horaDe(t)}`;
  if (fecha === sumarDias(hoy, -1)) return `ayer ${horaDe(t)}`;
  return `${diaCorto(fecha)} · ${horaDe(t)}`;
}

/** Número que cuenta desde 0 (1,4 s, frenando al final); `alPintar(n)` lo escribe. */
function animarNumero(valor, alPintar) {
  if (reducirMovimiento() || valor === 0) return alPintar(valor);
  const inicio = performance.now();
  const paso = (ahora) => {
    const t = limitar((ahora - inicio) / 1400, 0, 1);
    alPintar(Math.round(valor * (1 - Math.pow(1 - t, 4))));
    if (t < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

function pintarCabecera(r) {
  const noche = r.ultimaNoche;
  const metaMin = r.metas.sueno_horas * 60;
  let texto = "Aún no hay noches. Los atajos 🌙 y ☀️ las anotan solas; también puedes anotarla a mano.";
  if (noche && !noche.completa) {
    const falta = noche.acostarse ? "te levantaste" : "te acostaste";
    texto = `${noche.etiqueta} quedó a medias: falta la hora en que ${falta}.`;
  } else if (noche) {
    const dijo = noche.etiqueta === "Anoche" ? "Anoche" : `El ${nombreDia(noche.fecha)}`;
    const diferencia = noche.duracionMin - metaMin;
    texto =
      diferencia >= 0
        ? `${dijo} dormiste ${duracionCorta(noche.duracionMin)}: cumpliste tu meta.`
        : `${dijo} dormiste ${duracionCorta(noche.duracionMin)}, ${duracionCorta(-diferencia)} menos que tu meta.`;
  }
  $("cabecera-texto").textContent = texto;
}

// ── 1. Anoche ────────────────────────────────────────────────────────────

function ponerHora(elemento, iso) {
  elemento.textContent = iso ? horaDe(iso) : "—";
  elemento.classList.toggle("falta", !iso);
}

function pintarAnoche(r, animar) {
  const noche = r.ultimaNoche;
  $("anoche-vacia").hidden = Boolean(noche);
  $("anoche-rejilla").hidden = !noche;
  $("anoche-etiqueta").textContent = noche?.etiqueta ?? "Anoche";
  $("anoche-fecha").textContent = noche ? diaCorto(noche.fecha) : "";

  if (noche) {
    $("anoche-duracion").hidden = !noche.completa;
    $("anoche-sin-duracion").hidden = noche.completa;
    if (noche.completa) pintarDuracion(noche.duracionMin, animar);
    ponerHora($("anoche-acostarse"), noche.acostarse);
    ponerHora($("anoche-despertar"), noche.despertar);

    // Si a la última noche le falta una hora, se ofrece anotarla (solo si fue anoche).
    const falta = !noche.completa && noche.etiqueta === "Anoche" ? (noche.acostarse ? "despertar" : "acostarse") : null;
    const boton = $("anoche-falta");
    boton.hidden = !falta;
    if (falta) {
      boton.dataset.tipo = falta;
      boton.textContent = falta === "despertar" ? "Anota a qué hora te levantaste" : "Anota a qué hora te acostaste";
    }

    $("anoche-celular").hidden = !noche.celularMin;
    if (noche.celularMin) {
      $("anoche-celular").textContent = `📱 Dejaste el celular ${duracionCorta(noche.celularMin)} después de que empezó tu hora de dormir.`;
    }

    const fuentes = [...new Set([noche.fuente, noche.fuenteDespertar].filter(Boolean).map((f) => NOMBRE_FUENTE[f] ?? f))];
    $("anoche-fuente").textContent = fuentes.length ? `Llegó por: ${fuentes.join(" · ")}` : "";
  }

  pintarIndice(r.indice, animar);

  const estaNoche = $("esta-noche");
  estaNoche.hidden = !r.enCurso;
  if (r.enCurso) {
    estaNoche.textContent = `🌙 Esta noche te acostaste a las ${horaDe(r.enCurso.acostarse)}. Mañana verás cuánto dormiste.`;
  }
}

function pintarDuracion(minutos, animar) {
  $("duracion-lector").textContent = duracionCorta(minutos);
  const escribir = (valor) => {
    $("duracion-h").textContent = String(Math.floor(valor / 60));
    $("duracion-m").textContent = String(valor % 60).padStart(2, "0");
  };
  if (!animar) return escribir(minutos);
  escribir(0);
  alVerse($("anoche-duracion"), () => animarNumero(minutos, escribir));
}

function pintarIndice(indice, animar) {
  const valor = $("indice-valor");
  const circulo = $("indice-progreso");
  const largo = 2 * Math.PI * RADIO_INDICE;
  const avance = indice.valor === null ? 0 : limitar(indice.valor / 100, 0, 1);
  const final = `${largo * (1 - avance)}`;
  $("indice-frase").textContent = indice.frase;
  circulo.style.strokeDasharray = `${largo}`;
  circulo.classList.toggle("vacio", avance === 0);

  if (!animar || indice.valor === null) {
    valor.textContent = indice.valor === null ? "—" : String(indice.valor);
    circulo.style.strokeDashoffset = final;
    return;
  }
  valor.textContent = "0";
  circulo.style.strokeDashoffset = `${largo}`;
  alVerse(circulo.closest(".indice"), () =>
    requestAnimationFrame(() => {
      circulo.style.strokeDashoffset = final;
      animarNumero(indice.valor, (n) => (valor.textContent = String(n)));
    }),
  );
}

// ── 2. Semana ────────────────────────────────────────────────────────────

/** Hora "desde mediodía" de un "HH:MM" (22:30 → 22,5 · 01:00 → 25). */
function horaEje(texto) {
  const [h, m] = texto.split(":").map(Number);
  const decimal = h + m / 60;
  return decimal < 12 ? decimal + 24 : decimal;
}

function pintarSemana(r, animar) {
  const { eje, semana, metas } = r;
  const rango = eje.hasta - eje.desde;
  const pos = (h) => limitar(((h - eje.desde) / rango) * 100, 0, 100);

  const marcas = [];
  const lineas = [];
  for (let h = eje.desde, i = 0; h <= eje.hasta; h += 2, i++) {
    const marca = clonar("plantilla-marca");
    marca.textContent = `${String(h % 24).padStart(2, "0")}:00`;
    marca.style.setProperty("--x", pos(h).toFixed(2));
    marca.classList.toggle("impar", i % 2 === 1);
    marcas.push(marca);
    const linea = clonar("plantilla-guia-linea");
    linea.style.setProperty("--x", pos(h).toFixed(2));
    lineas.push(linea);
  }
  const meta = clonar("plantilla-guia-linea");
  meta.classList.add("meta");
  meta.style.setProperty("--x", pos(horaEje(metas.hora_acostarse)).toFixed(2));
  lineas.push(meta);
  $("grafica-eje").replaceChildren(...marcas);
  $("grafica-guias").replaceChildren(...lineas);
  $("leyenda-meta").textContent = metas.hora_acostarse;
  $("semana-promedio").textContent = r.promedios.duracionMin === null ? "" : `Promedio ${duracionCorta(r.promedios.duracionMin)}`;

  const resaltada = r.enCurso?.fecha ?? r.ultimaNoche?.fecha;
  $("leyenda-ultima").hidden = !semana.some((fila) => fila.fecha === resaltada);
  $("leyenda-ultima-texto").textContent = r.enCurso ? "Esta noche" : "Última noche";
  $("grafica-filas").replaceChildren(
    ...semana.map((fila, i) => {
      const item = clonar("plantilla-noche");
      const barra = item.querySelector(".noche-barra");
      const nombre = `${nombreDia(fila.fecha)} ${diaYMes(fila.fecha)}`;
      const noche = fila.noche;
      let duracion = "—";
      let lector = `${nombre}: sin datos`;

      item.querySelector(".noche-dia-nombre").textContent = fila.dia;
      item.querySelector(".noche-dia-numero").textContent = fila.fecha.slice(8);
      item.classList.toggle("ultima", fila.fecha === resaltada);
      item.classList.toggle("en-curso", fila.enCurso);
      barra.style.setProperty("--i", i);

      if (fila.desdeH !== null && fila.hastaH !== null) {
        barra.style.setProperty("--desde", pos(fila.desdeH).toFixed(2));
        barra.style.setProperty("--ancho", (pos(fila.hastaH) - pos(fila.desdeH)).toFixed(2));
        if (fila.enCurso) {
          duracion = "ahora";
          lector = `${nombre}: te acostaste a las ${horaDe(noche.acostarse)}, noche en curso`;
        } else {
          duracion = duracionCorta(noche.duracionMin);
          lector = `${nombre}: de ${horaDe(noche.acostarse)} a ${horaDe(noche.despertar)}, ${duracion}`;
        }
      } else if (fila.desdeH !== null || fila.hastaH !== null) {
        item.classList.add("punto");
        barra.style.setProperty("--desde", pos(fila.desdeH ?? fila.hastaH).toFixed(2));
        lector = noche.acostarse
          ? `${nombre}: te acostaste a las ${horaDe(noche.acostarse)}, falta la hora en que te levantaste`
          : `${nombre}: te levantaste a las ${horaDe(noche.despertar)}, falta la hora en que te acostaste`;
      } else item.classList.add("vacia");

      item.querySelector(".noche-duracion").textContent = duracion;
      item.querySelector(".noche-lector").textContent = lector;
      return item;
    }),
  );

  const grafica = $("grafica");
  if (animar) alVerse(grafica, () => grafica.classList.add("visto"));
  else grafica.classList.add("visto");
}

// ── 3. Regularidad, promedios y partes del índice ────────────────────────

function fraseRegularidad(reg) {
  const sd = reg.acostarseMin;
  let frase =
    sd <= 30
      ? "Te acuestas casi a la misma hora. Así el cuerpo se acostumbra."
      : sd <= 60
        ? "Tu hora de dormir se mueve un poco de una noche a otra."
        : sd <= 90
          ? "Tu hora de dormir cambia bastante; una hora fija ayuda."
          : "Cada noche te acuestas a una hora distinta. Elige una y repítela.";
  if (reg.despertarMin !== null) frase += ` Al levantarte, ±${duracionCorta(reg.despertarMin)}.`;
  return frase;
}

function pintarRegularidad(r, animar) {
  const reg = r.regularidad;
  const sinDatos = reg.acostarseMin === null;
  $("regularidad-valor").textContent = sinDatos ? "—" : `±${duracionCorta(reg.acostarseMin)}`;
  $("regularidad-nombre").textContent = sinDatos ? "Faltan noches." : `${reg.texto}.`;
  $("regularidad-detalle").textContent = sinDatos
    ? `Con 3 noches verás cuánto cambia tu hora de dormir (llevas ${reg.noches}).`
    : fraseRegularidad(reg);

  const p = r.promedios;
  $("promedio-acostarse").textContent = p.acostarse ?? "—";
  $("promedio-despertar").textContent = p.despertar ?? "—";
  $("promedio-duracion").textContent = p.duracionMin === null ? "—" : duracionCorta(p.duracionMin);
  const m = r.metas;
  $("promedios-nota").textContent =
    `${p.noches} ${p.noches === 1 ? "noche completa" : "noches completas"} en 7 días. ` +
    `Tus metas: ${duracionCorta(m.sueno_horas * 60)} de sueño, a la cama a las ${m.hora_acostarse} y arriba a las ${m.hora_despertar}.`;

  const partes = document.querySelectorAll("[data-parte]");
  partes.forEach((parte) => {
    const valor = r.indice.partes?.[parte.dataset.parte] ?? null;
    parte.querySelector(".parte-valor").textContent = valor === null ? "—" : String(valor);
    parte.classList.toggle("sin-dato", valor === null);
    const relleno = parte.querySelector(".progreso-relleno");
    const llenar = () => (relleno.style.transform = `scaleX(${valor === null ? 0 : valor / 100})`);
    if (animar) alVerse(parte, llenar);
    else llenar();
  });
}

// ── 5. Estado de los atajos y guías ──────────────────────────────────────

function pintarEstado() {
  const automaticos = datos.eventos.filter((e) => e.fuente !== "manual");
  const ultimo = automaticos.at(-1);
  $("estado-evento").textContent = ultimo
    ? `${ultimo.tipo === "acostarse" ? "🌙" : "☀️"} ${NOMBRE_FUENTE[ultimo.fuente] ?? ultimo.fuente} · ${cuando(ultimo.momento)}`
    : "Todavía ninguno. Arma los atajos de abajo.";
  const salud = datos.muestras.reduce((ultima, m) => (!ultima || m.creado_en > ultima.creado_en ? m : ultima), null);
  $("estado-salud").textContent = salud?.creado_en ? cuando(salud.creado_en) : "Todavía no. Llega con ☀️ Desperté.";
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

function pintarGuias() {
  $("guias").replaceChildren(
    ...ATAJOS.map((atajo) => {
      const guia = clonar("plantilla-guia");
      guia.querySelector(".guia-emoji").textContent = atajo.emoji;
      guia.querySelector(".guia-nombre").textContent = atajo.nombre;
      guia.querySelector(".guia-para").textContent = atajo.para;
      const requisitos = atajo.requisitos ?? [];
      guia.querySelector(".guia-requisitos-bloque").hidden = requisitos.length === 0;
      llenarLista(guia.querySelector(".guia-requisitos"), requisitos);
      llenarLista(guia.querySelector(".guia-pasos"), atajo.pasos);

      const automatizaciones = atajo.automatizaciones ?? (atajo.automatizacion ? [atajo.automatizacion] : []);
      guia.querySelector(".guia-automatizaciones").replaceChildren(
        ...automatizaciones.map((auto) => {
          const bloque = clonar("plantilla-automatizacion");
          bloque.querySelector(".guia-disparador").textContent = auto.disparador;
          llenarLista(bloque.querySelector(".guia-pasos"), auto.pasos);
          return bloque;
        }),
      );

      const permisos = atajo.permisos ?? [];
      guia.querySelector(".guia-permisos-bloque").hidden = permisos.length === 0;
      llenarLista(guia.querySelector(".guia-permisos"), permisos);
      return guia;
    }),
  );
}

/** Cada bloque entra suave cuando aparece en pantalla (solo la primera vez). */
function entradas() {
  document.querySelectorAll("#contenido .seccion").forEach((seccion) => {
    const hijos = [...seccion.children];
    hijos.forEach((hijo, i) => {
      hijo.classList.add("aparece");
      hijo.style.setProperty("--i", i);
    });
    alVerse(seccion, () => hijos.forEach((hijo) => hijo.classList.add("visto")), "0px 0px -5% 0px");
  });
}

// ── Registro a mano ──────────────────────────────────────────────────────

/** Qué ofrecer al tocar "＋ Anotar": lo que le falte a anoche, o según la hora. */
function sugerirTipo() {
  const noche = resumen?.ultimaNoche;
  if (noche && !noche.completa && noche.etiqueta === "Anoche") return noche.acostarse ? "despertar" : "acostarse";
  const hora = Number(horaDe(new Date()).slice(0, 2));
  return hora >= 4 && hora < 15 ? "despertar" : "acostarse";
}

function abrirEvento(tipoEvento) {
  formMetas.hidden = true;
  formEvento.hidden = false;
  tipo.poner(tipoEvento);
  prepararHora(tipoEvento);
  hoja.abrir();
}

/** Hora sugerida: ahora si cuadra con lo que anotas; si no, la de anoche o tu meta. */
function prepararHora(tipoEvento) {
  const acostarse = tipoEvento === "acostarse";
  $("hoja-titulo").textContent = acostarse ? "Me acosté." : "Me levanté.";
  $("hora-etiqueta").textContent = acostarse ? "Me acosté a las" : "Me levanté a las";
  const ahora = horaDe(new Date());
  const hora = Number(ahora.slice(0, 2));
  const noche = resumen?.ultimaNoche?.etiqueta === "Anoche" ? resumen.ultimaNoche : null;
  const metas = resumen?.metas ?? { hora_acostarse: "22:30", hora_despertar: "06:00" };
  if (acostarse) {
    const deNoche = hora >= 18 || hora < 4;
    entradaHora.value = deNoche ? ahora : noche?.acostarse ? horaDe(noche.acostarse) : metas.hora_acostarse;
  } else {
    const deManana = hora >= 4 && hora < 15;
    entradaHora.value = deManana ? ahora : noche?.despertar ? horaDe(noche.despertar) : metas.hora_despertar;
  }
  mostrarCuando();
}

/** "Ayer · jueves 02 oct · noche del jueves": así sabes a qué noche va. */
function mostrarCuando() {
  const elegido = momentoDesdeHora(entradaHora.value, new Date());
  if (!elegido) {
    $("hora-cuando").textContent = "";
    return;
  }
  const t = elegido.momento.getTime();
  const fecha = fechaDe(t);
  const noche = tipo.valor === "acostarse" ? diaLogico(elegido.momento) : sumarDias(diaLogico(elegido.momento), -1);
  $("hora-cuando").textContent = `${elegido.cuando === "hoy" ? "Hoy" : "Ayer"} · ${nombreDia(fecha)} ${diaYMes(fecha)} · noche del ${nombreDia(noche)}`;
}

async function guardarMomento(momento) {
  if (guardando || !tipo.valor) return;
  guardando = true;
  formEvento.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    const guardado = await guardarEvento(tipo.valor, momento);
    if (!guardado) return avisar("⚠️ No se pudo guardar");
    hoja.cerrar();
    avisar(tipo.valor === "acostarse" ? "🌙 Guardado" : "☀️ Guardado");
    await cargar();
  } catch (error) {
    pagina.manejarError(error);
  } finally {
    guardando = false;
    formEvento.querySelectorAll("button").forEach((b) => (b.disabled = false));
  }
}

function abrirMetas() {
  const metas = resumen?.metas ?? { sueno_horas: 7.5, hora_acostarse: "22:30", hora_despertar: "06:00" };
  formEvento.hidden = true;
  formMetas.hidden = false;
  $("hoja-titulo").textContent = "Tus metas.";
  horas.poner(String(metas.sueno_horas));
  formMetas.elements.hora_acostarse.value = metas.hora_acostarse;
  formMetas.elements.hora_despertar.value = metas.hora_despertar;
  hoja.abrir();
}

async function guardarLasMetas() {
  if (guardando) return;
  const metas = {
    sueno_horas: Number(horas.valor ?? resumen?.metas.sueno_horas ?? 7.5),
    hora_acostarse: formMetas.elements.hora_acostarse.value,
    hora_despertar: formMetas.elements.hora_despertar.value,
  };
  if (!metas.hora_acostarse || !metas.hora_despertar) return avisar("⚠️ Escribe las dos horas");
  guardando = true;
  try {
    await guardarMetas(metas);
    hoja.cerrar();
    avisar("🎯 Metas guardadas");
    await cargar();
  } catch (error) {
    pagina.manejarError(error);
  } finally {
    guardando = false;
  }
}
