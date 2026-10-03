# C · Sueño (rama `goat/sueno`, tanda 1)

## Para qué
Samuel quiere, "con permisos de la actividad del iPhone", un **índice de su horario de sueño**: cuándo deja el celular y se va a dormir, y cuándo se levanta — **automático**, porque "esta generación es adicta a la dopamina, procrastina y no quiere llenar formularios". El iPhone es "el cómplice de toda toma de datos". **No tiene Apple Watch** (D-055).

## Qué se puede (honesto)
- iOS no expone "cuándo bloqueé el celular por última vez". Se aproxima con eventos que sí existen:
  - **Acostarse:** automatización Sueño › "Hora de dormir comienza" (requiere horario de sueño en Salud), Modo de concentración Sueño › se activa, Cargador › se conecta (solo 21:00–03:00, filtra con "Si" la hora), o toque posterior "🌙 Me acuesto".
  - **Despertar:** Sueño › "Despertar", Alarma › se detiene, o Modo Sueño › se desactiva.
  - **Salud:** con horario de sueño, el iPhone registra "En cama" (por uso del teléfono); "Buscar muestras de salud" (Análisis del sueño, últimas 18 h) lo lee.
- Regla de consolidación: para cada noche, **acostarse** = el evento de acostarse más tardío antes del primer bloque largo "en cama" (o el inicio de "en cama" si no hay evento); **despertar** = el primer evento de despertar después de 04:00 (o el fin de "en cama"). Una noche pertenece al **día lógico en que te acostaste** (D-014).

## Tus archivos
- `web/sueno.html`, `web/css/sueno.css`, `web/js/sueno/*` (`pagina.js`, `logica.js`, `datos.js`, `atajos.js`, `mini.js`).
- `api/_rutas/sueno.js`. Sección **6. SUEÑO** de `supabase/schema.sql`. Pruebas `pruebas/sueno-*.test.mjs`.

## Base de datos (sección 6)
- `sueno_eventos`: `tipo` (`acostarse`|`despertar`), `fuente` (`hora_dormir`|`modo_sueno`|`cargador`|`alarma`|`despertar`|`manual`), `momento`, `fecha` generada, `origen`, `id_cliente`, `creado_en`.
- `sueno_muestras`: `inicio timestamptz`, `fin timestamptz` (check fin > inicio, ≤ 16 h), `tipo` (`en_cama`|`dormido`|`despierto`), `fuente` default `salud`, `creado_en`; unique (`user_id`, `inicio`, `tipo`) para que el sync sea repetible (upsert/ignore).
- Metas en `perfil.metas` (leer con respaldo): `sueno_horas` (7.5), `hora_despertar` ("06:00"), `hora_acostarse` ("22:30").

## Lógica (`web/js/sueno/logica.js`, pura)
- `construirNoches(eventos, muestras)` → `[{ fecha, acostarse, despertar, duracionMin, fuente, completa }]`.
- `indiceSueno(noches, metas)` 0–100: duración vs meta (50%), regularidad de la hora de acostarse en 7 noches (desviación estándar; 30%), acostarse antes de la meta (20%). Explicación en 1 frase.
- `regularidad(noches)`; `promedios(noches, dias)`; `resumenSemana`.

## API
- `POST sueno/evento` `{ tipo, fuente, momento? }` → `🌙 Buenas noches` / `☀️ Buenos días · 7 h 10` (duración sí se puede, no es dinero).
- `POST sueno/sync` `{ muestras: [{inicio, fin, tipo}] }` (lo que devuelve "Buscar muestras de salud", aceptar formatos de fecha de Atajos) → guarda sin duplicar.
- `GET sueno/resumen` → última noche, índice, semana.

## Web (`sueno.html`, titular `TU NOCHE.`)
1. **Anoche:** duración enorme (`7 H 10`), debajo "Te acostaste 23:42 · te levantaste 06:05", índice de sueño en anillo (color `--anillo-cuerpo`) y frase corta.
2. **Semana:** barras horizontales estilo app Salud (eje de 20:00 a 10:00, una barra por noche de acostarse a despertar, la de hoy resaltada), línea de la meta de acostarse.
3. **Regularidad y promedios** (hora media de acostarse/levantarse, duración media).
4. **Registrar a mano** (hoja): "Me acosté a…/Me levanté a…" con selector de hora (para cuando falló el atajo).
5. **Cómo se registra solo:** enlace al asistente Conectar.

## Atajos (`web/js/sueno/atajos.js`)
- "🌙 Me acuesto": POST `sueno/evento` `{tipo:"acostarse", fuente}`. Automatizaciones: Sueño › Hora de dormir comienza; Modo Sueño › se activa; Cargador › se conecta (con "Si hora entre 21:00 y 03:00").
- "☀️ Desperté": POST evento `despertar` + Buscar muestras de salud (Análisis del sueño, inicio en las últimas 18 h) → POST `sueno/sync`. Automatizaciones: Sueño › Despertar; Alarma › se detiene.
- Permisos: Salud › Análisis del sueño (lectura). Requisito: horario de sueño activo en Salud.

## Pruebas
- Noche normal (acostarse 23:40, despertar 06:05 → 6 h 25, fecha = día de acostarse); acostarse después de medianoche (01:10 → pertenece al día anterior por el corte 04:00); varios eventos de cargador (toma el último antes de "en cama"); solo muestras de Salud; solo eventos; sync repetido no duplica.
- Índice: semana regular vs irregular. SQL/RLS. API sin token → 401.
