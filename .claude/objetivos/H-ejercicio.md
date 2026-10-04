# H · Ejercicio y actividad (rama `goat/ejercicio`, tanda 1)

## Para qué
"A la categoría gym: el entrenamiento que se hizo, las horas que duró, **de qué hora a qué hora**; también **caminata**, **trote**, qué tiempo hubo… que también se registren para no procrastinar y que estén establecidas, que **sí o sí hay que hacerlas** porque ocupan un espacio en mi rutina semanal y diaria." Sin Apple Watch (D-055): entrenos con atajo inicio/fin o desde la web; pasos y distancia del iPhone vía Salud. Los "obligatorios" viven como bloques de la Rutina (objetivo G); este objetivo registra lo que se hizo y lo compara con la meta semanal.

## Tus archivos
- `web/ejercicio.html`, `web/css/ejercicio.css`, `web/js/ejercicio/*` (`pagina.js`, `logica.js`, `datos.js`, `atajos.js`, `mini.js`).
- `api/_rutas/ejercicio.js`. **Final de la sección 5. EJERCICIO** de `schema.sql`. Pruebas `pruebas/ejercicio-*.test.mjs`.
- **Excepción permitida:** la hoja "Gym" de Hoy: `<form id="form-gym">` en `web/index.html` y `formularioGym()` en `web/js/piezas/registros.js` (tipo + hora de inicio y fin, con valores sugeridos: fin = ahora, inicio = ahora − 60 min).
- `RUTINAS` y lo de ejercicio en `web/js/logica/catalogos.js` (agregar `TIPOS_EJERCICIO`).

## Base de datos (final de la sección 5, repetible)
- `gym_sesiones` (ya existe: `rutina` text not null 1–40, `notas`, `momento`, `fecha`, `origen`, `id_cliente`): 
  - `add column if not exists tipo text not null default 'fuerza'` + check (`fuerza`|`caminata`|`trote`|`cardio`|`deporte`|`movilidad`|`otro`) con `drop constraint if exists` antes;
  - `inicio timestamptz`, `fin timestamptz` (check `fin > inicio` y ≤ 6 h), `duracion_min int` (1–600), `distancia_km numeric(5,2)` (0–100), `pasos int` (0–100000), `en_curso bool default false`;
  - `alter column rutina drop not null` (para caminata/trote) — repetible.
  - `momento` = `inicio` cuando exista (para que `fecha` sea el día del entreno).
- `ejercicio_actividad` (resumen diario de Salud): `fecha date not null`, `pasos int`, `distancia_km numeric(5,2)`, `energia_kcal int`, `fuente` default `salud`, `creado_en`, `actualizado_en`; unique (`user_id`, `fecha`) → el sync hace upsert.
- RLS completo en la tabla nueva.

## Lógica (`web/js/ejercicio/logica.js`, pura)
- `duracion(sesion)`; `resumenSemana(sesiones, metas, lunes)` (sesiones por tipo, minutos totales, km, cumplimiento de `metas.gym_semana`); `agrupar(sesiones, "semana"|"tipo")`; `ritmo(km, min)` para trote (min/km); `enCurso(sesiones)`; `cubreBloque(sesion, bloque)` (≥ 70% de solape y tipo compatible: fuerza/cardio/deporte ↔ `ejercicio`, caminata ↔ `caminar`, trote ↔ `ejercicio`|`caminar`) — la usará la integración para marcar bloques de Rutina solos.

## Web (`ejercicio.html`, titular `MOVIMIENTO.`)
1. **Entreno en curso:** si hay una sesión `en_curso`, cronómetro grande que corre (CSS + `requestAnimationFrame` liviano), tipo, botón **Terminar**. Si no, botón principal **Empezar** → elegir tipo con chips (Fuerza, Caminata, Trote, Cardio, Deporte, Movilidad) y rutina (Empuje/Tirón/Pierna/Full si es fuerza). Debe aguantar sin internet: guarda en `localStorage` y sincroniza al volver (con `id_cliente`).
2. **Esta semana:** anillo/barra de sesiones vs meta (`gym_semana`, color `--anillo-cuerpo` permitido porque es "Cuerpo"), minutos totales, km caminados/trotados, pasos promedio.
3. **Registrar a mano** (hoja): tipo, **hora de inicio y hora de fin** (selectores grandes), distancia (caminata/trote), notas.
4. **Historial:** agrupado por semana (encabezado "Semana del 29 sep · 4 sesiones · 3 h 20") o por tipo (control segmentado); fila: emoji del tipo, "07:10–08:05 · 55 min", rutina o km/ritmo. Tocar → editar/borrar.
5. **Pasos de hoy y de la semana** (desde `ejercicio_actividad`).

## API
- `POST ejercicio/inicio` `{tipo, rutina?}` → crea sesión `en_curso` → `🏋️ A darle`.
- `POST ejercicio/fin` → cierra la sesión en curso (fin = ahora, duración) → `✅ 55 min`.
- `POST ejercicio/sesion` `{tipo, inicio, fin, distancia_km?, rutina?, notas?}` (registro completo).
- `POST ejercicio/actividad` `{fecha?, pasos, distancia_km, energia_kcal}` (de Salud, upsert del día).
- `GET ejercicio/semana`.

## Atajos (`atajos.js`)
- "🏋️ Entreno": ⚙️ Goat → Elegir del menú [Empezar / Terminar] → Empezar: Elegir de la lista tipo → POST `ejercicio/inicio`; Terminar: POST `ejercicio/fin` → Mostrar notificación `mensaje`. Opcional: automatización NFC (etiqueta en el bolso/gym) o "Llegar a" la ubicación del gym → Empezar.
- "📈 Actividad del día": Buscar muestras de salud (Pasos, Distancia caminando y corriendo; hoy; sumar) → POST `ejercicio/actividad`. Automatización Hora del día 21:30.
- Permisos: Salud › Pasos, Distancia (lectura).

## Pruebas
- Sesión 07:10–08:05 → 55 min, fecha correcta; entreno que cruza medianoche antes de las 04:00 → día lógico anterior; caminata con km → ritmo; en curso → fin.
- Semana vs meta; `cubreBloque` con solape 80% (sí) y 50% (no).
- SQL: columnas nuevas repetibles, `rutina` opcional, upsert de actividad único por fecha, RLS. Hoja Gym de Hoy guarda tipo e inicio/fin y el anillo Cuerpo/metrica gym siguen funcionando.
