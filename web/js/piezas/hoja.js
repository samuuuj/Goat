// Hoja inferior estilo iOS: sube con resorte, se cierra arrastrando la manija, tocando el velo o con Esc.
// Estilos en css/comun.css (.velo, .hoja, .hoja-manija).

/**
 * `hoja`, `velo`, `manija`: elementos del HTML. `fondo`: lo que queda detrás (se vuelve inerte mientras está abierta).
 * `alCerrar()`: se llama cada vez que se cierra. Devuelve { abrir(), cerrar(), abierta }.
 */
export function crearHoja({ hoja, velo, manija, fondo = [], alCerrar = () => {} }) {
  let abierta = false;
  let focoPrevio = null;

  function abrir() {
    focoPrevio = document.activeElement;
    abierta = true;
    hoja.scrollTop = 0;
    hoja.classList.add("abierta");
    velo.classList.add("abierto");
    fondo.forEach((el) => el && (el.inert = true));
    hoja.focus({ preventScroll: true });
  }

  function cerrar() {
    if (!abierta) return;
    abierta = false;
    hoja.classList.remove("abierta");
    hoja.style.removeProperty("--arrastre");
    velo.classList.remove("abierto");
    fondo.forEach((el) => el && (el.inert = false));
    focoPrevio?.focus?.({ preventScroll: true });
    alCerrar();
  }

  velo.addEventListener("click", cerrar);
  window.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && abierta) cerrar();
  });
  if (manija) arrastrarParaCerrar(manija, hoja, cerrar);

  return {
    abrir,
    cerrar,
    get abierta() {
      return abierta;
    },
  };
}

/** Arrastrar la manija hacia abajo cierra la hoja (más de 110 px o un gesto rápido). */
function arrastrarParaCerrar(manija, hoja, cerrar) {
  let inicio = null;

  manija.addEventListener("pointerdown", (evento) => {
    inicio = { y: evento.clientY, t: performance.now() };
    manija.setPointerCapture(evento.pointerId);
    hoja.classList.add("arrastrando");
  });

  manija.addEventListener("pointermove", (evento) => {
    if (!inicio) return;
    const bajada = Math.max(0, evento.clientY - inicio.y) * 0.7;
    hoja.style.setProperty("--arrastre", `${bajada}px`);
  });

  const soltar = (evento) => {
    if (!inicio) return;
    const bajada = Math.max(0, evento.clientY - inicio.y);
    const velocidad = bajada / Math.max(performance.now() - inicio.t, 1); // px por ms
    inicio = null;
    hoja.classList.remove("arrastrando");
    if (bajada > 110 || velocidad > 0.6) cerrar();
    else hoja.style.removeProperty("--arrastre");
  };
  manija.addEventListener("pointerup", soltar);
  manija.addEventListener("pointercancel", soltar);
}
