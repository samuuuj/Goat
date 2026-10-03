// Cómo se escriben los números en pantalla.

const miles = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export const formatoMiles = (valor) => miles.format(valor);

/** $19.100 · −$3.000 */
export function formatoCOP(valor) {
  return `${valor < 0 ? "−" : ""}$${miles.format(Math.abs(valor))}`;
}

/** 6h 25 · 45 min */
export function formatoDuracion(minutos) {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${String(m).padStart(2, "0")}`;
}

/** Número principal de una métrica, sin unidad. `formato`: cop, gramos, kcal, duracion, entero o minutos. */
export function formatearValor(valor, formato) {
  if (formato === "cop") return formatoCOP(valor);
  if (formato === "duracion") return formatoDuracion(valor);
  return miles.format(valor);
}

/** Unidad corta que acompaña al número ("g", "kcal", "min"). */
export function unidad(formato) {
  if (formato === "gramos") return "g";
  if (formato === "kcal") return "kcal";
  if (formato === "minutos") return "min";
  return "";
}
