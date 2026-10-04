// Datos de prueba de Finanzas para el simulador (pruebas/navegador/simulador.js). Nada de esto existe en Supabase.
// Fechas relativas a hoy, para que la página siempre se vea con datos del mes en curso.

import { diaLogico } from "/js/logica/dia.js";
import { sumarDias } from "/js/logica/calculo.js";
import { menuAtajo, mensajeGuardado, prepararMovimiento, resumenMes, saldosPorCuenta, total } from "/js/finanzas/logica.js";
import { momento } from "./datos.js";

const id = (n) => `f1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CUENTA = { efectivo: id(1), nu: id(2), nequi: id(3), tarjeta: id(4) };
const DEUDA = { tia: id(11), icetex: id(12), juan: id(13), laura: id(14) };

/** Agrega filas a datos.tablas. */
export function agregar(datos, _usuario) {
  // El simulador puede llamar esto más de una vez si llegan consultas en paralelo: solo se agrega una vez.
  if (datos.tablas.finanzas_cuentas?.some((c) => c.id === CUENTA.efectivo)) return;
  const hoy = diaLogico(new Date());
  const dia = (n) => sumarDias(hoy, -n);
  const creado = momento(dia(60), "09:00");

  datos.tablas.finanzas_cuentas = [
    { id: CUENTA.efectivo, nombre: "Efectivo", tipo: "efectivo", banco: null, saldo_inicial: 80000, orden: 0, activa: true, creado_en: creado },
    { id: CUENTA.nu, nombre: "Nu", tipo: "banco", banco: "Nu", saldo_inicial: 1_200_000, orden: 1, activa: true, creado_en: creado },
    { id: CUENTA.nequi, nombre: "Nequi", tipo: "billetera", banco: "Nequi", saldo_inicial: 150000, orden: 2, activa: true, creado_en: creado },
    {
      id: CUENTA.tarjeta,
      nombre: "Tarjeta Nu",
      tipo: "tarjeta_credito",
      banco: "Nu",
      saldo_inicial: 0,
      cupo: 2_000_000,
      dia_pago: 5,
      orden: 3,
      activa: true,
      creado_en: creado,
    },
  ];

  datos.tablas.finanzas_deudas = [
    { id: DEUDA.tia, direccion: "debo", tipo: "persona", nombre: "Tía Marta", monto_inicial: 200000, cuota: 50000, dia_pago: 15, estado: "activa", creado_en: creado },
    {
      id: DEUDA.icetex,
      direccion: "debo",
      tipo: "prestamo",
      nombre: "Crédito educativo",
      banco: "Bancolombia",
      monto_inicial: 1_500_000,
      cuota: 120000,
      dia_pago: 28,
      tasa_mensual: 1.9,
      estado: "activa",
      creado_en: creado,
    },
    { id: DEUDA.juan, direccion: "me_deben", tipo: "persona", nombre: "Juan", monto_inicial: 30000, estado: "activa", creado_en: creado },
    { id: DEUDA.laura, direccion: "me_deben", tipo: "persona", nombre: "Laura", monto_inicial: 20000, estado: "pagada", creado_en: creado },
  ];

  const m = (n, hora, fila) => ({ id: id(100 + datos.tablas.finanzas_movimientos.length), origen: "web", categoria_libre: false, cuenta_destino_id: null, deuda_id: null, ...fila, fecha: dia(n), momento: momento(dia(n), hora) });
  datos.tablas.finanzas_movimientos ??= [];
  const nuevos = [
    [0, "13:05", { tipo: "egreso", monto: 18000, categoria: "comida", cuenta: "Nequi", cuenta_id: CUENTA.nequi, descripcion: "Almuerzo" }],
    [1, "07:20", { tipo: "egreso", monto: 3200, categoria: "transporte", cuenta: "Efectivo", cuenta_id: CUENTA.efectivo, descripcion: "Bus" }],
    [1, "10:00", { tipo: "transferencia", monto: 100000, categoria: "transferencia", cuenta: "Nu", cuenta_id: CUENTA.nu, cuenta_destino_id: CUENTA.nequi }],
    [2, "09:00", { tipo: "ingreso", monto: 450000, categoria: "trabajo", cuenta: "Nu", cuenta_id: CUENTA.nu, descripcion: "Monitoría" }],
    [2, "18:30", { tipo: "retiro", monto: 50000, categoria: "retiro", cuenta: "Nu", cuenta_id: CUENTA.nu, cuenta_destino_id: CUENTA.efectivo }],
    [3, "16:10", { tipo: "egreso", monto: 80000, categoria: "compras", cuenta: "Tarjeta Nu", cuenta_id: CUENTA.tarjeta, descripcion: "Audífonos" }],
    [3, "20:00", { tipo: "egreso", monto: 45000, categoria: "servicios", cuenta: "Nu", cuenta_id: CUENTA.nu, descripcion: "Plan celular" }],
    [5, "21:15", { tipo: "egreso", monto: 32000, categoria: "ocio", cuenta: "Nequi", cuenta_id: CUENTA.nequi, descripcion: "Cine" }],
    [5, "19:00", { tipo: "egreso", monto: 35000, categoria: "Cita", categoria_libre: true, cuenta: "Nequi", cuenta_id: CUENTA.nequi }],
    [8, "11:00", { tipo: "egreso", monto: 60000, categoria: "hogar", cuenta: "Efectivo", cuenta_id: CUENTA.efectivo, descripcion: "Aseo" }],
    [8, "12:00", { tipo: "egreso", monto: 12500, categoria: "intereses", cuenta: "Tarjeta Nu", cuenta_id: CUENTA.tarjeta, descripcion: "Cuota de manejo" }],
    [10, "08:00", { tipo: "transferencia", monto: 50000, categoria: "abono_deuda", cuenta: "Nu", cuenta_id: CUENTA.nu, deuda_id: DEUDA.tia }],
    [12, "17:40", { tipo: "transferencia", monto: 30000, categoria: "prestamo_dado", cuenta: "Efectivo", cuenta_id: CUENTA.efectivo, deuda_id: DEUDA.juan, descripcion: "Préstamo a Juan" }],
    [14, "15:00", { tipo: "transferencia", monto: 20000, categoria: "cobro_deuda", cuenta: "Nequi", cuenta_destino_id: CUENTA.nequi, deuda_id: DEUDA.laura }],
    [20, "09:00", { tipo: "ingreso", monto: 700000, categoria: "salario", cuenta: "Nu", cuenta_id: CUENTA.nu, descripcion: "Pago del mes" }],
    [22, "13:00", { tipo: "egreso", monto: 22000, categoria: "comida", cuenta: "Nequi", cuenta_id: CUENTA.nequi, descripcion: "Corrientazo" }],
    [26, "19:30", { tipo: "egreso", monto: 140000, categoria: "estudio", cuenta: "Nu", cuenta_id: CUENTA.nu, descripcion: "Libros" }],
    [33, "10:00", { tipo: "egreso", monto: 38000, categoria: "salud", cuenta: "Efectivo", cuenta_id: CUENTA.efectivo, descripcion: "Droguería" }],
  ];
  for (const [n, hora, fila] of nuevos) datos.tablas.finanzas_movimientos.push(m(n, hora, fila));
  // Los de datos.js (v1: solo el nombre de la cuenta) también necesitan id para poder editarlos.
  for (const fila of datos.tablas.finanzas_movimientos) fila.id ??= crypto.randomUUID();
}

/** Respuestas simuladas de /api/v1/finanzas/* (con las mismas reglas de logica.js). */
export function api(api, _usuario) {
  const tablas = (datos) => ({
    cuentas: datos.tablas.finanzas_cuentas ?? [],
    deudas: datos.tablas.finanzas_deudas ?? [],
    movimientos: datos.tablas.finanzas_movimientos ?? [],
  });

  api["GET finanzas/menu"] = async ({ datos }) => ({ ok: true, mensaje: "💸 Menú listo", datos: menuAtajo({ ...tablas(datos), hoy: diaLogico(new Date()) }) });

  api["POST finanzas/movimientos"] = async ({ cuerpo, datos }) => {
    try {
      const fila = prepararMovimiento(cuerpo, tablas(datos));
      (datos.tablas.finanzas_movimientos ??= []).push({ ...fila, id: crypto.randomUUID(), origen: "atajo", momento: new Date().toISOString(), fecha: diaLogico(new Date()) });
      return { estado: 201, ok: true, mensaje: mensajeGuardado(fila), datos: { tipo: fila.tipo, categoria: fila.categoria } };
    } catch (error) {
      return { estado: 400, ok: false, mensaje: `⚠️ ${error.message}`, codigo: "DATO_INVALIDO" };
    }
  };

  api["GET finanzas/resumen"] = async ({ datos }) => {
    const { cuentas, movimientos } = tablas(datos);
    const resumen = resumenMes(movimientos, diaLogico(new Date()).slice(0, 7), cuentas);
    return { ok: true, mensaje: "💸 Tu mes", datos: { ...resumen, total: total(saldosPorCuenta(cuentas, movimientos)) } };
  };
}
