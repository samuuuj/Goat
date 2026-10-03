// Simulador para ver las páginas con datos de prueba, SIN tocar Supabase (solo en `npm run local`).
// Abre http://localhost:3000/_pruebas/index.html (o finanzas.html, rutina.html…): el servidor local inyecta este
// archivo antes del script de la página. Aquí se crea una sesión falsa y se reemplaza fetch:
//   - https://*.supabase.co/rest/v1/<tabla> → datos de pruebas/navegador/datos*.js (en memoria; guardar también funciona)
//   - https://*.supabase.co/auth/v1/…      → usuario de prueba
//   - /api/v1/<ruta>                         → respuestas de prueba (datos.js › API)
// Parámetros: ?escenario=vacio para empezar sin registros · ?hora=2026-10-02T16:00 para fijar "ahora" (no cambia Date).

const USUARIO = "11111111-1111-4111-8111-111111111111";
const parametros = new URLSearchParams(location.search);

// Sesión falsa que supabase-js acepta sin pedir nada a internet (vence en 10 años).
try {
  const ahora = Math.floor(Date.now() / 1000);
  localStorage.setItem(
    "goat-sesion",
    JSON.stringify({
      access_token: "eyJprueba.eyJsocal.firma",
      refresh_token: "prueba",
      token_type: "bearer",
      expires_in: 315360000,
      expires_at: ahora + 315360000,
      user: { id: USUARIO, email: "prueba@goat.local", aud: "authenticated", role: "authenticated" },
    }),
  );
  localStorage.setItem("goat:bienvenida", "1"); // El simulador no fuerza el asistente (ábrelo directo).
} catch {
  console.warn("[simulador] sin localStorage");
}

let datos = null;
async function cargarDatos() {
  if (datos) return datos;
  const base = await import("./datos.js");
  datos = parametros.get("escenario") === "vacio" ? base.vacio() : base.ejemplo(USUARIO);
  // Cada módulo puede sumar su archivo pruebas/navegador/datos-<modulo>.js con `export function agregar(datos, usuario)`.
  for (const modulo of ["finanzas", "sueno", "desbloqueo", "rutina", "ejercicio", "notificaciones", "widgets", "conectar"]) {
    try {
      const extra = await import(`./datos-${modulo}.js`);
      if (parametros.get("escenario") !== "vacio") extra.agregar?.(datos, USUARIO);
      extra.api?.(datos.api, USUARIO);
    } catch {
      // Ese módulo todavía no tiene datos de prueba.
    }
  }
  // Todo es del usuario de prueba (salvo las tablas comunes).
  for (const [tabla, filas] of Object.entries(datos.tablas)) {
    if (tabla !== "festivos") for (const fila of filas) fila.user_id ??= USUARIO;
  }
  return datos;
}

const respuesta = (cuerpo, estado = 200) =>
  new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json" },
  });

/** Filtros simples de PostgREST: eq, neq, gt, gte, lt, lte, is, in. */
function cumple(fila, columna, condicion) {
  const [op, ...resto] = condicion.split(".");
  const valor = resto.join(".");
  const a = fila[columna] == null ? null : String(fila[columna]);
  switch (op) {
    case "eq":
      return a === valor;
    case "neq":
      return a !== valor;
    case "gt":
      return a !== null && a > valor;
    case "gte":
      return a !== null && a >= valor;
    case "lt":
      return a !== null && a < valor;
    case "lte":
      return a !== null && a <= valor;
    case "is":
      return valor === "null" ? a === null : a === valor;
    case "in":
      return valor.replace(/^\(|\)$/g, "").split(",").includes(a);
    default:
      return true;
  }
}

const fetchReal = window.fetch.bind(window);

window.fetch = async (entrada, opciones = {}) => {
  const url = new URL(typeof entrada === "string" ? entrada : entrada.url, location.href);
  const metodo = (opciones.method ?? (typeof entrada === "object" ? entrada.method : null) ?? "GET").toUpperCase();
  const d = await cargarDatos();

  if (url.hostname.endsWith(".supabase.co")) {
    if (url.pathname.startsWith("/auth/v1/")) return respuesta({ id: USUARIO, email: "prueba@goat.local" });

    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const funcion = url.pathname.slice("/rest/v1/rpc/".length);
      const cuerpo = JSON.parse(opciones.body ?? "{}");
      if (funcion === "ajustes_poner") {
        const perfil = (d.tablas.perfil ??= [{ user_id: USUARIO, metas: {}, ajustes: {} }])[0];
        perfil.ajustes = { ...(perfil.ajustes ?? {}), [cuerpo.clave]: cuerpo.valor };
        return respuesta(null, 204);
      }
      return respuesta({ code: "PGRST202", message: `Función ${funcion} no simulada` }, 404);
    }

    const tabla = url.pathname.slice("/rest/v1/".length);
    const filas = (d.tablas[tabla] ??= []);
    const filtros = [...url.searchParams].filter(([c]) => !["select", "order", "limit", "offset", "on_conflict", "columns"].includes(c));
    const coincide = (fila) => filtros.every(([c, v]) => cumple(fila, c, v));

    if (metodo === "GET" || metodo === "HEAD") {
      let lista = filas.filter(coincide);
      const orden = url.searchParams.get("order");
      if (orden) {
        const [col, dir] = orden.split(",")[0].split(".");
        lista = [...lista].sort((x, y) => (String(x[col]) < String(y[col]) ? -1 : 1) * (dir === "desc" ? -1 : 1));
      }
      const limite = url.searchParams.get("limit");
      if (limite) lista = lista.slice(0, Number(limite));
      const unico = (new Headers(opciones.headers ?? {}).get("accept") ?? "").includes("vnd.pgrst.object");
      return respuesta(unico ? (lista[0] ?? null) : lista);
    }
    if (metodo === "POST") {
      const nuevas = [].concat(JSON.parse(opciones.body ?? "[]")).map((f) => ({
        id: crypto.randomUUID(),
        user_id: USUARIO,
        momento: new Date().toISOString(),
        creado_en: new Date().toISOString(),
        ...f,
      }));
      for (const fila of nuevas) fila.fecha ??= window.__goatDiaLogico?.(new Date(fila.momento)) ?? fila.momento.slice(0, 10);
      filas.push(...nuevas);
      return respuesta(nuevas, 201);
    }
    if (metodo === "PATCH") {
      const cambios = JSON.parse(opciones.body ?? "{}");
      const tocadas = filas.filter(coincide);
      tocadas.forEach((f) => Object.assign(f, cambios));
      return respuesta(tocadas);
    }
    if (metodo === "DELETE") {
      const borradas = filas.filter(coincide);
      d.tablas[tabla] = filas.filter((f) => !coincide(f));
      return respuesta(borradas);
    }
  }

  if (url.origin === location.origin && url.pathname.startsWith("/api/v1/")) {
    const ruta = url.pathname.slice("/api/v1/".length);
    const manejar = d.api[`${metodo} ${ruta}`];
    if (!manejar) return respuesta({ ok: false, mensaje: "Ruta no simulada", codigo: "RUTA_NO_EXISTE" }, 404);
    const cuerpo = opciones.body ? JSON.parse(opciones.body) : {};
    const { estado = 200, ...resto } = await manejar({ cuerpo, query: Object.fromEntries(url.searchParams), datos: d });
    return respuesta(resto, estado);
  }

  return fetchReal(entrada, opciones);
};

// Día lógico de la app (para la columna `fecha` de lo que se guarda en el simulador).
import("/js/logica/dia.js").then(({ diaLogico }) => (window.__goatDiaLogico = diaLogico)).catch(() => {});

console.info("[simulador] datos de prueba activos — nada se guarda en Supabase");
