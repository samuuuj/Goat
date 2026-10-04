# Resultado · 8 objetivos unidos en `goat/integracion`

Rama `goat/integracion` = `goat/base` + las 8 ramas de objetivo + los cruces entre módulos. `main` no cambia hasta que Samuel diga **"publica"**.
Detalle de cada objetivo: `A-RESULTADO.md` … `H-RESULTADO.md`. Pedidos entre módulos: `SOLICITUDES.md` (todos atendidos abajo).

## Ramas

| Objetivo | Rama | Página |
|---|---|---|
| Base compartida | `goat/base` | Hoy con 🔔, ⚙️ y Secciones; `api/v1.js` |
| A · Finanzas y deudas | `goat/finanzas` | `finanzas.html` (Dinero.) |
| B · Conectar iPhone | `goat/conectar` | `conectar.html` (asistente y Ajustes) |
| C · Sueño | `goat/sueno` | `sueno.html` (Tu noche.) |
| D · Desbloqueo | `goat/desbloqueo` | `desbloqueo.html` (Tu tiempo.) |
| E · Widgets | `goat/widgets` | `widgets.html` + `web/scriptable/goat.js` |
| F · Notificaciones | `goat/notificaciones` | panel de la 🔔 en Hoy |
| G · Rutina | `goat/rutina` | `rutina.html` (Tu día.) |
| H · Ejercicio | `goat/ejercicio` | `ejercicio.html` (Movimiento.) |

Orden de unión: notificaciones → sueño → desbloqueo → ejercicio → rutina → finanzas → conectar → widgets. Solo chocó `SOLICITUDES.md` (se juntaron las secciones).

## Cruces hechos en la integración
- **Lo que falta** (`calculo.js`): suma los bloques obligatorios de la rutina vencidos sin marcar (`obligatoriosVencidos`, con `modulo: "rutina"`). Así salen en Hoy, en la puerta de desbloqueo, en las notificaciones y en el widget. El puntaje v1 no cambia (D-039).
- **Meta semanal de entrenos:** Hoy cuenta como Movimiento (`cuentaParaMeta`: caminata y movilidad no suman). `cargarRegistros` y `cargarRegistrosServidor` traen `gym_sesiones.tipo`, `rutina_bloques` activos y `rutina_checks` de hoy.
- **Entreno → rutina** (`web/js/logica/cruces.js › bloquesCubiertos`): un entreno terminado que cubre ≥ 70 % de un bloque compatible lo marca "hecho" (Movimiento, hoja Gym de Hoy, `POST ejercicio/fin` y `ejercicio/sesion`). Usa upsert con `ignore-duplicates`: nunca pisa lo que Samuel marcó. Si falla, el entreno se guarda igual.
- **Hoy:**
  - un pendiente de rutina lleva a `rutina.html`;
  - `index.html#registrar=<accion>` abre esa hoja (lo usan desbloqueo y widgets);
  - escucha `goat:registrar` del panel de notificaciones;
  - el botón y la hoja de dinero se llaman "Dinero" (4 tipos);
  - la rejilla de Secciones ya no se sale a 375 px y MOVIMIENTO. cabe entero.
- **Atajos:** el atajo base "⚙️ Goat" devuelve `url` **sin** `/api/v1`; todas las guías escriben `url` + `/api/v1/<ruta>` (rutina y desbloqueo estaban al revés). `pruebas/conectar-atajos.test.mjs` lo vigila.
- **Columna que falta (42703):** también muestra "falta actualizar la base", en la web y en la API.
- **Simulador:**
  - responde 204 sin cuerpo (guardar ajustes ya funciona);
  - arma los datos una sola vez;
  - hace upsert con `on_conflict`;
  - recalcula `fecha` en un PATCH.

## Verificación
- `npm test`: **316/316**. Cubre:
  - schema corrido 2 veces en PGlite, sin que otra cuenta vea lo tuyo y con `anon` bloqueado en cada tabla;
  - la lógica de cada módulo;
  - todas las rutas de la API con un Supabase simulado;
  - las guías de atajos;
  - los cruces (`pruebas/integracion.test.mjs`).
- `node --check web/scriptable/goat.js`: sin errores.
- Simulador a 375 px: Hoy, Dinero, Tu día, Movimiento, Tu noche, Tu tiempo, Widgets, Conectar y Ajustes cargan sin errores de consola ni desborde horizontal. Cada agente revisó además su página a 768 y 1440 px.
- Vercel construyó la vista previa de `goat/integracion` (estado "success").

## Lo que solo Samuel puede hacer (en orden)
1. **Clave del servidor:** en Vercel › Settings › Environment Variables, `SUPABASE_SECRET_KEY` (Production y Preview), copiada de Supabase › Project Settings › API Keys › Secret. Nunca en el chat. Sin ella la API responde "Falta configurar el servidor".
2. **Base de datos:** pegar `supabase/schema.sql` de esta rama en Supabase › SQL Editor › Run. Solo agrega cosas (la web publicada sigue funcionando). Se puede correr varias veces.
3. **Cerrar el registro de cuentas** (Authentication › "Allow new users to sign up" apagado) y correr `borrar-datos.sql` si sigue pendiente.
4. **Revisar la vista previa** de `goat/integracion` y decir **"publica"** o **"cambia X en <objetivo>"**.
5. **En el iPhone** (después de "publica", con la dirección definitiva, ~45 min una vez):
   1. Abrir Goat en Safari › Compartir › Agregar a inicio, y entrar.
   2. Seguir el asistente Conectar: crear la llave y armar "⚙️ Goat" y "🧪 Goat · Probar". Luego, desde "Tus atajos", armar el resto, cada uno con su botón Probar. Responder "Permitir siempre" cuando iOS pregunte.
   3. Salud › Sueño › Horario de sueño activado + "Registrar tiempo en cama con el iPhone".
   4. Recordatorios: crear la lista "Goat".
   5. Tu día: hacer la encuesta de la rutina.
   6. Tu tiempo: agregar los juegos.
   7. Dinero: ajustar el saldo de hoy de cada cuenta y crear la tarjeta de crédito si tiene.
   8. Instalar Scriptable, copiar el script desde Widgets y agregar el widget.
   9. Ajustes › Notificaciones › Atajos: sin sonido.

## Decisiones de gusto para que Samuel confirme o cambie
- **Desbloqueo:** el pase de emergencia sirve aunque falten registros; los fines de semana son iguales a entre semana (P-15).
- **Ejercicio:** caminata y movilidad no cuentan para la meta semanal de entrenos.
- **Rutina:**
  - las clases presenciales no son obligatorias;
  - un bloque vence 30 min después de terminar;
  - horas por defecto de la encuesta: 6:00 levantarse, 45 min de caminata, trabajo útil 8:00–12:00 en 50/10, almuerzo 12:30, ejercicio 17:00 (obligatorio), cena 19:00, estudio 20:00, dormir 22:00;
  - la encuesta dice dormir a las 22:00 y Tu noche usa 22:30 como meta: conviene igualarlos.
- **Sueño:** metas de arranque 7 h 30, a la cama 22:30, arriba 6:00. Cuenta la hora en que el iPhone te ve "En cama" si llega más de 45 min después de "me acuesto".
- **Notificaciones:** "Esta semana" son los 6 días anteriores a hoy; al cerrar el panel, todo lo visto queda leído.
- **Hoy:** el botón "Gasto" ahora se llama "Dinero".

## Para copiar a `docs/` (en el PC)
Ya registrado en `docs/DECISIONES.md` (D-059 a D-062) y `docs/ESTADO.md` el 2026-10-04.
