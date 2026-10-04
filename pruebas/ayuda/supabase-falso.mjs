// Supabase de mentira en memoria para probar las rutas de /api/v1 sin internet ni base de datos real.
// Imita lo que usa api/_lib/supabase.js: PostgREST (GET/POST/PATCH/DELETE con filtros) y /auth/v1/user.

import { randomUUID } from "node:crypto";
import { diaLogico } from "../../web/js/logica/dia.js";
import { atender } from "../../api/_lib/enrutador.js";
import { RUTAS } from "../../api/_lib/rutas.js";

export const URL_FALSA = "https://prueba.supabase.co";
export const ENTORNO = {
  SUPABASE_URL: URL_FALSA,
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_prueba",
  SUPABASE_SECRET_KEY: "sb_secret_prueba",
};

/** Columnas únicas por tabla (además de id). Las tablas nuevas pueden agregar las suyas con `unicas`. */
const UNICAS = {
  "*": [["id_cliente"]],
  api_tokens: [["token_hash"]],
  notificaciones: [["user_id", "clave"]],
  perfil: [["user_id"]],
};

const comoValor = (v) => (v === null || v === undefined ? null : typeof v === "object" ? JSON.stringify(v) : String(v));

function cumple(fila, columna, condicion) {
  const [op, ...resto] = condicion.split(".");
  const crudo = resto.join(".");
  const valor = fila[columna];
  const a = comoValor(valor);
  const comparar = (b) => {
    const na = Number(a);
    const nb = Number(b);
    if (a !== null && a !== "" && b !== "" && !Number.isNaN(na) && !Number.isNaN(nb) && !/^\d{4}-/.test(a)) return na - nb;
    return a < b ? -1 : a > b ? 1 : 0;
  };
  switch (op) {
    case "eq":
      return a === crudo;
    case "neq":
      return a !== crudo;
    case "gt":
      return a !== null && comparar(crudo) > 0;
    case "gte":
      return a !== null && comparar(crudo) >= 0;
    case "lt":
      return a !== null && comparar(crudo) < 0;
    case "lte":
      return a !== null && comparar(crudo) <= 0;
    case "is":
      return crudo === "null" ? valor === null || valor === undefined : String(valor) === crudo;
    case "in":
      return crudo.replace(/^\(|\)$/g, "").split(",").includes(a);
    default:
      throw new Error(`Operador no soportado en el Supabase falso: ${op}`);
  }
}

/**
 * `datos`: { tabla: [filas] } iniciales. `sesiones`: { "<jwt>": "<userId>" } para /auth/v1/user.
 * Devuelve { fetch, tablas, llamadas }.
 */
export function crearSupabaseFalso({ datos = {}, sesiones = {}, unicas = {} } = {}) {
  const tablas = structuredClone(datos);
  const llamadas = [];
  const reglasUnicas = { ...UNICAS, ...unicas };

  const responder = (estado, cuerpo) =>
    new Response(cuerpo === undefined ? "" : JSON.stringify(cuerpo), {
      status: estado,
      headers: { "Content-Type": "application/json" },
    });

  async function falso(url, opciones = {}) {
    const u = new URL(url);
    const metodo = (opciones.method ?? "GET").toUpperCase();
    const h = opciones.headers ?? {};
    llamadas.push({ metodo, ruta: u.pathname + u.search, encabezados: h });

    if (u.pathname === "/auth/v1/user") {
      const jwt = /^Bearer (.+)$/.exec(h.Authorization ?? "")?.[1];
      return sesiones[jwt] ? responder(200, { id: sesiones[jwt] }) : responder(401, { message: "invalid JWT" });
    }
    if (!u.pathname.startsWith("/rest/v1/")) return responder(404, { message: "no" });
    if (h.apikey !== ENTORNO.SUPABASE_SECRET_KEY) return responder(401, { message: "Invalid API key" });

    const tabla = u.pathname.slice("/rest/v1/".length);
    const filasTabla = (tablas[tabla] ??= []);
    const filtros = [];
    let columnas = "*";
    let orden = null;
    let limite = null;
    let conflicto = null;
    for (const [clave, valor] of u.searchParams) {
      if (clave === "select") columnas = valor;
      else if (clave === "order") orden = valor;
      else if (clave === "limit") limite = Number(valor);
      else if (clave === "on_conflict") conflicto = valor.split(",");
      else filtros.push([clave, valor]);
    }
    const coincide = (fila) => filtros.every(([c, v]) => cumple(fila, c, v));
    const proyectar = (fila) =>
      columnas === "*" ? { ...fila } : Object.fromEntries(columnas.split(",").map((c) => [c.trim(), fila[c.trim()] ?? null]));
    const prefer = h.Prefer ?? "";
    const devolver = (filas, estado = 200) => responder(estado, prefer.includes("return=minimal") ? undefined : filas.map(proyectar));

    if (metodo === "GET") {
      let filas = filasTabla.filter(coincide);
      if (orden) {
        const [col, dir] = orden.split(".");
        filas = [...filas].sort((x, y) => (comoValor(x[col]) < comoValor(y[col]) ? -1 : 1) * (dir === "desc" ? -1 : 1));
      }
      if (limite !== null) filas = filas.slice(0, limite);
      return responder(200, filas.map(proyectar));
    }

    if (metodo === "POST") {
      const nuevas = [].concat(JSON.parse(opciones.body ?? "[]"));
      const guardadas = [];
      for (const entrada of nuevas) {
        const fila = { id: randomUUID(), creado_en: new Date().toISOString(), ...entrada };
        if ("momento" in fila || ["checkins", "notificaciones"].includes(tabla)) {
          fila.momento ??= new Date().toISOString();
          fila.fecha ??= diaLogico(new Date(fila.momento));
        }
        if (conflicto && /(merge|ignore)-duplicates/.test(prefer)) {
          const existente = filasTabla.find((f) => conflicto.every((c) => comoValor(f[c]) === comoValor(fila[c])));
          if (existente) {
            if (prefer.includes("ignore-duplicates")) continue;
            Object.assign(existente, entrada);
            guardadas.push(existente);
            continue;
          }
        }
        const reglas = [...(reglasUnicas["*"] ?? []), ...(reglasUnicas[tabla] ?? [])];
        const choca = reglas.some((cols) =>
          filasTabla.some((f) => cols.every((c) => fila[c] != null && comoValor(f[c]) === comoValor(fila[c]))),
        );
        if (choca) return responder(409, { code: "23505", message: "duplicate key value violates unique constraint" });
        filasTabla.push(fila);
        guardadas.push(fila);
      }
      return devolver(guardadas, 201);
    }

    if (metodo === "PATCH") {
      const cambios = JSON.parse(opciones.body ?? "{}");
      const filas = filasTabla.filter(coincide);
      filas.forEach((f) => Object.assign(f, cambios));
      return devolver(filas);
    }

    if (metodo === "DELETE") {
      const borradas = filasTabla.filter(coincide);
      tablas[tabla] = filasTabla.filter((f) => !coincide(f));
      return devolver(borradas);
    }
    return responder(405, { message: "método" });
  }

  return { fetch: falso, tablas, llamadas };
}

/**
 * Llama una ruta de /api/v1 como lo haría un atajo: llamar(falso, "GET hoy", { token, cuerpo, query }).
 * `token` puede ser un token de atajo o un JWT de sesión registrado en `sesiones`.
 */
export async function llamar(falso, metodoYRuta, { token, cuerpo, query = {}, entorno = ENTORNO, ahora } = {}) {
  const [metodo, ruta] = metodoYRuta.split(" ");
  const encabezados = token ? { authorization: `Bearer ${token}` } : {};
  return atender({ metodo, ruta, query, cuerpo, encabezados }, { rutas: RUTAS, entorno, fetch: falso.fetch, ahora });
}

/** JWT de mentira con forma válida (header.payload.firma). */
export const jwtFalso = (nombre = "a") => `eyJ${nombre}.eyJwYXlsb2Fk${nombre}.firma${nombre}`;
