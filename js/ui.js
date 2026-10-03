// Piezas de interfaz que usan varias pantallas.

export const reducirMovimiento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const limitar = (valor, minimo, maximo) => Math.min(Math.max(valor, minimo), maximo);

/** Copia de un <template> del HTML, lista para llenar con textContent (nunca con innerHTML). */
export function clonar(id) {
  return document.getElementById(id).content.firstElementChild.cloneNode(true);
}

/**
 * Ajusta cada `[data-linea]` del contenedor para que ocupe exactamente su ancho (texto justificado de revista).
 * Mide con una sonda oculta a font-size 100px y ancho de letra normal, así no depende de la compresión del scroll.
 * `maximo` es una función que devuelve el tope en px (puede depender del alto de la ventana).
 * Devuelve una función para volver a medir cuando cambian las líneas.
 */
export function ajustarAlAncho(contenedor, maximo) {
  let ultimo = "";

  const medir = (forzar = false) => {
    const ancho = contenedor.clientWidth;
    const tope = maximo();
    const clave = `${ancho}|${tope}`;
    if (!forzar && clave === ultimo) return;
    ultimo = clave;

    const sonda = document.createElement("span");
    sonda.className = "titular sonda";
    contenedor.appendChild(sonda);
    contenedor.querySelectorAll("[data-linea]").forEach((linea) => {
      sonda.textContent = linea.dataset.linea ?? "";
      const natural = sonda.getBoundingClientRect().width;
      if (natural > 0) linea.style.fontSize = `${Math.min((ancho / natural) * 100, tope)}px`;
    });
    sonda.remove();
  };

  medir(true);
  document.fonts?.ready.then(() => medir(true));
  new ResizeObserver(() => medir()).observe(contenedor);
  window.addEventListener("resize", () => medir());
  return () => medir(true);
}

/** Ejecuta `accion` una sola vez, cuando el elemento entra en pantalla. */
export function alVerse(elemento, accion, margen = "0px 0px -10% 0px") {
  const observador = new IntersectionObserver(
    (entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      observador.disconnect();
      accion();
    },
    { rootMargin: margen },
  );
  observador.observe(elemento);
}

/** Número que cuenta desde 0 hasta `valor` (1,4 s, frenando al final). */
export function contar(elemento, valor, formatear) {
  if (reducirMovimiento() || valor === 0) {
    elemento.textContent = formatear(valor);
    return;
  }
  const inicio = performance.now();
  const duracion = 1400;
  const paso = (ahora) => {
    const t = limitar((ahora - inicio) / duracion, 0, 1);
    const suave = 1 - Math.pow(1 - t, 4);
    elemento.textContent = formatear(Math.round(valor * suave));
    if (t < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

/** UUID v4 para que un doble toque no guarde dos veces. Funciona también sin HTTPS (pruebas en la red local). */
export function nuevoId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ── Modo discreto ────────────────────────────────────────────────────────
// Los valores sensibles (dinero) se ven borrosos hasta que los tocas.
// Activado por defecto; la preferencia se guarda en este navegador.

const CLAVE_DISCRETO = "goat:discreto";

function leerDiscreto() {
  try {
    return localStorage.getItem(CLAVE_DISCRETO) !== "0";
  } catch {
    return true;
  }
}

/** Conecta el botón del ojo y los valores `.sensible` de la página. */
export function iniciarDiscreto(boton) {
  const aplicar = (discreto) => {
    document.documentElement.classList.toggle("discreto", discreto);
    boton.setAttribute("aria-pressed", String(discreto));
    boton.setAttribute("aria-label", discreto ? "Mostrar montos" : "Ocultar montos");
  };

  aplicar(leerDiscreto());
  boton.addEventListener("click", () => {
    const discreto = !document.documentElement.classList.contains("discreto");
    try {
      localStorage.setItem(CLAVE_DISCRETO, discreto ? "1" : "0");
    } catch {
      // Modo privado: queda solo mientras la página esté abierta.
    }
    aplicar(discreto);
  });

  // Tocar un valor borroso lo muestra 3 segundos.
  document.addEventListener("pointerdown", (evento) => {
    const sensible = evento.target.closest?.(".sensible");
    if (!sensible || !document.documentElement.classList.contains("discreto")) return;
    sensible.classList.add("revelado");
    window.clearTimeout(sensible._temporizador);
    sensible._temporizador = window.setTimeout(() => sensible.classList.remove("revelado"), 3000);
  });
}

// ── Aviso flotante ("💸 Guardado") ───────────────────────────────────────

let temporizadorAviso;

export function avisar(texto) {
  const aviso = document.getElementById("aviso");
  aviso.textContent = texto;
  aviso.classList.remove("visible");
  void aviso.offsetWidth; // Reinicia la animación si ya estaba visible.
  aviso.classList.add("visible");
  window.clearTimeout(temporizadorAviso);
  temporizadorAviso = window.setTimeout(() => aviso.classList.remove("visible"), 2600);
}
