# B · Conectar iPhone · primer uso y permisos (rama `goat/conectar`, tanda 2)

## Para qué
Samuel pidió: "que la web, siempre que alguien la abra por primera vez, pida permisos para realizar cambios en el iPhone o tomar datos y ejecutar atajos". Una web **no puede** pedir permisos del iPhone; lo honesto y útil es un **asistente de configuración estilo "Configura tu iPhone"** que deja todo conectado en un rato, explica cada permiso que iOS pedirá y verifica que funcione.

## Tus archivos
- `web/conectar.html`, `web/css/conectar.css`, `web/js/conectar/*` (`pagina.js`, `bienvenida.js`, `pasos.js`, `atajos.js`, `mini.js`).
- `api/_rutas/conectar.js` (si necesitas algo además de `tokens` y `ping`, que ya están en `central.js`).
- Pruebas `pruebas/conectar-*.test.mjs`.
- Lees (no editas) los `web/js/<modulo>/atajos.js` de todos los módulos.

## Primer uso
- `revisarBienvenida()` (en `bienvenida.js`, Hoy ya la llama): devuelve `true` si en **este dispositivo** no existe `localStorage["goat:bienvenida"]` **y** `perfil.ajustes.bienvenida.completada` no es true → Hoy redirige a `conectar.html`. Envuelve todo acceso a `localStorage` en try/catch (modo privado).
- Al terminar o al tocar "Ahora no" → marca el dispositivo; "Listo" también guarda `perfil.ajustes.bienvenida = { completada: true, fecha }` (update de `perfil.ajustes` con merge, sin pisar otras claves).

## Asistente (pantallas a pantalla completa, avanzar con botón principal, barra de progreso arriba, atrás)
1. **Hola.** Titular `HOLA, SAMUEL.` (nombre de `perfil.nombre` si existe) + qué vas a configurar (≈ 20–30 min una sola vez) y por qué: "Goat registra por ti; tú solo confirmas".
2. **Instálala.** Detecta `matchMedia('(display-mode: standalone)')` / `navigator.standalone`. Si no está instalada: pasos con íconos (Safari › Compartir › Agregar a inicio). Si ya lo está: ✓.
3. **Conecta tu iPhone.** Botón "Crear llave" → `POST /api/v1/tokens` con `Authorization: Bearer <access_token de la sesión>` y `{nombre: "iPhone"}` → muestra el token **una sola vez** en un campo monoespaciado con botón **Copiar** (`navigator.clipboard.writeText`), aviso "No la compartas". Guía del atajo **"⚙️ Goat"** (Diccionario `{url: "<origen actual>/api/v1", token: "<pegar>"}` → Detener y devolver el diccionario). Botón **Probar conexión**: le pide a Samuel correr el atajo "🧪 Goat · Probar" (GET `ping`) y la página consulta `api_tokens.ultimo_uso` (select con RLS) cada 3 s hasta ver el uso → ✓.
4. **Permisos que iOS te pedirá.** Lista clara: Salud (Análisis del sueño, Pasos, Distancia) → "Permitir"; Recordatorios → "Permitir acceso completo"; Notificaciones de Atajos → activar; Automatizaciones → "Ejecutar inmediatamente" y apagar "Notificar al ejecutar"; Horario de sueño en Salud (para las automatizaciones de Sueño). Explica qué dato se toma y para qué, en 1 línea cada uno. Nota: una web no puede leer Salud ni Tiempo en pantalla; por eso se usan Atajos.
5. **Atajos y automatizaciones.** Une los `ATAJOS` de todos los módulos (importa cada `web/js/<modulo>/atajos.js`; si alguno está vacío, lo omite). Agrupa por módulo con su emoji; cada atajo se abre como hoja con: para qué, pasos numerados, automatización (disparador + pasos), permisos, botón **Probar** (le dice qué correr y verifica por `ultimo_uso`/datos nuevos cuando aplique) y casilla **Hecho** (guardado en `perfil.ajustes.atajos[id] = true`). Progreso "5 de 9 listos".
6. **Widgets.** Enlace a `widgets.html` (guía de Scriptable).
7. **Listo.** Resumen ✓/pendiente y botón "Ir a Hoy".

## Ajustes (`conectar.html#ajustes`, desde ⚙️ en Hoy)
- **Dispositivos conectados:** `GET /api/v1/tokens` (nombre, creado, último uso) → **Revocar** (`DELETE`). "Crear otra llave".
- **Volver a abrir el asistente.**
- **Apps del desbloqueo:** lista editable de juegos (nombres) en `perfil.ajustes.desbloqueo.juegos` (lo usa el objetivo D; si D define otra clave, usa la suya — revisa `web/js/desbloqueo/`).
- **Metas:** sueño (horas, hora de despertar) y gym por semana en `perfil.metas` (solo si no los gestiona otra página).

## Diseño
Estilo setup de iOS sobre el sistema de Goat: fondo negro, titular grande por paso, ícono/emoji grande, texto corto, botón principal naranja abajo (zona del pulgar), "Ahora no" en gris. Transiciones entre pasos con `--curva`. Respetar movimiento reducido.

## Pruebas
- `revisarBienvenida()` con/ sin marca local y con/ sin `perfil.ajustes`.
- Unión de `ATAJOS` (módulo vacío, ids duplicados → error claro).
- Token: se muestra una vez; al recargar no se vuelve a ver.
- Navegador a 375/768/1440, sin CSP.
