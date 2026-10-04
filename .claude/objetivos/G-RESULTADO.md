# G · Rutina, clases y tareas — resultado (rama `goat/rutina`)

## Qué quedó hecho
- **Página `rutina.html` · titular `TU DÍA.`**
  1. **Ahora:** tarjeta grande con el bloque en curso, reloj en vivo de lo que queda, barra de avance y botones **✓ Hecho / ⤼ Saltar**. Si no hay bloque: "Libre hasta las 14:00", "Arranca a las 06:00" o "Día cerrado". Debajo, "Después: 🍽️ Almuerzo 12:30" y **¿Lo hiciste?**: lo que terminó sin marcar (obligatorios primero, con ✓ y ⤼ de un toque).
  2. **El día como en Calendario de Apple:** horas a la izquierda, bloques con alto proporcional (lado a lado si se cruzan), línea naranja de "ahora" que avanza, ✓ hecho, ⤼ saltado, ● obligatorio (naranja si venció sin marcar), pausas rayadas y botón **Unirse ↗** en la clase virtual. Tocar un bloque abre su hoja (marcar, quitar marca, editar).
  3. **Semana L–D:** mini calendario por día (neutro; hecho en blanco, obligatorio más claro, vencido en naranja), hoy en naranja y % de cumplimiento. Tocar un día lo muestra en la línea de tiempo (se puede marcar lo de días pasados de la semana).
  4. **Tareas de la U:** vencidas arriba en naranja, luego por fecha límite; el **primer paso** siempre a la vista; círculo para marcar hecha; hoja corta para agregar (qué es, materia, para cuándo, primer paso) y para editar, empezar o borrar.
  5. **Qué hace el iPhone por ti:** en lenguaje simple, qué es automático y qué necesita su toque, con los pasos de cada atajo (desplegables) y enlace a Conectar.
  6. **Plantilla semanal:** lista de todos los bloques, choques de horario, "＋ Bloque" y "Rehacer con la encuesta". Cada bloque se edita en una hoja (nombre, tipo, días, hora, duración, obligatorio, aviso, lugar/enlace/materia según el tipo).
- **Encuesta** (asistente estilo "Configura tu iPhone", una pregunta por pantalla): hora de levantarse (y otra el fin de semana), caminata (45 min), desayuno (preparar + comer), trabajo útil (desde, horas, **50/10 o 25/5**, días), almuerzo, ejercicio (obligatorio ✓), cena + caminata nocturna, estudio, **clases presenciales** (materia, días como martes y miércoles, horas, lugar), **clases virtuales** (+ enlace https), **horas para trabajos de la U**, hora de dormir (sugiere 8 h antes de levantarse) → **vista previa por día con choques** → "Crear mi rutina". El trabajo útil se corre solo donde ese día hay clase u otro bloque. Las respuestas quedan en `perfil.ajustes.rutina` para rehacerla.
- **Reglas** (`web/js/rutina/logica.js`, puras, las usa también la API): `bloquesDelDia` (festivo = domingo), `bloqueActual`, `siguiente`, `estadoDelDia` (pendiente · ahora · hecho · saltado · vencido), **`obligatoriosVencidos()`** para `faltantes()`, `cumplimiento`, `semana`, `choques`, `generarPlantilla`, `bloqueParaMarcar`, orden de tareas.
- **Base de datos:** `rutina_bloques`, `rutina_checks` (único por bloque y fecha; solo puede apuntar a bloques propios) en la sección 8 y `uni_tareas` al final de la sección 4. RLS completo, nada para `anon`. Festivos de 2028.
- **API:** `GET rutina/hoy`, `GET rutina/ahora`, `POST rutina/check`, `POST rutina/checks`, `GET uni/tareas`, `POST uni/tareas`, `POST uni/tareas/hecha`.
- **Atajos** (`web/js/rutina/atajos.js`): ☀️ Plan del día, ✅ Hecho (+ copia ⤼ Saltar), 🌙 Cierre del día y 📚 Tarea. Dato corto para la tarjeta "Tu día" en Hoy (`mini.js`).

## Qué se sistematiza con el iPhone y cómo
| Qué | Cómo | ¿Solo? |
|---|---|---|
| Recordar cada bloque a su hora | "☀️ Plan del día" corre al despertar (Sueño › Despertar o Alarma › Se detiene; respaldo 6:05), pide `rutina/hoy` y crea un recordatorio por bloque en la lista **Goat** con alerta a su hora (clases presenciales 15 min antes, virtual 5). La clase virtual trae su enlace. | ✅ Automático |
| Avisos | Son notificaciones normales de Recordatorios: se ven en la pantalla bloqueada y se completan desde ahí. | ✅ Automático |
| Dar el visto bueno | Completar el recordatorio, **doble toque atrás del iPhone** ("✅ Hecho" marca el bloque que acabas de terminar) o tocar ✓ en la web. | 👆 Tu toque |
| Subir lo completado | "🌙 Cierre del día" a las 21:45 lee los recordatorios completados hoy y los marca en Goat. | ✅ Automático |
| Lo obligatorio sin marcar | 30 min después de terminar aparece en "¿Lo hiciste?" (y, con la integración, en lo que falta de Hoy y en la puerta del desbloqueo). Saltar también cuenta. | 👆 Tu toque |
| Saber si de verdad caminaste | iOS no lo sabe: lo confirmas tú. El ejercicio podrá marcarse solo con el objetivo H en la integración. | 👆 Tu toque |

## Cómo probarlo
- `npm test` → 56 pruebas en verde (33 de rutina: `rutina-logica` 14, `rutina-api` 9, `rutina-sql` 8, `rutina-atajos` 2).
- `npm run local` → http://localhost:3000/_pruebas/rutina.html?hora=2026-10-06T10:42 (martes con clase de Cálculo en curso). `?escenario=vacio` para la encuesta. `?hora=` fija la hora para revisar (sigue corriendo desde ahí).
- Revisado en el navegador a 375, 768 y 1440 px: sin scroll horizontal, sin errores de CSP en la consola, marcar / quitar marca / editar bloque / nuevo bloque con choque / enlace inválido / nueva tarea / encuesta completa hasta "Crear mi rutina".
- Con la clave secreta en Vercel y un token: `curl -H "Authorization: Bearer <token>" https://<vista-previa>/api/v1/rutina/hoy`.

## Lo que Samuel debe hacer a mano
1. Pegar `supabase/schema.sql` (de `goat/integracion`) en Supabase › SQL Editor › Run (solo agrega tablas).
2. En la app **Recordatorios**: crear una lista llamada exactamente **Goat**.
3. Armar los atajos siguiendo la sección "Qué hace el iPhone por ti" (o el asistente Conectar): primero "⚙️ Goat", luego ☀️ Plan del día, ✅ Hecho, 🌙 Cierre del día y 📚 Tarea (≈ 15 min). Cuando iOS pregunte: Recordatorios → **acceso completo**; notificaciones de Atajos → permitir.
4. Automatizaciones: Sueño › Despertar (o Alarma › Se detiene) → ☀️ Plan del día; Hora del día 21:45 → 🌙 Cierre; Ajustes › Accesibilidad › Tocar › Toque posterior › Doble toque → ✅ Hecho. "Ejecutar inmediatamente" y sin "Notificar al ejecutar".
5. Abrir **Tu día** y hacer la encuesta (2 minutos).

## Decisiones tomadas (para copiar a `docs/DECISIONES.md`)
- Un bloque **vence 30 min después de terminar** sin marcar; "saltado" cuenta como registro y lo quita de lo que falta.
- Las **pausas y el tiempo libre no se marcan** ni cuentan en el cumplimiento; Plan del día no crea recordatorio de pausas (el del trabajo útil muestra su rango, ej. "08:00–08:50").
- "✅ Hecho" con `bloque_id: "actual"` marca el bloque **sin marcar que ya empezó y termina más cerca de ahora** (si terminaste de caminar a las 06:57, marca Caminar y no el desayuno).
- Caminatas y ejercicio salen **obligatorios** de la encuesta (D-056); clases y lo demás no (se cambia por bloque).
- "Quitar de la rutina" = `activo = false` (no se pierden chequeos). Rehacer la encuesta inserta la plantilla nueva y luego apaga la anterior.
- `rutina_checks` tiene llave foránea `(bloque_id, user_id)` para que nadie chequee un bloque ajeno.
- La web deja marcar días pasados de la semana actual; la API, hasta 7 días atrás; nunca el futuro.

## Dudas de gusto (elegí lo más simple)
- Horas por defecto de la encuesta: trabajo útil 8:00 × 4 h, almuerzo 12:30, ejercicio 17:00, cena 19:00, estudio 20:00, dormir 22:00. Todo se cambia en la encuesta.
- ¿Las clases presenciales deberían ser obligatorias? Hoy no lo son.

## Límites conocidos
- Si cambias la plantilla a mitad del día, vuelve a correr "☀️ Plan del día" para actualizar los recordatorios.
- "Eliminar recordatorios" puede pedir confirmación en iOS (el paso es opcional).
- Solo hay dos horarios de mañana (entre semana y fin de semana); otros días distintos se ajustan bloque por bloque.
- La página no muestra todavía lo que marque el objetivo H (eso llega en la integración; ver `SOLICITUDES.md`).
