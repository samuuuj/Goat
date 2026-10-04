# Solicitudes a Central (archivos que no son del objetivo)

## D · Desbloqueo

1. **`pruebas/navegador/simulador.js` (Central) — `rpc/ajustes_poner` falla en el simulador.**
   Devuelve `respuesta(null, 204)`, que arma `new Response("null", { status: 204 })`: el navegador lanza
   `TypeError` (un 204 no puede tener cuerpo) y `guardarAjuste()` termina en "No se pudieron leer los registros ()".
   Arreglo de una línea: `return respuesta(undefined, 204);`. Afecta a todo lo que guarda en `perfil.ajustes`
   (juegos y niveles del desbloqueo, bienvenida y atajos de Conectar). Lo probé parcheando `Response` solo en la consola.

2. **`web/js/paginas/hoy.js` (Central) — abrir la hoja de registro desde un enlace.**
   Las filas "Lo que falta" de `desbloqueo.html` y el botón "📝 Registrar ahora" del atajo "🔒 Puerta" (cuando no hay
   atajo de iPhone para eso, como las comidas) abren `index.html#registrar=<accion>` (`comida`, `gasto`, `estudio`, `gym`).
   Pedido: al cargar Hoy, si `location.hash` es `#registrar=<accion>` válido, llamar `registro.abrir(accion)` y limpiar
   el hash con `history.replaceState`. Hoy funciona igual sin esto (solo abre Hoy).

3. **Widget (objetivo E) — minutos de desbloqueo.** Para `"desbloqueo": {"minutos": 60}` de `GET /api/v1/widget`:
   `import { cargarDesbloqueo } from "../_rutas/desbloqueo.js"` y `estadoDesbloqueo({ ...await cargarDesbloqueo(db, ahora), ahora })`
   de `web/js/desbloqueo/logica.js` → `nivel.minutos` (ganados por app hoy), `abierto`, y por app `apps[i].restantes`.
   `GET /api/v1/desbloqueo/estado` devuelve lo mismo ya armado (no anota aperturas).

4. **Conectar (objetivo B) — juegos del desbloqueo.** La clave es `perfil.ajustes.desbloqueo = { juegos: [{ id, nombre }], niveles: [{ puntaje, minutos }] }`.
   La página `desbloqueo.html` ya edita ambos; si Ajustes también los edita, guardar con merge sin pisar `niveles`.
   Para "Probar" en el asistente, los dos atajos usan `GET desbloqueo/estado` (no ensucia el uso de hoy).

5. **Integración — pendientes de rutina.** `comoRegistrar()` (en `web/js/desbloqueo/logica.js`) ya manda `accion: "rutina"` a `rutina.html`.
   Cuando exista un atajo de comidas o una ruta `POST comidas`, agregarlo en `ATAJO_DE` de ese archivo para que
   "Registrar ahora" abra el atajo en vez de la web.
