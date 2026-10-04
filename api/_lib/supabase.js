// Cliente mínimo de PostgREST (la API REST de Supabase) para el servidor, con la clave secreta.
// La clave secreta se salta RLS: por eso `baseDeDatos(userId)` filtra SIEMPRE por user_id y lo pone al insertar.

import { ErrorApi } from "./respuesta.js";

/** Tablas sin user_id que cualquiera con sesión puede leer. */
const TABLAS_COMUNES = new Set(["festivos"]);

/** Error de la base de datos con el código de Postgres/PostgREST. */
export class ErrorBD extends Error {
  constructor(estado, codigo, mensaje) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
  }
}

/** Encabezados con la clave secreta. Las claves nuevas (sb_secret_…) van solo en apikey; las JWT antiguas también en Authorization. */
function encabezados(config, extra = {}) {
  const h = { apikey: config.secreta, "Content-Type": "application/json", Accept: "application/json", ...extra };
  if (config.secreta.startsWith("eyJ")) h.Authorization = `Bearer ${config.secreta}`;
  return h;
}

/** Petición directa a /rest/v1. `ruta` ya incluye la tabla y los parámetros. */
export async function peticionRest(config, metodo, ruta, { cuerpo, prefer, fetch: f = fetch } = {}) {
  const extra = prefer ? { Prefer: prefer } : {};
  const respuesta = await f(`${config.url}/rest/v1/${ruta}`, {
    method: metodo,
    headers: encabezados(config, extra),
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto;
  }
  if (!respuesta.ok) {
    const codigo = datos?.code ?? String(respuesta.status);
    if (codigo === "PGRST205" || codigo === "42P01" || codigo === "42703") {
      throw new ErrorApi("BASE_SIN_INSTALAR", "🛠️ Falta actualizar la base de datos", 503);
    }
    throw new ErrorBD(respuesta.status, codigo, datos?.message ?? "Error de base de datos");
  }
  return datos;
}

/**
 * Convierte { columna: "eq.valor" | ["gte.1", "lte.5"] } en parámetros de PostgREST.
 * Los valores se codifican (nada de inyectar operadores con & o =).
 */
function parametros(filtros = {}, extra = {}) {
  const p = new URLSearchParams();
  for (const [columna, condicion] of Object.entries(filtros)) {
    if (!/^[a-z_][a-z0-9_]*$/.test(columna)) throw new Error(`Columna inválida: ${columna}`);
    for (const c of [].concat(condicion)) p.append(columna, String(c));
  }
  for (const [clave, valor] of Object.entries(extra)) if (valor !== undefined && valor !== null) p.set(clave, String(valor));
  return p.toString();
}

const tablaValida = (tabla) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(tabla)) throw new Error(`Tabla inválida: ${tabla}`);
  return tabla;
};

/**
 * Acceso a los datos de UN usuario. Todo lleva user_id = userId.
 * select(tabla, { columnas, filtros, orden, limite })  → filas
 * insert(tabla, filas, { devolver })                   → filas insertadas ([] si id_cliente repetido)
 * upsert(tabla, filas, { conflicto })                  → filas
 * update(tabla, cambios, filtros)                      → filas actualizadas
 * delete(tabla, filtros)                               → filas borradas
 */
export function baseDeDatos(config, userId, { fetch: f = fetch } = {}) {
  if (!userId) throw new Error("baseDeDatos necesita un usuario");
  const propio = (tabla, filtros = {}) =>
    TABLAS_COMUNES.has(tabla) ? filtros : { ...filtros, user_id: `eq.${userId}` };
  const conUsuario = (filas) => [].concat(filas).map((fila) => ({ ...fila, user_id: userId }));

  return {
    userId,

    async select(tabla, { columnas = "*", filtros, orden, limite } = {}) {
      const q = parametros(propio(tablaValida(tabla), filtros), { select: columnas, order: orden, limit: limite });
      return peticionRest(config, "GET", `${tabla}?${q}`, { fetch: f });
    },

    async insert(tabla, filas, { devolver = true } = {}) {
      try {
        return (
          (await peticionRest(config, "POST", `${tablaValida(tabla)}?${parametros({}, { select: devolver ? "*" : undefined })}`, {
            cuerpo: conUsuario(filas),
            prefer: devolver ? "return=representation" : "return=minimal",
            fetch: f,
          })) ?? []
        );
      } catch (e) {
        // id_cliente repetido: el atajo reintentó y ya estaba guardado.
        if (e instanceof ErrorBD && e.codigo === "23505") return [];
        throw e;
      }
    },

    async upsert(tabla, filas, { conflicto } = {}) {
      return (
        (await peticionRest(config, "POST", `${tablaValida(tabla)}?${parametros({}, { on_conflict: conflicto, select: "*" })}`, {
          cuerpo: conUsuario(filas),
          prefer: "resolution=merge-duplicates,return=representation",
          fetch: f,
        })) ?? []
      );
    },

    async update(tabla, cambios, filtros = {}) {
      const { user_id: _ignorado, ...seguros } = cambios;
      return (
        (await peticionRest(config, "PATCH", `${tablaValida(tabla)}?${parametros(propio(tabla, filtros), { select: "*" })}`, {
          cuerpo: seguros,
          prefer: "return=representation",
          fetch: f,
        })) ?? []
      );
    },

    async delete(tabla, filtros = {}) {
      if (Object.keys(filtros).length === 0) throw new Error("delete sin filtros");
      return (
        (await peticionRest(config, "DELETE", `${tablaValida(tabla)}?${parametros(propio(tabla, filtros), { select: "*" })}`, {
          prefer: "return=representation",
          fetch: f,
        })) ?? []
      );
    },
  };
}

/** Consultas de administración sin usuario (solo para auth.js: buscar un token por su hash). */
export function administrador(config, { fetch: f = fetch } = {}) {
  return {
    async buscarToken(hash) {
      const q = parametros({ token_hash: `eq.${hash}` }, { select: "id,user_id,revocado,ultimo_uso", limit: 1 });
      const filas = await peticionRest(config, "GET", `api_tokens?${q}`, { fetch: f });
      return filas?.[0] ?? null;
    },
    async marcarUso(id, cuando) {
      await peticionRest(config, "PATCH", `api_tokens?${parametros({ id: `eq.${id}` })}`, {
        cuerpo: { ultimo_uso: cuando.toISOString() },
        prefer: "return=minimal",
        fetch: f,
      });
    },
  };
}
