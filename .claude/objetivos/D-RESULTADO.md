# D · Desbloqueo por puntaje — resultado (rama `goat/desbloqueo`)

## Qué quedó hecho
**Regla D-054** en un solo lugar (`web/js/desbloqueo/logica.js`), la usan la página y la API:
- Registros atrasados → **0 min** · al día → **30 min** · puntaje ≥ 80 → **60 min** · 100 → **90 min**, por app y cada una con su bolsa.
- Minutos usados = pares abrir → cerrar del día lógico (04:00). Apertura sin cierre: cuenta hasta la siguiente apertura o ahora, **máximo 30 min**. Cierres sueltos, otros días y horas futuras se ignoran.
- Restantes = ganados + pase − usados, **nunca negativos**. Si el puntaje baja de nivel, lo usado no se devuelve.
- **Pase de emergencia:** 10 min para una app, **1 al día** (la base de datos lo garantiza con un índice único por día). Sirve aunque falte algo por registrar.
- Juegos con nombre libre (`Clash Royale` → `clash-royale`), máx. 12. Una app que llegue con otro nombre igual tiene su bolsa.
- Niveles editables en `perfil.ajustes.desbloqueo.niveles` (se limpian solos y un nivel más alto nunca da menos minutos).
- Mensajes sin montos: `✅ 42 min en TikTok` · `🔒 Falta: almuerzo` · `⏳ Se acabó TikTok por hoy` · `🆘 10 min en Instagram` · `🔒 Ya usaste el pase de hoy`.

**Base de datos** (sección 7 de `supabase/schema.sql`, repetible): `apps_eventos` (app, abrir/cerrar, permitido) y `desbloqueo_pases` (10 min, 1–30). RLS "solo lo mío", nada para `anon`.

**API** (`api/_rutas/desbloqueo.js`):
- `GET desbloqueo/gate?app=tiktok` → arma el resumen en el servidor (`cargarRegistrosServidor` + `construirResumen`), **anota la apertura** y responde `{permitido, accion: "pasar"|"bloquear", minutos_restantes, faltan:[{clave, texto, emoji, atajo, abrir}], abrir, pase_disponible, pista…}`. 🎉 notificación al ganar 60 o 90 min (una por día y nivel).
- `POST desbloqueo/evento` `{app, evento:"cerrar"}` · `POST desbloqueo/pase` `{app}` · `GET desbloqueo/estado` (todo lo de hoy sin anotar nada; para el widget y "Probar").
- `cargarDesbloqueo(db, ahora)` exportada para el widget.

**Web** (`desbloqueo.html`, titular `TU TIEMPO.`): estado Abierto/Cerrado con lo que falta (filas hacia Hoy) · puntaje y tabla de niveles con el actual marcado (editar minutos en hoja) · una tarjeta por app con anillo blanco de minutos restantes (naranja si lleva pase, punto naranja si está abierta ahora) · pase en hoja inferior · juegos editables (muestra el texto exacto para la automatización) · uso de hoy en barras por hora y lista de aperturas (las bloqueadas, marcadas) · guía de los atajos. `mini.js` para la tarjeta de Hoy ("60 min por app" / "🔒 Registra para abrir").

**Atajos** (`web/js/desbloqueo/atajos.js`): "🔒 Puerta" y "🔓 Cerré app" con pasos exactos en español, automatizaciones "App › Se abre / Se cierra" por app, y la guía honesta: fricción, no candado; candado opcional con código de Tiempo en pantalla; cerrar la salida por Safari.

## Archivos
`supabase/schema.sql` (solo sección 7) · `api/_rutas/desbloqueo.js` · `web/desbloqueo.html` · `web/css/desbloqueo.css` · `web/js/desbloqueo/{logica,datos,pagina,atajos,mini}.js` · `pruebas/desbloqueo-{logica,api,sql,atajos}.test.mjs` · `pruebas/navegador/datos-desbloqueo.js` · `.claude/objetivos/SOLICITUDES.md`.

## Cómo probarlo
- `npm test` → 61 pruebas en verde (17 de lógica, 12 de API, 6 de SQL, 3 de la guía + las de base).
- `npm run local` y abrir `http://localhost:3000/_pruebas/desbloqueo.html` (al día, ≈ 83–91 pts → 60 min, con uso de hoy y un juego). Variantes: `?desbloqueo=cerrado`, `?desbloqueo=pase`, `?escenario=vacio`.
- Revisado a 375, 768 y 1440 px, sin desbordes ni errores de CSP en la consola. Ojo: en el simulador, guardar juegos o niveles falla por un detalle del simulador de Central (SOLICITUDES 1); con el arreglo de una línea funciona (lo verifiqué así).

## Lo que Samuel debe hacer a mano (iPhone, ~20 min una vez)
1. Tener el atajo base **⚙️ Goat** (lo arma el asistente Conectar).
2. Armar **🔒 Puerta** y **🔓 Cerré app** siguiendo la guía de la página Tu tiempo (o del asistente Conectar). Correr cada uno una vez a mano y tocar **Permitir siempre** cuando iOS pregunte por la conexión a Goat y por notificaciones.
3. Crear **2 automatizaciones por app** (TikTok, Instagram, YouTube y cada juego): App › Se abre → Texto `tiktok` → Ejecutar atajo 🔒 Puerta; App › Se cierra → Texto `tiktok` → Ejecutar atajo 🔓 Cerré app. "Ejecutar inmediatamente" y sin "Notificar al ejecutar".
4. Agregar sus juegos en la página Tu tiempo (sección "Tus juegos") y usar el texto que muestra.
5. Opcional: límite de Tiempo en pantalla con código guardado por otra persona, y bloquear tiktok.com / instagram.com / youtube.com en Safari.
6. Pegar `schema.sql` de `goat/integracion` en Supabase (crea `apps_eventos` y `desbloqueo_pases`).

## Decisiones de gusto (elegí lo más simple; Samuel puede cambiarlas)
- El pase sirve aunque los registros estén atrasados (es de emergencia) y se puede usar en cualquier momento.
- Los segundos de un intento bloqueado cuentan como uso (solo importan si luego usas el pase). Los minutos se redondean al entero más cercano.
- En la web solo se editan los minutos de cada nivel; los puntajes (80 y 100) quedan fijos en la pantalla, aunque `perfil.ajustes` acepta otros.
- La notificación 🎉 de nivel la manda la puerta (API) la primera vez que abres una app ese día con 60 o 90 min.
- Fines de semana: igual que entre semana (P-15 sigue abierta).

## Límites conocidos (honestos)
- Es **fricción, no candado**: la puerta revisa al abrir y te manda al inicio; no te saca a mitad de un video. Si te pasas, el contador queda en 0.
- Sin internet, "Obtener contenido de URL" falla, el atajo se detiene y la app queda abierta (deja pasar, D-015). iOS muestra el error del atajo.
- La automatización "App" no dice qué app la disparó: por eso son 2 automatizaciones por app con su texto.
- "📝 Registrar ahora" abre el atajo **💸 Movimiento** para gastos; para comidas abre Goat en Safari (no hay atajo ni ruta de comidas todavía), y Safari puede pedir entrar otra vez porque no comparte la sesión con la app instalada.
- `Obtener valor del diccionario` con `datos.accion` usa la ruta con punto de Atajos; si una versión de iOS no la acepta, se hace en dos pasos (`datos` y luego `accion`).
