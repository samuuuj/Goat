// Conectar iPhone: funciones puras (sin pantalla ni internet). Las usan conectar.html, mini.js, bienvenida.js y las pruebas.

/**
 * Grupos del asistente, en el orden en que conviene armarlos: primero la base (⚙️ Goat), después lo que corre
 * solo cada día y al final la puerta del desbloqueo (necesita que los demás registren).
 */
export const MODULOS = Object.freeze([
  Object.freeze({ id: "conectar", emoji: "⚙️", nombre: "Base" }),
  Object.freeze({ id: "notificaciones", emoji: "🔔", nombre: "Avisos" }),
  Object.freeze({ id: "sueno", emoji: "🌙", nombre: "Tu noche" }),
  Object.freeze({ id: "rutina", emoji: "🗓️", nombre: "Tu día" }),
  Object.freeze({ id: "ejercicio", emoji: "🏃", nombre: "Movimiento" }),
  Object.freeze({ id: "finanzas", emoji: "💸", nombre: "Dinero" }),
  Object.freeze({ id: "desbloqueo", emoji: "🔓", nombre: "Tu tiempo" }),
  Object.freeze({ id: "widgets", emoji: "🧩", nombre: "Widgets" }),
]);

// ── Primer uso ───────────────────────────────────────────────────────────

/** ¿Hay que llevar a este dispositivo al asistente? Solo si no tiene la marca local y no se completó en ninguno. */
export function necesitaBienvenida({ marcaLocal = false, ajustes = {} } = {}) {
  if (marcaLocal) return false;
  return ajustes?.bienvenida?.completada !== true;
}

// ── Atajos de todos los módulos ──────────────────────────────────────────

const texto = (valor) => typeof valor === "string" && valor.trim().length > 0;
const lista = (valor) => (Array.isArray(valor) ? valor : []);

/**
 * Une los ATAJOS de cada módulo en grupos para el asistente.
 * `cargados`: [{ modulo: "finanzas", atajos: [...] }]. Un módulo sin atajos se omite.
 * Un id repetido o un atajo sin id, nombre o pasos es un error de programación: se lanza con un mensaje claro.
 * Devuelve [{ modulo, emoji, nombre, atajos: [{ ...atajo, modulo, requisitos, automatizaciones, permisos, prueba }] }].
 */
export function unirAtajos(cargados) {
  const vistos = new Map(); // id → módulo
  const grupos = [];
  for (const { modulo, atajos } of cargados ?? []) {
    if (atajos == null) continue;
    if (!Array.isArray(atajos)) throw new Error(`El módulo ${modulo} debe exportar ATAJOS como lista`);
    const normalizados = atajos.map((atajo, i) => {
      if (!texto(atajo?.id)) throw new Error(`El atajo ${i + 1} de ${modulo} no tiene id`);
      if (vistos.has(atajo.id)) {
        throw new Error(`Atajo repetido: "${atajo.id}" está en ${vistos.get(atajo.id)} y en ${modulo}`);
      }
      vistos.set(atajo.id, modulo);
      if (!texto(atajo.nombre)) throw new Error(`El atajo "${atajo.id}" no tiene nombre`);
      if (!Array.isArray(atajo.pasos) || atajo.pasos.length === 0) throw new Error(`El atajo "${atajo.id}" no tiene pasos`);
      const automatizaciones = Array.isArray(atajo.automatizaciones)
        ? atajo.automatizaciones
        : atajo.automatizacion
          ? [atajo.automatizacion]
          : [];
      return {
        ...atajo,
        modulo,
        emoji: texto(atajo.emoji) ? atajo.emoji : "⚡",
        para: texto(atajo.para) ? atajo.para : "",
        requisitos: lista(atajo.requisitos),
        automatizaciones: automatizaciones.filter((a) => a && texto(a.disparador)),
        permisos: lista(atajo.permisos),
        prueba: atajo.prueba && texto(atajo.prueba.ruta) ? { metodo: atajo.prueba.metodo ?? "GET", ruta: atajo.prueba.ruta } : null,
      };
    });
    if (normalizados.length === 0) continue;
    const info = MODULOS.find((m) => m.id === modulo) ?? { emoji: "⚡", nombre: modulo };
    grupos.push({ modulo, emoji: info.emoji, nombre: info.nombre, atajos: normalizados });
  }
  const orden = (modulo) => {
    const i = MODULOS.findIndex((m) => m.id === modulo);
    return i < 0 ? MODULOS.length : i;
  };
  return grupos.sort((a, b) => orden(a.modulo) - orden(b.modulo));
}

/**
 * Lee web/js/<modulo>/atajos.js de cada módulo y los une. Un archivo que no carga se omite (avisa en la consola)
 * para que el asistente siga funcionando; un id repetido sí es un error.
 */
export async function cargarAtajos(importar = (modulo) => import(`../${modulo}/atajos.js`)) {
  const cargados = await Promise.all(
    MODULOS.map(async ({ id }) => {
      try {
        const archivo = await importar(id);
        return { modulo: id, atajos: archivo?.ATAJOS ?? [] };
      } catch (error) {
        console.warn(`[conectar] no cargó ${id}/atajos.js`, error);
        return { modulo: id, atajos: [] };
      }
    }),
  );
  return unirAtajos(cargados);
}

/** Todos los atajos en una sola lista. */
export const todosLosAtajos = (grupos) => grupos.flatMap((g) => g.atajos);

/** { hechos, total } según perfil.ajustes.atajos ({ id: true }). Ids que ya no existen no cuentan. */
export function contarHechos(grupos, marcados) {
  const atajos = todosLosAtajos(grupos ?? []);
  const hechos = atajos.filter((a) => marcados?.[a.id] === true).length;
  return { hechos, total: atajos.length };
}

/** Copia de perfil.ajustes.atajos con `id` marcado o desmarcado (solo guarda los true). */
export function marcarAtajo(marcados, id, hecho) {
  const nuevo = {};
  for (const [clave, valor] of Object.entries(marcados ?? {})) if (valor === true) nuevo[clave] = true;
  if (hecho) nuevo[id] = true;
  else delete nuevo[id];
  return nuevo;
}

// ── Llaves (api_tokens) ──────────────────────────────────────────────────

/**
 * Qué mostrar en "Tu llave". El token solo existe en `recien` (memoria de la página, justo después de crearlo):
 * la base guarda solo su hash y GET tokens nunca lo devuelve, así que al recargar ya no se ve.
 */
export function estadoLlave({ tokens = [], recien = null } = {}) {
  const activas = tokens.filter((t) => !t.revocado);
  if (recien?.token) return { vista: "nueva", token: recien.token, activas };
  if (activas.length > 0) return { vista: "activas", token: null, activas, usada: activas.some((t) => t.ultimo_uso) };
  return { vista: "crear", token: null, activas };
}

/**
 * "Probar conexión": ¿alguna llave activa se usó desde que empezó la prueba?
 * `antes`: { id: ultimo_uso } al tocar Probar. `desde`: ms de ese momento.
 * La API anota el uso como máximo una vez por minuto, así que un uso de los últimos 2 min también cuenta.
 */
export function conexionProbada(filas, antes, desde, margen = 120_000) {
  return (
    (filas ?? []).find((fila) => {
      if (fila.revocado || !fila.ultimo_uso) return false;
      if (fila.ultimo_uso !== (antes?.[fila.id] ?? null)) return true;
      return Date.parse(fila.ultimo_uso) >= desde - margen;
    }) ?? null
  );
}

/** "finanzas/menu" → "finanzas". */
export const moduloDeRuta = (ruta) => String(ruta ?? "").split("/").filter(Boolean)[0] ?? "";

/**
 * "Probar" de un atajo: entre las llamadas nuevas de log_api, ¿llegó alguna a la parte de la API de su prueba?
 * Devuelve { ok: fila } si alguna salió bien, { error: fila } si solo hubo errores, o null si no llegó nada.
 */
export function pruebaRecibida(logs, prueba) {
  const modulo = moduloDeRuta(prueba?.ruta);
  if (!modulo) return null;
  const suyas = (logs ?? []).filter((l) => moduloDeRuta(l.ruta) === modulo);
  const buena = suyas.find((l) => Number(l.estado) < 400);
  if (buena) return { ok: buena };
  return suyas.length ? { error: suyas[suyas.length - 1] } : null;
}

// ── Textos ───────────────────────────────────────────────────────────────

/** Dirección de Goat para el atajo "⚙️ Goat": el origen, sin barra al final ni /api/v1. */
export const urlBase = (origen) => String(origen ?? "").replace(/\/+$/, "");

/** "ios" (iPhone o iPad), "android" u "otro". */
export function plataforma(agente = "", puntosTactiles = 0) {
  if (/iPhone|iPad|iPod/i.test(agente)) return "ios";
  if (/Macintosh/i.test(agente) && puntosTactiles > 1) return "ios"; // iPad que se presenta como Mac.
  if (/Android/i.test(agente)) return "android";
  return "otro";
}

const MINUTO = 60_000;
const formatoFecha = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" });

/** "3 oct" */
export function fechaCorta(iso) {
  const partes = formatoFecha.formatToParts(new Date(iso));
  const dia = partes.find((p) => p.type === "day")?.value ?? "";
  const mes = (partes.find((p) => p.type === "month")?.value ?? "").replace(".", "");
  return `${dia} ${mes}`.trim();
}

/** "hace un momento", "hace 5 min", "hace 3 h", "ayer", "hace 4 días" o "3 oct". */
export function tiempoRelativo(iso, ahora = new Date()) {
  if (!iso) return "nunca";
  const pasado = ahora.getTime() - Date.parse(iso);
  if (pasado < MINUTO) return "hace un momento";
  if (pasado < 60 * MINUTO) return `hace ${Math.floor(pasado / MINUTO)} min`;
  if (pasado < 24 * 60 * MINUTO) return `hace ${Math.floor(pasado / (60 * MINUTO))} h`;
  if (pasado < 48 * 60 * MINUTO) return "ayer";
  if (pasado < 30 * 24 * 60 * MINUTO) return `hace ${Math.floor(pasado / (24 * 60 * MINUTO))} días`;
  return fechaCorta(iso);
}

/** Una llave en una línea: "Creada 3 oct · usada hace 2 h". */
export function detalleLlave(llave, ahora = new Date()) {
  const uso = llave.ultimo_uso ? `usada ${tiempoRelativo(llave.ultimo_uso, ahora)}` : "sin usar todavía";
  return `Creada ${fechaCorta(llave.creado_en)} · ${uso}`;
}

/** Filas del paso "Listo": qué quedó y qué falta. */
export function resumenListo({ instalada, tokens = [], hechos = 0, total = 0 }) {
  const activas = tokens.filter((t) => !t.revocado);
  const conectada = activas.some((t) => t.ultimo_uso);
  return [
    {
      clave: "instalada",
      emoji: "📲",
      titulo: "Goat en tu inicio",
      detalle: instalada ? "Se abre como una app" : "Safari › Compartir › Agregar a inicio",
      listo: Boolean(instalada),
    },
    {
      clave: "llave",
      emoji: "🔑",
      titulo: "iPhone conectado",
      detalle: conectada ? "Tu llave ya funciona" : activas.length ? "Corre «🧪 Goat · Probar»" : "Falta crear tu llave",
      listo: conectada,
    },
    {
      clave: "atajos",
      emoji: "⚡",
      titulo: "Atajos",
      detalle: total ? `${hechos} de ${total} listos` : "Ninguno todavía",
      listo: total > 0 && hechos >= total,
    },
  ];
}
