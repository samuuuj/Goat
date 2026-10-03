# A · Finanzas y deudas (rama `goat/finanzas`)

## Para qué
Registrar **cualquier movimiento de dinero desde el iPhone** en segundos y verlo en la web **indexado, agrupado y ordenado**, sin perder ni olvidar nada. Más **deudas** (lo que debo y lo que me deben). Es la lógica que Samuel definió para su atajo (resumen fiel abajo).

## Lógica funcional de Samuel (su archivo, resumido)
- Cada registro guarda: **fecha y hora automáticas**, tipo, categoría, método/cuenta, valor, descripción. Ej.: "2 oct 2026 — 7:42 p. m. · Gasto — Comida — Nequi — $35.000 · Cena".
- Primera pregunta: **¿Qué tipo de movimiento?** Gasto · Ingreso · Transferencia · Retiro. Cada tipo pregunta solo lo necesario:
  - **Gasto** (consumí/pagué): Valor → Categoría → Método de pago → Descripción. Categorías: Comida, Transporte, Compras, Hogar, Ocio, Salud, Estudio, Servicios, Otros; y **"Otro" → escribir la categoría a mano** (ej. Gasto · $35.000 · Otro → "Cita" · Nequi).
  - **Ingreso** (recibí): Valor → Categoría → Dónde ingresó → Descripción. Categorías: Salario, Trabajo, Venta, Devolución, Regalo, Otro (escribir).
  - **Transferencia** (moví mi dinero entre cuentas, **no es gasto**): Valor → Origen → Destino → Descripción. Nu → Nequi: Nu −, Nequi +.
  - **Retiro** (saqué efectivo, **no es gasto**): Valor → Origen → (destino Efectivo) → Descripción. Nu → Efectivo: Nu −, Efectivo +.
- Cuentas: **Efectivo, Nu, Nequi**. Saber cuánto hay en total y **dónde está**.
- Análisis deseado: gastos por categoría, por día, por mes; ingresos; transferencias; retiros; dinero movido por Nu, por Nequi, en efectivo; descripciones.

## Decisiones (D-053)
- En la BD `tipo` sigue `egreso` para "Gasto" (la UI dice "Gasto"); se agrega `retiro`. **Solo `egreso` cuenta para el presupuesto** (`calculo.js` no cambia).
- **Deudas** (Samuel: "a una persona o una tarjeta de crédito y qué banco"; eligió llevar **lo que debo y lo que me deben**):
  - Compra con tarjeta de crédito = gasto con cuenta tipo `tarjeta_credito` → sube la deuda de esa tarjeta (la deuda de una tarjeta = saldo negativo de su cuenta).
  - Pagar la tarjeta = **transferencia** de Nu/Nequi a la tarjeta (no es gasto).
  - Abonar a una deuda que **debo** (persona/préstamo) = salida de una cuenta ligada a la deuda (`deuda_id`), **no es gasto**; baja el saldo de la deuda.
  - Cobrar lo que **me deben** = entrada a una cuenta con `deuda_id`, **no es ingreso**; baja lo que me deben.
  - Préstamo recibido = entrada (no ingreso) + deuda nueva `debo`; prestar dinero = salida (no gasto) + deuda nueva `me_deben`.
  - Intereses o cuotas de manejo = gasto categoría `intereses` (agregar al catálogo de gasto como "Intereses y cuotas").

## Tus archivos
- `web/finanzas.html`, `web/css/finanzas.css`, `web/js/finanzas/*` (`pagina.js`, `logica.js`, `datos.js`, `atajos.js`, `mini.js`).
- `api/_rutas/finanzas.js`.
- Sección **2. FINANZAS** de `supabase/schema.sql` (solo agregar al final de la sección).
- Parte de finanzas de `web/js/logica/catalogos.js` (`TIPOS_MOVIMIENTO`, `CATEGORIAS`, `CUENTAS`, `VALIDOS` de finanzas).
- **Excepción permitida:** la hoja "Gasto" de Hoy: `<form id="form-gasto">` en `web/index.html` y `formularioGasto()` en `web/js/piezas/registros.js` (pasar a los 4 tipos con el mismo flujo; las cuentas salen de `finanzas_cuentas`).
- Pruebas: `pruebas/finanzas-*.test.mjs`.

## Base de datos (sección 2, repetible)
- `finanzas_movimientos`: `alter table … drop constraint if exists finanzas_movimientos_tipo_check; add constraint … check (tipo in ('egreso','ingreso','transferencia','retiro'))`. Columnas nuevas (`add column if not exists`): `cuenta_id uuid references finanzas_cuentas(id) on delete set null`, `cuenta_destino_id uuid references finanzas_cuentas(id) on delete set null`, `categoria_libre boolean not null default false` (true si vino de "Otro"), `deuda_id uuid references finanzas_deudas(id) on delete set null`. Mantener `cuenta` (texto) por compatibilidad: guarda el nombre de la cuenta.
- `finanzas_cuentas`: `nombre` (≤ 40), `tipo` (`efectivo`|`banco`|`billetera`|`tarjeta_credito`), `banco` (≤ 40, ej. Nu, Bancolombia), `saldo_inicial bigint default 0`, `cupo bigint` (tarjetas), `dia_corte`, `dia_pago` (1–31), `orden int`, `activa bool`, `creado_en`; unique (`user_id`, `nombre`). Las 3 por defecto (Efectivo/efectivo, Nu/banco Nu, Nequi/billetera Nequi) las crea la página (o la API) la primera vez si el usuario no tiene ninguna.
- `finanzas_deudas`: `direccion` (`debo`|`me_deben`), `tipo` (`persona`|`tarjeta_credito`|`prestamo`|`otro`), `nombre` (≤ 60: persona o entidad), `banco` (≤ 40, opcional), `cuenta_id` (tarjeta asociada, opcional), `monto_inicial bigint > 0`, `cuota bigint`, `dia_pago`, `tasa_mensual numeric(5,2)`, `fecha_inicio date`, `estado` (`activa`|`pagada`), `notas` (≤ 200), `momento`, `creado_en`, `id_cliente`.
- RLS completo en ambas tablas nuevas (plantilla de `00-comun.md`).

## Lógica (`web/js/finanzas/logica.js`, pura)
- `saldosPorCuenta(cuentas, movimientos)`; `total`; `resumenMes(movimientos, mes)` (gastos, ingresos, neto, por categoría ordenado, por día, por cuenta); `agrupar(movimientos, por: "dia"|"categoria"|"cuenta")`; `filtrar({tipo, texto})`; `ordenar("recientes"|"monto")`; `saldoDeuda(deuda, movimientos)` (+ % pagado, próximo pago); `efectoDe(movimiento)` (qué cuenta sube/baja, si es gasto/ingreso/ninguno).
- Etiquetas y emojis por categoría (🍔 Comida, 🚌 Transporte, 🛍️ Compras, 🏠 Hogar, 🎮 Ocio, 💊 Salud, 📚 Estudio, 💡 Servicios, 📦 Otros, 💳 Intereses; ingresos 💼 Salario, 🛠️ Trabajo, 🏷️ Venta, ↩️ Devolución, 🎁 Regalo).

## Web (`finanzas.html`, titular `DINERO.`)
1. **Saldos:** total grande (`.sensible`, cuenta con `contar()`), debajo tarjetas por cuenta (Efectivo/Nu/Nequi/tarjetas) con su saldo `.sensible`; las tarjetas muestran deuda y cupo usado (barra `.progreso`).
2. **Este mes:** gastos vs ingresos, neto, y **gasto por categoría** en barras horizontales ordenadas de mayor a menor (barras que se llenan al verse). Frase corta sin montos en texto plano fuera de `.sensible`.
3. **Movimientos:** control segmentado **Día · Categoría · Cuenta** (cómo agrupar), chips de tipo (Todos, Gastos, Ingresos, Transferencias, Retiros), orden (Recientes / Monto), buscador por descripción. Lista estilo iOS con encabezados pegajosos ("Hoy", "Ayer", "mar 30 sep" o la categoría/cuenta con su subtotal `.sensible`); cada fila: emoji, descripción (o categoría), cuenta → destino, hora, monto `.sensible` (gasto con "−", ingreso con "+", transferencia/retiro en gris). Tocar abre la hoja para **editar o borrar**.
4. **Deudas:** pestañas **Debo / Me deben**; tarjeta por deuda: nombre, tipo, banco, saldo `.sensible`, cuota, próximo pago (fecha), barra de avance; botón **Abonar** (o **Cobrar**) y **Nueva deuda**.
5. Botón principal flotante **"＋ Movimiento"** → hoja con el flujo exacto de Samuel: chips de Tipo → Valor (campo grande + montos rápidos) → Categoría (chips + "Otro" que muestra un campo de texto) o Origen/Destino → Cuenta → Descripción → Guardar. < 15 s.
- Estados vacíos amables; sin datos de ejemplo en producción.

## API (`api/_rutas/finanzas.js`)
- `GET finanzas/menu` → `{ tipos:[{valor,texto,emoji}], categorias:{egreso:[…], ingreso:[…]}, cuentas:[{id,nombre}], deudas:[{id,nombre,direccion}] }` (categorías ordenadas por uso de los últimos 60 días). Si el usuario no tiene cuentas, crea las 3 por defecto.
- `POST finanzas/movimientos` `{ tipo: "gasto"|"egreso"|"ingreso"|"transferencia"|"retiro", monto, categoria?, categoria_otra?, cuenta, cuenta_destino?, descripcion?, deuda_id?, momento?, id_cliente, origen }` → valida según el tipo (retiro: destino Efectivo), guarda, responde `💸 Guardado · Comida` / `💰 Ingreso guardado` / `🔁 Transferencia guardada` / `🏧 Retiro guardado` (**sin montos**).
- `GET finanzas/resumen` → datos del mes para el atajo/widget (montos solo en `datos`, nunca en `mensaje`).
- `POST finanzas/deudas`, `POST finanzas/abonos` (opcional para el atajo).

## Atajo (`web/js/finanzas/atajos.js`)
"💸 Movimiento": Ejecutar "⚙️ Goat" → GET `finanzas/menu` → **Elegir del menú** Tipo → Pedir número (Valor) → según tipo: Elegir de la lista categoría (+ "Otro…" → Pedir texto) / Origen / Destino → Elegir cuenta → Pedir texto (Descripción, opcional) → POST `finanzas/movimientos` → Mostrar notificación con `mensaje`. (Atajos no tiene una acción de UUID: la API acepta `id_cliente` opcional y, si falta, lo genera; para evitar duplicados por reintento, la API ignora un movimiento idéntico —mismo tipo, monto, cuentas y categoría— recibido del mismo token en los últimos 60 s.) Sugerir: añadir a la pantalla de inicio / Toque posterior / widget de Atajos. Incluye una opción "📒 Deuda (abonar/cobrar)".

## Pruebas
- Ejemplos de Samuel: Gasto Comida Nequi $25.000 "Cena" (Nequi −25.000, cuenta como gasto); Ingreso Trabajo Nu $500.000 (Nu +); Transferencia Nu→Nequi $100.000 (total igual, no gasto); Retiro Nu→Efectivo $50.000 (no gasto); "Otro" → "Cita" con `categoria_libre`.
- Tarjeta: compra $80.000 con tarjeta Nu → gasto + deuda tarjeta 80.000; pago de tarjeta $80.000 desde Nu → transferencia, deuda 0, no gasto.
- Deudas: debo a persona $200.000, abono $50.000 → saldo 150.000, 25% pagado; me deben $30.000, cobro → 0, estado pagada.
- SQL: 2 corridas, RLS de las 3 tablas, `retiro` permitido, `anon` bloqueado. API: mensaje sin montos, idempotencia con `id_cliente`, validación por tipo.
- Hoy sigue funcionando: la hoja Gasto guarda los 4 tipos y "Disponible hoy" solo baja con gastos.
