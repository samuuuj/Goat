# Sistema Personal: contexto compartido para todas las sesiones

> Claude lee este archivo al iniciar cualquier sesión en esta carpeta (`C:\Users\Admin\OneDrive\Documents\Samuel UNI\WEB PROPIA`). Es la fuente de verdad común entre las sesiones de cada módulo. Mantenerlo corto: el detalle vive en `docs/`.
> **Toda la web vive y se modifica solo en esta carpeta (D-044).** `C:\dev\sistema-personal` es una copia vieja: no tocarla.
> **El repositorio de GitHub es público (D-047):** nada de claves secretas ni datos sensibles en archivos que se suben (la clave publicable en `web/js/config.js` sí se sube, D-050). `docs/` **no se sube** (D-048): vive solo aquí y en OneDrive. Commits con el correo privado de GitHub.

## Qué es
**Goat**: sistema personal de Samuel (estudiante universitario en Colombia) para automatizar el día, evitar procrastinar y cumplir metas.
Web en HTML, CSS y JavaScript instalada como app en el iPhone (PWA) + Atajos de iOS que envían datos + widgets con métricas.

**Mecánica clave: registrar desbloquea ocio.** Si los registros del día no están al día, abrir TikTok, Instagram, YouTube o un videojuego dispara un atajo que pide registrar primero (D-033).

## Stack (D-046)
- **HTML + CSS + JavaScript** sin frameworks ni compilación (módulos ES). Todo lo que ve el navegador está en **`web/`**; se abre con **Live Server** de VS Code, configurado para servir solo esa carpeta (`.vscode/settings.json`).
- Supabase (Postgres + Auth) desde el navegador con la clave publicable; la protección está en la base de datos (RLS). Vercel publica el sitio estático.
- Atajos de iOS → `/api/v1/...` con token personal (`Authorization: Bearer`): una sola función de Vercel `api/v1.js` (D-052), rutas por módulo en `api/_rutas/`, piezas en `api/_lib/`. Necesita `SUPABASE_SECRET_KEY` en Vercel.
- Widgets: **Scriptable** leyendo `/api/v1/widget`. Una PWA no puede crear widgets nativos.
- Datos de Salud (sueño, pasos, entrenos) **solo llegan vía Atajos**: no existe API web de HealthKit.
- Comandos (PowerShell; si `node` no aparece, refrescar el PATH): `npm test` (pruebas; PGlite + Supabase simulado, nunca la base real) · `npm run local` (servidor en http://localhost:3000 con las cabeceras de Vercel) · `npm run config` (reescribe `web/js/config.js` desde `.env.local`; Vercel corre el mismo script para revisarlo al publicar). Vista previa de Claude: `.claude/launch.json` → "web".

## Principios (no romper sin registrarlo en docs/DECISIONES.md)
1. **Las reglas viven en un solo lugar.** El cálculo del día está en `web/js/logica/calculo.js` y lo usarán también las funciones de `api/v1/`. Los atajos son clientes delgados: piden menús y mensajes a la API.
2. **Registrar debe tomar menos de 15 segundos**, y **máximo 4 registros manuales al día**; lo demás, automático.
3. **El desbloqueo exige registros, no metas.** Registrar algo "malo" cuenta como registro completo. Nunca incentivar mentir.
4. **Siempre existe "nada que registrar"** (hoy no gasté, no desayuné) como registro válido.
5. **Día lógico:** zona `America/Bogota` (UTC−5), el día termina a las **04:00**.
6. Dinero en **COP como enteros**.
7. Idioma: UI, rutas de API, tablas y columnas en **español sin tildes ni ñ** (`sueno`, `anio`).
8. **Diseño: seguir `docs/DISENO.md`.** Editorial cinético, siempre oscuro, estilo Apple, un solo acento naranja, anillos de progreso.
9. **Discreción:** dinero oculto por defecto (`.sensible`); notificaciones solo con emoji, sin montos ni sonido.
10. **Seguridad (`docs/SEGURIDAD.md`):** RLS y `revoke … from anon` en toda tabla; en el navegador solo la clave publicable; datos en pantalla siempre con `textContent` (nunca `innerHTML`); nada de scripts ni estilos en línea (la CSP los bloquea); nunca claves secretas en el código ni claves en el chat.
11. **Git (D-050):** no hacer commit ni push hasta que Samuel lo pida. Cuando diga **"commit and push"**, hacer los dos: antes revisar con `git diff --cached` que no vaya `sb_secret_`, `service_role`, su correo personal ni `docs/`; después confirmar que Vercel publicó. Si el cambio toca `supabase/schema.sql`, decirle que lo pegue en Supabase › SQL Editor › Run (lo hace él a mano).

## Mapa del proyecto
- **`web/`** (la página; lo único que se publica): `index.html` (inicio) · `login.html` (entrada) · `manifest.webmanifest` · `robots.txt` · `img/` · `fuentes/`
  - Secciones: `finanzas.html`, `rutina.html`, `ejercicio.html`, `sueno.html`, `desbloqueo.html`, `widgets.html`, `conectar.html` (asistente del primer uso y Ajustes). Cada una con `web/css/<modulo>.css` y `web/js/<modulo>/` (`logica.js` puro y compartido con la API, `pagina.js`, `datos.js`, `atajos.js` con las guías de Atajos, `mini.js` para su tarjeta en Hoy). La 🔔 es `web/js/notificaciones/`. `web/scriptable/goat.js`: widget de Scriptable.
  - `web/css/`: `base.css` (colores, letras, responsive) · `comun.css` (piezas compartidas: hoja, chips, filas, tarjetas) · `login.css` · `hoy.css` · uno por sección.
  - `web/js/paginas/`: `login.js`, `hoy.js` (lo que carga cada HTML) · `web/js/piezas/`: `registros.js` (hojas de registro), `hoja.js`, `chips.js`, `pagina.js` (arranque de cada sección), `ui.js` · `web/js/logica/`: `calculo.js` (resumen y puntuación), `dia.js`, `formato.js`, `catalogos.js`, `cruces.js` (reglas entre módulos) (funciones puras, sin pantalla ni internet) · `web/js/supabase/`: `sesion.js` (conexión y "mantener sesión"), `datos.js` (leer y guardar) · `web/js/vendor/supabase.js`.
  - `web/js/config.js`: URL y clave publicable de Supabase. Se sube (D-050); se cambia con `npm run config`.
- `supabase/schema.sql` · `scripts/` (`crear-config.mjs`, `servidor-local.mjs`) · `vercel.json` (cabeceras de seguridad y publicación) · `.vscode/settings.json` (Live Server solo sirve `web/`).
- `supabase/schema.sql`: **toda la base de datos en un solo archivo** (D-045), una sección por módulo. Se pega completo en Supabase › SQL Editor › Run; es repetible. `supabase/borrar-datos.sql`: vacía todos los registros (menos festivos) y deja el perfil en las metas de arranque; no se puede deshacer.
- `docs/ESTADO.md`: tablero compartido. **Leer al empezar, actualizar al terminar.**
- `docs/DECISIONES.md`: decisiones tomadas y preguntas abiertas para Samuel.
- `docs/SEGURIDAD.md`: **leer antes de tocar login, tablas, API o cabeceras.**
- `docs/ROADMAP.md` · `docs/ARQUITECTURA.md` · `docs/DISENO.md` · `docs/SESIONES.md` · `docs/SETUP.md`
- `docs/modulos/NN-*.md`: especificación de cada módulo. `docs/contexto/`: material que trajo Samuel (chat web).

## En la nube o en una rama `goat/*` (D-051)
`docs/` no existe en GitHub. Las sesiones y agentes que trabajan en la nube leen **`.claude/objetivos/`** (empezar por `LEEME.md` y `00-comun.md`): plan aprobado, reglas de diseño y seguridad, y la ficha de cada objetivo. Un objetivo por rama `goat/<objetivo>`; todo se une en `goat/integracion`; `main` solo cambia cuando Samuel dice "publica".

## Protocolo entre sesiones
Cada módulo tiene su propia sesión ("01 · Finanzas", "02 · Comidas", …). La sesión "00 · Central" coordina e integra.
1. Al empezar: leer este archivo, `docs/ESTADO.md`, `docs/DECISIONES.md`, `docs/DISENO.md` y el doc del módulo.
2. Editar solo los archivos del propio módulo (ver `docs/SESIONES.md` › Propiedad de archivos). Para cambiar algo compartido, dejar una solicitud en `docs/ESTADO.md` › Solicitudes a Central.
3. Decisión nueva → añadirla al final de `docs/DECISIONES.md` con la sesión como autora.
4. Al terminar: actualizar la sección propia en `docs/ESTADO.md`. El commit (prefijo del módulo, `[finanzas] …`) solo cuando Samuel lo pida.
5. Hablarle a Samuel en español, con ejemplos concretos y sin jerga. Samuel prefiere que Claude ejecute y solo le pregunte lo que únicamente Samuel puede decidir.
