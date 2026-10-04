# D · Desbloqueo por puntaje (rama `goat/desbloqueo`, tanda 2)

## Para qué
"Que la web pueda desbloquear horas de recompensa de tiempo en pantalla en apps de dopamina como TikTok, Instagram y YouTube o videojuegos, para cada una de ellas, dependiendo de cómo se desarrolle el puntaje de cada día." Samuel eligió **escalonado por app** con **1 pase de emergencia de 10 min al día**.

## Regla (D-054)
- **Puerta:** los registros deben estar **al día** según la hora (`pendientes` de `construirResumen()` vacío; ver `faltantes()` en `web/js/logica/calculo.js`). Registrar algo "malo" cuenta (principio 3).
- **Minutos por app hoy** (cada app tiene su bolsa propia):
  - registros atrasados → **0 min** (la puerta dice qué registrar);
  - al día → **30 min**;
  - puntaje de hoy ≥ 80 → **60 min**;
  - puntaje 100 → **90 min**.
  El nivel se calcula en vivo (sube durante el día). Si el puntaje baja de nivel, los minutos ya usados no se devuelven (restantes nunca < 0).
- **Pase de emergencia:** 1 al día, 10 min, para cualquier app; queda registrado.
- **Apps:** `tiktok`, `instagram`, `youtube` + juegos configurables (nombres libres) en `perfil.ajustes.desbloqueo.juegos` (array de `{id, nombre}`); cada juego tiene su bolsa. Niveles editables en `perfil.ajustes.desbloqueo.niveles` (por defecto los de arriba). Fines de semana: igual (P-15 abierta).
- **Fricción, no candado:** si no hay minutos, el atajo manda a la pantalla de inicio. Opcional (texto en la guía): candado real con Tiempo en pantalla + código que guarde otra persona.
- **Sin internet → deja pasar** (D-015); el atajo lo maneja si la petición falla.

## Tus archivos
- `web/desbloqueo.html`, `web/css/desbloqueo.css`, `web/js/desbloqueo/*` (`pagina.js`, `logica.js`, `datos.js`, `atajos.js`, `mini.js`).
- `api/_rutas/desbloqueo.js`. Sección **7. DESBLOQUEO** de `supabase/schema.sql`. Pruebas `pruebas/desbloqueo-*.test.mjs`.

## Base de datos (sección 7)
- `apps_eventos` (compartida con Ocio a futuro, D-016): `app` (≤ 40, slug), `evento` (`abrir`|`cerrar`), `permitido bool`, `momento`, `fecha`, `origen`, `id_cliente`, `creado_en`; índice (`user_id`, `fecha`, `app`).
- `desbloqueo_pases`: `app`, `minutos` (default 10, 1–30), `momento`, `fecha`, `origen`, `id_cliente`, `creado_en`.

## Lógica (`web/js/desbloqueo/logica.js`, pura)
- `minutosUsados(eventos, app, ahora)`: suma pares abrir→cerrar del día lógico; una apertura sin cierre cuenta hasta `min(ahora, apertura + 30 min)`; cierres sin apertura se ignoran.
- `nivel(resumen, niveles)` → `{minutos, nombre}` con `resumen.pendientes` y `resumen.score`.
- `estadoApp({resumen, eventos, pases, app, ajustes, ahora})` → `{permitido, ganados, usados, pase, restantes, faltan, siguienteNivel: {puntaje, minutos}}`.
- `mensajeGate(estado)` sin montos: `✅ 42 min en TikTok`, `🔒 Falta: almuerzo`, `⏳ Se acabó TikTok por hoy`.

## API
- `GET desbloqueo/gate?app=tiktok` → arma el resumen en el servidor (`cargarRegistrosServidor` + `construirResumen`), devuelve `{permitido, minutos_restantes, mensaje, faltan:[{clave, texto, atajo}], pase_disponible}` y **registra la apertura** (`apps_eventos` abrir, con `permitido`).
- `POST desbloqueo/evento` `{app, evento:"cerrar"}`.
- `POST desbloqueo/pase` `{app}` → si queda pase hoy: crea pase y responde `🆘 10 min`; si no: `🔒 Ya usaste el pase de hoy`.
- Puedes llamar `notificar()` cuando se gana un nivel nuevo (`🎉 60 min desbloqueados`, clave por día y nivel).

## Web (`desbloqueo.html`, titular `TU TIEMPO.` o `DESBLOQUEO.`)
1. **Estado:** "Abierto" / "Cerrado" grande + qué falta registrar (filas tocables que abren Hoy con la hoja correspondiente: `index.html#registrar=comida`… o simplemente enlazan a Hoy).
2. **Una tarjeta por app** con anillo de minutos restantes/ganados (anillo en blanco/naranja; no uses colores de anillos de Hoy), usados hoy, y botón "Usar pase" si aplica.
3. **Niveles:** tabla clara (Registros al día · 30 min / 80+ pts · 60 min / 100 pts · 90 min) marcando el nivel actual y cuánto falta para el siguiente.
4. **Juegos:** lista editable (agregar/quitar nombres) guardada en `perfil.ajustes.desbloqueo.juegos` (merge sin pisar otras claves).
5. **Uso de hoy:** línea de tiempo de aperturas/cierres por app.

## Atajos (`web/js/desbloqueo/atajos.js`)
- "🔒 Puerta" (recibe la app como entrada de la automatización): ⚙️ Goat → GET `desbloqueo/gate?app=<app>` → **Si** falla la petición → terminar (deja pasar) → **Si** `permitido` = false → Ir a pantalla de inicio → Mostrar notificación `mensaje` → Elegir del menú [Registrar ahora → Ejecutar el atajo correspondiente según `faltan[0].atajo` / Usar pase → POST `desbloqueo/pase` / Ahora no].
- "🔓 Cerré app": POST `desbloqueo/evento` `{app, evento:"cerrar"}`.
- Automatizaciones por app: "App › TikTok › **Se abre**" → Ejecutar "🔒 Puerta" con texto `tiktok`; "App › TikTok › **Se cierra**" → "🔓 Cerré app". Igual para Instagram, YouTube y cada juego. Ejecutar inmediatamente, sin notificar.
- Nota en la guía: también bloquear instagram.com / tiktok.com en Safari desde Tiempo en pantalla si se usa esa salida.

## Pruebas
- Niveles: registros atrasados → 0; al día con score 46 → 30; 85 → 60; 100 → 90; niveles personalizados.
- Minutos usados con pares, apertura sin cierre (tope 30 min), cierre huérfano; restantes nunca negativos; pase suma 10 solo 1 vez al día.
- API gate registra la apertura; mensajes sin montos; SQL/RLS.
