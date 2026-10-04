# Solicitudes a Central (archivos compartidos que el objetivo no toca)

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
