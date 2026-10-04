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
