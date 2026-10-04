# F · Centro de notificaciones estilo Apple (rama `goat/notificaciones`, tanda 1)

## Para qué
"Centro de notificaciones de la web estilo Apple y lo que caracteriza este estilo." Dentro de la app (la 🔔 de Hoy) + avisos nativos del iPhone vía Atajos (D-057). **Sin montos ni detalles sensibles** (D-020): emoji + pocas palabras.

## Tus archivos
- `web/js/notificaciones/*` (`campana.js` — Hoy ya llama `iniciarCampana(boton, contador)` —, `panel.js`, `reglas.js`, `datos.js`, `atajos.js`), `web/css/notificaciones.css` (ya enlazado desde `index.html` por la base).
- Las plantillas del panel: créalas por código con `createElement` (no puedes editar `index.html`) o en un `<template>` que construyas en JS.
- `api/_rutas/notificaciones.js`. Sección **9. NOTIFICACIONES (reglas)** de `schema.sql` solo si necesitas algo extra (la tabla `notificaciones` ya existe en el núcleo). Pruebas `pruebas/notificaciones-*.test.mjs`.

## Panel (al tocar 🔔)
- Se abre como capa a pantalla completa que **baja desde arriba** (como el centro de notificaciones de iOS) con fondo desenfocado (`backdrop-filter: blur(30px) saturate(1.4)` sobre negro 55%); se cierra deslizando hacia arriba, con Esc o tocando "Cerrar". `inert` en el resto mientras está abierto; foco al panel.
- Arriba: hora y fecha grandes (estilo pantalla bloqueada: `viernes, 3 de octubre` + `12:40` en Archivo ancho), luego título "Notificaciones".
- Secciones **Hoy · Esta semana · Antes**. Dentro, **pilas agrupadas por módulo**: tarjeta de vidrio (`rgba(28,28,30,.72)`, radio 22px, borde 0,5px blanco 8%) con ícono (emoji en cuadrado redondeado 38px con fondo `--superficie-2`), nombre del módulo en mayúsculas pequeñas, tiempo relativo ("ahora", "hace 5 min", "ayer"), título en negrita y cuerpo en 2 líneas máx. Si un módulo tiene varias, se ven **apiladas** (2 tarjetas fantasma detrás, escaladas .96/.92) con "N más"; tocar la pila la expande con resorte y aparece "Mostrar menos".
- **Deslizar a la izquierda** una tarjeta revela "Borrar" (y "Ver"); deslizar del todo la descarta (`descartada_en`). Botón ⓧ junto a cada sección → "Borrar todo" (confirmación en línea, no `confirm()`).
- Tocar una notificación → marca `leida_en` y navega a su `url`.
- Estado vacío: "Sin notificaciones" centrado en gris, como iOS.
- El contador de la campana = no leídas y no descartadas; desaparece en 0; animación de rebote al cambiar.
- Respeta movimiento reducido (sin deslizamientos, solo fundidos).

## Reglas (`reglas.js`, puras + guardado)
Generan notificaciones a partir del resumen de Hoy (`construirResumen`) y guardan **sin duplicar** usando `clave` (`<regla>:<fecha>`):
- Pendiente nuevo según la hora (`🍽️ Almuerzo pendiente`, `💸 Check-in de gastos`).
- Racha: hito 3/7/14/30 días (`🔥 7 días seguidos`).
- Puntaje: superar 80 o llegar a 100 (`⭐ Día de 100`).
- Resumen de la mañana (primera apertura del día): `☀️ Tu día · 3 cosas por hacer`.
- Los demás módulos agregan las suyas con `notificar()` en la API (sueño, desbloqueo, rutina…) o con tu función `notificarLocal({modulo, emoji, titulo, cuerpo, url, clave})` exportada desde `web/js/notificaciones/datos.js`.
- Corren al cargar Hoy: `campana.js` escucha el evento `goat:resumen` que Hoy emite con el resumen cada vez que pinta.

## API
- `GET notificaciones/ahora` → para automatizaciones "Hora del día" del iPhone (ej. 9:00, 13:00, 16:00, 20:00, 22:15): devuelve `{ notificar: bool, mensaje }` con **solo emoji + 1–2 palabras** si hay algo pendiente o un bloque de rutina obligatorio sin marcar (si existe `web/js/rutina/logica.js`; si no, solo pendientes). Si no hay nada, `notificar:false`.
- `GET notificaciones` (lista para Scriptable o futuros clientes) y `POST notificaciones/leidas`.

## Atajo (`atajos.js`)
"🔔 Avisos de Goat": ⚙️ Goat → GET `notificaciones/ahora` → Si `notificar` → Mostrar notificación `mensaje` (sin sonido: en Ajustes › Notificaciones › Atajos). Automatizaciones: Hora del día × 5 horarios (ejecutar inmediatamente).

## Fuera de alcance (dejar anotado en tu RESULTADO)
Web Push real (necesita claves VAPID, guardar suscripciones y un servicio de envío programado: `pg_cron` + función). Propón cómo hacerlo después.

## Pruebas
- Reglas: no duplican (misma clave), sin montos, agrupación por módulo y por sección de tiempo, tiempo relativo.
- API `ahora`: nada pendiente → `notificar:false`; pendiente → mensaje corto sin dígitos de dinero.
- Navegador: abrir/cerrar, expandir pila, deslizar para borrar, contador, 375/768/1440, sin CSP.
