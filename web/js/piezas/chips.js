// Selector de una opción hecho con botones (los "chips"). La página necesita <template id="plantilla-chip">.

import { clonar } from "./ui.js";

/**
 * `contenedor`: el elemento [data-chips]. `alCambiar(valor)` se llama al tocar un chip.
 * Devuelve { valor, poner(valor), opciones([{ valor, texto }]) }.
 */
export function chips(contenedor, alCambiar = () => {}) {
  let valor = null;
  const marcar = () =>
    contenedor.querySelectorAll(".chip").forEach((chip) => chip.setAttribute("aria-checked", String(chip.dataset.valor === valor)));

  contenedor.addEventListener("click", (evento) => {
    const chip = evento.target.closest(".chip");
    if (!chip) return;
    valor = chip.dataset.valor;
    marcar();
    alCambiar(valor);
  });

  return {
    get valor() {
      return valor;
    },
    poner(nuevo) {
      valor = nuevo;
      marcar();
    },
    opciones(lista) {
      contenedor.replaceChildren(
        ...lista.map((opcion) => {
          const chip = clonar("plantilla-chip");
          chip.dataset.valor = opcion.valor;
          chip.textContent = opcion.texto;
          return chip;
        }),
      );
      marcar();
    },
  };
}
