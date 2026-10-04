// Rutas de /api/v1 de Finanzas (D-053). Las reglas están en web/js/finanzas/logica.js: las mismas que usa la web.
// El atajo "💸 Movimiento" pide el menú, pregunta y manda lo elegido; aquí se valida, se guarda y se responde
// con un mensaje corto SIN montos (D-020). Los montos solo van en `datos`.

import { randomUUID } from "node:crypto";
import { ok, ErrorApi } from "../_lib/respuesta.js";
import { fechaIso, idCliente, origen } from "../_lib/validar.js";
import { diaLogico } from "../../web/js/logica/dia.js";
import { sumarDias } from "../../web/js/logica/calculo.js";
import {
  DatoInvalido,
  buscarCuenta,
  buscarDeuda,
  cuentasIniciales,
  deudasVista,
  esTarjeta,
  leerTipo,
  mensajeGuardado,
  menuAtajo,
  mesDe,
  movimientoDePrestamo,
  prepararDeuda,
  prepararMovimiento,
  resumenMes,
  saldoDeuda,
  saldosPorCuenta,
  total,
  totalesDeudas,
} from "../../web/js/finanzas/logica.js";

const COLUMNAS_MOVIMIENTO = "id,tipo,monto,categoria,categoria_libre,cuenta,cuenta_id,cuenta_destino_id,deuda_id,descripcion,momento,fecha";
/** Supabase devuelve como máximo 1000 filas por consulta: se pide por páginas. */
const PAGINA = 1000;
/** Mismos campos = mismo movimiento si llega repetido en menos de 60 s sin id_cliente (reintento del atajo). */
const CAMPOS_REPETIDO = ["tipo", "monto", "categoria", "cuenta_id", "cuenta_destino_id", "deuda_id"];

/** Un DatoInvalido de logica.js se responde como 400 con mensaje humano ("⚠️ Revisa: cuenta"). */
async function validando(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof DatoInvalido) throw new ErrorApi("DATO_INVALIDO", `⚠️ ${e.message}`, 400);
    throw e;
  }
}

/** Cuentas del usuario. La primera vez crea Efectivo, Nu y Nequi. */
async function cuentasDe(db) {
  const cuentas = await db.select("finanzas_cuentas", { orden: "orden.asc" });
  if (cuentas.length > 0) return cuentas;
  // Una por una: si otra petición ya creó alguna, esa choca (nombre único) y las demás sí entran.
  for (const cuenta of cuentasIniciales()) await db.insert("finanzas_cuentas", cuenta, { devolver: false });
  return db.select("finanzas_cuentas", { orden: "orden.asc" });
}

const deudasDe = (db) => db.select("finanzas_deudas", { orden: "creado_en.asc" });

/** Todos los movimientos (para los saldos), por páginas de 1000 de lo más nuevo a lo más viejo. */
async function todosLosMovimientos(db) {
  const filas = [];
  const vistos = new Set();
  let hasta = null;
  for (let vuelta = 0; vuelta < 100; vuelta++) {
    const pagina = await db.select("finanzas_movimientos", {
      columnas: COLUMNAS_MOVIMIENTO,
      filtros: hasta ? { momento: `lte.${hasta}` } : {},
      orden: "momento.desc",
      limite: PAGINA,
    });
    let nuevas = 0;
    for (const fila of pagina) {
      if (vistos.has(fila.id)) continue;
      vistos.add(fila.id);
      filas.push(fila);
      nuevas++;
    }
    if (pagina.length < PAGINA || nuevas === 0) break;
    hasta = pagina.at(-1).momento;
  }
  return filas;
}

/** Guarda un movimiento ya validado y responde. Si un abono deja la deuda en cero, la marca pagada. */
async function guardarMovimiento(db, fila, cuerpo, ahora, { deuda = null, movimientosDeuda = [] } = {}) {
  const registro = {
    ...fila,
    momento: fechaIso(cuerpo.momento, "momento", ahora).toISOString(),
    origen: origen(cuerpo.origen),
  };
  registro.id_cliente = await idCliente(db, "finanzas_movimientos", registro, CAMPOS_REPETIDO, cuerpo.id_cliente, ahora);
  const [guardada] = registro.id_cliente ? await db.insert("finanzas_movimientos", registro) : [];

  let saldada = false;
  if (guardada && deuda && (fila.categoria === "abono_deuda" || fila.categoria === "cobro_deuda")) {
    if (saldoDeuda(deuda, [...movimientosDeuda, guardada]).saldo === 0) {
      await db.update("finanzas_deudas", { estado: "pagada" }, { id: `eq.${deuda.id}` });
      saldada = true;
    }
  }
  return ok(
    mensajeGuardado(fila, { saldada }),
    { id: guardada?.id ?? null, tipo: fila.tipo, categoria: fila.categoria, repetido: !guardada, deuda_saldada: saldada },
    201,
  );
}

/** Gasto, ingreso, transferencia, retiro o abono/cobro de una deuda (tipo "deuda"). */
async function registrarMovimiento({ db, cuerpo, ahora }) {
  return validando(async () => {
    const [cuentas, deudas] = await Promise.all([cuentasDe(db), deudasDe(db)]);
    let deuda = null;
    let movimientosDeuda = null;
    if (leerTipo(cuerpo.tipo) === "deuda") {
      deuda = buscarDeuda(cuerpo.deuda ?? cuerpo.deuda_id, deudas);
      if (deuda) {
        movimientosDeuda = await db.select("finanzas_movimientos", { columnas: COLUMNAS_MOVIMIENTO, filtros: { deuda_id: `eq.${deuda.id}` } });
      }
    }
    const fila = prepararMovimiento(cuerpo, { cuentas, deudas, movimientos: movimientosDeuda });
    return guardarMovimiento(db, fila, cuerpo, ahora, { deuda, movimientosDeuda: movimientosDeuda ?? [] });
  });
}

export default {
  /** Lo que el atajo necesita para preguntar: tipos, categorías (por uso), cuentas y deudas activas. */
  "GET finanzas/menu": async ({ db, ahora }) => {
    const hoy = diaLogico(ahora);
    const [cuentas, deudas, recientes] = await Promise.all([
      cuentasDe(db),
      deudasDe(db),
      db.select("finanzas_movimientos", {
        columnas: "tipo,categoria,categoria_libre,momento,fecha",
        filtros: { fecha: `gte.${sumarDias(hoy, -59)}` },
      }),
    ]);
    return ok("💸 Menú listo", menuAtajo({ cuentas, deudas, movimientos: recientes, hoy }));
  },

  /**
   * { tipo: "gasto"|"ingreso"|"transferencia"|"retiro"|"deuda", monto, categoria, categoria_otra, cuenta,
   *   cuenta_destino, deuda, descripcion, momento, id_cliente, origen } → "💸 Guardado · Comida".
   * Cuentas, categorías y deudas por id o por el mismo texto que dio el menú.
   */
  "POST finanzas/movimientos": registrarMovimiento,

  /** Abonar a una deuda o cobrar lo que te deben: { deuda, monto, cuenta, … }. */
  "POST finanzas/abonos": (ctx) => registrarMovimiento({ ...ctx, cuerpo: { ...ctx.cuerpo, tipo: "deuda" } }),

  /**
   * Deuda nueva: { direccion: "debo"|"me_deben", tipo, nombre, banco, monto, cuota, dia_pago, tasa_mensual, notas, cuenta }.
   * Con `cuenta` (y si no es tarjeta), el dinero del préstamo entra a esa cuenta (debo) o sale de ella (me deben).
   */
  "POST finanzas/deudas": async ({ db, cuerpo, ahora }) =>
    validando(async () => {
      const cuentas = await cuentasDe(db);
      const fila = prepararDeuda(cuerpo, { cuentas });
      const activas = cuentas.filter((c) => c.activa !== false);
      const cuenta = fila.tipo !== "tarjeta_credito" && cuerpo.cuenta ? buscarCuenta(cuerpo.cuenta, activas) : null;
      if (cuerpo.cuenta && fila.tipo !== "tarjeta_credito" && (!cuenta || esTarjeta(cuenta))) throw new DatoInvalido("cuenta");

      const momento = fechaIso(cuerpo.momento, "momento", ahora).toISOString();
      const registro = { ...fila, id: randomUUID(), momento, origen: origen(cuerpo.origen) };
      registro.id_cliente = await idCliente(db, "finanzas_deudas", registro, ["direccion", "nombre", "monto_inicial"], cuerpo.id_cliente, ahora);
      if (!registro.id_cliente) return ok("📒 Deuda guardada", { repetido: true }, 201);

      const [deuda] = await db.insert("finanzas_deudas", registro);
      if (!deuda) return ok("📒 Deuda guardada", { repetido: true }, 201);
      if (cuenta) {
        await db.insert(
          "finanzas_movimientos",
          { ...movimientoDePrestamo(deuda, cuenta), momento, origen: registro.origen, id_cliente: randomUUID() },
          { devolver: false },
        );
      }
      return ok("📒 Deuda guardada", { id: deuda.id, direccion: deuda.direccion, repetido: false }, 201);
    }),

  /** Datos del mes (?mes=2026-10) y saldos para el atajo o el widget. Montos solo en `datos`, nunca en `mensaje`. */
  "GET finanzas/resumen": async ({ db, ahora, query }) => {
    const hoy = diaLogico(ahora);
    const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(query.mes ?? "") ? query.mes : mesDe(hoy);
    const [cuentas, deudas, movimientos] = await Promise.all([cuentasDe(db), deudasDe(db), todosLosMovimientos(db)]);
    const saldos = saldosPorCuenta(cuentas, movimientos);
    const resumen = resumenMes(movimientos, mes, cuentas);
    const vista = deudasVista(deudas, saldos, movimientos, hoy);
    const proximo = vista.find((d) => d.estado === "activa" && d.proximoPago && d.saldo > 0);
    const mayor = resumen.mayor && !/\d/.test(resumen.mayor.texto) ? resumen.mayor.texto : null;

    return ok(mayor ? `💸 Lo que más pesa: ${mayor}` : "💸 Tu mes", {
      mes,
      gastos: resumen.gastos,
      ingresos: resumen.ingresos,
      neto: resumen.neto,
      transferencias: resumen.transferencias,
      retiros: resumen.retiros,
      cantidad: resumen.cantidad,
      categorias: resumen.porCategoria.slice(0, 5).map((c) => ({ texto: c.texto, emoji: c.emoji, total: c.total, pct: Math.round(c.pct * 100) })),
      total: total(saldos),
      cuentas: saldos
        .filter((c) => c.activa !== false)
        .map((c) => ({ nombre: c.nombre, tipo: c.tipo, saldo: c.saldo, deuda: c.deuda ?? null })),
      deudas: { ...totalesDeudas(vista), proximoPago: proximo ? { nombre: proximo.nombre, fecha: proximo.proximoPago } : null },
    });
  },
};
