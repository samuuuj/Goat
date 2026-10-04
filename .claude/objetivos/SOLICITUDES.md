# Solicitudes a Central (archivos compartidos que el objetivo no puede tocar)

## H · Ejercicio

1. **Meta semanal: que Hoy cuente igual que Movimiento.** Hoy (`web/js/logica/calculo.js` › métrica "Entrenos esta semana") cuenta **todas** las filas de `gym_sesiones`. En Movimiento la meta `gym_semana` cuenta solo fuerza, trote, cardio, deporte y otro; caminata y movilidad se ven aparte (si no, dos caminatas al día cumplen la meta el martes). Cambio propuesto:
   - `web/js/supabase/datos.js` › `cargarRegistros()` y `api/_lib/registros.js` › `cargarRegistrosServidor()`: pedir `fecha, tipo` de `gym_sesiones` (hoy solo `fecha`).
   - `calculo.js` › `agrupar()`: `for (const sesion of registros.gym) if (cuentaParaMeta(sesion)) del(sesion.fecha).gym += 1;` con `import { cuentaParaMeta } from "../ejercicio/logica.js";` (ese archivo no importa `calculo.js`: no hay ciclo). Las filas viejas sin `tipo` cuentan.
   - Si Samuel prefiere que todo cuente, basta cambiar `TIPOS_META` en `web/js/ejercicio/logica.js`.
2. **Integración Ejercicio → Rutina.** `cubreBloque(sesion, bloque)` está en `web/js/ejercicio/logica.js`. Acepta `bloque` como `{ tipo, inicio, fin }` (ISO, lo que devuelve `GET rutina/hoy`) o como fila de plantilla `{ tipo, hora_inicio, duracion_min, dias?, fecha? }` (sin `fecha` usa el día lógico de la sesión). Puntos donde llamarla al guardar o terminar una sesión:
   - Web: `web/js/ejercicio/pagina.js` › `guardar()` y `terminarCon()` (después de `encolar`); hoja Gym de Hoy: `web/js/piezas/registros.js` › `formularioGym` (en el `submit`).
   - API: `api/_rutas/ejercicio.js` › `POST ejercicio/fin` y `POST ejercicio/sesion` (junto a `avisarSiCumplio`).
3. **`comun.css` (opcional):** la hoja Gym de Hoy usa `.entrada` (tamaño normal) para las horas porque no puedo tocar `hoy.css`/`comun.css`. Si se quiere el selector grande también ahí, mover `.hora-grande` de `web/css/ejercicio.css` a `comun.css` y usarlo en `#form-gym`.
4. **Simulador (`pruebas/navegador/simulador.js`), solo informativo:** PATCH no recalcula `fecha` cuando cambia `momento`, y POST ignora `on_conflict` (los upsert duplicarían). Movimiento no depende de eso (calcula el día con `inicio` y sube con "actualizar y si no existe insertar"), pero otros módulos podrían.
5. **Conectar (B):** las guías de `web/js/ejercicio/atajos.js` asumen que el atajo base "⚙️ Goat" devuelve un diccionario con las claves `url` (sin `/` al final, ej. `https://….vercel.app`) y `token`; cada paso escribe `url` + `/api/v1/ejercicio/…`. Si B usa otros nombres de clave, avisar para ajustar el texto.
6. **Notificaciones (F):** la API deja una notificación `modulo: "ejercicio"`, `clave: "ejercicio:semana:<lunes>"`, `url: "ejercicio.html"` cuando la semana llega a la meta (una sola vez por semana).
