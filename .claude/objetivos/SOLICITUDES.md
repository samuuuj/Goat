# Solicitudes al orquestador (archivos que no son del objetivo que las pide)

## A · Finanzas

1. **Hoy se sale por la derecha a 375 px** (`web/css/hoy.css`, ya pasaba en `goat/base`): en "Secciones", la palabra «MOVIMIENTO.» ensancha la segunda columna (tarjetas de 253 a 423 px en un iPhone de 375). Como hay desborde, el navegador agranda el ancho de la página y la hoja inferior también queda más ancha que la pantalla (se ve cortada la caja "Descripción" de la hoja Gasto). Arreglo sugerido:
   ```css
   .secciones-rejilla { grid-template-columns: repeat(2, minmax(0, 1fr)); }
   .seccion-tarjeta-titulo { font-size: clamp(1.25rem, 6.4vw, 1.65rem); overflow-wrap: anywhere; }
   ```
   (y a 48rem `repeat(3, minmax(0, 1fr))`).
2. **Simulador** (`pruebas/navegador/simulador.js`): `cargarDatos()` no guarda la promesa, así que si la página hace varias consultas en paralelo al cargar, `ejemplo()` y los `agregar()` de cada módulo se corren varias veces. Los que hacen `push` a una tabla compartida duplican filas. En `datos-finanzas.js` lo evité (solo agrega una vez), pero conviene: `let cargando = null; function cargarDatos() { return (cargando ??= (async () => { … })()); }`.
3. **`web/js/piezas/registros.js`**: `formularioGasto()` ahora delega en `js/finanzas/formulario.js`. Quedaron imports sin uso arriba (`CATEGORIAS`, `CUENTAS`, `MONTOS_RAPIDOS`, `MONTO_MAXIMO`, `TIPOS_MOVIMIENTO`, `formatoCOP`); no los quité para no chocar con otras ramas que tocan ese mismo bloque. Al integrar se pueden borrar. El `import` del formulario quedó justo encima de `formularioGasto()` (los `import` pueden ir en cualquier parte del nivel superior).
4. **Título de la hoja en Hoy**: `TITULO.gasto = "Gasto"` (en `registros.js`, fuera de mi función). Ahora la hoja registra los 4 tipos; si Samuel prefiere, cambiarlo a "Dinero" o "Movimiento". Lo dejé igual.
5. **`api/_lib/registros.js`** (opcional): el cálculo de Hoy en la API lee `finanzas_movimientos` con `tipo,monto,fecha,momento`; sigue funcionando igual porque solo `egreso` cuenta para el presupuesto. No requiere cambio.
