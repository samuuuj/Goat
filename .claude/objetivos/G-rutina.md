# G · Rutina, clases y tareas (rama `goat/rutina`, tanda 1)

## Para qué (palabras de Samuel, resumidas)
"Rutina que organice recordatorios de la app del iPhone: tienes este espacio para desayunar; recordatorios con **encuestas adaptadas a mí**: me levanto a las 6 (quiero levantarme a esa hora), ir a caminar 45 min, preparación del desayuno y desayunar, luego tiempo de **trabajo útil** con **descansos** en medio, almuerzo, salir a hacer ejercicio, cena, caminar, estudiar; una rutina que se complete y se realice **para no procrastinar**, con recordatorios y una forma de **dar el visto bueno** a cada cosa. Agregar a mi día espacios como **martes y miércoles ciertas horas de clases presenciales**, también **clases virtuales**, horarios para **trabajos de la universidad** y **tareas pendientes**. Infórmame qué se puede sistematizar y cómo chequear todo con el iPhone." Gym/caminata/trote son **obligatorios** y ocupan espacio en la rutina semanal (D-056).

## Tus archivos
- `web/rutina.html`, `web/css/rutina.css`, `web/js/rutina/*` (`pagina.js`, `logica.js`, `encuesta.js`, `datos.js`, `atajos.js`, `mini.js`).
- `api/_rutas/rutina.js` (incluye rutas `uni/tareas`).
- Sección **8. RUTINA** de `schema.sql` y, para tareas, el **final de la sección 4. UNIVERSIDAD**. Pruebas `pruebas/rutina-*.test.mjs`.

## Base de datos
- `rutina_bloques` (plantilla semanal): `titulo` (≤ 60), `tipo` (`despertar`|`caminar`|`desayuno`|`trabajo`|`descanso`|`almuerzo`|`ejercicio`|`cena`|`estudio`|`clase_presencial`|`clase_virtual`|`trabajo_uni`|`dormir`|`libre`|`otro`), `dias smallint[]` (1 = lunes … 7 = domingo; check que todos estén en 1..7 y no vacío), `hora_inicio time`, `duracion_min int` (5–600), `obligatorio bool default false`, `aviso_min int default 0` (0–120), `lugar` (≤ 80), `enlace` (≤ 300, solo `https://`), `materia` (≤ 60), `notas` (≤ 200), `activo bool default true`, `orden int`, `creado_en`, `actualizado_en`. Sin `fecha` generada (es plantilla).
- `rutina_checks`: `bloque_id uuid references rutina_bloques(id) on delete cascade`, `fecha date not null`, `estado` (`hecho`|`saltado`), `nota` (≤ 120), `momento`, `origen`, `id_cliente`, `creado_en`; **unique (`bloque_id`, `fecha`)** (marcar de nuevo = actualizar).
- `uni_tareas` (sección 4): `titulo` (≤ 120), `materia` (≤ 60), `fecha_limite timestamptz`, `estimado_min int`, `estado` (`pendiente`|`en_progreso`|`hecha`), `prioridad` (1–3), `primer_paso` (≤ 120), `hecha_en`, `momento`, `fecha`, `origen`, `id_cliente`, `creado_en`.
- RLS completo en las 3.

## Encuesta (asistente para crear la rutina; estilo Apple, una pregunta por pantalla, chips y selectores grandes)
1. ¿A qué hora quieres levantarte? (6:00 por defecto) · días hábiles / fines de semana.
2. ¿Caminas al despertar? ¿Cuánto? (45 min).
3. Desayuno: preparación + comer (20 + 20 min).
4. Trabajo útil: desde qué hora, cuántas horas, ritmo de pausas (**50/10** o **25/5**) → genera bloques `trabajo` con `descanso` intercalados.
5. Almuerzo (hora, duración).
6. Ejercicio: qué días, a qué hora, cuánto (obligatorio ✓ por defecto).
7. Cena y caminata nocturna.
8. Estudio: días y horas.
9. **Clases presenciales:** agregar varias (materia, días — ej. martes y miércoles —, hora inicio/fin, lugar).
10. **Clases virtuales:** igual + enlace.
11. **Trabajos de la universidad:** bloques fijos (días/horas).
12. Hora de dormir.
→ Vista previa de la semana → "Crear mi rutina" (inserta los bloques). Luego todo se edita bloque por bloque (hoja: título, tipo, días, hora, duración, obligatorio, aviso, lugar/enlace). Detecta choques de horario y los muestra.

## Lógica (`web/js/rutina/logica.js`, pura)
- `bloquesDelDia(bloques, fecha, tipoDia)` (festivo → usa los bloques de domingo; ordenados por hora), `bloqueActual(bloques, ahora)`, `siguiente`, `estadoDelDia(bloques, checks, ahora)` → por bloque: `pendiente|ahora|hecho|saltado|vencido`; `obligatoriosVencidos()` (fin del bloque + 30 min sin check) — la usará la integración en `faltantes()` y el desbloqueo; `cumplimiento(dia|semana)` (% hecho de obligatorios y total); `generarPlantilla(respuestasEncuesta)`; `choques(bloques)`.

## Web (`rutina.html`, titular `TU DÍA.`)
1. **Ahora:** tarjeta grande con el bloque actual (tiempo restante en vivo) y el siguiente; botones **Hecho** / **Saltar**.
2. **Línea de tiempo del día** (estilo Calendario de Apple, vertical, horas a la izquierda, bloques con altura proporcional, línea roja/naranja de "ahora" que avanza): cada bloque con estado (✓ hecho, ⤼ saltado, ● obligatorio, enlace de clase virtual tocable). Barra de avance del día (obligatorios cumplidos).
3. **Semana:** cuadrícula L–D compacta (colores neutros; obligatorios marcados; hoy en naranja) con cumplimiento por día.
4. **Tareas pendientes:** ordenadas por fecha límite (vencidas arriba en naranja), agregar (hoja corta: título, materia, para cuándo, primer paso), marcar hecha, "Primer paso" visible para vencer la procrastinación.
5. **Qué hace el iPhone por ti:** explicación corta + enlace al asistente Conectar.

## API
- `GET rutina/hoy` → bloques de hoy con `{id, titulo, tipo, inicio ISO, fin ISO, obligatorio, enlace, estado}` (para el atajo de recordatorios).
- `GET rutina/ahora` → bloque actual/siguiente + `mensaje` corto (`🚶 Caminar · 45 min`).
- `POST rutina/check` `{bloque_id | "actual", estado}` → `✅ Hecho` / `⤼ Saltado`.
- `POST rutina/checks` `{items:[{bloque_id, estado}]}` (lo usa el cierre del día).
- `GET uni/tareas`, `POST uni/tareas`, `POST uni/tareas/hecha`.

## Cómo se chequea con el iPhone (atajos en `atajos.js` y explicación en la página)
- **"☀️ Plan del día"** (automatización: Sueño › Despertar o Alarma › se detiene; respaldo Hora del día 6:05): ⚙️ Goat → GET `rutina/hoy` → borra recordatorios viejos de la lista "Goat" → **Añadir recordatorio nuevo** por bloque (título con emoji, alerta a `inicio − aviso`, notas con `bloque_id` y el enlace de la clase virtual, lista "Goat"). Así llegan **notificaciones nativas** a su hora y se marcan desde la pantalla bloqueada.
- **"✅ Hecho"** (Toque posterior doble o widget de Atajos): POST `rutina/check` `{bloque_id:"actual", estado:"hecho"}` → notificación `✅ Hecho`.
- **"🌙 Cierre del día"** (Hora del día 21:45 o Cargador se conecta de noche): Buscar recordatorios (lista Goat, completados hoy) → extraer `bloque_id` de las notas → POST `rutina/checks`; los no completados de bloques obligatorios quedan como pendientes (la web pide confirmarlos).
- Permisos: Recordatorios (acceso completo). Explica qué queda automático (recordatorios, sincronizar completados) y qué no (iOS no sabe si de verdad caminaste: el visto bueno lo das tú con un toque; el ejercicio puede marcarse solo desde el objetivo H en la integración).

## Pruebas
- Plantilla desde la encuesta del ejemplo de Samuel (6:00 despertar → caminar 45 → desayuno → trabajo 50/10 → almuerzo → ejercicio → cena → caminar → estudiar) sin choques; martes/miércoles con clases presenciales; festivo usa domingo.
- Estados (actual, vencido a +30 min, hecho, saltado), cumplimiento, obligatorios vencidos.
- `rutina_checks` único por bloque y fecha; SQL/RLS; API `hoy` con ISO y zona Bogotá correctos; mensajes cortos.
