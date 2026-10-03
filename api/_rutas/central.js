// Rutas de Central: probar conexión, resumen del día, llaves (tokens) de los atajos y check-ins.

import { ok, ErrorApi } from "../_lib/respuesta.js";
import { hashToken, tokenNuevo } from "../_lib/auth.js";
import { cargarRegistrosServidor } from "../_lib/registros.js";
import { idCliente, origen, texto, uno, fechaIso, esUuid } from "../_lib/validar.js";
import { construirResumen } from "../../web/js/logica/calculo.js";

const VERSION = "1";
const MAXIMO_TOKENS = 10;
const MODULOS_CHECKIN = ["finanzas", "comidas", "desbloqueo", "sueno", "ejercicio", "universidad", "ocio", "rutina", "puntuacion", "diario"];

export default {
  /** Sin token: ¿responde el servidor? Con token: además confirma que la llave sirve. */
  "GET ping": {
    auth: "publica",
    manejar: async ({ usuario }) =>
      ok(usuario ? "✅ Conectado" : "👋 Goat responde", { version: VERSION, conectado: Boolean(usuario) }),
  },

  /** Resumen del día (el mismo cálculo que la pantalla de inicio). */
  "GET hoy": async ({ db, ahora }) => {
    const resumen = construirResumen(await cargarRegistrosServidor(db, ahora), ahora);
    const mensaje = resumen.pendientes.length ? `${resumen.pendientes[0].emoji} Falta ${resumen.pendientes[0].texto}` : "✅ Todo al día";
    return ok(mensaje, resumen);
  },

  /** Crea una llave para un iPhone. Solo con la sesión de la web. El token se ve UNA sola vez. */
  "POST tokens": {
    auth: "sesion",
    manejar: async ({ db, cuerpo }) => {
      const nombre = texto(cuerpo.nombre ?? "iPhone", 40, "nombre");
      const activos = await db.select("api_tokens", { columnas: "id", filtros: { revocado: "eq.false" } });
      if (activos.length >= MAXIMO_TOKENS) {
        throw new ErrorApi("DEMASIADOS_TOKENS", "🔑 Ya tienes 10 llaves: revoca una primero", 409);
      }
      const token = tokenNuevo();
      const [fila] = await db.insert("api_tokens", { nombre, token_hash: hashToken(token) });
      return ok("🔑 Llave creada", { id: fila.id, nombre: fila.nombre, token }, 201);
    },
  },

  /** Lista de llaves (sin el hash). */
  "GET tokens": {
    auth: "sesion",
    manejar: async ({ db }) => {
      const filas = await db.select("api_tokens", {
        columnas: "id,nombre,ultimo_uso,revocado,creado_en",
        orden: "creado_en.desc",
      });
      return ok("🔑 Tus llaves", { tokens: filas });
    },
  },

  /** Revoca una llave: el atajo que la use deja de funcionar. */
  "DELETE tokens": {
    auth: "sesion",
    manejar: async ({ db, cuerpo, query }) => {
      const id = cuerpo.id ?? query.id;
      if (!esUuid(id)) throw new ErrorApi("DATO_INVALIDO", "⚠️ Falta la llave", 400);
      const filas = await db.update("api_tokens", { revocado: true }, { id: `eq.${id}` });
      if (filas.length === 0) throw new ErrorApi("NO_EXISTE", "🔑 Esa llave no existe", 404);
      return ok("🔒 Llave revocada", { id });
    },
  },

  /** "Nada que registrar", cierres y omisiones de cualquier módulo. */
  "POST checkins": async ({ db, cuerpo, ahora }) => {
    const fila = {
      modulo: uno(cuerpo.modulo, MODULOS_CHECKIN, "módulo"),
      tipo: uno(cuerpo.tipo, ["nada_que_registrar", "cierre"], "tipo"),
      clave: texto(cuerpo.clave, 60, "clave", { opcional: true }),
      momento: fechaIso(cuerpo.momento, "momento", ahora).toISOString(),
      origen: origen(cuerpo.origen),
    };
    fila.id_cliente = await idCliente(db, "checkins", fila, ["modulo", "tipo"], cuerpo.id_cliente, ahora);
    if (fila.id_cliente) await db.insert("checkins", fila, { devolver: false });
    return ok(fila.tipo === "cierre" ? "🧾 Día cerrado" : "✅ Anotado", {}, 201);
  },
};
