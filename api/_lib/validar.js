// Validación de lo que mandan los atajos. Si algo no sirve, se lanza ErrorApi con un mensaje humano.

import { randomUUID } from "node:crypto";
import { ErrorApi } from "./respuesta.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORIGENES = new Set(["atajo", "web", "automatizacion", "widget"]);

const invalido = (campo) => new ErrorApi("DATO_INVALIDO", `⚠️ Revisa: ${campo}`);

/** Entero entre min y max. Acepta "25.000", "25000" o 25000 (los atajos a veces mandan texto). */
export function entero(valor, min, max, campo = "número") {
  const n = typeof valor === "string" ? Number(valor.replace(/[.\s$]/g, "").replace(",", ".")) : valor;
  if (!Number.isInteger(n) || n < min || n > max) throw invalido(campo);
  return n;
}

/** Número (con decimales) entre min y max. */
export function numero(valor, min, max, campo = "número") {
  const n = typeof valor === "string" ? Number(valor.replace(",", ".")) : valor;
  if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max) throw invalido(campo);
  return n;
}

/** Texto recortado, de 1 a max caracteres. Con `opcional`, vacío → null. */
export function texto(valor, max, campo = "texto", { opcional = false } = {}) {
  const t = typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor).trim();
  if (!t) {
    if (opcional) return null;
    throw invalido(campo);
  }
  if (t.length > max) throw invalido(campo);
  return t;
}

/** Uno de una lista cerrada. */
export function uno(valor, lista, campo = "opción") {
  const v = typeof valor === "string" ? valor.trim().toLowerCase() : valor;
  if (!lista.includes(v)) throw invalido(campo);
  return v;
}

/** Fecha ISO 8601 con zona (lo que da "Formatear fecha › ISO 8601" en Atajos). Sin valor → `porDefecto`. */
export function fechaIso(valor, campo = "fecha", porDefecto = null) {
  if (valor == null || valor === "") return porDefecto;
  const t = Date.parse(String(valor));
  if (Number.isNaN(t)) throw invalido(campo);
  return new Date(t);
}

export const esUuid = (valor) => UUID.test(valor ?? "");

/** "atajo" si no viene; error si viene algo raro. */
export function origen(valor) {
  if (valor == null || valor === "") return "atajo";
  if (!ORIGENES.has(valor)) throw invalido("origen");
  return valor;
}

/**
 * id_cliente para no duplicar (D-052). Atajos no tiene acción de UUID: si no viene, se genera uno nuevo,
 * salvo que haya un registro idéntico (mismos `campos`) en los últimos 60 s: entonces devuelve null (= ya estaba).
 */
export async function idCliente(db, tabla, fila, campos, valor, ahora = new Date()) {
  if (valor != null && valor !== "") {
    if (!esUuid(valor)) throw invalido("id_cliente");
    return valor;
  }
  const filtros = { creado_en: `gte.${new Date(ahora.getTime() - 60_000).toISOString()}` };
  for (const campo of campos) {
    filtros[campo] = fila[campo] === null || fila[campo] === undefined ? "is.null" : `eq.${fila[campo]}`;
  }
  const repetidas = await db.select(tabla, { columnas: "id", filtros, limite: 1 });
  return repetidas.length > 0 ? null : randomUUID();
}
