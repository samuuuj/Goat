# E · Widgets estilo Apple (rama `goat/widgets`, tanda 2)

## Para qué
"Complementos de widgets súper estilo Apple, informativos, métricos y motivacionales, relacionados con la web, para cada día, que cambien y se actualicen." Una PWA no puede crear widgets: se hacen con **Scriptable** (gratis) leyendo `GET /api/v1/widget` con el token (D-009, D-058).

## Tus archivos
- `web/scriptable/goat.js` (un solo script, todos los tamaños), `scriptable/LEEME.md` (instalación corta).
- `api/_rutas/widget.js`, `api/_lib/frases.js` (frases; si prefieres, en `api/_rutas/widget-frases.js`).
- `web/widgets.html`, `web/css/widgets.css`, `web/js/widgets/*` (`pagina.js`, `atajos.js`, `mini.js`).
- Pruebas `pruebas/widget-*.test.mjs`.

## API `GET /api/v1/widget[?dinero=1]`
Respuesta compacta (≤ 4 KB), calculada en el servidor con `cargarRegistrosServidor` + `construirResumen` y, si existen, las funciones de los otros módulos (importa de `web/js/<modulo>/logica.js` y lee sus tablas con `db`; si el módulo aún no existe en tu rama, omite ese campo sin romper):
```json
{ "fecha":"2026-10-03", "dia":"viernes", "score":72, "scoreAyer":64, "racha":5,
  "anillos":[{"clave":"registro","progreso":0.75},{"clave":"cuerpo","progreso":0.4},{"clave":"mente","progreso":0.6}],
  "pendientes":{"total":2,"primero":"🍽️ almuerzo"},
  "rutina":{"ahora":"Trabajo útil","siguiente":"Almuerzo","hora":"12:30"},
  "sueno":{"duracion":"7 h 10","indice":82},
  "desbloqueo":{"minutos":60},
  "frase":"Cinco días seguidos. No rompas la cadena hoy.",
  "dinero":{"disponibleHoy":19100}   // solo con ?dinero=1
}
```
- **Frases** (`frases.js`): 60+ frases cortas en español, sin regañar, sin montos; elegidas por contexto (mañana/tarde/noche, racha, puntaje alto/bajo, pendientes, fin de semana, festivo) y rotación diaria con semilla `fecha + franja` (cambian cada día y por franja horaria). Tono: cómplice, directo, Apple ("Lo difícil ya empezó. Sigue.").

## `scriptable/goat.js`
- Configuración arriba: `URL` y `TOKEN` (Samuel pega los mismos del atajo "⚙️ Goat"), `MOSTRAR_DINERO = false`.
- Detecta `config.widgetFamily`: `small`, `medium`, `large`, `accessoryCircular`, `accessoryRectangular`, `accessoryInline`.
  - **Pequeño:** anillo triple (dibujado con `DrawContext`: arcos con extremos redondeados, colores `#ff6a1f`, `#b4f03c`, `#3cd2ff` sobre pistas al 20%), puntaje grande en el centro, racha `🔥5`.
  - **Mediano:** anillos + puntaje a la izquierda; a la derecha "Ahora: Trabajo útil · Siguiente 12:30 Almuerzo", pendientes (`🍽️ almuerzo`), minutos de desbloqueo; frase pequeña abajo.
  - **Grande:** lo del mediano + semana (7 barras de puntaje con hoy en naranja) + sueño de anoche + frase destacada.
  - **Pantalla bloqueada:** circular = anillo de puntaje con número; rectangular = `72 · 🔥5 · falta almuerzo`; en línea = `Goat 72 · 🔥5`. **Nunca dinero.**
- Estilo: fondo `#000` (o degradado sutil a `#0d0d0f`), texto `#f5f5f7`/`#a1a1a6`, acento naranja solo para lo que falta; fuente `Font.boldRoundedSystemFont`/`Font.systemFont`; números `monospacedDigit`; márgenes y radios como widgets nativos de Apple.
- `widget.refreshAfterDate = ahora + 15 min`; guarda la última respuesta en `FileManager.local()` y la usa sin internet (con "hace X min" sutil). Error de token → mensaje claro "Revisa el token".
- `widget.url` = sección de la web (`/`, `rutina.html`, `sueno.html` según el tamaño/elemento principal).
- Si se ejecuta dentro de la app (no widget), muestra la vista previa mediana (`presentMedium()`).

## Web (`widgets.html`, titular `WIDGETS.`)
- Vistas previas en **HTML/CSS** (réplicas fieles, con datos de ejemplo o los reales del usuario vía supabase-js/`construirResumen`) de cada tamaño, en un "fondo de pantalla" oscuro.
- Guía: instalar Scriptable → nuevo script → pegar `goat.js` (botón **Copiar** que trae el archivo con `fetch('scriptable/goat.js')`) → pegar URL y token arriba del script (el archivo publicado solo trae marcadores, nunca un token) → mantener presionado el inicio › + › Scriptable › elegir tamaño › Script: Goat. Pantalla bloqueada igual.
- **Ubicación del script:** `web/scriptable/goat.js` (se publica para poder copiarlo); `scriptable/LEEME.md` en la raíz solo apunta ahí.
- Widget de **Atajos** (botones Comí/Gasto/Estudio/Gym) explicado en 3 pasos.

## Pruebas
- `node --check` del script; prueba del armado de datos de `widget.js` con Supabase simulado (sin dinero por defecto, con `?dinero=1` sí, campos opcionales ausentes sin error); frases: nunca contienen `$` ni dígitos de dinero, cambian de un día a otro, variedad por franja.
