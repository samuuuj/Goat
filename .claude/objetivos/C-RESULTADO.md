# C · Sueño — resultado (rama `goat/sueno`)

## Qué quedó hecho
- **Base de datos (sección 6 de `supabase/schema.sql`, repetible):**
  - `sueno_eventos`: "me acuesto" y "desperté", con su fuente (hora de dormir, Modo Sueño, cargador, alarma, despertar o a mano).
  - `sueno_muestras`: lo que Salud anota como "En cama", sin duplicar (única por usuario + inicio + tipo), máximo 16 h por muestra.
  - Las dos con RLS ("solo lo mío") y sin permisos para `anon`.
- **Lógica (`web/js/sueno/logica.js`, pura)**, la misma para la página, el dato de Hoy y la API:
  - Arma cada noche con el corte de las 04:00. La noche es del día en que te acostaste: acostarte a la 01:10 cuenta para la noche de ayer.
  - Hora de acostarte: el "me acuesto" más tardío antes de "En cama"; si no hay evento, el inicio de "En cama".
  - Hora de levantarte: el primer "desperté" después de las 04:00; si no hay, el fin de "En cama".
  - Lo anotado a mano manda sobre lo automático (cuenta lo último que escribiste).
  - Índice de 0 a 100 con una frase: duración contra tu meta (50 %), regularidad de la hora de acostarte (30 %) y acostarte antes de tu meta (20 %).
  - También: promedios, regularidad y la semana.
  - Lee las fechas de Atajos: ISO 8601 y también sin formatear, en español o en inglés.
- **API (`api/_rutas/sueno.js`):**
  - `POST sueno/evento` responde "🌙 Buenas noches" o "☀️ Buenos días · 7 h 10".
    - Acepta en la misma llamada las muestras de Salud, así el atajo de la mañana hace un solo envío.
    - `datos.aviso` queda vacío cuando no hay nada que avisar: el cargador de día (la regla de 21:00 a 03:00 vive en la API) o un evento repetido (alarma + Despertar).
    - Al despertar deja un aviso en el centro de notificaciones.
  - `POST sueno/sync` guarda muestras sin duplicar.
  - `GET sueno/resumen` da lo mismo que se ve en la página.
- **Página `sueno.html` (titular TU NOCHE.):**
  1. **Anoche:** la duración en grande, la hora en que te acostaste y te levantaste, y el índice en su anillo (verde del anillo Cuerpo) con una frase.
     - Avisa "📱 Dejaste el celular X después de que empezó tu hora de dormir".
     - Si falta una de las dos horas, muestra un botón para anotarla.
  2. **Semana como en la app Salud:** una barra por noche, de acostarte a levantarte.
     - El eje va de 20:00 a 10:00 y se ensancha si alguna noche se sale.
     - La última noche va en naranja, la de hoy aparece "en curso", y hay una línea con tu meta para acostarte.
  3. **Regularidad y promedios:** cuánto cambia tu hora de acostarte (±min), los promedios, de qué está hecho el índice y el botón "Cambiar metas".
  4. **Anotar a mano:** una hoja inferior con "Me acosté a…" / "Me levanté a…" (o "Ahora mismo") que dice a qué noche va. Toma menos de 10 s.
  5. **Cómo se registra solo:** muestra el último aviso automático, la última vez que llegó Salud, el enlace a Conectar y las guías completas de los dos atajos.
- **Tarjeta en Hoy (`mini.js`):** "6 h 45 · índice 68", o "En cama desde las 23:30".
- **Guía de atajos (`web/js/sueno/atajos.js`):** los atajos "🌙 Me acuesto" y "☀️ Desperté", con pasos exactos y 5 automatizaciones.

## Archivos
- `supabase/schema.sql` (solo la sección 6)
- `web/sueno.html`, `web/css/sueno.css`
- `web/js/sueno/logica.js`, `datos.js`, `pagina.js`, `atajos.js`, `mini.js`
- `api/_rutas/sueno.js`
- `pruebas/sueno-logica.test.mjs`, `sueno-sql.test.mjs`, `sueno-api.test.mjs`, `sueno-atajos.test.mjs`
- `pruebas/navegador/datos-sueno.js`
- `.claude/objetivos/SOLICITUDES.md` (sección C)

## Cómo probarlo
- `npm test`: 68 pruebas en verde, incluida `schema.test.mjs`.
- `npm run local` → http://localhost:3000/_pruebas/sueno.html: una semana de ejemplo, con cargador, celular hasta tarde, una noche sin datos, solo Salud y una noche pasada la medianoche.
- `?escenario=vacio` muestra el estado sin noches.
- Revisado a 375, 768, 1024 y 1440 px:
  - sin desborde horizontal;
  - consola sin errores de CSP;
  - funcionan anotar a mano (aparece la noche "en curso") y cambiar metas;
  - en Hoy, la tarjeta muestra su dato.

## Lo que Samuel debe hacer a mano
1. Pegar `supabase/schema.sql` (de `goat/integracion`) en Supabase › SQL Editor › Run.
2. **En el iPhone, en Salud:** Explorar › Sueño › "Horario completo y opciones".
   - Activar el **Horario de sueño** (hora de dormir y de despertar).
   - En Opciones, activar **"Registrar tiempo en cama con el iPhone"**. Sin esto no hay "En cama".
   - Si quiere, usar el Modo Sueño.
3. Armar el atajo base "⚙️ Goat" (asistente Conectar) y luego "🌙 Me acuesto" y "☀️ Desperté", siguiendo la guía de sueno.html (unos 15 min).
4. Crear las automatizaciones. En todas: "Ejecutar inmediatamente" y sin "Notificar al ejecutar".
   - Sueño › Hora de dormir comienza
   - Modo Sueño › Al activarse
   - Cargador › Se conecta
   - Sueño › Despertar
   - Alarma › Se detiene
5. La primera vez, permitir que el atajo lea "Análisis del sueño" de Salud, se conecte a Goat ("Permitir siempre") y muestre notificaciones.
6. Si quiere, cambiar sus metas en Tu noche › "Cambiar metas". Las de arranque son 7 h 30, a la cama a las 22:30 y arriba a las 06:00.

## Decisiones y límites conocidos
- **Sin Apple Watch, la duración es tiempo en cama** (de acostarte a levantarte), no sueño medido.
- **Cambio sobre la ficha (honesto con el celular):** si el último "me acuesto" quedó más de 45 min antes de que empezara "En cama", la hora de acostarte es la de "En cama".
  - El motivo: "Hora de dormir comienza" y el Modo Sueño siempre llegan a la misma hora. Si contaran ellos, la regularidad saldría perfecta aunque sigas con el celular hasta la 01:30.
  - Ese tiempo se muestra como "Dejaste el celular X después…", sin regañar.
  - Las pruebas de la ficha siguen igual: con varios cargadores, toma el último antes de "En cama".
- El cargador se filtra en la API (de 21:00 a 03:00), no en el atajo: es más simple de armar. De día el atajo corre en silencio y no guarda nada.
- Si corren las dos automatizaciones de la mañana, se guardan ambas y se avisa una sola vez; aun así, el atajo corre dos veces.
- **Metas de sueño:** se guardan en `perfil.ajustes.sueno`, encima de `perfil.metas`. Así no se toca la columna de Central (ver SOLICITUDES.md).
- **La hora escrita a mano** se toma como el momento más reciente que ya pasó con esa hora: a las 07:00, "23:40" es ayer. Sirve para anoche, no para noches más viejas.
- **Casos raros:**
  - Si te acuestas después de las 04:00 sin ningún "me acuesto" antes, esa noche cuenta para el día nuevo.
  - Una mañana con solo "desperté" crea una noche a medias del día anterior.
- **Nombres de iOS:** los nombres de acciones y menús son los de iOS 17/18 en español y pueden variar un poco según la versión.
- **Movimiento reducido:** respetado con la regla global de `base.css` y en los números que cuentan. No pude simularlo en el navegador de pruebas.
- **Simulador:** guardar metas falla solo en el simulador por un fallo de `simulador.js` (ver SOLICITUDES.md). En la vista de prueba se comprobó rodeando ese fallo.
