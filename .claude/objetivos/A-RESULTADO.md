# A · Finanzas y deudas — resultado (rama `goat/finanzas`)

## Qué quedó hecho
- **Los 4 tipos de Samuel** con su flujo exacto (Tipo → Valor → Categoría u «Otro…» escrito a mano / Origen y Destino → Cuenta → Descripción):
  - **Gasto** (`egreso` en la BD): baja la cuenta y es lo único que mueve el presupuesto de Hoy (`calculo.js` no cambió).
  - **Ingreso**: sube la cuenta. **Transferencia**: Nu → Nequi, el total no cambia. **Retiro**: de Nu/Nequi a Efectivo (si no se dice el destino, va a Efectivo).
  - «Otro…» → «Cita» se guarda con `categoria_libre = true`. Si escribe una que ya existe («comida») usa la del catálogo.
- **Cuentas** (`finanzas_cuentas`): Efectivo, Nu y Nequi se crean solas la primera vez (desde la página, la hoja de Hoy o la API). Se pueden agregar más (banco, billetera, tarjeta de crédito), editar el «saldo de hoy» (recalcula el saldo inicial), archivar (solo con saldo en cero) o borrar si no tienen movimientos.
- **Tarjeta de crédito** = una cuenta: comprar con ella es gasto y sube su deuda; pagarla desde Nu es una transferencia (`pago_tarjeta`), no otro gasto. Aparece sola en «Debo» con su próximo pago y el % del cupo.
- **Deudas** (`finanzas_deudas`), pestañas **Debo / Me deben**: persona, préstamo u otro, con banco, cuota, día de pago, interés mensual y notas. Abonar (debo) es una salida que no es gasto; cobrar (me deben) es una entrada que no es ingreso. Al llegar a cero se marca **pagada** («🎉 Deuda saldada»). Al crearla se puede decir si el dinero pasó por una cuenta (préstamo recibido/dado).
- **Página `finanzas.html` (titular «DINERO.»)**: total y saldos por cuenta; el mes (gastos, ingresos, neto, gasto por categoría en barras de mayor a menor, meses anteriores con ‹ ›); movimientos agrupados por **Día · Categoría · Cuenta**, filtros por tipo, orden **Recientes / Monto**, buscador (busca en todos los meses), tocar para editar o borrar (borrar pide un segundo toque); deudas; botón flotante «＋ Movimiento». `finanzas.html#nuevo` abre la hoja directo.
- **Hoja «Gasto» de Hoy**: ahora con los 4 tipos y las cuentas reales; recuerda la última cuenta usada por tipo. Si la base aún no tiene la v2, sigue guardando gastos e ingresos como antes.
- **API**: `GET finanzas/menu`, `POST finanzas/movimientos` (también tipo «deuda» para abonar/cobrar), `POST finanzas/abonos`, `POST finanzas/deudas`, `GET finanzas/resumen`. Mensajes sin montos: «💸 Guardado · Comida», «💰 Ingreso guardado», «🔁 Transferencia guardada», «🏧 Retiro guardado», «📒 Abono guardado». Acepta los mismos textos del menú («💸 Gasto», «🍔 Comida», «Nequi») y evita duplicados con `id_cliente` o, si falta, con un reintento idéntico en 60 s.
- **Atajo «💸 Movimiento»**: guía paso a paso en `web/js/finanzas/atajos.js` (16 pasos, incluye la opción «📒 Deuda»).
- **Tarjeta «Dinero.» en Hoy** (`mini.js`): «📒 Pago en 2 días» si una deuda vence pronto; si no, «3 movimientos hoy». Sin montos.

## Archivos
- `supabase/schema.sql` (solo al final de la sección 2. FINANZAS): `finanzas_cuentas`, `finanzas_deudas`, `retiro` en el check de tipo, columnas `cuenta_id`, `cuenta_destino_id`, `categoria_libre`, `deuda_id`; llaves compuestas `(user_id, id)` para que un movimiento solo apunte a cuentas/deudas del mismo usuario (`on delete set null (col)`, Postgres 15+). Repetible.
- `web/js/finanzas/logica.js` (reglas puras, las usan web y API), `datos.js`, `formulario.js` (hoja compartida con Hoy), `pagina.js`, `atajos.js`, `mini.js`.
- `web/finanzas.html`, `web/css/finanzas.css`.
- `web/js/logica/catalogos.js` (solo la parte de finanzas), `web/index.html` (`form-gasto`), `web/js/piezas/registros.js` (`formularioGasto()`).
- `api/_rutas/finanzas.js`.
- Pruebas: `pruebas/finanzas-logica.test.mjs`, `finanzas-sql.test.mjs`, `finanzas-api.test.mjs`, `finanzas-atajos.test.mjs`; simulador: `pruebas/navegador/datos-finanzas.js`.

## Cómo probarlo
- `npm test` → 62 pruebas en verde (incluye `schema.test.mjs`).
- `npm run local` → http://localhost:3000/_pruebas/finanzas.html (datos de ejemplo) y `?escenario=vacio`; la hoja de Hoy en http://localhost:3000/_pruebas/index.html › dock «Gasto».
- Revisado en el navegador: 375 px (todo), 768 y 1440 px (medidas: 3 y 2 columnas a 768; total junto a las cuentas, mes en dos columnas y filtros fijos a la izquierda de la lista a 1440; nada se sale), modo discreto (todo el dinero borroso), consola sin errores de CSP. Probado de punta a punta en el simulador: gasto «Otro → Cita», cobro que salda una deuda, retiro y gasto desde Hoy, crear cuenta, agrupar/ordenar/filtrar/buscar.

## Lo que Samuel debe hacer a mano
1. Pegar `supabase/schema.sql` (de `goat/integracion`) en Supabase › SQL Editor › Run. Solo agrega; no borra nada.
2. Armar el atajo «💸 Movimiento» siguiendo la guía (aparece en Conectar iPhone). Requiere el atajo base «⚙️ Goat» y la clave secreta puesta en Vercel.
3. En Finanzas, ajustar el «saldo de hoy» de Efectivo, Nu y Nequi (toca cada cuenta) y crear su tarjeta de crédito si tiene una (cupo y día de pago).
4. Gusto personal (lo elegí simple, se cambia fácil): las categorías son las de su archivo + «Intereses y cuotas»; los movimientos viejos con categorías de la v1 («Comida fuera», «Mercado»…) se siguen mostrando con su nombre.

## Límites conocidos
- Los movimientos de la v1 guardaron solo el nombre de la cuenta (`nequi`, `efectivo`): se reconocen por nombre; los de «Débito»/«Crédito» quedan «sin cuenta» (no afectan saldos).
- Una cuenta archivada no cuenta en el total (por eso solo se archiva con saldo en cero).
- Editar el dinero de un préstamo recibido/dado no cambia el monto de la deuda (son dos cosas separadas).
- El atajo se arma a mano (iOS no instala `.shortcut` sin firmar). Los nombres de acciones son los de iOS 17/18 en español; si alguna cambia de nombre, la lógica es la misma.
- Solicitudes para Central en `.claude/objetivos/SOLICITUDES.md` › A · Finanzas (desborde de «Secciones» en Hoy a 375 px, simulador que corre `agregar()` varias veces, imports sin uso en `registros.js`).
