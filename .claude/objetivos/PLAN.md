# Plan · 8 objetivos nuevos para Goat (en la nube, un objetivo por rama)

## Contexto
Samuel quiere que Goat deje de ser solo "Hoy + 4 registros" y se convierta en su cómplice diario con el iPhone:
1. finanzas completas desde Atajos, según su archivo `IDEAS/Atajo_gastos_movimientos_logica.md` (gasto, ingreso, transferencia, retiro; Efectivo, Nu, Nequi; categoría "Otro" escrita a mano), más **deudas**;
2. un primer uso que conecte el iPhone y pida los permisos;
3. sueño automático;
4. desbloqueo de minutos en TikTok, Instagram, YouTube y juegos según el puntaje;
5. widgets estilo Apple;
6. centro de notificaciones estilo Apple;
7. rutina con encuesta, clases, trabajos de la universidad, tareas y chequeo desde el iPhone;
8. gym ampliado con hora de inicio y fin, caminata y trote, como bloques obligatorios.

Cada objetivo lo hace un agente propio, en su propia rama, sin tocar lo de los demás. El trabajo sigue en la nube con el PC apagado.

**Respuestas de Samuel:**
- No tiene Apple Watch.
- Desbloqueo escalonado por app, con 1 pase de emergencia de 10 min al día.
- Deudas: lo que debe y lo que le deben.
- Revisión separada, con vista previa por objetivo. La web publicada (`main`) no cambia hasta que diga **"publica"**.

## Lo que el iPhone permite (base de todo el diseño)
- **Lo que una web/PWA no puede hacer:**
  - leer Salud ni Tiempo en pantalla;
  - bloquear apps;
  - crear widgets nativos;
  - ejecutar atajos sola.

  Los permisos reales los da iOS cuando un **Atajo** se ejecuta la primera vez: Salud, Recordatorios, notificaciones.
- **Por eso el sistema es web + Atajos + automatizaciones de iOS + Scriptable:**
  - la web guarda, calcula y muestra;
  - los Atajos envían y consultan `/api/v1` con un token personal;
  - las automatizaciones disparan los Atajos solos, con "Ejecutar inmediatamente".
- **Los Atajos se arman a mano en el iPhone, una sola vez.** Archivos `.shortcut` generados no se pueden instalar sin firmarlos en una Mac. La web da la guía paso a paso de cada uno. Cuando Samuel arme uno, puede guardar su enlace de iCloud para reinstalarlo en otro iPhone.
- **El desbloqueo es "fricción", no candado.** Al abrir TikTok, la automatización consulta la puerta; si no hay minutos, manda a la pantalla de inicio y avisa. Para un candado real se usa un código de Tiempo en pantalla que guarde otra persona; es opcional.
- **Sueño sin Watch:** se usa el horario de sueño de Salud. El iPhone registra "En cama", y hay automaciones de Sueño ("Hora de dormir comienza", "Despertar"), "Alarma se detiene" y "Cargador conectado". iOS no expone "cuándo dejé el celular": se aproxima con esos eventos.
- **Avisos en el iPhone:** los avisos nativos llegan por Recordatorios (con alerta) y por "Mostrar notificación" en los Atajos. Web Push queda para otra tanda: necesita claves y un servicio de envío.

## Forma de trabajo (nube + ramas)
1. **En el PC, antes de irme a la nube:**
   - registro las decisiones D-051 a D-058 en `docs/DECISIONES.md` y actualizo `docs/ESTADO.md`;
   - creo la rama `goat/base` desde `main`;
   - subo las fichas técnicas `.claude/objetivos/*.md`: el plan, las reglas de diseño de `docs/DISENO.md`, las convenciones y el alcance de cada agente. No llevan datos personales. Hacen falta porque `docs/` no está en GitHub y los agentes en la nube no lo verían;
   - hago push de esa rama, nunca a `main`, y paso la sesión a la nube con `move_to_cloud`.
2. **Fase 0 · Base:** la hago yo, el orquestador, en `goat/base` (detalle abajo). Compruebo su vista previa de Vercel.
3. **Agentes:** cada uno trabaja en un worktree y en su rama `goat/<objetivo>`, creada desde `goat/base`. Hacen commits solo en su rama.
   - **Tanda 1** (no dependen de otros): finanzas, sueño, ejercicio, rutina, notificaciones.
   - **Tanda 2** (usan lo anterior): desbloqueo, conectar, widgets.
4. **Integración:** uno las ramas en `goat/integracion` en este orden: base, notificaciones, finanzas, ejercicio, rutina, sueño, desbloqueo, conectar, widgets. Ahí agrego los cruces entre módulos y corro todas las pruebas.
5. **Vistas previas:** cada rama tiene su link de Vercel; `goat/integracion` muestra todo junto. "Publica" une `goat/integracion` con `main`. Si algo no le gusta ("cambia X en Finanzas"), se corrige solo en su rama y se vuelve a integrar.
6. **Si `move_to_cloud` falla** (por ejemplo, sin acceso a GitHub desde la nube), aviso y hago lo mismo en local con el PC encendido.

**Reglas que cada agente debe cumplir:**
- CSP estricta: nada de `innerHTML` con datos ni nada en línea; usar `<template>` y `textContent`.
- Dinero siempre `.sensible`; sin montos en notificaciones ni en mensajes de Atajos (D-020).
- Tablas con RLS, `user_id default auth.uid()` y `revoke` a `anon`.
- `schema.sql`: solo agregar, dentro de su sección, y que se pueda correr varias veces.
- Diseño: oscuro, Archivo en los titulares, un solo acento naranja, curvas `--curva` y `--resorte`, `prefers-reduced-motion`, primero a 375 px.
- Cada agente toca solo sus archivos. Las únicas excepciones están indicadas en su objetivo.

## Fase 0 · Base compartida (`goat/base`, la hago yo)
- **Estilos comunes:** paso las piezas reutilizables de `web/css/hoy.css` a un nuevo `web/css/comun.css`: `.sensible`, chips, velo y hoja, aviso, `.boton-secundario`, `.boton-circulo`, `.progreso` y los campos de formulario. Lo cargan `index.html` y las páginas nuevas.
- **Piezas JS:**
  - `web/js/piezas/chips.js`: saco `chips()` de `registros.js`.
  - `web/js/piezas/hoja.js`: hoja genérica (abrir, cerrar, arrastrar, Esc, `inert` configurable); `registros.js` pasa a usarla.
  - `web/js/piezas/pagina.js`: `iniciarPagina()`, con sesión, vistas cargando/fallo/falta-base, errores `BaseSinInstalar`/`SesionVencida`, botón "‹ Hoy" y modo discreto.
- **Navegación:**
  - En Hoy agrego una barra superior con 🔔 (con contador) y ⚙️.
  - Agrego una sección "Secciones" con tarjetas hacia `finanzas.html`, `rutina.html`, `sueno.html`, `ejercicio.html`, `desbloqueo.html` y `conectar.html`.
  - Dejo esas páginas creadas con "Pronto" para que no den 404; cada agente reemplaza la suya.
  - Dejo stubs por módulo (`web/js/<modulo>/atajos.js`, `web/js/conectar/bienvenida.js`, `web/js/notificaciones/campana.js`) para que nadie edite archivos compartidos.
- **API:**
  - Una sola función `api/v1.js` con una reescritura en `vercel.json` (`/api/v1/:ruta*`). Así no se choca con el límite de 12 funciones del plan Hobby.
  - `api/_lib/`:
    - `respuesta.js`: `{ok, mensaje, datos}`;
    - `supabase.js`: cliente PostgREST mínimo con `SUPABASE_SECRET_KEY`, siempre filtrado por `user_id`;
    - `auth.js`: token Bearer → SHA-256 → `api_tokens`, revisando `revocado` y anotando `ultimo_uso`. También valida la sesión web (JWT) con `/auth/v1/user`;
    - `registros.js`: el mismo formato que `cargarRegistros`, para reusar `construirResumen` en el servidor;
    - `notificar.js`, `log.js`, `validar.js`;
    - un límite simple de 60 llamadas por minuto por token.
  - Rutas base: `GET /ping`, `POST/GET/DELETE /tokens` (crear un token desde la web con sesión; se muestra una sola vez), `GET /hoy`.
  - Archivos de rutas por módulo como stubs en `api/_rutas/<modulo>.js`: cada agente llena solo el suyo.
  - Si falta la clave secreta, la API responde 503 "Falta configurar el servidor".
- **Base de datos (núcleo de `schema.sql`):**
  - tabla `notificaciones`: `modulo`, `emoji`, `titulo`, `cuerpo`, `url`, `clave` única por usuario, `leida_en`, `descartada_en`, `momento`, `fecha`;
  - columna `perfil.ajustes jsonb` para el progreso del primer uso y las reglas de desbloqueo;
  - encabezados vacíos de las secciones nuevas (sueño, desbloqueo, rutina), para que los agentes no choquen al unir.
- **Pruebas:**
  - carpeta `pruebas/` con `node --test` y el script `npm test`;
  - `@electric-sql/pglite` como devDependency para probar `schema.sql`: correrlo 2 veces, comprobar que otra cuenta no ve lo tuyo y que `anon` queda bloqueado.
- **Comprobación de la base:** en la vista previa, `/api/v1/ping` responde, las páginas cargan y la consola no muestra errores de CSP. Esto confirma que funciones + `outputDirectory: web` funcionan juntas.

## Objetivos (un agente cada uno)

### A · Finanzas y deudas (`goat/finanzas`)
- **Base de datos (sección 2):**
  - `finanzas_movimientos`: agregar `retiro` al `check` de tipo (borrar y volver a crear la restricción, de forma repetible); nuevas columnas `cuenta_destino`, `categoria_libre` y `deuda_id`.
  - Tabla nueva `finanzas_cuentas`: `nombre`, `tipo` (efectivo, banco, billetera, tarjeta_credito), `banco`, `saldo_inicial`, `cupo`, `orden`, `activa`. Efectivo, Nu y Nequi se crean al abrir Finanzas la primera vez.
  - Tabla nueva `finanzas_deudas`: `direccion` (debo, me_deben), `tipo` (persona, tarjeta_credito, prestamo, otro), `nombre`, `banco`, `monto_inicial`, `cuota`, `dia_pago`, `tasa_mensual`, `fecha_inicio`, `estado`, `notas`.
- **Reglas** (`web/js/finanzas/logica.js`, funciones puras que reusa la API):
  - Los 4 tipos se comportan como en el archivo de Samuel. Solo "gasto" (`egreso`) cuenta para el presupuesto; `calculo.js` no cambia.
  - Saldo por cuenta.
  - Una compra con tarjeta de crédito es gasto y sube la deuda de esa tarjeta; pagar la tarjeta es una transferencia.
  - Abonar a una deuda que debo es una salida que no cuenta como gasto. Cobrar lo que me deben es una entrada que no cuenta como ingreso. Un préstamo recibido es una entrada (no ingreso) más una deuda nueva.
- **Catálogos** (solo la parte de finanzas de `catalogos.js`):
  - Categorías de gasto: Comida, Transporte, Compras, Hogar, Ocio, Salud, Estudio, Servicios y Otros, más "Otro" para escribir a mano.
  - Categorías de ingreso: Salario, Trabajo, Venta, Devolución, Regalo y Otro.
- **Web** (`finanzas.html`, `web/css/finanzas.css`, `web/js/finanzas/`):
  - saldos por cuenta y total;
  - resumen del mes: gastos, ingresos y gasto por categoría en barras ordenadas;
  - movimientos agrupados por día, categoría o cuenta, con filtros por tipo, orden (recientes o monto) y buscador; abrir uno para editarlo o borrarlo;
  - Deudas, con las pestañas "Debo" y "Me deben": banco, saldo, cuota, próximo pago, barra de avance y botón Abonar;
  - hoja "Nuevo movimiento" con el flujo exacto del archivo: Tipo → Valor → Categoría/Otro → Cuenta(s) → Descripción.
- **Excepción:** puede actualizar la hoja "Gasto" de Hoy (`form-gasto` y `formularioGasto`) a los 4 tipos.
- **API:**
  - `GET finanzas/menu`: tipos, categorías, cuentas y deudas activas, para los menús del atajo;
  - `POST finanzas/movimientos`: responde "💸 Guardado · Comida", sin montos;
  - `GET finanzas/resumen`.
- **Atajo:** "💸 Movimiento" (guía en `web/js/finanzas/atajos.js`).
- **Pruebas:** los ejemplos del archivo (cena $25.000 con Nequi; ingreso de $500.000 a Nu; Nu→Nequi; retiro Nu→Efectivo), más tarjeta y abonos.

### B · Conectar iPhone · primer uso y permisos (`goat/conectar`)
- **Primer uso:** la primera vez que se entra en un dispositivo (marca en `localStorage` + `perfil.ajustes.bienvenida`), Hoy lleva a `conectar.html`. Es un asistente estilo "Configura tu iPhone":
  1. **Instalar en inicio:** detecta si ya se abre a pantalla completa.
  2. **Conectar:** crea el token, lo muestra una sola vez con botón Copiar y guía el atajo "⚙️ Goat" (URL + token). "Probar conexión" mira `ultimo_uso`.
  3. **Permisos:** explica cada permiso que iOS va a pedir (Salud: sueño y pasos; Recordatorios; notificaciones de Atajos; automatizaciones de apps) y qué tocar.
  4. **Atajos y automatizaciones:** arma la lista leyendo el `atajos.js` de cada módulo, con pasos, casilla de "hecho" y botón Probar.
  5. **Widgets:** enlace a la guía.
  6. **Listo.**
- **Ajustes (⚙️):** dispositivos conectados, revocar un token, volver a abrir el asistente.

### C · Sueño (`goat/sueno`)
- **Base de datos:**
  - `sueno_eventos`: `acostarse`/`despertar`, con fuente (modo sueño, cargador, alarma, manual);
  - `sueno_muestras`: "en cama" de Salud, únicas por inicio.
- **Lógica** (`web/js/sueno/logica.js`):
  - una noche va de acostarse a despertar y pertenece al día en que te acostaste (D-014);
  - calcula duración, regularidad en 7 días e índice de sueño de 0 a 100;
  - metas `sueno_horas` y `hora_despertar` en `perfil.metas`.
- **API:** `POST sueno/evento`, `POST sueno/sync`, `GET sueno/resumen`.
- **Web** (`sueno.html`):
  - la última noche en grande (hora de dormir, de levantarse y duración);
  - la semana en barras al estilo Salud;
  - índice y regularidad;
  - registro manual.
- **Automatizaciones:**
  - "🌙 Me acuesto": se dispara con "Hora de dormir comienza", modo Sueño activado o cargador conectado entre 21:00 y 03:00.
  - "☀️ Desperté": se dispara con "Despertar" o alarma detenida. Envía el evento y las muestras de Salud de las últimas 18 h.

### D · Desbloqueo por puntaje (`goat/desbloqueo`)
- **Regla (D-054)** — ajusta D-006 para respetar "registrar algo malo cuenta":
  - registros al día = puerta abierta, con **30 min por app**;
  - puntaje de hoy de 80 o más = **60 min**; puntaje 100 = **90 min**;
  - registros atrasados = 0 min, y la puerta dice qué registrar;
  - 1 pase de emergencia de 10 min al día;
  - apps: TikTok, Instagram y YouTube, más los juegos que Samuel liste en Ajustes. Cada una tiene su propia bolsa;
  - los límites se pueden editar en `perfil.ajustes`.
- **Base de datos:** `apps_eventos` (app, abrir/cerrar, momento) y `desbloqueo_pases`.
- **Lógica:** minutos usados (pares abrir/cerrar; una sesión sin cierre cuenta como máximo 30 min), ganados y restantes.
- **API:**
  - `GET desbloqueo/gate?app=`: `{permitido, minutos_restantes, mensaje, faltan[]}`. Si la API no responde, deja pasar (D-015);
  - `POST desbloqueo/evento`;
  - `POST desbloqueo/pase`.
- **Web** (`desbloqueo.html`): un anillo de minutos por app, tabla de niveles, qué falta registrar, botón de pase y uso de hoy.
- **Automatizaciones:** "App › TikTok › Se abre" ejecuta "🔒 Puerta": si no hay minutos, va a la pantalla de inicio, avisa y ofrece [Registrar ahora / Usar pase / Ahora no]. "Se cierra" registra el cierre.

### E · Widgets estilo Apple (`goat/widgets`)
- **API** `GET /api/v1/widget`:
  - puntaje, racha y anillos;
  - pendientes;
  - siguiente bloque de la rutina;
  - sueño de anoche;
  - minutos de desbloqueo restantes;
  - frase del día.

  Las frases dependen de la hora, el puntaje y la racha, cambian a diario y nunca regañan. No incluye dinero salvo con `?dinero=1`, y nunca en la pantalla bloqueada.
- **`scriptable/goat.js`:** un solo script que se adapta al tamaño (pequeño, mediano, grande y los tres de pantalla bloqueada):
  - fondo negro, anillos dibujados, acento naranja;
  - se actualiza cada 15 min y guarda la última respuesta por si no hay internet;
  - al tocarlo abre la sección correspondiente.
- **Web** (`widgets.html`): vista previa en HTML/CSS de cada widget y guía de instalación en Scriptable.

### F · Centro de notificaciones (`goat/notificaciones`)
- **🔔 en Hoy:** un panel estilo iOS:
  - título grande y secciones Hoy / Esta semana / Antes;
  - pilas agrupadas por módulo que se expanden;
  - tarjetas de vidrio con ícono emoji, título, texto y "hace 5 min";
  - deslizar para borrar y "Borrar todo";
  - tocar una lleva a su sección.
- **Reglas** (`web/js/notificaciones/reglas.js`): crean avisos a partir del resumen (pendientes, rachas, minutos ganados), sin duplicados gracias a `clave`. Los demás módulos avisan con `notificar()`. Sin montos (D-020).
- **API** `GET notificaciones/ahora`: mensaje solo con emoji para las automatizaciones "Hora del día" del iPhone, que lo muestran con "Mostrar notificación".

### G · Rutina, clases y tareas (`goat/rutina`)
- **Base de datos:**
  - `rutina_bloques`: plantilla semanal con título, tipo (despertar, caminar, desayuno, trabajo, descanso, almuerzo, ejercicio, cena, estudio, clase_presencial, clase_virtual, trabajo_uni, dormir, otro), días, hora, duración, obligatorio, aviso, lugar/enlace, materia;
  - `rutina_checks`: hecho/saltado por bloque y fecha, únicos;
  - `uni_tareas` (sección Universidad): título, materia, fecha límite, estado, prioridad, primer paso.
- **Encuesta** al estilo Apple: hora de levantarse, caminata (45 min), desayuno, bloques de trabajo útil con pausas (50/10 o 25/5), almuerzo, ejercicio, cena, caminata, estudio, hora de dormir, clases presenciales (martes y miércoles + horas), clases virtuales (+ enlace) y horas de trabajos de la universidad. Arma la plantilla semanal y luego se edita bloque por bloque.
- **Web** (`rutina.html`):
  - el día como línea de tiempo tipo Calendario, con "Ahora" resaltado y avance del día;
  - Hecho / Saltar en cada bloque, con los obligatorios marcados;
  - la semana;
  - tareas pendientes ordenadas por fecha límite.
- **Lógica:** bloques del día (los festivos usan la plantilla de fin de semana), bloque actual y siguiente, cumplimiento y obligatorios vencidos sin marcar.
- **API:** `GET rutina/hoy`, `GET rutina/ahora`, `POST rutina/check`, `GET/POST uni/tareas`.
- **iPhone:**
  - "☀️ Plan del día" (al despertar): crea recordatorios en la lista "Goat" con alerta a la hora de cada bloque. Se marcan desde la pantalla bloqueada, y la clase virtual lleva su enlace.
  - "✅ Hecho" (con toque en la parte trasera o widget de Atajos): marca el bloque actual.
  - "🌙 Cierre" (21:45 o cargador): sube los recordatorios completados.
  - La guía le explica a Samuel qué queda automático y qué no.

### H · Ejercicio y actividad (`goat/ejercicio`)
- **Base de datos (sección 5):**
  - `gym_sesiones` suma `tipo` (fuerza, caminata, trote, cardio, deporte, movilidad, otro), `inicio`, `fin`, `duracion_min`, `distancia_km` y `pasos`; `rutina` pasa a ser opcional;
  - tabla nueva `ejercicio_actividad`: pasos, distancia y energía del día, desde Salud.
- **Web** (`ejercicio.html` · "Movimiento"):
  - "Entreno en curso" con cronómetro (inicio → tipo → fin; aguanta sin internet);
  - registro manual con hora de inicio y fin;
  - semana contra la meta;
  - sesiones agrupadas por semana y tipo, con totales de minutos, km y pasos.
- **Excepción:** puede actualizar la hoja "Gym" de Hoy para agregar tipo, inicio y fin.
- **API:** `POST ejercicio/inicio`, `ejercicio/fin`, `ejercicio/sesion`, `ejercicio/actividad`.
- **Atajos:** "🏋️ Entreno" (iniciar o terminar, con tipo) y una automatización a las 21:30, "📈 Actividad", con pasos y distancia de Salud (el iPhone los cuenta sin Watch).

## Integración (`goat/integracion`, la hago yo)
- Una sesión de ejercicio que cubre un bloque de rutina del mismo tipo lo marca solo.
- `faltantes()` en `calculo.js` suma los bloques obligatorios vencidos sin marcar. Así aparecen en Hoy, en la puerta de desbloqueo y en el widget. El puntaje v1 no cambia (D-039); el puntaje v2 queda como pregunta para Samuel.
- Las tarjetas de Secciones en Hoy muestran un mini dato en vivo.
- Corro todas las pruebas, la revisión visual y la vista previa final.
- Escribo `.claude/objetivos/RESULTADO.md` con lo hecho y lo que hay que copiar a `docs/` cuando el PC esté encendido.

## Lo que solo Samuel puede hacer (se lo dejo en una lista al final)
1. Vercel › Settings › Environment Variables › `SUPABASE_SECRET_KEY` (Production y Preview), copiada de Supabase › API Keys › Secret. Nunca pegarla en el chat.
2. Pegar `supabase/schema.sql` de `goat/integracion` en el SQL Editor y Run. Solo agrega cosas, así que no rompe la web publicada.
3. Apagar "Allow new users to sign up". Correr `borrar-datos.sql` si sigue pendiente.
4. En el iPhone: activar el horario de sueño en Salud, seguir el asistente Conectar (armar atajos y automatizaciones, unos 30–45 min una sola vez) e instalar Scriptable.
5. Revisar cada link de vista previa y decir "publica" o "cambia X en <objetivo>".

## Verificación
- `npm test`:
  - lógica de cada módulo con los ejemplos del archivo de Samuel;
  - rutas de la API con un Supabase simulado: el token se exige primero, la respuesta no lleva montos y `id_cliente` evita duplicados;
  - `schema.sql` corrido 2 veces en PGlite, sin que otra cuenta vea lo tuyo y con `anon` bloqueado en cada tabla nueva.
- `npm run local` y navegador a 375, 768 y 1440 px en cada página nueva:
  - sin errores de CSP en la consola;
  - el dinero oculto en modo discreto;
  - el movimiento reducido respetado.
- Vista previa de Vercel:
  - `/api/v1/ping` responde;
  - con la clave secreta puesta: crear un token en Conectar y probar con `curl -H "Authorization: Bearer …"` las rutas `finanzas/menu`, `desbloqueo/gate`, `rutina/hoy` y `widget`.
- `node --check scriptable/goat.js`.
- Al final, Samuel prueba los atajos reales en su iPhone.
