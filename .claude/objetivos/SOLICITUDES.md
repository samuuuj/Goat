# Solicitudes a archivos compartidos (las integra el orquestador)

## C · Sueño

1. **`pruebas/navegador/simulador.js` (Central): `ajustes_poner` falla en el simulador.** La rama `rpc/` hace
   `return respuesta(null, 204)`, y `respuesta()` convierte `null` en el texto `"null"`: un 204 con cuerpo hace que
   `new Response` lance un error, y supabase-js lo ve como fallo (en sueno.html sale "⚠️ No se pudo actualizar" al
   guardar metas, solo en el simulador; en Supabase real funciona). Arreglo: en esa rama,
   `return new Response(null, { status: 204 });`. Afecta a cualquier módulo que use `guardarAjuste()`.
2. **Conectar (B): leer `automatizaciones` y `requisitos` de cada atajo.** Los atajos de sueño tienen varias
   automatizaciones: `automatizaciones` es la lista completa y `automatizacion` es la primera (para el formato común).
   `requisitos` dice qué tener listo antes (atajo base "⚙️ Goat" y horario de sueño de Salud con "Registrar tiempo en
   cama con el iPhone").
3. **Widgets (E): sueño de anoche.** Usar `resumenSueno({ eventos, muestras, metas }, ahora)` de
   `web/js/sueno/logica.js` (o la ruta `GET sueno/resumen`): `ultimaNoche.duracionMin`, `ultimaNoche.etiqueta === "Anoche"`,
   `indice.valor`, `enCurso`. `duracionCorta(min)` da "7 h 10".
4. **Metas de sueño.** Se pueden cambiar en sueno.html y se guardan en `perfil.ajustes.sueno` con `ajustes_poner`
   (para no reescribir `perfil.metas`, que es de Central). La web y la API leen `{ ...perfil.metas, ...perfil.ajustes.sueno }`.
   Si Central hace un editor de metas general, conviene respetar ese orden o pasar las metas de sueño a `perfil.metas`.
5. **Notificaciones (F):** al despertar, la API crea un aviso `modulo: "sueno"`, `clave: "sueno:<fecha de la noche>"`,
   `url: "sueno.html"` ("☀️ Dormiste 7 h 10" + índice y frase). Sin montos.
6. **Idea para Central (no hecha):** `hoy.js` ya tiene `VERBO_PENDIENTE.sueno`. Si se quiere un pendiente "🌙 Tu sueño"
   cuando anoche no llegó nada, `resumenSueno().ultimaNoche` lo dice; no lo agregué porque el sueño debe ser automático
   (principio 2) y cambiaría lo que exige el desbloqueo. El índice de sueño (0–100) queda listo para un puntaje v2.
