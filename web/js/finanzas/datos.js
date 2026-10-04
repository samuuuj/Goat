// Finanzas: leer y escribir en Supabase desde el navegador. RLS hace que solo veas y cambies tus filas;
// user_id lo pone la base de datos (auth.uid()).

import { sesionActual, supabase } from "../supabase/sesion.js";
import { SesionVencida, guardar, leer, revisar } from "../supabase/datos.js";
import { CUENTAS } from "../logica/catalogos.js";
import { diaLogico } from "../logica/dia.js";
import { sumarDias } from "../logica/calculo.js";
import { cuentasIniciales } from "./logica.js";

export const COLUMNAS_MOVIMIENTO =
  "id,tipo,monto,categoria,categoria_libre,cuenta,cuenta_id,cuenta_destino_id,deuda_id,descripcion,momento,fecha,origen";

/** Supabase entrega como máximo 1000 filas por consulta: se piden por páginas. */
const PAGINA = 1000;

async function leerTodo(crearConsulta) {
  const filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const parte = (await leer(crearConsulta().range(desde, desde + PAGINA - 1))) ?? [];
    filas.push(...parte);
    if (parte.length < PAGINA) return filas;
  }
}

const leerCuentas = (userId) => leer(supabase.from("finanzas_cuentas").select("*").eq("user_id", userId).order("orden"));

/** Tus cuentas. La primera vez crea Efectivo, Nu y Nequi. */
export async function asegurarCuentas(userId) {
  const cuentas = (await leerCuentas(userId)) ?? [];
  if (cuentas.length > 0) return cuentas;
  const { error, status } = await supabase.from("finanzas_cuentas").insert(cuentasIniciales());
  // 23505: otra pestaña (o el atajo) las creó al mismo tiempo. Sirve igual.
  if (error && error.code !== "23505") revisar({ error, status });
  return (await leerCuentas(userId)) ?? [];
}

/** Todo lo de la página: cuentas, deudas y todos los movimientos (los saldos necesitan la historia completa). */
export async function cargarFinanzas(userId) {
  const [cuentas, deudas, movimientos] = await Promise.all([
    asegurarCuentas(userId),
    leer(supabase.from("finanzas_deudas").select("*").eq("user_id", userId).order("creado_en")),
    leerTodo(() =>
      supabase
        .from("finanzas_movimientos")
        .select(COLUMNAS_MOVIMIENTO)
        .eq("user_id", userId)
        .order("momento", { ascending: false })
        .order("id"),
    ),
  ]);
  return { cuentas, deudas: deudas ?? [], movimientos };
}

/** Cuentas sin finanzas_cuentas (la base de datos aún sin la v2): solo nombres, para no dejar de registrar gastos. */
export const contextoLegado = () => ({
  legado: true,
  movimientos: [],
  cuentas: CUENTAS.map((c, i) => ({ id: null, nombre: c.texto, tipo: c.tipo, banco: c.banco, orden: i, activa: true })),
});

/** Para la hoja "Gasto" de Hoy: tus cuentas y las categorías que más usas (últimos 60 días). */
export async function cargarContextoMovimiento() {
  const userId = (await sesionActual())?.user?.id;
  try {
    const desde = sumarDias(diaLogico(new Date()), -59);
    const [cuentas, movimientos] = await Promise.all([
      asegurarCuentas(userId),
      leer(
        supabase.from("finanzas_movimientos").select("tipo,categoria,categoria_libre,momento,fecha").eq("user_id", userId).gte("fecha", desde),
      ),
    ]);
    return { legado: false, cuentas, movimientos: movimientos ?? [] };
  } catch (error) {
    if (error instanceof SesionVencida) throw error;
    // Sin las tablas nuevas (falta correr schema.sql): Hoy sigue guardando gastos e ingresos como antes.
    return contextoLegado();
  }
}

/** Ya tienes una cuenta con ese nombre (unique user_id + nombre). */
export class NombreRepetido extends Error {}

function revisarEscritura(respuesta) {
  if (respuesta.error?.code === "23505") throw new NombreRepetido(respuesta.error.message);
  revisar(respuesta);
}

/** Inserta un movimiento o una deuda (origen "web"). Un id_cliente repetido cuenta como guardado. */
export async function insertar(tabla, fila) {
  if (!(await guardar(tabla, fila))) throw new Error(`No se guardó en ${tabla}`);
}

/** Las cuentas no llevan origen ni id_cliente: el nombre ya es único. */
export async function insertarCuenta(fila) {
  revisarEscritura(await supabase.from("finanzas_cuentas").insert(fila));
}

export async function actualizar(tabla, id, cambios) {
  revisarEscritura(await supabase.from(tabla).update(cambios).eq("id", id));
}

export async function borrar(tabla, id) {
  revisar(await supabase.from(tabla).delete().eq("id", id));
}
