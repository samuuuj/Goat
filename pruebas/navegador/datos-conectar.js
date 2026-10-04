// Datos de prueba de Conectar para el simulador (pruebas/navegador/simulador.js). Nada de esto existe en Supabase.
// http://localhost:3000/_pruebas/conectar.html                 → asistente sin terminar, una llave usada hace 2 h y 3 atajos hechos
// http://localhost:3000/_pruebas/conectar.html?conectar=listo  → asistente ya terminado: abre Ajustes
// http://localhost:3000/_pruebas/conectar.html?escenario=vacio → primer uso: sin llaves ni atajos
// El "iPhone" se simula: 8 s después de "Crear llave" corre «🧪 Goat · Probar» (anota ultimo_uso), y 5 s después
// de que la web pruebe la ruta de un atajo llega la misma llamada "desde el iPhone" (log_api).

import { cargarAtajos, todosLosAtajos } from "/js/conectar/logica.js";

const opcion = new URLSearchParams(location.search).get("conectar");
const hace = (min) => new Date(Date.now() - min * 60_000).toISOString();
const RUTAS_PRUEBA = new Set(todosLosAtajos(await cargarAtajos()).flatMap((a) => (a.prueba ? [`${a.prueba.metodo} ${a.prueba.ruta}`] : [])));

export function agregar(datos, usuario) {
  const perfil = datos.tablas.perfil[0];
  perfil.ajustes = {
    ...(perfil.ajustes ?? {}),
    atajos: { "conectar-goat": true, "conectar-probar": true, "finanzas-movimiento": true },
  };
  if (opcion === "listo") perfil.ajustes.bienvenida = { completada: true, fecha: hace(60 * 24) };

  datos.tablas.api_tokens = [
    { id: "6a1f0c2e-3b4d-4e5f-8a9b-0c1d2e3f4a5b", user_id: usuario, nombre: "iPhone", ultimo_uso: hace(120), revocado: false, creado_en: hace(60 * 24 * 3) },
    { id: "7b2e1d3f-4c5e-4f6a-9b0c-1d2e3f4a5b6c", user_id: usuario, nombre: "Widget", ultimo_uso: hace(60 * 30), revocado: true, creado_en: hace(60 * 24 * 12) },
  ];
  datos.tablas.log_api = [{ id: 1001, user_id: usuario, ruta: "finanzas/menu", metodo: "GET", estado: 200, creado_en: hace(150) }];
}

export function api(rutas, usuario) {
  const llaves = (datos) => (datos.tablas.api_tokens ??= []);
  let siguiente = 2000; // Ids de 4 cifras: el simulador compara como texto.
  const anotar = (datos, metodo, ruta, estado) =>
    (datos.tablas.log_api ??= []).push({ id: siguiente++, user_id: usuario, ruta, metodo, estado, creado_en: new Date().toISOString() });

  // Llaves en la tabla api_tokens del simulador, para que "Probar conexión" (select con RLS) las vea.
  rutas["GET tokens"] = async ({ datos }) => ({
    ok: true,
    mensaje: "🔑 Tus llaves",
    datos: { tokens: llaves(datos).map(({ id, nombre, ultimo_uso, revocado, creado_en }) => ({ id, nombre, ultimo_uso, revocado, creado_en })) },
  });

  rutas["POST tokens"] = async ({ cuerpo, datos }) => {
    const fila = { id: crypto.randomUUID(), user_id: usuario, nombre: cuerpo.nombre ?? "iPhone", ultimo_uso: null, revocado: false, creado_en: new Date().toISOString() };
    llaves(datos).unshift(fila);
    window.setTimeout(() => (fila.ultimo_uso = new Date().toISOString()), 8000); // El iPhone corre «🧪 Goat · Probar».
    return { estado: 201, ok: true, mensaje: "🔑 Llave creada", datos: { id: fila.id, nombre: fila.nombre, token: `PRUEBA_${"x".repeat(37)}` } };
  };

  rutas["DELETE tokens"] = async ({ cuerpo, query, datos }) => {
    const id = cuerpo.id ?? query.id;
    const fila = llaves(datos).find((t) => t.id === id);
    if (!fila) return { estado: 404, ok: false, mensaje: "🔑 Esa llave no existe", codigo: "NO_EXISTE" };
    fila.revocado = true;
    return { ok: true, mensaje: "🔒 Llave revocada", datos: { id } };
  };

  // Rutas de prueba de los atajos: la llamada de la web queda en log_api y 5 s después "llega" la del iPhone.
  for (const clave of RUTAS_PRUEBA) {
    const original = rutas[clave];
    if (!original || clave === "GET ping") continue;
    const [metodo, ruta] = clave.split(" ");
    rutas[clave] = async (args) => {
      const respuesta = await original(args);
      anotar(args.datos, metodo, ruta, respuesta.estado ?? 200);
      window.setTimeout(() => anotar(args.datos, metodo, ruta, 200), 5000);
      return respuesta;
    };
  }
}
