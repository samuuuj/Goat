# E · Widgets estilo Apple — resultado (rama `goat/widgets`)

## Qué quedó hecho
**Una sola fuente para todos los widgets** (principio 1): `armarWidget()` en `web/js/widgets/logica.js` arma la respuesta a partir de
`construirResumen()` (puntaje, racha, anillos, semana, pendientes) y de las funciones de cada módulo (rutina, sueño, desbloqueo).
La usan la API, la página Widgets y el simulador, así todos muestran exactamente lo mismo.

**API** `GET /api/v1/widget` (`api/_rutas/widget.js`), con token (o sesión web), ≤ 4 KB:
- `score`, `scoreAyer`, `racha`, `anillos` (registro, cuerpo, mente), `semana` (7 días con letra y hoy marcado),
  `pendientes` (`total`, `primero` "🍽️ Almuerzo", `texto` "almuerzo y check-in de gastos"), `rutina` (ahora · quedan · siguiente · hora),
  `sueno` ("7 h 10", índice, "Anoche"/"En cama"), `desbloqueo` (abierto, minutos por app, apps), `avisos` (sin leer), `frase`,
  `abrir` (lo que se abre al tocar: `index.html#registrar=comida`, `rutina.html` o Hoy) y `bloqueo` (los textos de la pantalla bloqueada).
- **Sin dinero** salvo `?dinero=1` → `dinero.disponibleHoy`. Nunca en `bloqueo`, `mensaje` ni `frase` (D-020).
- Reusa `cargarRegistrosServidor` + `construirResumen`, `cargarDesbloqueo` + `estadoDesbloqueo`, la ruta `GET sueno/resumen`,
  la ruta `GET notificaciones` y `ahoraYSiguiente(estadoDelDia(…))` de rutina. Una envoltura con memoria hace que cada consulta
  a Supabase se haga **una sola vez** por llamada aunque varias partes la pidan.
- **Cada parte que falla se omite** (tabla sin instalar → ese campo sale `null`); solo si falla el núcleo responde 503
  "🛠️ Falta actualizar la base de datos" y el script usa lo guardado.

**Frase del día** (`web/js/widgets/frases.js`): 71 frases cortas (≤ 60 caracteres), sin cifras ni montos, sin regaños. Contextos:
mañana, tarde, noche, madrugada, racha (con el número: "5 días seguidos. No rompas la cadena hoy."), puntaje alto, subiendo,
pendientes ("Registrar algo malo también cuenta."), puntaje bajo (solo de tarde/noche), al día, fin de semana, festivo, lunes y viernes.
Rotan cada día con una semilla `fecha + franja + contexto`: dos días seguidos nunca repiten frase y no cambia en cada refresco.

**Script de Scriptable** (`web/scriptable/goat.js`, un solo archivo, todos los tamaños):
- **Pequeño:** anillo triple dibujado (arcos con puntas redondas sobre pistas al 20 %) con el puntaje en el centro, día y 🔥racha arriba,
  "● Falta almuerzo" (naranja) o "✓ Todo al día" abajo.
- **Mediano:** anillos + puntaje; a la derecha día, 🔔 avisos, 🔥racha, "🎯 Trabajo útil / 40 min · luego 17:00 Ejercicio", lo que falta
  y minutos de desbloqueo (o el dinero, si lo activas); frase abajo.
- **Grande:** lo del mediano + leyenda de anillos con %, "Ayer 64 · hoy 72", semana en 7 barras (hoy en naranja), sueño de anoche y
  la frase destacada.
- **Pantalla bloqueada:** circular = medidor abierto abajo con el puntaje; rectangular = "72 pts · 🔥5 / Falta almuerzo / 17:00 Ejercicio";
  en línea = "Goat 72 · 🔥5". **Nunca pide ni muestra dinero.**
- Fondo negro con degradado a `#0d0d0f`, letra redondeada del sistema, un solo naranja (lo que falta). Se refresca cada 15 min.
- Al tocar abre Goat donde toca; en mediano y grande cada zona tiene su enlace (anillos → Hoy, rutina → Tu día, minutos → Tu tiempo,
  sueño → Tu noche).
- **Sin internet** usa la última respuesta guardada (con "hace 20 min" sutil). La copia guardada **no lleva el dinero**.
  Llave mala → "🔑 Revisa el token". Sin configurar → "⚙️ Conecta Goat".
- **La llave nunca va en el archivo**: la primera vez que lo tocas en Scriptable pide la dirección y la llave (las del atajo ⚙️ Goat),
  las prueba y las guarda en el **Llavero** del iPhone. Acepta la dirección con o sin `/api/v1`. Después, tocarlo abre un menú:
  ver mediano/pequeño/grande/pantalla bloqueada, mostrar u ocultar el dinero, cambiar dirección o llave, desconectar.
- Pantallas bajas (iPhone SE): anillos y barras más chicos para que todo quepa.

**Web** (`widgets.html`, titular `WIDGETS.`): réplicas en HTML/CSS de cada tamaño sobre un "fondo de pantalla" oscuro (pantalla de
inicio con pequeño, mediano, grande y un widget de Atajos; pantalla bloqueada con hora, en línea, circular y rectangular), con tus
datos de hoy (armados en el navegador con supabase-js, igual que la API) o de ejemplo si no se pueden leer. Botón "💸 Dinero en
mediano y grande" (borroso en modo discreto). La frase de hoy en grande. Guía en 5 pasos con **Copiar script** (trae
`scriptable/goat.js` al cargar; si el portapapeles moderno falla, copia con un texto oculto) y **Copiar dirección**. Pasos de la
pantalla bloqueada, del **widget de Atajos** (4 botones: Comí, Movimiento, Estudio, Entreno) y opciones.
`mini.js`: la tarjeta "Widgets." de Hoy muestra la frase del día.

**Atajos** (`web/js/widgets/atajos.js`): "🍽️ Comí" y "📚 Estudio" (abren Goat con la hoja lista: `index.html#registrar=…`) y la
guía del widget de Atajos en carpeta "Goat". Formato común, prueba con `GET widget`.

## Archivos
`api/_rutas/widget.js` · `web/js/widgets/{logica,frases,datos,vista,pagina,atajos,mini}.js` · `web/widgets.html` · `web/css/widgets.css` ·
`web/scriptable/goat.js` · `pruebas/widgets-{api,frases,scriptable,atajos}.test.mjs` · `pruebas/navegador/datos-widgets.js` ·
`.claude/objetivos/SOLICITUDES.md` (sección E) · este archivo.

## Cómo probarlo
- `npm test` → 274 en verde (40 de widgets: 10 de API, 10 de frases y armado, 17 del script, 3 de guía y CSP).
  Las del script **corren `goat.js` de verdad** en un Scriptable de mentira (ListWidget, DrawContext, Request, Keychain, Alert…)
  para los 6 tamaños, sin internet, con token malo, servidor caído, sin configurar, y el menú dentro de la app.
- `node --check web/scriptable/goat.js` → sin errores.
- `npm run local` → `http://localhost:3000/_pruebas/widgets.html` (y `?escenario=vacio`). La tarjeta de Hoy en `/_pruebas/index.html`.
- Revisado a 375, 768 y 1440 px: sin desborde horizontal ni errores en la consola (CSP limpia). Copiar script probado con un toque real.

## Lo que Samuel debe hacer a mano (iPhone, ~5 min)
1. Tener la llave y el atajo **⚙️ Goat** (asistente Conectar iPhone).
2. Instalar **Scriptable** (gratis) desde la App Store.
3. En Goat › Widgets tocar **Copiar script** → Scriptable › "+" › pegar → nombre **Goat**.
4. Tocar el script una vez: pegar la dirección de Goat (botón **Copiar dirección**) y la llave → "✅ Conectado".
5. Pantalla de inicio: mantener presionado › Editar › Añadir widget › Scriptable › tamaño › tocar el widget › Script: **Goat**.
   Pantalla bloqueada: Personalizar › recuadro bajo la hora (o la fecha) › Scriptable › Script: Goat.
6. Opcional: atajos "🍽️ Comí" y "📚 Estudio" y el widget de Atajos con la carpeta "Goat".
7. En Vercel debe estar `SUPABASE_SECRET_KEY` (sin ella, el widget dice "🛠️ Falta configurar el servidor").

## Decisiones de gusto (lo más simple; Samuel puede cambiarlas)
- Dirección y llave en el **Llavero** (no arriba del script): así el archivo publicado y el que pega son el mismo y nunca llevan la llave.
  Por eso, tocar el script en la app abre un menú (la ficha decía "mostrar el mediano"; es la primera opción del menú).
- Dinero apagado por defecto; se enciende desde el menú del script (o con "dinero" en el campo Parameter de un widget).
- La racha se escribe con 🔥 y se omite si es 0. El naranja solo marca lo que falta (y hoy en las barras).
- El pequeño muestra lo que falta abajo (no la rutina) porque es lo que desbloquea.
- La tarjeta de Hoy muestra la frase del día (y no el puntaje, que ya está en Hoy).

## Límites conocidos (honestos)
- iOS decide cuándo refresca: pedimos cada 15 min, pero puede tardar más (sobre todo con poca batería).
- Tocar un widget abre **Safari**, no la app instalada en el inicio (iOS no deja abrir una PWA desde un enlace). La primera vez
  puede pedir entrar a Goat en Safari, porque no comparte la sesión con la app instalada.
- Los widgets de la pantalla bloqueada iOS los pinta en un solo tono: los anillos de colores solo se ven en la pantalla de inicio.
- Scriptable no tiene números con ancho fijo en su letra redondeada: las cifras pueden "bailar" un pixel al cambiar.
