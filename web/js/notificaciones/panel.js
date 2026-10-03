// Centro de notificaciones estilo iOS (se abre con la 🔔 de Hoy). Se arma por código con createElement
// y textContent (nada de innerHTML) y se monta en <body>. Estilos en css/notificaciones.css.
//   - Baja desde arriba con vidrio desenfocado; se cierra deslizando la manija hacia arriba, con Esc o "Cerrar".
//   - Hora y fecha grandes, secciones Hoy · Esta semana · Antes, pilas por módulo que se expanden con resorte.
//   - Deslizar a la izquierda revela "Ver" y "Borrar"; deslizar del todo borra. ⓧ de cada sección → "Borrar todo".
//   - Mientras está abierto, lo de atrás queda inerte ([data-fondo-hoja]: Hoy y el dock).

import { MODULOS, agrupar, fechaLarga, nombreModulo, tiempoRelativo } from "./logica.js";
import { horaBogota } from "../logica/dia.js";
import { reducirMovimiento } from "../piezas/ui.js";

/** Elemento con clase y texto (siempre textContent). */
function el(etiqueta, clase = "", texto = null, atributos = {}) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== null) nodo.textContent = texto;
  for (const [nombre, valor] of Object.entries(atributos)) nodo.setAttribute(nombre, valor);
  return nodo;
}

/** Ícono ✕ en SVG (sin innerHTML). */
function iconoX() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("nc-x");
  const trazo = document.createElementNS(ns, "path");
  trazo.setAttribute("d", "M6 6l12 12M18 6L6 18");
  svg.append(trazo);
  return svg;
}

const esperar = (ms) => new Promise((listo) => window.setTimeout(listo, reducirMovimiento() ? Math.min(ms, 220) : ms));
const sinRuta = (ruta) => ruta.replace(/index\.html$/, "");

/** Escalas y desplazamientos de las tarjetas "fantasma" de una pila cerrada (iguales a notificaciones.css). */
const ESCALA_FANTASMA = [1, 0.955, 0.91];

/**
 * `boton`: la campana (recibe el foco al cerrar).
 * `alTocar(ids)`: marcar leídas · `alBorrar(ids)`: descartar · `alCerrar(idsVistas)`: lo visto deja de contar.
 * Devuelve { abrir(lista), cerrar(), actualizar(lista), abierto }.
 */
export function crearPanel({ boton, alTocar, alBorrar, alCerrar }) {
  let lista = [];
  let abierto = false;
  let focoPrevio = null;
  let relojTemporizador = null;
  let fondos = [];
  const abiertas = new Set(); // Pilas expandidas ("hoy:finanzas").
  const vistas = new Set(); // Ids que se vieron mientras estuvo abierto.
  let ocupado = 0; // Gestos o animaciones en curso: los cambios de afuera esperan.
  let pendiente = null;

  // ── Esqueleto ──────────────────────────────────────────────────────────
  const raiz = el("div", "nc", null, { role: "dialog", "aria-modal": "true", "aria-labelledby": "nc-titulo", tabindex: "-1" });
  const hoja = el("div", "nc-hoja");
  const desplazable = el("div", "nc-desplazable sin-scrollbar");
  const contenido = el("div", "nc-contenido");

  const reloj = el("header", "nc-reloj");
  const fecha = el("p", "nc-fecha");
  const hora = el("p", "nc-hora cifras");
  const horaTexto = el("span", "nc-hora-texto");
  hora.append(horaTexto);
  reloj.append(fecha, hora);

  const barra = el("div", "nc-barra");
  const titulo = el("h2", "titular nc-titulo", "Notificaciones", { id: "nc-titulo" });
  const cerrarBoton = el("button", "nc-boton-vidrio nc-cerrar", "Cerrar", { type: "button" });
  barra.append(titulo, cerrarBoton);

  const listaEl = el("div", "nc-lista");
  const vacio = el("p", "nc-vacio", "Sin notificaciones");
  const ayuda = el("p", "solo-lector", "Toca para abrir. Desliza a la izquierda o pulsa Suprimir para borrar.", { id: "nc-ayuda" });
  const anuncio = el("p", "solo-lector", null, { "aria-live": "polite" });
  contenido.append(reloj, barra, listaEl, vacio, ayuda, anuncio);
  desplazable.append(contenido);

  const manija = el("div", "nc-manija", null, { "aria-hidden": "true" });
  manija.append(el("span"));
  hoja.append(desplazable, manija);
  raiz.append(hoja);
  document.body.append(raiz);

  // ── Abrir y cerrar ─────────────────────────────────────────────────────

  function abrir(nuevaLista) {
    if (abierto) return actualizar(nuevaLista);
    lista = nuevaLista ?? [];
    abierto = true;
    focoPrevio = document.activeElement;
    vistas.clear();
    pintar();
    pintarReloj();
    desplazable.scrollTop = 0;

    fondos = [...document.querySelectorAll("[data-fondo-hoja]")];
    fondos.forEach((f) => (f.inert = true));
    document.documentElement.classList.add("nc-bloqueo");

    raiz.classList.add("entrando");
    void raiz.offsetWidth; // Primero se pinta arriba (fuera de la pantalla) y luego baja.
    raiz.classList.add("abierto");
    raiz.focus({ preventScroll: true });
    relojTemporizador = window.setInterval(() => {
      pintarReloj();
      refrescarTiempos();
    }, 15_000);
    window.setTimeout(() => raiz.classList.remove("entrando"), 1400);
  }

  function cerrar({ devolverFoco = true } = {}) {
    if (!abierto) return;
    abierto = false;
    cancelarConfirmacion();
    cerrarRevelada();
    raiz.classList.remove("abierto", "entrando");
    hoja.style.removeProperty("--arrastre");
    window.clearInterval(relojTemporizador);
    fondos.forEach((f) => (f.inert = false));
    document.documentElement.classList.remove("nc-bloqueo");
    if (devolverFoco) {
      const previo = focoPrevio?.isConnected && focoPrevio !== document.body ? focoPrevio : boton;
      previo?.focus?.({ preventScroll: true });
    }
    alCerrar?.([...vistas]);
  }

  /** Lo que cambia lo que se ve: si la firma es igual, no se repinta (no reinicia animaciones). */
  const firma = (l) => l.map((n) => `${n.id}|${n.leida_en ? 1 : 0}|${n.descartada_en ? 1 : 0}`).join(",");

  /** Lista nueva desde afuera (reglas, atajos). Si estás deslizando o algo se está animando, espera. */
  function actualizar(nuevaLista) {
    if (ocupado > 0) {
      pendiente = nuevaLista;
      return;
    }
    const nueva = nuevaLista ?? [];
    const cambio = firma(nueva) !== firma(lista);
    lista = nueva;
    if (abierto && cambio) pintar();
  }

  function soltarOcupado() {
    ocupado = Math.max(0, ocupado - 1);
    if (ocupado === 0 && pendiente) {
      const siguiente = pendiente;
      pendiente = null;
      actualizar(siguiente);
    }
  }

  cerrarBoton.addEventListener("click", () => cerrar());

  raiz.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
      evento.preventDefault();
      if (confirmando) return cancelarConfirmacion(true);
      if (revelada) return cerrarRevelada();
      return cerrar();
    }
    if ((evento.key === "Delete" || evento.key === "Backspace") && evento.target.closest?.(".nc-tarjeta")) {
      evento.preventDefault();
      borrarUnidad(unidadDe(evento.target.closest(".nc-item")), { teclado: true });
    }
  });

  // Deslizar la manija hacia arriba cierra (como el centro de notificaciones del iPhone).
  let arrastre = null;
  manija.addEventListener("pointerdown", (evento) => {
    arrastre = { y: evento.clientY, t: performance.now() };
    try {
      manija.setPointerCapture(evento.pointerId);
    } catch {
      // Sin captura: igual sigue al dedo mientras esté encima.
    }
    hoja.classList.add("arrastrando");
  });
  manija.addEventListener("pointermove", (evento) => {
    if (!arrastre) return;
    const subida = Math.min(0, evento.clientY - arrastre.y);
    hoja.style.setProperty("--arrastre", `${subida}px`);
  });
  const soltarManija = (evento) => {
    if (!arrastre) return;
    const subida = Math.min(0, evento.clientY - arrastre.y);
    const velocidad = subida / Math.max(performance.now() - arrastre.t, 1);
    arrastre = null;
    hoja.classList.remove("arrastrando");
    if (subida < -90 || velocidad < -0.5) cerrar();
    else hoja.style.removeProperty("--arrastre");
  };
  manija.addEventListener("pointerup", soltarManija);
  manija.addEventListener("pointercancel", soltarManija);

  // ── Pintar ─────────────────────────────────────────────────────────────

  function pintarReloj() {
    const ahora = new Date();
    fecha.textContent = fechaLarga(ahora);
    horaTexto.textContent = horaBogota(ahora);
  }

  function refrescarTiempos() {
    const ahora = new Date();
    listaEl.querySelectorAll("time[data-momento]").forEach((t) => (t.textContent = tiempoRelativo(t.dataset.momento, ahora)));
  }

  function pintar() {
    const ahora = new Date();
    const secciones = agrupar(lista, ahora);
    // Las pilas que ya no existen dejan de estar "abiertas".
    const existentes = new Set(secciones.flatMap((s) => s.pilas.map((p) => p.id)));
    for (const id of [...abiertas]) if (!existentes.has(id)) abiertas.delete(id);

    let orden = 0;
    listaEl.replaceChildren(
      ...secciones.map((seccion) => {
        const nodo = crearSeccion(seccion, () => orden++, ahora);
        return nodo;
      }),
    );
    vacio.hidden = secciones.length > 0;
    for (const s of secciones) for (const p of s.pilas) for (const n of p.items) vistas.add(n.id);
  }

  function crearSeccion(seccion, siguiente, ahora) {
    const nodo = el("section", "nc-seccion", null, { "aria-labelledby": `nc-seccion-${seccion.clave}` });
    nodo.dataset.seccion = seccion.clave;
    const cabeza = el("div", "nc-seccion-cabeza");
    cabeza.style.setProperty("--i", siguiente());
    const nombre = el("h3", "nc-seccion-titulo", seccion.titulo, { id: `nc-seccion-${seccion.clave}` });
    const borrar = el("button", "nc-boton-vidrio nc-borrar", null, { type: "button", "aria-label": `Borrar todas: ${seccion.titulo}` });
    borrar.dataset.titulo = seccion.titulo;
    borrar.append(iconoX(), el("span", "nc-borrar-texto", "Borrar todo"));
    cabeza.append(nombre, borrar);

    const pilas = el("ul", "nc-pilas");
    pilas.append(...seccion.pilas.map((pila) => crearPila(pila, siguiente(), ahora)));
    nodo.append(cabeza, pilas);
    return nodo;
  }

  function crearPila(pila, indice, ahora) {
    const multiple = pila.items.length > 1;
    const abierta = multiple && abiertas.has(pila.id);
    const nodo = el("li", "nc-pila");
    nodo.dataset.pila = pila.id;
    nodo.classList.toggle("multiple", multiple);
    nodo.classList.toggle("abierta", abierta);
    nodo.classList.toggle("tres", pila.items.length > 2);
    nodo.style.setProperty("--i", indice);

    if (multiple) {
      const cabeza = el("div", "nc-pila-cabeza");
      cabeza.append(
        el("h4", "nc-pila-nombre", pila.nombre),
        el("button", "nc-boton-vidrio nc-menos", "Mostrar menos", { type: "button" }),
      );
      nodo.append(cabeza);
    }

    const cuerpo = el("div", "nc-pila-cuerpo");
    if (multiple) {
      cuerpo.classList.add("nc-deslizable");
      cuerpo.append(crearAcciones("Ver todas"));
    }
    const tarjetas = el("ul", "nc-tarjetas nc-movil");
    tarjetas.append(...pila.items.map((n, i) => crearItem(n, i, pila, ahora)));
    cuerpo.append(tarjetas);
    nodo.append(cuerpo);
    ajustarAccesibilidad(nodo);
    return nodo;
  }

  function crearAcciones(textoVer = "Ver") {
    const acciones = el("div", "nc-acciones", null, { "aria-hidden": "true" });
    acciones.append(
      el("button", "nc-accion", textoVer, { type: "button", tabindex: "-1", "data-accion": "ver" }),
      el("button", "nc-accion", "Borrar", { type: "button", tabindex: "-1", "data-accion": "borrar" }),
    );
    return acciones;
  }

  function crearItem(n, indice, pila, ahora) {
    const item = el("li", "nc-item nc-deslizable");
    item.dataset.id = n.id;
    item.classList.toggle("nueva", !n.leida_en);

    const tarjeta = el("button", "nc-tarjeta nc-movil", null, { type: "button", "aria-describedby": "nc-ayuda" });
    const icono = el("span", "nc-icono", n.emoji || MODULOS[n.modulo]?.emoji || "🔔", { "aria-hidden": "true" });
    const texto = el("span", "nc-texto");

    const meta = el("span", "nc-meta");
    const modulo = el("span", "nc-modulo", nombreModulo(n.modulo));
    const lado = el("span", "nc-lado");
    if (!n.leida_en) lado.append(el("span", "nc-punto", null, { "aria-hidden": "true" }), el("span", "solo-lector", "Sin leer."));
    const tiempo = el("time", "nc-tiempo", tiempoRelativo(n.momento, ahora), { datetime: n.momento });
    tiempo.dataset.momento = n.momento;
    lado.append(tiempo);
    meta.append(modulo, lado);

    texto.append(meta, el("span", "nc-titulo-tarjeta", n.titulo));
    if (n.cuerpo) texto.append(el("span", "nc-cuerpo", n.cuerpo));
    if (indice === 0 && pila.items.length > 1) {
      const mas = pila.items.length - 1;
      texto.append(el("span", "nc-mas", `${mas} más`));
    }
    tarjeta.append(icono, texto);
    item.append(crearAcciones(), tarjeta);
    return item;
  }

  /** En una pila cerrada solo la primera tarjeta se enfoca y se lee; las de atrás son decoración. */
  function ajustarAccesibilidad(pilaEl) {
    if (!pilaEl.classList.contains("multiple")) return;
    const cerrada = !pilaEl.classList.contains("abierta");
    const items = [...pilaEl.querySelectorAll(".nc-item")];
    items.forEach((item, i) => {
      const fantasma = cerrada && i > 0;
      item.inert = fantasma;
      if (fantasma) item.setAttribute("aria-hidden", "true");
      else item.removeAttribute("aria-hidden");
    });
    items[0]?.querySelector(".nc-tarjeta")?.setAttribute("aria-expanded", String(!cerrada));
  }

  // ── Expandir y cerrar pilas (FLIP con resorte) ─────────────────────────

  function alternarPila(pilaEl, { enfocar = false } = {}) {
    const abrirla = !pilaEl.classList.contains("abierta");
    const id = pilaEl.dataset.pila;
    if (abrirla) abiertas.add(id);
    else abiertas.delete(id);

    if (reducirMovimiento()) {
      pilaEl.classList.toggle("abierta", abrirla);
      ajustarAccesibilidad(pilaEl);
      if (enfocar) enfocarPila(pilaEl, abrirla);
      return;
    }

    const items = [...pilaEl.querySelectorAll(".nc-item")];
    const otros = [...listaEl.querySelectorAll(".nc-pila, .nc-seccion-cabeza")].filter((x) => x !== pilaEl);
    const antes = new Map([...items, ...otros].map((x) => [x, x.getBoundingClientRect()]));

    pilaEl.classList.toggle("abierta", abrirla);
    ajustarAccesibilidad(pilaEl);

    for (const x of otros) {
      const dy = antes.get(x).top - x.getBoundingClientRect().top;
      if (Math.abs(dy) < 0.5) continue;
      x.classList.add("sin-transicion");
      x.style.setProperty("--dy-pila", `${dy}px`);
    }
    items.forEach((x, i) => {
      const despues = x.getBoundingClientRect();
      const s = ESCALA_FANTASMA[Math.min(i, 2)];
      let dy;
      if (abrirla) {
        // Arranca donde estaba (encogida y abajo) y crece hasta su lugar. Origen de la escala: abajo al centro.
        dy = antes.get(x).top - despues.top - despues.height * (1 - s);
        x.style.setProperty("--escala", String(s));
      } else {
        // Arranca a tamaño completo donde estaba y se mete detrás de la primera.
        const alto = despues.height / s;
        dy = antes.get(x).top - (despues.top - alto * (1 - s));
        x.style.setProperty("--escala", "1");
      }
      x.classList.add("sin-transicion");
      x.style.setProperty("--dy-item", `${dy}px`);
    });

    void listaEl.offsetHeight; // Fija el punto de partida antes de animar.
    ocupado++;
    for (const x of [...otros, ...items]) {
      x.classList.remove("sin-transicion");
      x.style.removeProperty("--dy-pila");
      x.style.removeProperty("--dy-item");
      x.style.removeProperty("--escala");
    }
    window.setTimeout(soltarOcupado, 600);
    if (enfocar) enfocarPila(pilaEl, abrirla);
  }

  function enfocarPila(pilaEl, abierta) {
    const destino = abierta ? pilaEl.querySelector(".nc-menos") : pilaEl.querySelector(".nc-tarjeta");
    destino?.focus({ preventScroll: true });
  }

  // ── Deslizar para borrar ───────────────────────────────────────────────

  let revelada = null; // Unidad con "Ver · Borrar" a la vista.
  let gesto = null;
  let ignorarClic = false;

  /** Lo que se desliza: la pila entera si está cerrada, o una tarjeta. */
  function unidadDe(item) {
    if (!item) return null;
    const pila = item.closest(".nc-pila");
    if (pila?.classList.contains("multiple") && !pila.classList.contains("abierta")) return pila.querySelector(".nc-pila-cuerpo");
    return item;
  }

  const movilDe = (unidad) => unidad.querySelector(":scope > .nc-movil");
  const anchoAcciones = (unidad) => unidad.querySelector(":scope > .nc-acciones")?.offsetWidth || 148;

  function ponerX(unidad, x) {
    unidad.style.setProperty("--x", `${x}px`);
    unidad.style.setProperty("--revela", String(Math.min(1, Math.max(0, -x / anchoAcciones(unidad)))));
  }

  function revelar(unidad) {
    if (revelada && revelada !== unidad) cerrarRevelada();
    revelada = unidad;
    unidad.classList.add("revelando", "revelada");
    unidad.classList.remove("completo");
    ponerX(unidad, -anchoAcciones(unidad));
    unidad.querySelectorAll(":scope > .nc-acciones .nc-accion").forEach((b) => b.setAttribute("tabindex", "0"));
    unidad.querySelector(":scope > .nc-acciones")?.removeAttribute("aria-hidden");
  }

  function cerrarRevelada(unidad = revelada) {
    if (!unidad) return;
    unidad.classList.remove("revelada", "completo");
    ponerX(unidad, 0);
    unidad.querySelectorAll(":scope > .nc-acciones .nc-accion").forEach((b) => b.setAttribute("tabindex", "-1"));
    unidad.querySelector(":scope > .nc-acciones")?.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      if (unidad !== revelada || !unidad.classList.contains("revelada")) unidad.classList.remove("revelando");
    }, 450);
    if (unidad === revelada) revelada = null;
  }

  listaEl.addEventListener("pointerdown", (evento) => {
    if (evento.button !== 0 || evento.target.closest(".nc-acciones, .nc-pila-cabeza, .nc-seccion-cabeza")) return;
    const item = evento.target.closest(".nc-item");
    const unidad = unidadDe(item);
    if (!unidad) return;
    if (revelada && revelada !== unidad) cerrarRevelada();
    gesto = {
      unidad,
      id: evento.pointerId,
      x0: evento.clientX,
      y0: evento.clientY,
      t0: performance.now(),
      base: unidad === revelada ? -anchoAcciones(unidad) : 0,
      x: 0,
      horizontal: false,
    };
  });

  listaEl.addEventListener("pointermove", (evento) => {
    if (!gesto || evento.pointerId !== gesto.id) return;
    const dx = evento.clientX - gesto.x0;
    const dy = evento.clientY - gesto.y0;
    if (!gesto.horizontal) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        gesto = null; // Era scroll vertical: lo maneja el navegador.
        return;
      }
      gesto.horizontal = true;
      ocupado++;
      gesto.unidad.classList.add("arrastrando", "revelando");
      try {
        movilDe(gesto.unidad)?.setPointerCapture(evento.pointerId);
      } catch {
        // Sin captura: igual funciona mientras el dedo siga encima.
      }
    }
    let x = gesto.base + dx;
    if (x > 0) x *= 0.2; // A la derecha se resiste.
    gesto.x = x;
    ponerX(gesto.unidad, x);
    gesto.unidad.classList.toggle("completo", x < -gesto.unidad.clientWidth * 0.55);
  });

  function soltarGesto(evento) {
    if (!gesto || evento.pointerId !== gesto.id) return;
    const g = gesto;
    gesto = null;
    if (!g.horizontal) return;
    ignorarClic = true;
    window.setTimeout(() => (ignorarClic = false), 80);
    g.unidad.classList.remove("arrastrando");
    const velocidad = (g.x - g.base) / Math.max(performance.now() - g.t0, 1); // px por ms
    const ancho = g.unidad.clientWidth;
    if (evento.type !== "pointercancel" && (g.x < -ancho * 0.55 || (velocidad < -1.1 && g.x < -60))) borrarUnidad(g.unidad);
    else if (g.x < -40) revelar(g.unidad);
    else cerrarRevelada(g.unidad);
    soltarOcupado();
  }
  listaEl.addEventListener("pointerup", soltarGesto);
  listaEl.addEventListener("pointercancel", soltarGesto);

  /** Borra una tarjeta o una pila cerrada entera: sale por la izquierda y se cierra el hueco. */
  async function borrarUnidad(unidad, { teclado = false } = {}) {
    if (!unidad || unidad.classList.contains("borrando")) return;
    const pilaEl = unidad.closest(".nc-pila");
    const esPila = unidad.classList.contains("nc-pila-cuerpo");
    const objetivo = esPila || pilaEl.querySelectorAll(".nc-item").length === 1 ? pilaEl : unidad;
    const ids = (esPila ? [...pilaEl.querySelectorAll(".nc-item")] : [unidad]).map((x) => x.dataset.id);
    const siguienteFoco = teclado ? vecinoDe(objetivo) : null;

    unidad.classList.add("borrando");
    if (unidad === revelada) revelada = null;
    alBorrar?.(ids);
    anunciar(ids.length === 1 ? "Notificación borrada" : `${ids.length} notificaciones borradas`);

    ocupado++;
    if (reducirMovimiento()) {
      objetivo.classList.add("desvaneciendo");
      await esperar(200);
    } else {
      unidad.classList.add("revelando", "completo");
      ponerX(unidad, -(unidad.clientWidth + 60));
      await esperar(260);
      await colapsar(objetivo);
    }
    quitarDeLista(ids);
    soltarOcupado();
    if (ocupado === 0) pintar();
    if (teclado) {
      const vecina = siguienteFoco && listaEl.querySelector(`.nc-item[data-id="${CSS.escape(siguienteFoco)}"]`);
      const destino = vecina && !vecina.inert ? vecina.querySelector(".nc-tarjeta") : vecina?.closest(".nc-pila")?.querySelector(".nc-tarjeta");
      (destino ?? raiz).focus({ preventScroll: true });
    }
  }

  /** Cierra el hueco de un elemento que se va (alto → 0). */
  async function colapsar(nodo) {
    nodo.style.setProperty("height", `${nodo.offsetHeight}px`);
    void nodo.offsetHeight;
    nodo.classList.add("colapsando");
    await esperar(320);
  }

  /** Id de la tarjeta que recibe el foco después de borrar con el teclado (la siguiente, o la anterior). */
  function vecinoDe(nodo) {
    const todas = [...listaEl.querySelectorAll(".nc-tarjeta")].filter((t) => !t.closest("[inert]"));
    const propias = new Set(nodo.querySelectorAll(".nc-tarjeta"));
    const indice = todas.findIndex((t) => propias.has(t));
    const vecina =
      todas.slice(indice + 1).find((t) => !propias.has(t)) ?? todas.slice(0, Math.max(indice, 0)).reverse().find((t) => !propias.has(t));
    return vecina?.closest(".nc-item")?.dataset.id ?? null;
  }

  function quitarDeLista(ids) {
    const cuando = new Date().toISOString();
    const set = new Set(ids);
    lista = lista.map((n) => (set.has(n.id) ? { ...n, descartada_en: cuando } : n));
  }

  function anunciar(texto) {
    anuncio.textContent = "";
    window.setTimeout(() => (anuncio.textContent = texto), 30);
  }

  // ── Borrar todo (confirmación en línea, sin confirm()) ─────────────────

  let confirmando = null;
  let temporizadorConfirmar = null;

  function pedirConfirmacion(boton) {
    cancelarConfirmacion();
    confirmando = boton;
    boton.classList.add("confirmar");
    boton.setAttribute("aria-label", `Confirmar: borrar todas las de ${boton.dataset.titulo}`);
    anunciar("Toca otra vez para borrar todo");
    temporizadorConfirmar = window.setTimeout(() => cancelarConfirmacion(), 4000);
  }

  function cancelarConfirmacion(enfocar = false) {
    window.clearTimeout(temporizadorConfirmar);
    if (!confirmando) return;
    const boton = confirmando;
    confirmando = null;
    boton.classList.remove("confirmar");
    boton.setAttribute("aria-label", `Borrar todas: ${boton.dataset.titulo}`);
    if (enfocar) boton.focus({ preventScroll: true });
  }

  async function borrarSeccion(seccionEl) {
    cancelarConfirmacion();
    const ids = [...seccionEl.querySelectorAll(".nc-item")].map((x) => x.dataset.id);
    if (ids.length === 0) return;
    alBorrar?.(ids);
    anunciar(`${ids.length} ${ids.length === 1 ? "notificación borrada" : "notificaciones borradas"}`);
    ocupado++;
    seccionEl.classList.add("vaciando");
    await esperar(reducirMovimiento() ? 200 : 380);
    if (!reducirMovimiento()) await colapsar(seccionEl);
    quitarDeLista(ids);
    soltarOcupado();
    if (ocupado === 0) pintar();
    raiz.focus({ preventScroll: true });
  }

  // ── Toques ─────────────────────────────────────────────────────────────

  listaEl.addEventListener("click", (evento) => {
    if (ignorarClic) return;
    const objetivo = evento.target;

    const borrarTodo = objetivo.closest(".nc-borrar");
    if (borrarTodo) {
      if (confirmando === borrarTodo) borrarSeccion(borrarTodo.closest(".nc-seccion"));
      else pedirConfirmacion(borrarTodo);
      return;
    }
    cancelarConfirmacion();

    const menos = objetivo.closest(".nc-menos");
    if (menos) return alternarPila(menos.closest(".nc-pila"), { enfocar: evento.detail === 0 });

    const accion = objetivo.closest("[data-accion]");
    if (accion) {
      const unidad = accion.closest(".nc-deslizable");
      if (accion.dataset.accion === "borrar") return borrarUnidad(unidad);
      if (unidad.classList.contains("nc-pila-cuerpo")) {
        cerrarRevelada(unidad);
        return alternarPila(unidad.closest(".nc-pila"));
      }
      return abrirNotificacion(unidad);
    }

    const tarjeta = objetivo.closest(".nc-tarjeta");
    if (!tarjeta) return cerrarRevelada();
    const item = tarjeta.closest(".nc-item");
    if (revelada) return cerrarRevelada(); // Con una deslizada a la vista, el primer toque solo la cierra.
    const pila = item.closest(".nc-pila");
    if (pila.classList.contains("multiple") && !pila.classList.contains("abierta")) {
      return alternarPila(pila, { enfocar: evento.detail === 0 });
    }
    abrirNotificacion(item);
  });

  // Tocar fuera de una tarjeta deslizada la cierra.
  contenido.addEventListener("pointerdown", (evento) => {
    if (revelada && !revelada.contains(evento.target)) cerrarRevelada();
    if (confirmando && !confirmando.contains(evento.target)) cancelarConfirmacion();
  });

  /** Marca leída y va a su sección. Si es esta misma página, cierra el panel y baja hasta ahí. */
  async function abrirNotificacion(item) {
    const n = lista.find((x) => x.id === item.dataset.id);
    if (!n) return;
    item.classList.remove("nueva");
    const destino = new URL(n.url || MODULOS[n.modulo]?.url || "index.html", location.href);
    if (destino.origin !== location.origin) return; // Solo rutas internas (la tabla tampoco acepta otras).
    await Promise.race([Promise.resolve(alTocar?.([n.id])), esperar(800)]);

    if (sinRuta(destino.pathname) !== sinRuta(location.pathname)) {
      location.assign(destino.href);
      return;
    }
    cerrar({ devolverFoco: false });
    const ancla = decodeURIComponent(destino.hash.slice(1));
    // Hoy puede abrir el registro directo si escucha este evento (ver SOLICITUDES.md).
    const [regla, clave] = (n.clave ?? "").split(":");
    if (regla === "pendiente") document.dispatchEvent(new CustomEvent("goat:registrar", { detail: { clave, notificacion: n.clave } }));
    const lugar = ancla ? (document.getElementById(ancla) ?? document.querySelector(`.${CSS.escape(ancla)}`)) : null;
    window.setTimeout(() => {
      (lugar?.querySelector("button, a") ?? boton)?.focus?.({ preventScroll: true });
      const comportamiento = reducirMovimiento() ? "auto" : "smooth";
      if (lugar) lugar.scrollIntoView({ behavior: comportamiento, block: "start" });
      else window.scrollTo({ top: 0, behavior: comportamiento });
    }, 260);
  }

  return {
    abrir,
    cerrar,
    actualizar,
    get abierto() {
      return abierto;
    },
  };
}
