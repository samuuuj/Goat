# Solicitudes a Central (cambios en archivos que no son del objetivo)

## F · Notificaciones

1. **`web/js/paginas/hoy.js` · abrir el registro desde una notificación.** Al tocar un aviso de pendiente
   ("🍽️ Almuerzo pendiente"), el panel se cierra, baja hasta "Lo que falta" y emite
   `document.dispatchEvent(new CustomEvent("goat:registrar", { detail: { clave, notificacion } }))`
   (`clave` = la de `calculo.js`: `almuerzo`, `checkin_finanzas`…). Propuesta para Hoy, 4 líneas:
   ```js
   const ACCION = { desayuno: "comida", almuerzo: "comida", cena: "comida", checkin_finanzas: "gasto", cierre_finanzas: "gasto" };
   document.addEventListener("goat:registrar", (e) => {
     const accion = ACCION[e.detail?.clave];
     if (accion) registro.abrir(accion, e.detail.clave);
   });
   ```
   Sin esto, todo funciona igual: solo no se abre la hoja sola.

2. **Integración · pendientes de otros módulos.** Cuando `faltantes()` de `calculo.js` sume los bloques
   obligatorios de la rutina (plan de integración), conviene que cada pendiente nuevo traiga `modulo`
   (ej. `{ clave: "rutina:<id>", emoji: "🗓️", texto: "Caminata", accion: "rutina", modulo: "rutina" }`).
   `reglas.js` ya lo usa (si falta, lo adivina por la clave) y `GET notificaciones/ahora` lo incluye solo.

3. **`pruebas/navegador/simulador.js` · carrera al cargar datos.** Si varias consultas arrancan a la vez,
   `cargarDatos()` corre `ejemplo()` y los `agregar()` de cada módulo más de una vez sobre el mismo objeto
   (con datos que se agregan al final, se duplican). Arreglo: guardar la promesa, no el resultado
   (`let datos = null; let cargando = null; … return (cargando ??= (async () => { … })());`).
   Mi `datos-notificaciones.js` ya es idempotente, así que no me afecta.

4. **Otros módulos (opcional).** Para avisar desde la web: `import { notificarLocal } from "../notificaciones/datos.js"`
   y `notificarLocal({ modulo: "sueno", emoji: "🌙", titulo: "Dormiste 7 h", url: "sueno.html", clave: "sueno:noche:<fecha>" })`.
   Desde la API: `notificar(db, {...})` de `api/_lib/notificar.js` (ya existía). Siempre con `clave` para no duplicar y sin montos.

## C · Sueño

1. **`pruebas/navegador/simulador.js` (Central): `ajustes_poner` falla en el simulador.** La rama `rpc/` hace
   `return respuesta(null, 204)`, y `respuesta()` convierte `null` en el texto `"null"`: un 204 con cuerpo hace que
   `new Response` lance un error, y supabase-js lo ve como fallo (en sueno.html sale "⚠️ No se pudo actualizar" al
   guardar metas, solo en el simulador; en Supabase real funciona). Arreglo: en esa rama,
   `return new Response(null, { status: 204 });`. Afecta a cualquier módulo que use `guardarAjuste()`.
2. **Conectar (B): leer `automatizaciones` y `requisitos` de cada atajo.** Los atajos de sueño tienen varias
   automatizaciones: `automatizaciones` es la lista completa y `automatizacion` es la primera (para el formato común).
   `requisitos` dice qué tener listo antes (atajo base "⚙️ Goat" y horario de sueño de Salud con "Registrar tiempo en
   cama con el iPhone").
3. **Widgets (E): sueño de anoche.** Usar `resumenSueno({ eventos, muestras, metas }, ahora)` de
   `web/js/sueno/logica.js` (o la ruta `GET sueno/resumen`): `ultimaNoche.duracionMin`, `ultimaNoche.etiqueta === "Anoche"`,
   `indice.valor`, `enCurso`. `duracionCorta(min)` da "7 h 10".
4. **Metas de sueño.** Se pueden cambiar en sueno.html y se guardan en `perfil.ajustes.sueno` con `ajustes_poner`
   (para no reescribir `perfil.metas`, que es de Central). La web y la API leen `{ ...perfil.metas, ...perfil.ajustes.sueno }`.
   Si Central hace un editor de metas general, conviene respetar ese orden o pasar las metas de sueño a `perfil.metas`.
5. **Notificaciones (F):** al despertar, la API crea un aviso `modulo: "sueno"`, `clave: "sueno:<fecha de la noche>"`,
   `url: "sueno.html"` ("☀️ Dormiste 7 h 10" + índice y frase). Sin montos.
6. **Idea para Central (no hecha):** `hoy.js` ya tiene `VERBO_PENDIENTE.sueno`. Si se quiere un pendiente "🌙 Tu sueño"
   cuando anoche no llegó nada, `resumenSueno().ultimaNoche` lo dice; no lo agregué porque el sueño debe ser automático
   (principio 2) y cambiaría lo que exige el desbloqueo. El índice de sueño (0–100) queda listo para un puntaje v2.

## D · Desbloqueo

1. **`pruebas/navegador/simulador.js` (Central) — `rpc/ajustes_poner` falla en el simulador.**
   Devuelve `respuesta(null, 204)`, que arma `new Response("null", { status: 204 })`: el navegador lanza
   `TypeError` (un 204 no puede tener cuerpo) y `guardarAjuste()` termina en "No se pudieron leer los registros ()".
   Arreglo de una línea: `return respuesta(undefined, 204);`. Afecta a todo lo que guarda en `perfil.ajustes`
   (juegos y niveles del desbloqueo, bienvenida y atajos de Conectar). Lo probé parcheando `Response` solo en la consola.

2. **`web/js/paginas/hoy.js` (Central) — abrir la hoja de registro desde un enlace.**
   Las filas "Lo que falta" de `desbloqueo.html` y el botón "📝 Registrar ahora" del atajo "🔒 Puerta" (cuando no hay
   atajo de iPhone para eso, como las comidas) abren `index.html#registrar=<accion>` (`comida`, `gasto`, `estudio`, `gym`).
   Pedido: al cargar Hoy, si `location.hash` es `#registrar=<accion>` válido, llamar `registro.abrir(accion)` y limpiar
   el hash con `history.replaceState`. Hoy funciona igual sin esto (solo abre Hoy).

3. **Widget (objetivo E) — minutos de desbloqueo.** Para `"desbloqueo": {"minutos": 60}` de `GET /api/v1/widget`:
   `import { cargarDesbloqueo } from "../_rutas/desbloqueo.js"` y `estadoDesbloqueo({ ...await cargarDesbloqueo(db, ahora), ahora })`
   de `web/js/desbloqueo/logica.js` → `nivel.minutos` (ganados por app hoy), `abierto`, y por app `apps[i].restantes`.
   `GET /api/v1/desbloqueo/estado` devuelve lo mismo ya armado (no anota aperturas).

4. **Conectar (objetivo B) — juegos del desbloqueo.** La clave es `perfil.ajustes.desbloqueo = { juegos: [{ id, nombre }], niveles: [{ puntaje, minutos }] }`.
   La página `desbloqueo.html` ya edita ambos; si Ajustes también los edita, guardar con merge sin pisar `niveles`.
   Para "Probar" en el asistente, los dos atajos usan `GET desbloqueo/estado` (no ensucia el uso de hoy).

5. **Integración — pendientes de rutina.** `comoRegistrar()` (en `web/js/desbloqueo/logica.js`) ya manda `accion: "rutina"` a `rutina.html`.
   Cuando exista un atajo de comidas o una ruta `POST comidas`, agregarlo en `ATAJO_DE` de ese archivo para que
   "Registrar ahora" abra el atajo en vez de la web.

## H · Ejercicio

1. **Meta semanal: que Hoy cuente igual que Movimiento.** Hoy (`web/js/logica/calculo.js` › métrica "Entrenos esta semana") cuenta **todas** las filas de `gym_sesiones`. En Movimiento la meta `gym_semana` cuenta solo fuerza, trote, cardio, deporte y otro; caminata y movilidad se ven aparte (si no, dos caminatas al día cumplen la meta el martes). Cambio propuesto:
   - `web/js/supabase/datos.js` › `cargarRegistros()` y `api/_lib/registros.js` › `cargarRegistrosServidor()`: pedir `fecha, tipo` de `gym_sesiones` (hoy solo `fecha`).
   - `calculo.js` › `agrupar()`: `for (const sesion of registros.gym) if (cuentaParaMeta(sesion)) del(sesion.fecha).gym += 1;` con `import { cuentaParaMeta } from "../ejercicio/logica.js";` (ese archivo no importa `calculo.js`: no hay ciclo). Las filas viejas sin `tipo` cuentan.
   - Si Samuel prefiere que todo cuente, basta cambiar `TIPOS_META` en `web/js/ejercicio/logica.js`.
2. **Integración Ejercicio → Rutina.** `cubreBloque(sesion, bloque)` está en `web/js/ejercicio/logica.js`. Acepta `bloque` como `{ tipo, inicio, fin }` (ISO, lo que devuelve `GET rutina/hoy`) o como fila de plantilla `{ tipo, hora_inicio, duracion_min, dias?, fecha? }` (sin `fecha` usa el día lógico de la sesión). Puntos donde llamarla al guardar o terminar una sesión:
   - Web: `web/js/ejercicio/pagina.js` › `guardar()` y `terminarCon()` (después de `encolar`); hoja Gym de Hoy: `web/js/piezas/registros.js` › `formularioGym` (en el `submit`).
   - API: `api/_rutas/ejercicio.js` › `POST ejercicio/fin` y `POST ejercicio/sesion` (junto a `avisarSiCumplio`).
3. **`comun.css` (opcional):** la hoja Gym de Hoy usa `.entrada` (tamaño normal) para las horas porque no puedo tocar `hoy.css`/`comun.css`. Si se quiere el selector grande también ahí, mover `.hora-grande` de `web/css/ejercicio.css` a `comun.css` y usarlo en `#form-gym`.
4. **Simulador (`pruebas/navegador/simulador.js`), solo informativo:** PATCH no recalcula `fecha` cuando cambia `momento`, y POST ignora `on_conflict` (los upsert duplicarían). Movimiento no depende de eso (calcula el día con `inicio` y sube con "actualizar y si no existe insertar"), pero otros módulos podrían.
5. **Conectar (B):** las guías de `web/js/ejercicio/atajos.js` asumen que el atajo base "⚙️ Goat" devuelve un diccionario con las claves `url` (sin `/` al final, ej. `https://….vercel.app`) y `token`; cada paso escribe `url` + `/api/v1/ejercicio/…`. Si B usa otros nombres de clave, avisar para ajustar el texto.
6. **Notificaciones (F):** la API deja una notificación `modulo: "ejercicio"`, `clave: "ejercicio:semana:<lunes>"`, `url: "ejercicio.html"` cuando la semana llega a la meta (una sola vez por semana).

## G · Rutina

Nada de esto bloquea la rama `goat/rutina`: la página, la API y las pruebas funcionan solas. Son los cruces de la integración.

1. **`web/js/logica/calculo.js` › `faltantes()`**: sumar los obligatorios vencidos.
   - `import { obligatoriosVencidos } from "../rutina/logica.js";` (no hay ciclo: `rutina/logica.js` solo importa `logica/dia.js`).
   - Firma: `obligatoriosVencidos(bloques, checks, ahora, { festivos, fecha })` → `[{ clave: "rutina:<id>", emoji, texto, accion: "rutina", bloque_id, fin }]`. Ya viene en el formato de un pendiente; `saltado` también lo quita (principio 3).
   - `checks` puede traer varias fechas: la función usa solo las de `fecha` (por defecto el día lógico de `ahora`).
2. **`cargarRegistros()` (`web/js/supabase/datos.js`) y `cargarRegistrosServidor()` (`api/_lib/registros.js`)**: traer
   - `rutina_bloques` con `activo = true`, columnas `id,titulo,tipo,dias,hora_inicio,duracion_min,obligatorio,orden,activo`;
   - `rutina_checks` de hoy, columnas `bloque_id,fecha,estado`.
   Los festivos ya los traen.
3. **Hoy (`web/js/paginas/hoy.js` › `pintarPendientes`)**: un pendiente con `accion: "rutina"` debe ir a `rutina.html` (no abrir la hoja de registro).
4. **Ejercicio → Rutina**: para marcar solo un bloque cubierto por un entreno, upsert en `rutina_checks` con `on_conflict=bloque_id,fecha` y `Prefer: resolution=ignore-duplicates` (así no pisa un "saltado" o "hecho" que Samuel ya marcó). `fecha` es el día lógico; `estado: "hecho"`, `origen: "automatizacion"`.
5. **Notificaciones (opcional)**: obligatorio vencido → `notificar(db, { modulo: "rutina", emoji, titulo: "Caminar sin marcar", url: "rutina.html", clave: "rutina:<bloque_id>:<fecha>" })`.
6. **Widget (E)**: `GET rutina/ahora` ya devuelve `actual`, `siguiente` y `mensaje`; o usar `ahoraYSiguiente(estadoDelDia(...))` de `rutina/logica.js`.
7. **Conectar (B)**: `web/js/rutina/atajos.js` trae 4 atajos (`rutina-plan`, `rutina-hecho`, `rutina-cierre`, `rutina-tarea`). La prueba de "✅ Hecho" usa `GET rutina/ahora` para no marcar nada al probar.
8. `supabase/borrar-datos.sql` no necesita cambios (vacía todas las tablas de `public` menos festivos, incluidas las de rutina).

## A · Finanzas

1. **Hoy se sale por la derecha a 375 px** (`web/css/hoy.css`, ya pasaba en `goat/base`): en "Secciones", la palabra «MOVIMIENTO.» ensancha la segunda columna (tarjetas de 253 a 423 px en un iPhone de 375). Como hay desborde, el navegador agranda el ancho de la página y la hoja inferior también queda más ancha que la pantalla (se ve cortada la caja "Descripción" de la hoja Gasto). Arreglo sugerido:
   ```css
   .secciones-rejilla { grid-template-columns: repeat(2, minmax(0, 1fr)); }
   .seccion-tarjeta-titulo { font-size: clamp(1.25rem, 6.4vw, 1.65rem); overflow-wrap: anywhere; }
   ```
   (y a 48rem `repeat(3, minmax(0, 1fr))`).
2. **Simulador** (`pruebas/navegador/simulador.js`): `cargarDatos()` no guarda la promesa, así que si la página hace varias consultas en paralelo al cargar, `ejemplo()` y los `agregar()` de cada módulo se corren varias veces. Los que hacen `push` a una tabla compartida duplican filas. En `datos-finanzas.js` lo evité (solo agrega una vez), pero conviene: `let cargando = null; function cargarDatos() { return (cargando ??= (async () => { … })()); }`.
3. **`web/js/piezas/registros.js`**: `formularioGasto()` ahora delega en `js/finanzas/formulario.js`. Quedaron imports sin uso arriba (`CATEGORIAS`, `CUENTAS`, `MONTOS_RAPIDOS`, `MONTO_MAXIMO`, `TIPOS_MOVIMIENTO`, `formatoCOP`); no los quité para no chocar con otras ramas que tocan ese mismo bloque. Al integrar se pueden borrar. El `import` del formulario quedó justo encima de `formularioGasto()` (los `import` pueden ir en cualquier parte del nivel superior).
4. **Título de la hoja en Hoy**: `TITULO.gasto = "Gasto"` (en `registros.js`, fuera de mi función). Ahora la hoja registra los 4 tipos; si Samuel prefiere, cambiarlo a "Dinero" o "Movimiento". Lo dejé igual.
5. **`api/_lib/registros.js`** (opcional): el cálculo de Hoy en la API lee `finanzas_movimientos` con `tipo,monto,fecha,momento`; sigue funcionando igual porque solo `egreso` cuenta para el presupuesto. No requiere cambio.

## B · Conectar

1. **Una sola forma de armar la dirección en los atajos (importante para que funcionen).** El atajo base «⚙️ Goat» devuelve
   `{ url, token }` con **`url` = la dirección de Goat sin barra final y sin `/api/v1`** (ej. `https://tu-goat.vercel.app`).
   Así lo asumen finanzas, sueño, ejercicio, notificaciones y los dos atajos de Conectar (`url` + `/api/v1/<ruta>`).
   **Rutina y desbloqueo asumen lo contrario** (que `url` ya termina en `/api/v1`): con el «⚙️ Goat» de Conectar
   llamarían a `https://…/rutina/hoy` (404). Son cambios de texto, sin tocar lógica:
   - `web/js/rutina/atajos.js`: comentario de arriba «(url ya termina en /api/v1)» → «(url va sin /api/v1)»; en `pedir()`:
     `URL: la variable URL seguida de /${ruta}` → `URL: la variable URL seguida de /api/v1/${ruta}`.
   - `web/js/desbloqueo/atajos.js`: `luego /desbloqueo/gate?app=` → `luego /api/v1/desbloqueo/gate?app=` ·
     `la variable url y /desbloqueo/pase` → `la variable url y /api/v1/desbloqueo/pase` ·
     `la variable url y luego /desbloqueo/evento` → `la variable url y luego /api/v1/desbloqueo/evento`.
   - `pruebas/conectar-atajos.test.mjs` lo vigila: hoy sale como **«todo»** (no hace fallar `npm test`) y pasa a verde
     solo cuando esos textos se corrijan.
   - Widgets (E): la `URL` de `scriptable/goat.js` debería ser la misma `url` de «⚙️ Goat» (sin `/api/v1`), para que
     Samuel pegue los mismos dos datos.
2. **Nada que cambiar en Hoy.** `hoy.js` ya llama `revisarBienvenida()` y el ⚙️ ya abre `conectar.html#ajustes`.
   La tarjeta «Conectar iPhone.» abre el asistente si no está terminado y Ajustes si ya; su `miniDato()` dice
   «Falta tu llave», «3 de 14 atajos listos» o «✓ Todo conectado».
3. **API: sin rutas nuevas** (`api/_rutas/conectar.js` sigue `{}`). Crear y revocar llaves usa `POST/DELETE tokens`
   de `central.js` con la sesión web. La lista de llaves y «Probar conexión» leen `api_tokens` directo con RLS
   (sin el hash), así Ajustes funciona aunque falte la clave del servidor; el «Probar» de cada atajo lee `log_api`.
4. **Atajos nuevos:** cualquier atajo que se agregue a un `web/js/<modulo>/atajos.js` aparece solo en el asistente.
   Un id repetido entre módulos hace fallar `pruebas/conectar-logica.test.mjs` con un mensaje que nombra los dos módulos.
5. **Simulador (informativo):** los filtros `gt` y `order` comparan como texto; en `datos-conectar.js` los ids de
   `log_api` son de 4 cifras para que «Probar» funcione. `datos-conectar.js` reemplaza `GET/POST/DELETE tokens`
   para guardar las llaves en `tablas.api_tokens` (las lee «Probar conexión»).
## E · Widgets

Nada de esto bloquea `goat/widgets`: la API, el script de Scriptable, la página y las pruebas funcionan solos.

1. **Atajo base "⚙️ Goat" — formato de `url` (Central / Conectar B).** Hoy hay dos versiones: `web/js/rutina/atajos.js` dice que
   `url` ya termina en `/api/v1`; `web/js/ejercicio/atajos.js` (y su solicitud H.5) dice que es la dirección sin `/api/v1`.
   Conviene fijar una. Widgets aguanta las dos: el script de Scriptable quita `/api/v1` y la `/` final al guardar la dirección,
   y los atajos "🍽️ Comí" y "📚 Estudio" usan "Reemplazar texto" para quitar `/api/v1` antes de abrir la web.
2. **Conectar (B) — paso 5 "Widgets".** Puede reusar `GUIA_SCRIPTABLE` y `GUIA_BLOQUEO` de `web/js/widgets/atajos.js`
   (los mismos textos de `widgets.html`). `ATAJOS` trae 3 entradas en el formato común: `widgets-comi`, `widgets-estudio`
   (atajos de una sola acción que abren `index.html#registrar=comida|estudio`) y `widgets-botones` (armar el widget de Atajos
   con 4 botones; no es un atajo en sí, solo pasos). Las tres prueban con `GET widget`.
3. **`api/_rutas/sueno.js` (opcional).** El widget saca el sueño llamando al manejador de `GET sueno/resumen` (reusa su `cargar()`
   interno). Si Sueño exporta `cargar` (por ejemplo como `cargarSueno(db, ahora)`), `api/_rutas/widget.js` puede usarlo directo.
4. **Hoy a 375 px (ya reportado en A.1).** La tarjeta "Widgets." no se sale (su texto mide 135 de 170 px); el desborde lo
   causa «MOVIMIENTO.». La tarjeta ahora muestra la frase del día (`web/js/widgets/mini.js`), que salta de línea sin ensanchar.
5. **`scriptable/LEEME.md` en la raíz** (lo pedía la ficha E): no lo creé porque no estaba en mi lista de archivos. La guía vive en
   `widgets.html` y en el encabezado de `web/scriptable/goat.js`. Si se quiere, basta un archivo de 2 líneas que apunte a
   `web/scriptable/goat.js` y a la página Widgets.
