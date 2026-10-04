# F · Centro de notificaciones estilo Apple — resultado

Rama `goat/notificaciones` (desde `goat/base`). `npm test`: 48 pruebas (25 nuevas de este objetivo), todas en verde.

## Qué hice
- **Campana de Hoy** (`campana.js`): contador = no leídas y no descartadas; desaparece en 0, muestra "99+" y rebota al cambiar.
  Cada vez que Hoy pinta (`goat:resumen`) corren las reglas y se guardan **sin duplicar** (clave única).
  Recarga al volver a la app (lo que dejaron los atajos) y cuando otro módulo llama `notificarLocal()`.
- **Panel estilo iOS** (`panel.js` + `css/notificaciones.css`), armado por código con `createElement`/`textContent`:
  - baja desde arriba con vidrio (`blur(30px) saturate(1.4)` sobre negro 55 %); se cierra con "Cerrar", Esc o deslizando la manija de abajo hacia arriba;
  - fecha ("sábado, 3 de octubre") y hora grande en Archivo ancho, luego el titular "Notificaciones";
  - secciones **Hoy · Esta semana · Antes**, con **pilas por módulo**: tarjeta de vidrio con ícono emoji, módulo, "hace 5 min", título y 2 líneas;
    si hay varias, 2 tarjetas fantasma detrás (.955 y .91) y "N más"; tocar la pila la expande con resorte (FLIP) y aparece "Mostrar menos";
  - **deslizar a la izquierda** revela "Ver" y "Borrar"; deslizar del todo borra (en una pila cerrada, la pila entera); tecla Suprimir también borra;
  - ⓧ de cada sección se convierte en "Borrar todo" (confirmación en línea, se cancela sola a los 4 s o con Esc);
  - tocar una notificación la marca leída y va a su sección; si es de Hoy (pendientes, racha, puntaje) cierra el panel y baja hasta ahí;
  - punto naranja en las no leídas; al cerrar el panel, lo que viste deja de contar en la campana;
  - estado vacío "Sin notificaciones"; `inert` en `[data-fondo-hoja]` (Hoy y el dock), rol de diálogo, foco al panel y de vuelta a la campana;
  - movimiento reducido: el panel aparece con fundido, sin deslizamientos.
- **Reglas** (`reglas.js`, puras, las usa la web y la API): pendientes según la hora (el check-in de gastos una vez por franja de la tarde),
  racha 3/7/14/30 (identificada por su día de inicio, no se repite al día siguiente), puntaje 80+ y 100, resumen de la mañana
  ("☀️ Tu día · 3 cosas por hacer", antes de las 12:00). Los avisos de pendientes ya registrados se marcan leídos solos.
  Ningún texto regaña: "«No comí» también cuenta".
- **Lógica pura** (`logica.js`): agrupación, tiempo relativo ("ahora", "hace 5 min", "hace 3 h", "ayer", "martes", "12 sept"), validación (sin montos, url interna, largos de la tabla).
- **Datos** (`datos.js`): leer (30 días), marcar leídas, descartar (la fila queda para que la clave no se repita) y **`notificarLocal()`** para los demás módulos.
- **API** (`api/_rutas/notificaciones.js`):
  - `GET notificaciones/ahora` → `{ notificar, mensaje, aviso, pendientes }`, mensaje de emoji + 1–2 palabras ("🍽️ Almuerzo pendiente", "🍳 4 pendientes"); también guarda los avisos en el centro (misma clave que la web: no duplica).
  - `GET notificaciones` (`?limite=` hasta 50, `?no_leidas=1`) para Scriptable · `POST notificaciones/leidas` (`{ ids }` o `{ todas: true }`).
- **Atajo** (`atajos.js`): "🔔 Avisos de Goat" + 5 automatizaciones "Hora del día" (9:00, 13:00, 16:00, 20:00, 22:15).
- `schema.sql`: **sin cambios** (la tabla del núcleo alcanza).

## Archivos
`web/js/notificaciones/{campana,panel,reglas,logica,datos,atajos}.js` · `web/css/notificaciones.css` · `api/_rutas/notificaciones.js` ·
`pruebas/notificaciones-{reglas,logica,api}.test.mjs` · `pruebas/navegador/datos-notificaciones.js` · `.claude/objetivos/SOLICITUDES.md`.

## Cómo probarlo
1. `npm test`.
2. `npm run local` → http://localhost:3000/_pruebas/index.html → tocar la 🔔 (14 avisos de ejemplo de 8 módulos y 3 secciones, más los de las reglas).
   Probar: expandir la pila de Dinero, deslizar una tarjeta (a medias y del todo), "Borrar todo" en "Esta semana", tocar una notificación.
   `?escenario=vacio` y "Borrar todo" → "Sin notificaciones".
3. Revisado en el navegador a 375, 768 y 1440 px, sin errores de CSP en la consola.

## Lo que Samuel debe hacer a mano
1. En el iPhone, armar el atajo "🔔 Avisos de Goat" y sus 5 automatizaciones (la guía sale en Conectar iPhone; unos 10 min). Necesita el atajo base "⚙️ Goat".
2. Ajustes › Notificaciones › Atajos › desactivar "Sonidos" (avisos sin sonido, principio 9).
3. Nada en Supabase: no hay SQL nuevo.

## Decisiones de gusto (cámbialas si no te gustan)
- "Esta semana" = los 6 días anteriores a hoy (no desde el lunes), para que "ayer" nunca caiga en "Antes".
- Al cerrar el panel, todo lo que viste queda como leído (el contador se limpia, como al abrir el centro de notificaciones del iPhone). El punto naranja marca lo nuevo mientras lo ves.
- El resumen de la mañana sale solo antes de las 12:00. Horarios del atajo: 9:00, 13:00, 16:00, 20:00, 22:15.

## Límites conocidos
- Tocar un aviso de pendiente baja hasta "Lo que falta" pero no abre la hoja sola: falta que Hoy escuche `goat:registrar` (SOLICITUDES.md › 1).
- Los bloques obligatorios de la rutina llegan a `notificaciones/ahora` cuando la integración los sume a `faltantes()` de `calculo.js` (SOLICITUDES.md › 2).
- Con el panel abierto, las tarjetas usan `backdrop-filter`; con muchísimas (100+) un iPhone viejo podría ir más lento. Se muestran hasta 300 de los últimos 30 días.
- El movimiento reducido del CSS no se puede emular en la herramienta del navegador; se revisó el código y la parte de JavaScript.

## Propuesta: Web Push real (otra tanda)
Hoy los avisos nativos llegan por Atajos ("Mostrar notificación"). Para avisos push de la propia web (PWA instalada, iOS 16.4+):
1. **Claves VAPID**: generarlas una vez (`npx web-push generate-vapid-keys`); la pública va en `web/js/config.js`, la privada solo en Vercel (`VAPID_PRIVATE_KEY`).
2. **Service worker** `web/sw.js` (CSP ya permite `worker-src 'self'`): evento `push` → `showNotification(titulo, { body, icon, tag: clave, silent: true })`; `notificationclick` → abrir la `url` interna.
3. **Suscribir** desde un botón en Ajustes (iOS solo lo permite tras un toque y con la app instalada en inicio): `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` → `POST /api/v1/notificaciones/suscripcion`.
4. **Tabla** `push_suscripciones` (sección 9: `endpoint` único, `p256dh`, `auth`, `dispositivo`, `activa`, RLS como todas).
5. **Envío**: un trigger `after insert on notificaciones` no puede firmar VAPID; mejor un **cron** (Vercel Cron cada 5–15 min o `pg_cron` + `pg_net` llamando `/api/v1/notificaciones/enviar` con un secreto) que mande las no enviadas (columna nueva `enviada_en`) con la librería `web-push` (o firma VAPID propia con `node:crypto` para no sumar dependencias). Borrar suscripciones que respondan 404/410.
6. Mismas reglas: solo emoji + pocas palabras, sin montos, `silent: true`, y respetar un horario de silencio (ej. 22:30–07:00).
