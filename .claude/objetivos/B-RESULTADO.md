# B · Conectar iPhone — resultado (rama `goat/conectar`)

## Qué quedó hecho
Una web no puede pedir permisos del iPhone; lo honesto es un **asistente estilo "Configura tu iPhone"** que deja todo conectado una sola vez, explica qué pedirá iOS y comprueba que llegue.

**Primer uso** (`web/js/conectar/bienvenida.js`): `revisarBienvenida()` devuelve `true` (Hoy manda a `conectar.html`) solo si este dispositivo no tiene `localStorage["goat:bienvenida"]` **y** `perfil.ajustes.bienvenida.completada` no es `true`. Si ya se terminó en otro dispositivo, marca este y sigue. Nunca lanza; todo acceso a `localStorage` va en try/catch y, si el navegador no deja guardar, no insiste (no habría cómo recordar "Ahora no"). El simulador sigue poniendo `goat:bienvenida=1`.

**Asistente** (`conectar.html`, 7 pantallas, barra de progreso, ‹ Atrás, Salir, botón naranja en la zona del pulgar, entrada lateral con `--curva`, titulares con máscara):
1. **HOLA, SAMUEL.** (nombre de `perfil.nombre`): qué se va a configurar, 20–30 min, "Goat registra por ti; tú solo confirmas". "Ahora no" marca el dispositivo y vuelve a Hoy.
2. **INSTÁLALA.** Detecta `display-mode: standalone` / `navigator.standalone` (✓ si ya está). Si no: Safari › Compartir › Agregar a inicio, con íconos; aviso de que la app guarda su sesión aparte de Safari; fuera del iPhone dice que se hace allá.
3. **TU LLAVE.** "Crear llave" → `POST /api/v1/tokens` con la sesión web → el token se muestra **una sola vez** (campo monoespaciado de solo lectura + Copiar + "No la compartas"). Vive solo en memoria: se borra al salir (`pagehide`), nunca va a `localStorage` ni a la base (allá solo el hash). Guía de «⚙️ Goat» con la `url` lista para copiar (`location.origin`, sin barra) y la de «🧪 Goat · Probar». **Probar conexión** mira `api_tokens.ultimo_uso` (select con RLS) cada 3 s hasta 5 min, y al volver de Atajos revisa enseguida (iOS congela la página en segundo plano). Si funciona, marca los dos atajos base como hechos.
4. **TUS PERMISOS.** Salud (sueño, pasos, distancia), Recordatorios (acceso completo), notificaciones de Atajos, "Permitir siempre" la conexión, automatizaciones ("Ejecutar inmediatamente" y sin "Notificar al ejecutar") y horario de sueño en Salud; qué se toma y para qué en una línea, qué tocar en una píldora. Nota honesta: una web no puede leer Salud ni Tiempo en pantalla.
5. **TUS ATAJOS.** Une los `ATAJOS` de cada `web/js/<modulo>/atajos.js` (vacíos se omiten; un id repetido es un error que nombra los dos módulos; un archivo que no carga se omite). Grupos con emoji y "n de m"; hoy son **14** (base 2, avisos 1, sueño 2, rutina 4, ejercicio 2, finanzas 1, desbloqueo 2). Cada atajo abre una hoja con para qué, "Antes" (`requisitos`), pasos numerados, **todas** sus automatizaciones (`automatizaciones` o `automatizacion`), permisos, **Probar** y el interruptor **Hecho** (`perfil.ajustes.atajos[id] = true`, sin pisar otras claves). Probar: la web llama a la ruta `prueba` (¿Goat responde? si falta la clave del servidor lo dice) y luego espera en `log_api` una llamada nueva del iPhone a esa parte de la API; si llega, marca Hecho solo.
6. **WIDGETS.** Enlace a `widgets.html`; misma llave u otra.
7. **LISTO / CASI LISTO.** Resumen ✓/Pendiente (instalada, iPhone conectado, atajos n de m) y "Ir a Hoy", que guarda `perfil.ajustes.bienvenida = { completada: true, fecha }` y la marca local.

**Ajustes** (`conectar.html#ajustes`, desde ⚙️ en Hoy; sin hash y con el asistente terminado también abre aquí): atajos listos + "Ver atajos" + "Abrir el asistente" · **Dispositivos conectados** (nombre, creada, último uso) con **Revocar** en dos toques (`DELETE /api/v1/tokens`) y "Crear otra llave" (iPhone, Widget, iPad, Otro) en hoja · **Apps del desbloqueo**: juegos en `perfil.ajustes.desbloqueo.juegos` con las reglas de `web/js/desbloqueo/logica.js` (sin pisar `niveles`) · **Metas**: entrenos por semana (`perfil.metas.gym_semana`, con merge) y enlace a las metas de sueño (las maneja Tu noche) · Cerrar sesión.

**Tarjeta de Hoy** (`mini.js`): "Falta tu llave", "3 de 14 atajos listos" o "✓ Todo conectado".

## Archivos
`web/conectar.html` · `web/css/conectar.css` · `web/js/conectar/{pagina,bienvenida,logica,pasos,datos,atajos,mini}.js` · `pruebas/conectar-{logica,bienvenida,atajos}.test.mjs` · `pruebas/navegador/datos-conectar.js` · `.claude/objetivos/SOLICITUDES.md` (sección B). `api/_rutas/conectar.js` sigue vacío: no hizo falta ninguna ruta nueva.

## Cómo probarlo
- `npm test` → 267 en verde + **1 «todo»** (no falla): la guía de rutina y la de desbloqueo escriben las rutas como si `url` ya trajera `/api/v1` (ver SOLICITUDES › B 1). Pasa a verde solo cuando Central corrija esos textos.
- 34 pruebas de Conectar: bienvenida con/sin marca, con/sin `perfil.ajustes`, almacenamiento bloqueado y error de red; unión de atajos (vacíos, repetidos, mal formados, módulo que no carga, los 14 reales con rutas de prueba que existen, solo GET y sin montos); el token solo existe recién creado; "Probar" de conexión y de atajos; textos; CSP de `conectar.html` y que el código solo guarde la marca de bienvenida en el navegador.
- `npm run local` → `http://localhost:3000/_pruebas/conectar.html` (asistente con una llave usada y 3 atajos hechos) · `?conectar=listo` (abre Ajustes) · `?escenario=vacio` (primer uso). El "iPhone" se simula: 8 s después de crear una llave anota su uso, y 5 s después de "Probar" un atajo llega su llamada.
- Revisado a 375, 768 y 1440 px: sin desborde horizontal, sin errores de CSP en la consola; token fuera del DOM al recargar; juegos, meta de gym, revocar y crear llave guardan sin pisar otras claves; "Ir a Hoy" guarda la bienvenida y la marca.

## Lo que Samuel hace a mano en el iPhone (20–30 min, una vez)
1. Tener la clave secreta del servidor en Vercel (sin ella "Crear llave" responde "🛠️ Falta configurar el servidor").
2. Abrir Goat en **Safari** › Compartir › **Agregar a inicio**, abrirla desde el ícono y entrar con su correo.
3. Seguir el asistente: **Crear llave** → Copiar → armar **«⚙️ Goat»** (Diccionario con `url` y `token` → Detener y generar salida) → armar **«🧪 Goat · Probar»** → tocar "Probar conexión" y correr el atajo. Tocar **Permitir siempre** cuando iOS pregunte.
4. En Salud: activar el **horario de sueño** y "Registrar tiempo en cama con el iPhone".
5. Armar los demás atajos y automatizaciones desde "Tus atajos" (con Probar en cada uno), sin prisa.
6. No compartir «⚙️ Goat» (lleva la llave). Si pierde el iPhone: Ajustes › Dispositivos conectados › Revocar.

## Decisiones de gusto (elegí lo más simple; Samuel puede cambiarlas)
- **`url` de «⚙️ Goat» sin `/api/v1`** (como ya lo asumían 4 de los 6 módulos); la ficha decía `<origen>/api/v1`. Rutina y desbloqueo quedan para ajustar en SOLICITUDES.
- Orden de los grupos: Base → Avisos → Tu noche → Tu día → Movimiento → Dinero → Tu tiempo (la puerta al final, porque necesita que lo demás registre).
- La lista de llaves y "Probar conexión" leen `api_tokens` con RLS en vez de `GET /api/v1/tokens` (mismos datos; así Ajustes funciona aunque falte la clave del servidor). Crear y revocar sí van por la API.
- "Hecho" es un interruptor estilo iOS en naranja; un atajo hecho lleva ✓ blanco y uno pendiente un círculo vacío (el naranja queda para lo accionable).
- Juegos del desbloqueo editables en Ajustes y en Tu tiempo (las mismas reglas de `desbloqueo/logica.js`); metas de sueño solo en Tu noche (ya las maneja), gym por semana en Ajustes.
- Revocar pide un segundo toque ("¿Revocar?") en vez de una ventana de confirmación.

## Límites conocidos
- La web no puede saber si Samuel armó un atajo: "Hecho" lo marca él o lo marca "Probar" cuando llega la llamada del iPhone.
- La API anota `ultimo_uso` como máximo una vez por minuto; por eso "Probar conexión" también acepta un uso de los últimos 2 min.
- La app instalada guarda su sesión aparte de Safari: si empezó el asistente en Safari, en la app lo vuelve a ver hasta que toque "Ir a Hoy" o "Ahora no" (lo hecho no se pierde: la llave y los atajos están en la base).
- Los pasos de iOS están escritos para iOS 17/18 en español; algunos nombres pueden variar un poco ("Detener y generar salida" se encuentra buscando "Detener").
