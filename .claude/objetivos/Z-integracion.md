# Integración (rama `goat/integracion`, la hace el orquestador)

1. Crear `goat/integracion` desde `goat/base` y unir en orden: notificaciones → finanzas → ejercicio → rutina → sueno → desbloqueo → conectar → widgets. Resolver conflictos (esperables en `schema.sql`, `index.html`, `registros.js`, `catalogos.js`) respetando lo de cada objetivo. Atender `.claude/objetivos/SOLICITUDES.md` de cada rama.
2. Cruces entre módulos (en archivos de Central):
   - `web/js/logica/calculo.js` › `faltantes()`: agregar los bloques **obligatorios vencidos sin marcar** de la rutina (`obligatoriosVencidos()` de `web/js/rutina/logica.js`) como pendientes (`{clave:"rutina:<id>", emoji, texto:"Caminar", accion:"rutina"}`); `cargarRegistros()` (navegador) y `cargarRegistrosServidor()` (API) traen `rutina_bloques` + `rutina_checks` de hoy. Así aparecen en Hoy, en la puerta de desbloqueo, en el widget y en las notificaciones. El puntaje v1 (D-039) **no cambia**.
   - En Hoy, un pendiente de rutina abre `rutina.html`.
   - Ejercicio → Rutina: al guardar/terminar una sesión (web y API), marcar `hecho` los bloques de hoy que `cubreBloque()` cubra (si no están marcados).
   - Tarjetas de "Secciones" en Hoy: mostrar `miniDato()` de cada módulo (sin montos).
   - Notificaciones de los módulos vía `notificar()` (sueño registrado, nivel de desbloqueo, obligatorio vencido).
3. `npm test` completo, revisión en navegador de todas las páginas (375/768/1440, sin CSP, discreto, movimiento reducido), push de `goat/integracion` y comprobación de su vista previa (`/api/v1/ping`).
4. Escribir `.claude/objetivos/RESULTADO.md`: qué hizo cada objetivo, links de vista previa por rama, **pasos que solo Samuel puede hacer** (clave secreta en Vercel para Production y Preview, pegar `schema.sql` de `goat/integracion`, apagar registros nuevos, correr `borrar-datos.sql` si sigue pendiente, horario de sueño en Salud, asistente Conectar en el iPhone, Scriptable), decisiones a copiar en `docs/DECISIONES.md` y estado para `docs/ESTADO.md`, y preguntas abiertas (puntaje v2 con sueño/ejercicio/rutina; qué juegos; fines de semana; Web Push).
5. **No unir a `main`** hasta que Samuel diga "publica". Para cambios ("cambia X en Finanzas"): editar solo `goat/finanzas`, volver a unir en `goat/integracion`, probar y avisar.
