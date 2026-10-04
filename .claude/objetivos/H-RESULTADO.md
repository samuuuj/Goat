# H · Ejercicio y actividad: resultado (rama `goat/ejercicio`)

## Qué quedó hecho
- **Página "Movimiento"** (`web/ejercicio.html`, titular `MOVIMIENTO.`):
  1. **Entreno en curso:** eliges el tipo (Fuerza, Caminata, Trote, Cardio, Deporte, Movilidad) y la rutina si es fuerza, y tocas **Empezar**. Sale un cronómetro grande que corre con el segundero de cada minuto. **Terminar** guarda de qué hora a qué hora; en caminata y trote pregunta los km (opcional) y calcula el ritmo. Si un entreno lleva más de 6 h abierto ("se te olvidó terminar"), pide la hora real de fin: nunca se inventa.
  2. **Funciona sin internet:** empezar, terminar, registrar, editar y borrar se guardan primero en el teléfono (con `id_cliente`) y suben solos al volver la conexión. Arriba sale "☁️ 1 sin subir" mientras tanto.
  3. **Esta semana:** anillo verde de entrenos contra tu meta (`gym_semana`, 4 por defecto) con segunda vuelta si te pasas, minutos, km, pasos promedio por día, barras de minutos L–D (hoy en naranja) y sesiones por tipo.
  4. **Pasos de hoy** desde Salud, con promedio y barras de la semana.
  5. **Historial** por semana ("Esta semana · 7 sesiones · 6h 23 · 17,1 km") o por tipo; cada fila "jue 01 oct · 06:00–06:47 · 4,3 km · 10:56 /km". Tocar una la abre para editar o borrar (borrar pide un segundo toque).
  6. **Registrar a mano** (botón ＋ y "Registrar a mano"): tipo, día (Hoy, Ayer u otro), hora de inicio y de fin en selectores grandes, distancia y notas. Entiende el cruce de medianoche y el corte de las 04:00.
  7. **Con el iPhone:** las guías de los dos atajos, paso a paso.
- **Hoja "Gym" de Hoy:** ahora pide tipo, rutina (solo fuerza) y hora de inicio y fin, ya sugeridas (terminó ahora, empezó hace 60 min), con la duración en vivo. Si registras "23:00–23:45" en la mañana, entiende que fue anoche. Botón para ir al cronómetro.
- **Base de datos** (final de la sección 5, repetible): `gym_sesiones` suma `tipo`, `inicio`, `fin`, `duracion_min`, `distancia_km`, `pasos`, `en_curso`. `rutina` pasa a ser opcional. Un trigger pone `momento = inicio` (así la fecha es la del entreno) y calcula la duración. Hay un solo entreno en curso por persona. Tabla nueva `ejercicio_actividad`: pasos, km y kcal por fecha, una fila por día, con RLS completo.
- **API** (`api/_rutas/ejercicio.js`): `GET ejercicio/menu`, `POST ejercicio/inicio` (🏋️ A darle), `POST ejercicio/fin` (✅ 55 min), `POST ejercicio/sesion`, `POST ejercicio/actividad` (📈 8.432 pasos) y `GET ejercicio/semana`. Los reintentos del atajo no duplican. Avisa "Semana cumplida" en el centro de notificaciones una vez por semana. Nada lleva montos.
- **Lógica pura** (`web/js/ejercicio/logica.js`), la misma para la web, la hoja de Hoy y la API. Incluye `cubreBloque(sesion, bloque)` para que la integración marque sola los bloques de la Rutina: tipo compatible y ≥ 70% del bloque cubierto.
- **Tarjeta de Hoy** (`mini.js`): "⏱️ Fuerza en curso", "2 de 4 entrenos" o "Semana cumplida ✓".

## Archivos
`web/ejercicio.html`, `web/css/ejercicio.css`, `web/js/ejercicio/{pagina,logica,datos,formulario,atajos,mini}.js`, `api/_rutas/ejercicio.js`, `supabase/schema.sql` (final de la sección 5), `web/index.html` (solo `#form-gym`), `web/js/piezas/registros.js` (solo `formularioGym`), `web/js/logica/catalogos.js` (`RUTINAS` y `TIPOS_EJERCICIO`), `pruebas/ejercicio-{sql,logica,api,atajos}.test.mjs`, `pruebas/navegador/datos-ejercicio.js`.

## Cómo probarlo
- `npm test`: 54 pruebas, todas en verde (incluye PGlite con el schema corrido 2 veces, RLS y `anon` bloqueado).
- `npm run local` y abrir `http://localhost:3000/_pruebas/ejercicio.html`. Variantes:
  - `?entreno=curso`: cronómetro corriendo.
  - `?entreno=olvidado`: abierto hace 7 h.
  - `?escenario=vacio`: sin datos.

  La hoja Gym se prueba en `/_pruebas/index.html` › Gym.
- Revisado en el navegador a 375, 768 y 1440 px, sin errores de CSP y sin scroll horizontal. Probado: empezar, terminar, terminar con km, empezar y terminar sin internet y luego subir, registrar a mano, editar, borrar y "olvidado". En la hoja de Hoy: guardar con inicio y fin, y que la métrica de entrenos y el anillo Cuerpo sigan funcionando.

## Lo que Samuel debe hacer a mano
1. **Pegar `supabase/schema.sql`** (el de `goat/integracion`) en Supabase › SQL Editor › Run. **Importante:** hasta hacerlo, la hoja Gym nueva de Hoy y la página Movimiento no pueden guardar, porque usan las columnas nuevas. Movimiento muestra "Falta un paso".
2. En el iPhone, armar los atajos de Movimiento › "Con el iPhone" (unos 10 min cada uno, una sola vez):
   - **🏋️ Entreno:** Empezar, Terminar o "Ya lo hice". Opcional: automatización con una etiqueta NFC o al llegar al gym.
   - **📈 Actividad del día:** pasos y distancia de Salud. Automatización: Hora del día, 21:30, Ejecutar inmediatamente.
   - La primera vez, iOS pide permiso de Salud para leer Pasos, Distancia caminando y corriendo y Energía activa: toca **Permitir**.

## Decisiones de gusto (elegí lo más simple; se cambian fácil)
- **La meta semanal no cuenta caminata ni movilidad** (`TIPOS_META` en `logica.js`). Así dos caminatas diarias no "cumplen" los 4 entrenos. Hoy todavía cuenta todo: está en `SOLICITUDES.md` › 1 para que Central lo iguale.
- "Cardio" pasó de rutina a tipo. Rutinas de fuerza: Empuje, Tirón, Pierna y Full body.
- La fecha de los pasos es la del calendario (como la muestra Salud), no el día lógico de las 04:00.
- El botón flotante "Registrar a mano" es de vidrio, no naranja, para no competir con **Empezar**.

## Límites conocidos
- La app no tiene service worker: hay que abrir la página con internet una vez. Ya abierta, el cronómetro y los registros aguantan sin conexión y suben después.
- Los nombres de las acciones de Atajos pueden variar un poco entre versiones de iOS (por ejemplo «Definir variable» y «Resultado del menú»).
- El iPhone con hora de 12 h muestra "11:30 p. m."; por eso en el celular cada hora va en su propia fila.
- Marcar solos los bloques de la Rutina lo hace la integración con `cubreBloque()` (ver `SOLICITUDES.md` › 2).
