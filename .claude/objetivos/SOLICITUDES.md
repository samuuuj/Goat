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
