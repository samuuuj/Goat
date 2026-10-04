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
