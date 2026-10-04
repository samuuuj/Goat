# Reglas comunes para todos los agentes (leer primero)

Proyecto **Goat**: sistema personal de Samuel (estudiante en Colombia, iPhone sin Apple Watch). Web HTML + CSS + JavaScript sin frameworks (módulos ES, sin compilación), instalada como PWA; Supabase (Postgres + Auth); Vercel publica `web/`; Atajos de iOS y Scriptable hablan con `/api/v1`.
Lee también: `CLAUDE.md` (raíz), `PLAN.md` (esta carpeta) y la ficha de tu objetivo. `docs/` **no existe en GitHub**: todo lo que necesitas está en estas fichas y en el código.

## Cómo trabajas
- Trabajas en **tu rama** `goat/<objetivo>` (creada desde `goat/base`) y **solo en tus archivos** (los lista tu ficha). Commits en tu rama con prefijo `[<objetivo>] …` y el autor que ya está configurado (correo privado de GitHub; nunca otro). Nada de `main`.
- Si necesitas algo de un archivo compartido que no está en tu lista, **no lo toques**: anótalo en `.claude/objetivos/SOLICITUDES.md` de tu rama (sección con tu objetivo) y sigue con un plan B dentro de tus archivos. El orquestador lo integra.
- Al terminar: `npm test` en verde, revisión en el navegador (abajo) y un resumen corto en `.claude/objetivos/<tu-letra>-RESULTADO.md` (qué hiciste, archivos, cómo probarlo, qué debe hacer Samuel a mano, límites conocidos).
- Habla poco y haz mucho: Samuel prefiere que se ejecute; solo él decide gustos personales. Si hay una duda de gusto, elige lo más simple y anótalo en tu RESULTADO.

## Lo que el iPhone permite (no prometas magia)
- Una web/PWA **no puede**: leer Salud ni Tiempo en pantalla, bloquear apps, crear widgets nativos, ejecutar atajos por sí sola ni pedir permisos del iPhone. Los permisos (Salud, Recordatorios, notificaciones de Atajos) los pide iOS cuando un **Atajo** corre la primera vez.
- **Atajos**: se arman **a mano** en el iPhone (un `.shortcut` sin firmar en Mac no se instala). Tu módulo entrega una **guía paso a paso** en `web/js/<modulo>/atajos.js` (formato abajo). Los atajos son clientes delgados: piden menús y mensajes a la API, no calculan nada.
- **Automatizaciones** (iOS 17+/18, "Ejecutar inmediatamente", sin notificar): Hora del día; App › Se abre / Se cierra; Sueño › Hora de relajarse / Hora de dormir comienza / Despertar (requiere horario de sueño en Salud); Alarma › Se detiene; Cargador › Se conecta; Modo de concentración › Se activa/desactiva; NFC; Llegar/Salir de un lugar.
- Acciones útiles: "Obtener contenido de URL" (GET/POST JSON con encabezados), "Buscar muestras de salud" (sueño, pasos, distancia), "Añadir recordatorio nuevo" (con alerta y lista), "Buscar recordatorios" (completados hoy), "Mostrar notificación", "Ir a la pantalla de inicio", "Elegir del menú", "Elegir de la lista", "Pedir entrada", "Abrir URL".
- Desbloqueo = **fricción, no candado** (al abrir la app la automatización manda a inicio si no hay minutos).
- Sin Apple Watch: sueño desde el horario de sueño de Salud ("En cama") + eventos; pasos/distancia del iPhone; entrenos con atajo de inicio y fin.

## Diseño (obligatorio; referencia viva: `web/index.html`, `web/css/base.css`, `web/css/comun.css`, `web/css/hoy.css`)
- **Siempre oscuro, estilo Apple, editorial cinético.** Tokens en `base.css`: `--fondo #000`, `--superficie #0d0d0f`, `--superficie-2 #1c1c1e`, `--linea` (blanco 9%), `--texto #f5f5f7`, `--texto-2 #a1a1a6`, `--texto-3 #6e6e73`, **un solo acento `--acento #ff6a1f`** (solo lo accionable, lo que falta, el botón principal, hoy). Colores de anillos (`--anillo-registro`, `--anillo-cuerpo #b4f03c`, `--anillo-mente #3cd2ff`) **solo** en anillos y sus leyendas.
- Tipografía: titulares `.titular` (Archivo ExtraBold, ancho variable 62–125%, mayúsculas, interlineado .86); texto con la fuente del sistema; `.etiqueta` (0,72rem, mayúsculas, gris); cifras `.cifras` (tabulares).
- Cada pantalla empieza con un **titular editorial de 2 a 4 palabras** (ej. `DINERO.`, `TU NOCHE.`). Una idea por sección, separadas por línea fina; números grandes + frase corta.
- Movimiento solo con CSS: `var(--curva)` para todo, `var(--resorte)` para lo que rebota; entradas con máscara (`translateY(110%) → 0`, 90 ms entre líneas); números que cuentan (`contar()`), barras/anillos que se llenan al verse (`alVerse()`); `:active { transform: scale(.97) }`; **respetar `prefers-reduced-motion`**.
- Formularios en **hoja inferior** (`web/js/piezas/hoja.js`) con **chips** (`web/js/piezas/chips.js`) y campos grandes; registrar en < 15 s.
- **Dinero siempre con `.sensible`** (borroso en modo discreto; `iniciarDiscreto()`).
- Celular primero (375 px), cortes `48rem` y `64rem`; usa `.contenedor` y sus variables (`--margen`, `--ancho`); zonas seguras `env(safe-area-inset-*)`.
- Avisos en la app: `avisar("💸 Guardado")` (emoji + 1–2 palabras).

## Seguridad (obligatorio)
- **CSP estricta** (`vercel.json`): nada de `<script>` ni `style="…"` en línea, nada de scripts de otros dominios, nada de `eval`. Valores dinámicos con CSSOM (`el.style.setProperty("--x", v)`).
- Datos en pantalla **solo** con `textContent` / `<template>` + `clonar()`; **nunca `innerHTML`** con datos.
- En el navegador solo la clave **publicable** (`web/js/config.js`). La clave secreta **solo** en el servidor (`process.env.SUPABASE_SECRET_KEY`), nunca en `web/`, nunca en logs, nunca en el chat.
- **Sin montos** en notificaciones, mensajes de atajos, widgets de pantalla bloqueada ni frases (D-020). Ej.: `💸 Guardado · Comida`, nunca `$25.000`.
- Toda tabla nueva (en tu sección de `supabase/schema.sql`):
  ```sql
  create table if not exists public.<modulo>_<cosa> (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
    momento     timestamptz not null default now(),
    fecha       date generated always as (public.dia_logico(momento)) stored,  -- si aplica
    origen      text not null default 'web' check (origen in ('atajo','web','automatizacion','widget')),
    id_cliente  uuid unique,
    creado_en   timestamptz not null default now()
    -- + tus columnas con check (largos, rangos, listas cerradas)
  );
  create index if not exists … on public.<tabla> (user_id, fecha);
  revoke all on table public.<tabla> from anon, authenticated;
  grant select, insert, update, delete on table public.<tabla> to authenticated;
  alter table public.<tabla> enable row level security;
  drop policy if exists <tabla>_propias on public.<tabla>;
  create policy <tabla>_propias on public.<tabla> for all to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  ```
- `schema.sql` es **repetible** y **solo se agrega**: `create … if not exists`, `alter table … add column if not exists`, `drop … if exists` antes de recrear políticas/restricciones/triggers. Escribe **solo dentro de la sección de tu módulo** (tiene un encabezado con tu nombre). No reescribas lo que ya corrió en producción.

## Convenciones de código
- Español sin tildes ni ñ en nombres de tablas, columnas, rutas y archivos (`sueno`, `anio`). UI en español con tildes.
- Dinero en **COP enteros**. Día lógico: `America/Bogota`, el día termina a las **04:00** (`diaLogico()` en `web/js/logica/dia.js`, `dia_logico()` en SQL).
- Lógica pura de tu módulo en `web/js/<modulo>/logica.js` (sin DOM ni internet) para que la reusen la página y la API.
- Página: `web/<modulo>.html` + `web/css/<modulo>.css` + `web/js/<modulo>/pagina.js` (módulo ES). Arranca con `iniciarPagina()` de `web/js/piezas/pagina.js` (sesión, vistas, errores, botón "‹ Hoy", modo discreto). Lee y escribe tablas **directo con supabase-js y RLS** (`supabase` de `web/js/supabase/sesion.js`; `guardar()` de `datos.js` o tus propias funciones en `web/js/<modulo>/datos.js`).
- Plantillas `<template id="plantilla-…">` en tu HTML; `clonar(id)` de `web/js/piezas/ui.js`.
- Cada registro nuevo lleva `id_cliente` (`nuevoId()`), para no duplicar con doble toque.
- Para usar datos de otro módulo: léelos (select con RLS) o llama su función exportada de `logica.js`; **no escribas en tablas ajenas** (excepto `notificaciones` vía `notificar()` en la API).

## API (`/api/v1`, una sola función)
- Archivo de rutas de tu módulo: `api/_rutas/<modulo>.js`, que exporta un objeto `{ "GET finanzas/menu": handler, "POST finanzas/movimientos": handler, … }`. El enrutador `api/v1.js` ya lo importa. Firma: `async (ctx) => respuesta`, con `ctx = { metodo, ruta, query, cuerpo, usuario: { id }, db, ahora }`; usa los ayudantes de `api/_lib/` (`ok(mensaje, datos)`, `error(codigo, mensaje, estado)`, `db.select/insert/update/delete` ya filtrados por `user_id`, `notificar()`, `validar`).
- Respuesta: `{ ok: true, mensaje, datos }` o `{ ok: false, mensaje, codigo }`. `mensaje` es para mostrar tal cual en el iPhone: **emoji + pocas palabras, sin montos**.
- Todo POST acepta `id_cliente` (idempotencia) y `origen`. Fechas ISO 8601 con zona; sin `momento` → hora del servidor. Atajos no tiene acción de UUID: si falta `id_cliente`, la API lo genera e ignora un registro idéntico del mismo usuario recibido en los últimos 60 s (reintentos).
- El token se valida **antes de todo** (lo hace el enrutador). No registres cuerpos con dinero en `log_api`.

## Guía de atajos (`web/js/<modulo>/atajos.js`)
```js
export const ATAJOS = [{
  id: "finanzas-movimiento", emoji: "💸", nombre: "Movimiento",
  para: "Registrar gasto, ingreso, transferencia o retiro en segundos.",
  pasos: ["Abre Atajos › + › …", "…"],                // pasos exactos, en orden, con nombres de acciones de iOS en español
  automatizacion: null,                               // o { disparador: "Sueño › Despertar", pasos: [...] }
  permisos: ["Salud: análisis del sueño"],            // lo que iOS pedirá al correrlo
  prueba: { metodo: "GET", ruta: "finanzas/menu" }    // para el botón "Probar" del asistente Conectar
}];
```
Todos los atajos usan el atajo base **"⚙️ Goat"** (devuelve un diccionario `{url, token}`) con "Ejecutar atajo" para no repetir la URL ni el token.

## Pruebas (obligatorio)
- `npm test` (`node --test pruebas/`): pruebas de tu `logica.js`, de tus rutas de API con el Supabase simulado de `pruebas/ayuda/` y de tu SQL con PGlite (`pruebas/ayuda/sql.mjs`: corre `schema.sql` 2 veces, otra cuenta no ve lo tuyo, `anon` bloqueado).
- Navegador: `npm run local` → **http://localhost:3000/_pruebas/<tu-pagina>.html** (mismas cabeceras que Vercel + un **simulador**: sesión falsa y Supabase/API en memoria, nunca toca la base real; ver `pruebas/navegador/simulador.js`). Tus datos de prueba van en `pruebas/navegador/datos-<modulo>.js` (`agregar(datos, usuario)` para filas de tus tablas y `api(api, usuario)` para respuestas simuladas de tus rutas). `?escenario=vacio` para probar el estado vacío. Revisa tu página a 375, 768 y 1440 px, consola sin errores de CSP, modo discreto, movimiento reducido.
- Ayudas de pruebas ya listas: `pruebas/ayuda/sql.mjs` (`crearBase({veces:2})`, `comoUsuario`, `comoAnon`, `una`, `USUARIO_A/B`) y `pruebas/ayuda/supabase-falso.mjs` (`crearSupabaseFalso({datos, sesiones})`, `llamar(falso, "POST finanzas/movimientos", {token, cuerpo})`, `jwtFalso()`); ejemplo completo en `pruebas/api-central.test.mjs`. Para obtener un token de atajo en una prueba: `POST tokens` con un JWT de sesión (ver `conToken()` en ese archivo). Si tu tabla tiene otra columna única además de `id_cliente`, pásala en `crearSupabaseFalso({ unicas: { mi_tabla: [["col1","col2"]] } })`.
- `pruebas/schema.test.mjs` revisa **todas** las tablas (también las tuyas): RLS, política con `auth.uid()`, `user_id default auth.uid()` y nada para `anon`. Tiene que seguir en verde.
- Nunca escribas en la base de datos real de Samuel ni uses claves reales.
