# Fase 0 · Base compartida (rama `goat/base`, la hace el orquestador)

Objetivo: dejar listo todo lo compartido para que los 8 agentes trabajen en paralelo **sin tocar archivos comunes**.

## 1. Estilos comunes
- Crear `web/css/comun.css` moviendo desde `web/css/hoy.css` las piezas reutilizables: `.sensible` (+ `.discreto`), `.boton-circulo`, `.progreso`/`.progreso-relleno`, `.velo`/`.hoja` (+ `.abierta`, `.arrastrando`, `.hoja-manija`), `.form-registro` y clases de campos (`.campo-titulo`, `.campo-grande`, `.entrada-grande`, `.entrada-mediana`, `.dos-columnas`, `.botones`), `.boton-secundario`, `.chips`/`.chip`, `.aviso-zona`/`.aviso`, y sus keyframes. `index.html` carga `base.css`, `comun.css`, `hoy.css`. Nada debe verse distinto en Hoy.
- Agregar estilos de página de sección: `.barra-seccion` (botón "‹ Hoy" + acciones), `.seccion` (bloque con línea fina), `.tarjeta` (superficie con radio 22px, vidrio opcional `.vidrio` con `backdrop-filter`), `.lista-agrupada` (filas estilo iOS con separadores), `.fila`, `.vacio` (estado vacío), `.pestanas` (control segmentado iOS).

## 2. Piezas JS
- `web/js/piezas/chips.js`: exportar `chips(contenedor, alCambiar)` (sacarlo de `registros.js`, misma API: `{ valor, poner(v), opciones([{valor, texto}]) }`). Necesita `<template id="plantilla-chip">` en la página.
- `web/js/piezas/hoja.js`: `crearHoja({ hoja, velo, manija, fondo: [elementos para inert], alCerrar })` → `{ abrir(), cerrar(), abierta }` con resorte, arrastrar para cerrar (> 110 px o > 0,6 px/ms), Esc, clic en el velo, foco al abrir y devolución de foco. `registros.js` pasa a usarla (mismo comportamiento).
- `web/js/piezas/pagina.js`: `iniciarPagina({ titulo, vistas })` → hace `requerirSesion()`, pone el botón "‹ Hoy" (`index.html`), `iniciarDiscreto()` si hay botón ojo, y devuelve `{ sesion, mostrar(vista), manejarError(e) }` (`BaseSinInstalar` → vista falta-base; `SesionVencida` → `cerrarSesion()`; otro → `avisar("⚠️ No se pudo actualizar.")` o vista fallo).
- `web/js/supabase/datos.js`: exportar también `revisar()` (o un `leer(tabla, consulta)`) para que los módulos manejen errores igual.

## 3. Navegación y páginas vacías
- Hoy (`web/index.html` + `hoy.js` + `hoy.css`): barra superior con **🔔** (`#campana`, contador `#campana-contador`, abre lo que defina `web/js/notificaciones/campana.js`) y **⚙️** (`conectar.html#ajustes`). Nueva sección **"Secciones"** antes del pie: tarjetas grandes (titular corto + etiqueta + mini dato `data-mini`) hacia `finanzas.html` (DINERO), `rutina.html` (TU DÍA), `ejercicio.html` (MOVIMIENTO), `sueno.html` (TU NOCHE), `desbloqueo.html` (DESBLOQUEO), `widgets.html` (WIDGETS), `conectar.html` (CONECTAR IPHONE).
- Crear esas 7 páginas con el esqueleto común (barra "‹ Hoy", titular, "Pronto.") + su CSS y `pagina.js` vacíos, para que cada agente reemplace solo lo suyo.
- Stubs que los agentes llenan (cada uno el suyo):
  - `web/js/<modulo>/atajos.js` → `export const ATAJOS = [];` para finanzas, sueno, desbloqueo, rutina, ejercicio, notificaciones, widgets, conectar.
  - `web/js/conectar/bienvenida.js` → `export async function revisarBienvenida() { return false; }` (Hoy la llama al cargar; si devuelve true, va a `conectar.html`).
  - `web/js/notificaciones/campana.js` → `export function iniciarCampana(boton, contador) {}` (Hoy la llama) + `web/css/notificaciones.css` vacío **ya enlazado** desde `index.html`.
  - Hoy emite `document.dispatchEvent(new CustomEvent("goat:resumen", { detail: resumen }))` cada vez que pinta, para que la campana y otros lo usen sin recalcular.
  - `web/js/<modulo>/mini.js` → `export async function miniDato(sesion) { return null; }` (texto corto para la tarjeta de Hoy; sin montos).
- Lista de páginas privadas en `scripts/servidor-local.mjs` no cambia (sirve todo `web/`).

## 4. API
- `api/v1.js` (única función, ESM): lee `?ruta=` (de la reescritura) o el path; métodos GET/POST/PATCH/DELETE; CORS no hace falta (Atajos/Scriptable no usan CORS; la web llama mismo origen). Flujo: parsear → rutas públicas (`GET ping` sin token responde `{ok:true, datos:{version}}`; con token también confirma usuario) → autenticar (Bearer token de atajo, o JWT de sesión web para las rutas `tokens`) → límite 60/min por token → handler → `log_api` (ruta, método, estado, duración; **sin cuerpo**).
- `vercel.json`: agregar `"rewrites": [{ "source": "/api/v1/:ruta*", "destination": "/api/v1?ruta=:ruta*" }]` y cabeceras `Cache-Control: no-store` para `/api/(.*)`. Mantener todo lo demás.
- `api/_lib/`:
  - `config.js`: URL de Supabase y clave publicable desde `web/js/config.js` (import), clave secreta desde `process.env.SUPABASE_SECRET_KEY`; si falta → 503 `{codigo:"SERVIDOR_SIN_CONFIGURAR"}`.
  - `supabase.js`: cliente PostgREST mínimo con `fetch` (cabecera `apikey: <secreta>`; si la clave es JWT legado también `Authorization: Bearer`). `db = baseDeDatos(userId)` con `select(tabla, {columnas, filtros, orden, limite})`, `insert(tabla, filas)` (pone `user_id`, trata 23505 de `id_cliente` como éxito), `update`, `delete` — **siempre** con `user_id=eq.<id>`.
  - `auth.js`: `usuarioDeToken(token)` (SHA-256 hex → `api_tokens` no revocado → `user_id`; actualiza `ultimo_uso` como máximo 1 vez por minuto) y `usuarioDeSesion(jwt)` (`GET <url>/auth/v1/user` con `apikey` publicable).
  - `respuesta.js`: `ok(mensaje, datos)`, `error(codigo, mensaje, estado)`.
  - `validar.js`: `entero(v, min, max)`, `texto(v, max)`, `uno(v, lista)`, `fechaIso(v)`, `uuid(v)`.
  - `registros.js`: `cargarRegistrosServidor(db, ahora)` → el mismo objeto que `cargarRegistros()` del navegador, para `construirResumen()` de `web/js/logica/calculo.js`.
  - `notificar.js`: `notificar(db, { modulo, emoji, titulo, cuerpo, url, clave })` → inserta en `notificaciones` (sin duplicar por `clave`).
- `api/_rutas/`: `central.js` (lleno: `GET ping`, `GET hoy` → resumen, `POST tokens` (sesión web) → crea token aleatorio de 32 bytes base64url, guarda el hash, devuelve el token **una sola vez**, `GET tokens` → lista sin hash, `DELETE tokens` `{id}` → revoca, `POST checkins`) y stubs `export default {}` para finanzas, sueno, desbloqueo, rutina, ejercicio, notificaciones, widget, conectar. El enrutador une todos.

## 5. Base de datos (núcleo, `supabase/schema.sql`)
- `perfil`: `add column if not exists ajustes jsonb not null default '{}'::jsonb`.
- Nueva `notificaciones`: `id`, `user_id default auth.uid()`, `modulo` (lista de checkins.modulo + 'notificaciones','conectar'), `emoji` (≤ 8), `titulo` (≤ 60), `cuerpo` (≤ 160), `url` (≤ 200, ruta relativa), `clave` (≤ 80, unique con user_id), `leida_en`, `descartada_en`, `momento`, `fecha` generada, `origen`, `creado_en`; RLS completo (select/insert/update/delete propio).
- `api_tokens`: el navegador solo lee (ya); escribir solo desde la API.
- Encabezados vacíos (con el formato de los existentes) **antes de "Comprobación"**, con 2 líneas en blanco entre ellos: `6. SUEÑO · dueña: 04 · Sueño`, `7. DESBLOQUEO · dueña: 03 · Desbloqueo`, `8. RUTINA · dueña: 08 · Rutina`, `9. NOTIFICACIONES (reglas) · dueña: Central`. Finanzas (2), Universidad (4) y Ejercicio (5) ya existen: cada agente agrega al final de la suya.

## 6. Pruebas
- `package.json`: `"test": "node --test pruebas/"`; devDependency `@electric-sql/pglite`.
- `pruebas/ayuda/sql.mjs`: PGlite con roles `anon`/`authenticated`, esquema `auth` simulado (`auth.users`, `auth.uid()` vía `set_config`), privilegios por defecto como Supabase; utilidades `comoUsuario(id, fn)`.
- `pruebas/ayuda/supabase-falso.mjs`: simula el PostgREST para probar rutas de la API en memoria.
- `pruebas/schema.test.mjs`: schema 2 veces; cada tabla con RLS; otra cuenta ve 0 filas; `anon` sin permisos.
- `pruebas/api-central.test.mjs`: sin token → 401; token revocado → 401; token válido → ping ok; crear token solo con sesión.
- `pruebas/calculo.test.mjs`: los 5 escenarios conocidos (día vacío, requisitos por hora, día completo de madrugada, pasarse del presupuesto, festivo/fin de semana).

## 7. Comprobar y publicar la base
- `npm test` en verde; `npm run local`: Hoy igual que antes + barra 🔔/⚙️ + Secciones; las 7 páginas cargan con sesión; consola sin CSP.
- Push de `goat/base` → vista previa de Vercel: `/api/v1/ping` responde JSON (confirma funciones + `outputDirectory: web` + reescritura). Si no responde, arreglar antes de lanzar agentes.
