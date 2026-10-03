// Finanzas: reglas puras (sin pantalla ni internet). Las usan finanzas.html, la hoja "Gasto" de Hoy y /api/v1/finanzas.
// Lógica de Samuel (D-053):
//   Gasto (egreso)  → sale de una cuenta y cuenta como gasto (lo único que mueve el presupuesto de Hoy).
//   Ingreso         → entra a una cuenta y cuenta como ingreso.
//   Transferencia   → sale de una cuenta y entra a otra: no es gasto (pagar la tarjeta también es esto).
//   Retiro          → sale de Nu/Nequi y entra a Efectivo: no es gasto.
//   Deudas          → abonar lo que debo es una salida que no es gasto; cobrar lo que me deben es una entrada que no es ingreso.
//   Tarjeta crédito → es una cuenta: comprar con ella es gasto y su saldo baja (la deuda = saldo negativo).

import {
  CATEGORIAS,
  CATEGORIA_OTRA,
  CUENTAS,
  DIRECCIONES_DEUDA,
  MONTO_MAXIMO,
  TIPOS_CUENTA,
  TIPOS_DEUDA,
  TIPOS_MOVIMIENTO,
} from "../logica/catalogos.js";
import { ZONA, diaLogico, diaYMes, nombreDia } from "../logica/dia.js";
import { sumarDias } from "../logica/calculo.js";

/** Tope para saldos, cupos y deudas (las deudas pueden ser más grandes que un movimiento). */
export const MONTO_GRANDE = 10_000_000_000;

// ── Textos ───────────────────────────────────────────────────────────────

/** "✏️ Otro…" → "otro" · "Tía Marta · le debo" → "tia marta le debo". Para comparar sin tildes, emojis ni mayúsculas. */
export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Texto limpio de 1 a `max` caracteres, o null si viene vacío. Lanza DatoInvalido si es muy largo. */
function textoOpcional(valor, max, campo) {
  const t = String(valor ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;
  if (t.length > max) throw new DatoInvalido(campo);
  return t;
}

function textoRequerido(valor, max, campo) {
  const t = textoOpcional(valor, max, campo);
  if (!t) throw new DatoInvalido(campo);
  return t;
}

const conEmoji = (opcion) => `${opcion.emoji} ${opcion.texto}`;

// ── Fechas ───────────────────────────────────────────────────────────────

/** Día lógico del movimiento. Se calcula desde `momento` (así coincide aunque `fecha` aún no se haya recalculado). */
export function fechaDe(mov) {
  if (mov.momento) {
    const t = Date.parse(mov.momento);
    if (!Number.isNaN(t)) return diaLogico(new Date(t));
  }
  return mov.fecha ?? "";
}

export const mesDe = (fecha) => String(fecha).slice(0, 7);

/** "2026-10" + 1 → "2026-11". */
export function sumarMeses(mes, n) {
  const [anio, numero] = mes.split("-").map(Number);
  return new Date(Date.UTC(anio, numero - 1 + n, 1)).toISOString().slice(0, 7);
}

const formatoMes = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, month: "long" });

/** "2026-10" → "octubre" (con el año si no es el de `hoy`: "diciembre 2025"). */
export function nombreMes(mes, hoy = null) {
  const nombre = formatoMes.format(new Date(`${mes}-15T12:00:00-05:00`));
  return hoy && mes.slice(0, 4) !== hoy.slice(0, 4) ? `${nombre} ${mes.slice(0, 4)}` : nombre;
}

/** Encabezado de un día en la lista: "Hoy", "Ayer" o "mar 30 sep". */
export function tituloDia(fecha, hoy) {
  if (fecha === hoy) return "Hoy";
  if (fecha === sumarDias(hoy, -1)) return "Ayer";
  const texto = `${nombreDia(fecha).slice(0, 3)} ${diaYMes(fecha).replace(/^0/, "")}`;
  return fecha.slice(0, 4) === hoy.slice(0, 4) ? texto : `${texto} ${fecha.slice(0, 4)}`;
}

/** Días de `desde` a `hasta` (YYYY-MM-DD). */
export function diasEntre(desde, hasta) {
  return Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000);
}

/** Próxima fecha con ese día del mes (31 en un mes de 30 días → el 30), desde hoy incluido. */
export function proximaFecha(dia, hoy) {
  const [anio, mes] = hoy.split("-").map(Number);
  const enMes = (a, m) => {
    const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
    return `${a}-${String(m).padStart(2, "0")}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
  };
  const este = enMes(anio, mes);
  if (este >= hoy) return este;
  return mes === 12 ? enMes(anio + 1, 1) : enMes(anio, mes + 1);
}

const formatoLocal = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Fecha → "2026-10-02T19:42" en hora de Bogotá (para <input type="datetime-local">). */
export function aEntradaLocal(fecha) {
  const p = Object.fromEntries(formatoLocal.formatToParts(fecha).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "2026-10-02T19:42" (hora de Bogotá) → Date. null si no tiene esa forma. */
export function deEntradaLocal(texto) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(texto ?? "")) return null;
  const fecha = new Date(`${texto}:00-05:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

// ── Categorías ───────────────────────────────────────────────────────────

/** Categorías de los movimientos que no son gasto ni ingreso. */
const ESPECIALES = {
  transferencia: { texto: "Transferencia", emoji: "🔁" },
  pago_tarjeta: { texto: "Pago de tarjeta", emoji: "💳" },
  retiro: { texto: "Retiro", emoji: "🏧" },
  abono_deuda: { texto: "Abono a deuda", emoji: "📒" },
  cobro_deuda: { texto: "Cobro de deuda", emoji: "📒" },
  prestamo_recibido: { texto: "Préstamo recibido", emoji: "🤝" },
  prestamo_dado: { texto: "Préstamo dado", emoji: "🤝" },
};

/** Categorías de la v1 (antes de D-053): se siguen mostrando bien. */
const LEGADO = {
  comida_fuera: { texto: "Comida fuera", emoji: "🍔" },
  mercado: { texto: "Mercado", emoji: "🛒" },
  universidad: { texto: "Universidad", emoji: "📚" },
  suscripciones: { texto: "Suscripciones", emoji: "💡" },
  ropa: { texto: "Ropa", emoji: "🛍️" },
  mesada: { texto: "Mesada", emoji: "💵" },
  beca: { texto: "Beca", emoji: "🎓" },
  otros: { texto: "Otros", emoji: "📦" },
};

const EMOJI_TIPO = Object.fromEntries(TIPOS_MOVIMIENTO.map((t) => [t.valor, t.emoji]));

/** Texto y emoji de la categoría de un movimiento (también las escritas a mano y las viejas). */
export function etiquetaCategoria(mov) {
  if (mov.categoria_libre) return { texto: mov.categoria, emoji: CATEGORIA_OTRA.emoji };
  const hallada =
    CATEGORIAS[mov.tipo]?.find((c) => c.valor === mov.categoria) ?? ESPECIALES[mov.categoria] ?? LEGADO[mov.categoria];
  if (hallada) return { texto: hallada.texto, emoji: hallada.emoji };
  const crudo = String(mov.categoria ?? "").replace(/_/g, " ").trim();
  return { texto: crudo ? crudo.charAt(0).toUpperCase() + crudo.slice(1) : "Sin categoría", emoji: EMOJI_TIPO[mov.tipo] ?? "•" };
}

/** Categorías en el orden en que más las usas (últimos 60 días); empates, en el orden del catálogo. */
export function ordenarPorUso(opciones, movimientos, tipo, desde = null) {
  const usos = new Map();
  for (const m of movimientos) {
    if (m.tipo !== tipo || m.categoria_libre || (desde && fechaDe(m) < desde)) continue;
    usos.set(m.categoria, (usos.get(m.categoria) ?? 0) + 1);
  }
  return opciones
    .map((opcion, i) => ({ opcion, i, n: usos.get(opcion.valor) ?? 0 }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.opcion);
}

// ── Cuentas ──────────────────────────────────────────────────────────────

const porOrden = (a, b) =>
  (a.orden ?? 0) - (b.orden ?? 0) || String(a.creado_en ?? "").localeCompare(String(b.creado_en ?? "")) || a.nombre.localeCompare(b.nombre);

export const ordenarCuentas = (cuentas) => [...cuentas].sort(porOrden);

/** Las 3 cuentas con las que arranca todo usuario (Efectivo, Nu, Nequi). */
export const cuentasIniciales = () => CUENTAS.map((c, i) => ({ nombre: c.texto, tipo: c.tipo, banco: c.banco, orden: i }));

export const esTarjeta = (cuenta) => cuenta?.tipo === "tarjeta_credito";

export function emojiCuenta(tipo) {
  return TIPOS_CUENTA.find((t) => t.valor === tipo)?.emoji ?? "🏦";
}

/** Cuenta por id o por nombre ("Nequi", "nequi"). null si no existe. */
export function buscarCuenta(valor, cuentas) {
  if (valor == null || valor === "") return null;
  const v = String(valor).trim();
  const n = normalizar(v);
  return cuentas.find((c) => c.id && c.id === v) ?? cuentas.find((c) => normalizar(c.nombre) === n) ?? null;
}

/**
 * Qué hace un movimiento con tus cuentas: { sale, entra, clase, monto }.
 * `sale`/`entra`: id de la cuenta que baja/sube (o null) · `clase`: "gasto" | "ingreso" | "ninguno".
 * `cuentas` sirve para los movimientos viejos que solo tienen el nombre de la cuenta ("nequi").
 */
export function efectoDe(mov, cuentas = null) {
  const monto = Number(mov.monto) || 0;
  let cuenta = mov.cuenta_id ?? null;
  if (!cuenta && cuentas && (mov.tipo === "egreso" || mov.tipo === "ingreso")) cuenta = buscarCuenta(mov.cuenta, cuentas)?.id ?? null;
  if (mov.tipo === "egreso") return { sale: cuenta, entra: null, clase: "gasto", monto };
  if (mov.tipo === "ingreso") return { sale: null, entra: cuenta, clase: "ingreso", monto };
  return { sale: mov.cuenta_id ?? null, entra: mov.cuenta_destino_id ?? null, clase: "ninguno", monto };
}

/**
 * Saldo de cada cuenta = saldo inicial + entradas − salidas.
 * Las tarjetas de crédito traen además `deuda` (lo que debes) y `cupoUsado` (0 a 1).
 */
export function saldosPorCuenta(cuentas, movimientos) {
  const porId = new Map(
    cuentas.map((c) => [c.id, { ...c, saldo_inicial: Number(c.saldo_inicial) || 0, saldo: Number(c.saldo_inicial) || 0, entradas: 0, salidas: 0 }]),
  );
  for (const mov of movimientos) {
    const efecto = efectoDe(mov, cuentas);
    const sale = porId.get(efecto.sale);
    if (sale) {
      sale.saldo -= efecto.monto;
      sale.salidas += efecto.monto;
    }
    const entra = porId.get(efecto.entra);
    if (entra) {
      entra.saldo += efecto.monto;
      entra.entradas += efecto.monto;
    }
  }
  return [...porId.values()].sort(porOrden).map((c) => {
    if (!esTarjeta(c)) return c;
    const deuda = Math.max(0, -c.saldo);
    return { ...c, deuda, cupoUsado: c.cupo ? Math.min(1, deuda / Number(c.cupo)) : null };
  });
}

/** Dinero disponible: suma de las cuentas activas que no son tarjeta de crédito. */
export function total(saldos) {
  return saldos.filter((c) => c.activa !== false && !esTarjeta(c)).reduce((suma, c) => suma + c.saldo, 0);
}

/** Saldo inicial que hace que la cuenta quede con `saldoDeseado` hoy (para "ajustar saldo"). */
export function ajustarSaldoInicial(cuentaConSaldo, saldoDeseado) {
  return saldoDeseado - (cuentaConSaldo.saldo - cuentaConSaldo.saldo_inicial);
}

// ── Resumen del mes ──────────────────────────────────────────────────────

const claveCategoria = (mov) => (mov.categoria_libre ? `libre:${normalizar(mov.categoria)}` : `${mov.tipo}:${mov.categoria}`);

/**
 * Resumen de un mes ("2026-10"): gastos, ingresos, neto, transferencias, retiros,
 * gasto por categoría (de mayor a menor), por día y por cuenta.
 */
export function resumenMes(movimientos, mes, cuentas = []) {
  let gastos = 0;
  let ingresos = 0;
  let transferencias = 0;
  let retiros = 0;
  let cantidad = 0;
  const categorias = new Map();
  const dias = new Map();
  const porCuenta = new Map();

  for (const mov of movimientos) {
    const fecha = fechaDe(mov);
    if (!fecha.startsWith(mes)) continue;
    cantidad++;
    const monto = Number(mov.monto) || 0;
    const dia = dias.get(fecha) ?? { fecha, gastos: 0, ingresos: 0 };
    dias.set(fecha, dia);
    if (mov.tipo === "egreso") {
      gastos += monto;
      dia.gastos += monto;
      const clave = claveCategoria(mov);
      const cat = categorias.get(clave) ?? { clave, ...etiquetaCategoria(mov), total: 0, cantidad: 0 };
      cat.total += monto;
      cat.cantidad++;
      categorias.set(clave, cat);
    } else if (mov.tipo === "ingreso") {
      ingresos += monto;
      dia.ingresos += monto;
    } else if (mov.tipo === "retiro") retiros += monto;
    else transferencias += monto;

    const efecto = efectoDe(mov, cuentas);
    for (const [id, lado] of [
      [efecto.sale, "salidas"],
      [efecto.entra, "entradas"],
    ]) {
      if (!id) continue;
      const fila = porCuenta.get(id) ?? { id, nombre: cuentas.find((c) => c.id === id)?.nombre ?? null, entradas: 0, salidas: 0 };
      fila[lado] += monto;
      porCuenta.set(id, fila);
    }
  }

  const porCategoria = [...categorias.values()]
    .sort((a, b) => b.total - a.total || a.texto.localeCompare(b.texto))
    .map((c) => ({ ...c, pct: gastos > 0 ? c.total / gastos : 0 }));

  return {
    mes,
    gastos,
    ingresos,
    neto: ingresos - gastos,
    transferencias,
    retiros,
    cantidad,
    porCategoria,
    mayor: porCategoria[0] ?? null,
    porDia: [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    porCuenta: [...porCuenta.values()],
  };
}

/** Frase corta del mes, SIN montos (se lee aunque el modo discreto esté activo, D-020). */
export function fraseMes(resumen, esteMes = true) {
  if (resumen.cantidad === 0) return esteMes ? "Aún no hay movimientos este mes." : "Ese mes no tuvo movimientos.";
  if (!resumen.mayor) return esteMes ? "Este mes no has registrado gastos." : "Ese mes no tuvo gastos.";
  const pct = Math.round(resumen.mayor.pct * 100);
  const lider = `${resumen.mayor.texto} se lleva el ${pct}% de tus gastos.`;
  if (resumen.ingresos > 0 && resumen.gastos > resumen.ingresos) return `${lider} Salió más de lo que entró.`;
  return lider;
}

// ── Lista de movimientos: enriquecer, filtrar, ordenar y agrupar ─────────

/**
 * Agrega a cada movimiento lo que necesita la lista: fecha, efecto, etiqueta, nombres de origen/destino,
 * título (descripción o categoría) y un texto para buscar.
 */
export function enriquecer(movimientos, cuentas = [], deudas = []) {
  const nombres = new Map(cuentas.map((c) => [c.id, c.nombre]));
  const deudasPorId = new Map(deudas.map((d) => [d.id, d]));
  return movimientos.map((mov) => {
    const efecto = efectoDe(mov, cuentas);
    const etiqueta = etiquetaCategoria(mov);
    const deuda = mov.deuda_id ? (deudasPorId.get(mov.deuda_id) ?? null) : null;
    let origen = null;
    let destino = null;
    if (mov.tipo === "egreso") origen = nombres.get(efecto.sale) ?? mov.cuenta ?? null;
    else if (mov.tipo === "ingreso") destino = nombres.get(efecto.entra) ?? mov.cuenta ?? null;
    else {
      origen = nombres.get(efecto.sale) ?? (efecto.sale ? mov.cuenta : (deuda?.nombre ?? null));
      destino = nombres.get(efecto.entra) ?? (efecto.entra ? null : (deuda?.nombre ?? null));
    }
    const descripcion = mov.descripcion?.trim() || null;
    return {
      ...mov,
      monto: Number(mov.monto) || 0,
      fecha: fechaDe(mov),
      efecto,
      etiqueta,
      origen,
      destino,
      deuda: deuda ? { id: deuda.id, nombre: deuda.nombre, direccion: deuda.direccion } : null,
      titulo: descripcion ?? etiqueta.texto,
      buscable: normalizar([descripcion, etiqueta.texto, origen, destino, deuda?.nombre].filter(Boolean).join(" ")),
    };
  });
}

const TIPO_FILTRO = { gasto: "egreso", gastos: "egreso", ingresos: "ingreso", transferencias: "transferencia", retiros: "retiro" };

/** `tipo`: "todos" | "egreso" | "ingreso" | "transferencia" | "retiro" · `texto`: busca en descripción, categoría y cuentas. */
export function filtrar(lista, { tipo = "todos", texto = "" } = {}) {
  const t = TIPO_FILTRO[tipo] ?? tipo;
  const q = normalizar(texto);
  return lista.filter((m) => (t === "todos" || m.tipo === t) && (!q || (m.buscable ?? "").includes(q)));
}

const momentoDe = (m) => Date.parse(m.momento ?? `${m.fecha}T12:00:00-05:00`) || 0;

/** "recientes" (lo último primero) o "monto" (lo más grande primero). Devuelve una lista nueva. */
export function ordenar(lista, criterio = "recientes") {
  const copia = [...lista];
  if (criterio === "monto") return copia.sort((a, b) => b.monto - a.monto || momentoDe(b) - momentoDe(a));
  return copia.sort((a, b) => momentoDe(b) - momentoDe(a));
}

/** +1 si el movimiento suma (en esa cuenta, o si es ingreso), −1 si resta, 0 si es neutro. */
export function signoEn(item, cuentaId = null) {
  if (cuentaId && (item.efecto.entra === cuentaId || item.efecto.sale === cuentaId)) return item.efecto.entra === cuentaId ? 1 : -1;
  if (item.efecto.clase === "gasto") return -1;
  if (item.efecto.clase === "ingreso") return 1;
  return 0;
}

/**
 * Agrupa una lista ya enriquecida (y ordenada) por "dia", "categoria" o "cuenta".
 * Devuelve [{ clave, titulo, emoji, subtotal, clase, cuentaId, movimientos }]. El subtotal lleva signo
 * (día: ingresos − gastos · cuenta: entradas − salidas · categoría: negativo si son gastos).
 * Una transferencia aparece en las dos cuentas cuando se agrupa por cuenta.
 */
export function agrupar(lista, por = "dia", { hoy, cuentas = [] } = {}) {
  const grupos = new Map();
  const meter = (clave, base, item, cuanto) => {
    let grupo = grupos.get(clave);
    if (!grupo) grupos.set(clave, (grupo = { clave, emoji: null, cuentaId: null, clase: "ninguno", ...base, subtotal: 0, movimientos: [] }));
    grupo.movimientos.push(item);
    grupo.subtotal += cuanto;
  };

  for (const item of lista) {
    if (por === "categoria") {
      const clase = item.efecto.clase;
      meter(
        clase === "ninguno" ? `especial:${item.categoria}` : claveCategoria(item),
        { titulo: item.etiqueta.texto, emoji: item.etiqueta.emoji, clase },
        item,
        clase === "gasto" ? -item.monto : item.monto,
      );
    } else if (por === "cuenta") {
      const lados = [
        [item.efecto.sale, -1],
        [item.efecto.entra, 1],
      ].filter(([id]) => id);
      if (lados.length === 0) {
        // Movimiento viejo con una cuenta que ya no existe: se agrupa por el nombre guardado.
        const nombre = item.cuenta ?? "Sin cuenta";
        meter(`texto:${normalizar(nombre)}`, { titulo: nombre }, item, signoEn(item) * item.monto);
      }
      for (const [id, signo] of lados) {
        const cuenta = cuentas.find((c) => c.id === id);
        meter(id, { titulo: cuenta?.nombre ?? "Cuenta borrada", emoji: emojiCuenta(cuenta?.tipo), cuentaId: id }, item, signo * item.monto);
      }
    } else {
      meter(item.fecha, { titulo: hoy ? tituloDia(item.fecha, hoy) : item.fecha, fecha: item.fecha }, item, signoEn(item) * item.monto);
    }
  }

  const lista2 = [...grupos.values()];
  if (por === "dia") return lista2.sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (por === "categoria") return lista2.sort((a, b) => Math.abs(b.subtotal) - Math.abs(a.subtotal));
  const orden = new Map(ordenarCuentas(cuentas).map((c, i) => [c.id, i]));
  return lista2.sort((a, b) => (orden.get(a.cuentaId) ?? 999) - (orden.get(b.cuentaId) ?? 999));
}

// ── Deudas ───────────────────────────────────────────────────────────────

/** Movimientos que bajan una deuda: abonar lo que debo o cobrar lo que me deben. */
const ABONOS = new Set(["abono_deuda", "cobro_deuda"]);

export const textoDeuda = (deuda) => `${deuda.nombre} · ${deuda.direccion === "debo" ? "le debo" : "me debe"}`;

export function emojiDeuda(tipo) {
  return TIPOS_DEUDA.find((t) => t.valor === tipo)?.emoji ?? "📒";
}

/**
 * Saldo de una deuda = monto inicial − abonos. Devuelve la deuda con { abonado, saldo, pct (pagado, 0 a 1),
 * estado ("activa" | "pagada"), proximoPago (YYYY-MM-DD o null) }.
 */
export function saldoDeuda(deuda, movimientos, hoy = null) {
  let abonado = 0;
  for (const m of movimientos) if (m.deuda_id === deuda.id && ABONOS.has(m.categoria)) abonado += Number(m.monto) || 0;
  const inicial = Number(deuda.monto_inicial) || 0;
  const saldo = Math.max(0, inicial - abonado);
  const pagada = deuda.estado === "pagada" || saldo === 0;
  return {
    ...deuda,
    abonado,
    saldo,
    pct: inicial > 0 ? Math.min(1, abonado / inicial) : 0,
    estado: pagada ? "pagada" : "activa",
    proximoPago: !pagada && deuda.dia_pago && hoy ? proximaFecha(deuda.dia_pago, hoy) : null,
  };
}

/**
 * Todas las deudas para mostrar: las de finanzas_deudas y, en "Debo", cada tarjeta de crédito como deuda
 * (su saldo negativo). `saldos` = saldosPorCuenta(). Activas primero (por próximo pago), pagadas al final.
 */
export function deudasVista(deudas, saldos, movimientos, hoy) {
  const tarjetas = saldos.filter((c) => esTarjeta(c) && c.activa !== false);
  const ligadas = new Set(deudas.map((d) => d.cuenta_id).filter(Boolean));

  const vista = deudas.map((d) => {
    const tarjeta = d.cuenta_id ? tarjetas.find((c) => c.id === d.cuenta_id) : null;
    if (!tarjeta) return saldoDeuda(d, movimientos, hoy);
    const inicial = Number(d.monto_inicial) || 0;
    const pagada = d.estado === "pagada";
    return {
      ...d,
      tarjeta: true,
      saldo: tarjeta.deuda,
      abonado: Math.max(0, inicial - tarjeta.deuda),
      pct: inicial > 0 ? Math.min(1, Math.max(0, 1 - tarjeta.deuda / inicial)) : 0,
      estado: pagada ? "pagada" : "activa",
      proximoPago: !pagada && d.dia_pago && tarjeta.deuda > 0 ? proximaFecha(d.dia_pago, hoy) : null,
    };
  });

  for (const t of tarjetas) {
    if (ligadas.has(t.id)) continue;
    vista.push({
      id: `cuenta:${t.id}`,
      virtual: true,
      tarjeta: true,
      cuenta_id: t.id,
      direccion: "debo",
      tipo: "tarjeta_credito",
      nombre: t.nombre,
      banco: t.banco ?? null,
      cupo: t.cupo ?? null,
      cuota: null,
      saldo: t.deuda,
      pct: t.cupoUsado ?? 0,
      estado: "activa",
      dia_pago: t.dia_pago ?? null,
      proximoPago: t.dia_pago && t.deuda > 0 ? proximaFecha(t.dia_pago, hoy) : null,
    });
  }

  const rango = (d) => (d.estado === "pagada" ? 2 : d.virtual && d.saldo === 0 ? 1 : 0);
  return vista.sort(
    (a, b) =>
      rango(a) - rango(b) ||
      String(a.proximoPago ?? "9999").localeCompare(String(b.proximoPago ?? "9999")) ||
      b.saldo - a.saldo ||
      a.nombre.localeCompare(b.nombre),
  );
}

/** Lo que debes y lo que te deben (solo deudas activas). */
export function totalesDeudas(vista) {
  const suma = (direccion) =>
    vista.filter((d) => d.direccion === direccion && d.estado !== "pagada").reduce((s, d) => s + d.saldo, 0);
  return { debo: suma("debo"), meDeben: suma("me_deben") };
}

/** Deuda por id, por su texto de menú ("Tía · le debo") o por nombre. Prefiere las activas. */
export function buscarDeuda(valor, deudas) {
  if (valor == null || valor === "") return null;
  const v = String(valor).trim();
  const n = normalizar(v);
  const activas = deudas.filter((d) => d.estado !== "pagada");
  return (
    deudas.find((d) => d.id === v) ??
    activas.find((d) => normalizar(textoDeuda(d)) === n) ??
    activas.find((d) => normalizar(d.nombre) === n) ??
    deudas.find((d) => normalizar(d.nombre) === n) ??
    null
  );
}

// ── Validar y armar filas (web y API) ────────────────────────────────────

/** Un dato no sirve. `campo` va en el aviso: "⚠️ Revisa: cuenta". */
export class DatoInvalido extends Error {
  constructor(campo) {
    super(`Revisa: ${campo}`);
    this.campo = campo;
  }
}

/** Valor en COP entero. Acepta 25000, "25000", "25.000", "$25.000" o "1.250.000". */
export function leerMonto(valor, campo = "valor", maximo = MONTO_MAXIMO) {
  let n = valor;
  if (typeof valor === "string") {
    const t = valor.replace(/[\s$]/g, "").replace(/^cop/i, "");
    if (/^\d{1,3}([.,]\d{3})+$/.test(t)) n = Number(t.replace(/[.,]/g, ""));
    else if (/^\d+([.,]\d{1,2})?$/.test(t)) n = Number(t.replace(",", "."));
    else n = Number.NaN;
  }
  if (typeof n !== "number" || !Number.isFinite(n)) throw new DatoInvalido(campo);
  n = Math.round(n);
  if (n < 1 || n > maximo) throw new DatoInvalido(campo);
  return n;
}

const ALIAS_TIPO = {
  gasto: "egreso",
  egreso: "egreso",
  ingreso: "ingreso",
  transferencia: "transferencia",
  transferir: "transferencia",
  retiro: "retiro",
  retirar: "retiro",
  deuda: "deuda",
  abono: "deuda",
  abonar: "deuda",
  cobro: "deuda",
  cobrar: "deuda",
};

/** "gasto", "egreso", "💸 Gasto" → "egreso" · "📒 Deuda" → "deuda". */
export function leerTipo(valor) {
  const tipo = ALIAS_TIPO[normalizar(valor).split(" ")[0]];
  if (!tipo) throw new DatoInvalido("tipo");
  return tipo;
}

/** Categoría del catálogo (por valor o texto, con o sin emoji) o "Otro" + texto escrito a mano. */
export function leerCategoria(tipo, categoria, escrita) {
  const lista = CATEGORIAS[tipo] ?? [];
  const v = normalizar(categoria);
  const igual = (texto) => (c) => c.valor === texto.replace(/ /g, "_") || normalizar(c.texto) === texto;
  if (v === "otro" || v === "otra") {
    const texto = textoRequerido(escrita, 40, "categoría");
    // Si escribió una que ya existe ("comida"), se usa la del catálogo.
    const conocida = lista.find(igual(normalizar(texto)));
    return conocida ? { categoria: conocida.valor, libre: false } : { categoria: texto, libre: true };
  }
  const hallada = v ? lista.find(igual(v)) : null;
  if (!hallada) throw new DatoInvalido("categoría");
  return { categoria: hallada.valor, libre: false };
}

/**
 * Valida un movimiento como lo manda la hoja o el atajo y devuelve la fila para finanzas_movimientos
 * (sin momento, origen ni id_cliente: eso lo pone quien guarda).
 * `entrada`: { tipo, monto, categoria, categoria_otra, cuenta, cuenta_destino, descripcion, deuda }
 *   (cuentas por id o por nombre; tipo "deuda" = abonar o cobrar).
 * `contexto`: { cuentas, deudas, movimientos (para el saldo de una deuda) }.
 */
export function prepararMovimiento(entrada, contexto = {}) {
  const tipo = leerTipo(entrada.tipo);
  if (tipo === "deuda") return prepararAbono(entrada, contexto);
  const cuentas = (contexto.cuentas ?? []).filter((c) => c.activa !== false);
  const monto = leerMonto(entrada.monto);
  const base = {
    tipo,
    monto,
    descripcion: textoOpcional(entrada.descripcion, 200, "descripción"),
    categoria_libre: false,
    cuenta_id: null,
    cuenta_destino_id: null,
    deuda_id: null,
  };

  if (tipo === "egreso" || tipo === "ingreso") {
    const { categoria, libre } = leerCategoria(tipo, entrada.categoria, entrada.categoria_otra);
    const cuenta = buscarCuenta(entrada.cuenta, cuentas);
    if (!cuenta) throw new DatoInvalido("cuenta");
    return { ...base, categoria, categoria_libre: libre, cuenta_id: cuenta.id ?? null, cuenta: cuenta.nombre };
  }

  const origen = buscarCuenta(entrada.cuenta, cuentas);
  if (tipo === "transferencia") {
    if (!origen || esTarjeta(origen)) throw new DatoInvalido("origen");
    const destino = buscarCuenta(entrada.cuenta_destino, cuentas);
    if (!destino || destino.id === origen.id) throw new DatoInvalido("destino");
    return {
      ...base,
      categoria: esTarjeta(destino) ? "pago_tarjeta" : "transferencia",
      cuenta_id: origen.id,
      cuenta: origen.nombre,
      cuenta_destino_id: destino.id,
    };
  }

  // Retiro: de una cuenta a Efectivo.
  if (!origen || origen.tipo === "efectivo") throw new DatoInvalido("origen");
  const destino = entrada.cuenta_destino ? buscarCuenta(entrada.cuenta_destino, cuentas) : cuentas.find((c) => c.tipo === "efectivo");
  if (!destino || destino.tipo !== "efectivo") throw new DatoInvalido("destino");
  return { ...base, categoria: "retiro", cuenta_id: origen.id, cuenta: origen.nombre, cuenta_destino_id: destino.id };
}

/**
 * Abonar a una deuda que debo (sale de una cuenta, no es gasto) o cobrar lo que me deben (entra a una cuenta,
 * no es ingreso). `entrada`: { deuda (id, texto o nombre), monto, cuenta, descripcion }.
 */
export function prepararAbono(entrada, { cuentas = [], deudas = [], movimientos = null } = {}) {
  const deuda = buscarDeuda(entrada.deuda ?? entrada.deuda_id, deudas);
  if (!deuda || deuda.estado === "pagada") throw new DatoInvalido("deuda");
  const activas = cuentas.filter((c) => c.activa !== false);
  const monto = leerMonto(entrada.monto);
  const cuenta = buscarCuenta(entrada.cuenta, activas);
  if (!cuenta || esTarjeta(cuenta)) throw new DatoInvalido("cuenta");
  const base = {
    tipo: "transferencia",
    monto,
    descripcion: textoOpcional(entrada.descripcion, 200, "descripción"),
    categoria_libre: false,
    deuda_id: deuda.id,
  };

  // Deuda ligada a una tarjeta de crédito: pagarla es una transferencia a la tarjeta.
  const tarjeta = deuda.cuenta_id ? activas.find((c) => c.id === deuda.cuenta_id && esTarjeta(c)) : null;
  if (tarjeta) return { ...base, categoria: "pago_tarjeta", cuenta_id: cuenta.id, cuenta: cuenta.nombre, cuenta_destino_id: tarjeta.id };

  if (movimientos && monto > saldoDeuda(deuda, movimientos).saldo) throw new DatoInvalido("valor (es más que la deuda)");
  if (deuda.direccion === "debo") return { ...base, categoria: "abono_deuda", cuenta_id: cuenta.id, cuenta: cuenta.nombre, cuenta_destino_id: null };
  return { ...base, categoria: "cobro_deuda", cuenta_id: null, cuenta: cuenta.nombre, cuenta_destino_id: cuenta.id };
}

function opcional(valor, leer) {
  return valor == null || String(valor).trim() === "" ? null : leer(valor);
}

function enteroEntre(valor, min, max, campo) {
  const n = Number(String(valor).trim());
  if (!Number.isInteger(n) || n < min || n > max) throw new DatoInvalido(campo);
  return n;
}

function deCatalogo(valor, lista, campo) {
  const v = normalizar(valor);
  const hallada = lista.find((o) => o.valor === v.replace(/ /g, "_") || normalizar(o.texto) === v);
  if (!hallada) throw new DatoInvalido(campo);
  return hallada.valor;
}

/** Fila para finanzas_deudas. `entrada`: { direccion, tipo, nombre, banco, monto, cuota, dia_pago, tasa_mensual, fecha_inicio, notas, cuenta }. */
export function prepararDeuda(entrada, { cuentas = [] } = {}) {
  const tipo = entrada.tipo ? deCatalogo(entrada.tipo, TIPOS_DEUDA, "tipo") : "persona";
  const tarjeta = tipo === "tarjeta_credito" ? buscarCuenta(entrada.cuenta, cuentas.filter(esTarjeta)) : null;
  const fechaInicio = opcional(entrada.fecha_inicio, (v) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new DatoInvalido("fecha");
    return v;
  });
  return {
    direccion: deCatalogo(entrada.direccion, DIRECCIONES_DEUDA, "debo o me deben"),
    tipo,
    nombre: textoRequerido(entrada.nombre, 60, "nombre"),
    banco: textoOpcional(entrada.banco, 40, "banco"),
    cuenta_id: tarjeta?.id ?? null,
    monto_inicial: leerMonto(entrada.monto ?? entrada.monto_inicial, "monto", MONTO_GRANDE),
    cuota: opcional(entrada.cuota, (v) => leerMonto(v, "cuota", MONTO_GRANDE)),
    dia_pago: opcional(entrada.dia_pago, (v) => enteroEntre(v, 1, 31, "día de pago")),
    tasa_mensual: opcional(entrada.tasa_mensual, (v) => {
      const n = Number(String(v).replace(",", ".").replace("%", "").trim());
      if (!Number.isFinite(n) || n < 0 || n > 100) throw new DatoInvalido("tasa");
      return Math.round(n * 100) / 100;
    }),
    fecha_inicio: fechaInicio,
    notas: textoOpcional(entrada.notas, 200, "notas"),
  };
}

/**
 * Movimiento del dinero de un préstamo nuevo: me prestaron (entra a la cuenta, no es ingreso)
 * o presté (sale de la cuenta, no es gasto). `deuda` necesita id.
 */
export function movimientoDePrestamo(deuda, cuenta) {
  if (!cuenta || esTarjeta(cuenta)) throw new DatoInvalido("cuenta");
  const debo = deuda.direccion === "debo";
  return {
    tipo: "transferencia",
    monto: deuda.monto_inicial,
    categoria: debo ? "prestamo_recibido" : "prestamo_dado",
    categoria_libre: false,
    cuenta_id: debo ? null : cuenta.id,
    cuenta: cuenta.nombre,
    cuenta_destino_id: debo ? cuenta.id : null,
    deuda_id: deuda.id,
    descripcion: debo ? `Préstamo de ${deuda.nombre}` : `Préstamo a ${deuda.nombre}`,
  };
}

/** Fila para finanzas_cuentas. `entrada`: { nombre, tipo, banco, cupo, dia_pago }. */
export function prepararCuenta(entrada) {
  const tipo = deCatalogo(entrada.tipo ?? "banco", TIPOS_CUENTA, "tipo de cuenta");
  const tarjeta = tipo === "tarjeta_credito";
  return {
    nombre: textoRequerido(entrada.nombre, 40, "nombre"),
    tipo,
    banco: textoOpcional(entrada.banco, 40, "banco"),
    cupo: tarjeta ? opcional(entrada.cupo, (v) => leerMonto(v, "cupo", MONTO_GRANDE)) : null,
    dia_pago: tarjeta ? opcional(entrada.dia_pago, (v) => enteroEntre(v, 1, 31, "día de pago")) : null,
  };
}

// ── Mensajes (sin montos, D-020) ─────────────────────────────────────────

/** "💸 Guardado · Comida", "💰 Ingreso guardado", "🔁 Transferencia guardada", "🏧 Retiro guardado"… Nunca montos. */
export function mensajeGuardado(fila, { saldada = false } = {}) {
  if (saldada) return "🎉 Deuda saldada";
  switch (fila.categoria) {
    case "abono_deuda":
      return "📒 Abono guardado";
    case "cobro_deuda":
      return "📒 Cobro guardado";
    case "pago_tarjeta":
      return "💳 Pago de tarjeta guardado";
    case "prestamo_recibido":
    case "prestamo_dado":
      return "🤝 Préstamo guardado";
  }
  if (fila.tipo === "egreso") {
    const { texto } = etiquetaCategoria(fila);
    // Una categoría escrita a mano con números ("$20 mil") no se repite: podría ser un monto.
    return /\d/.test(texto) ? "💸 Guardado" : `💸 Guardado · ${texto}`;
  }
  if (fila.tipo === "ingreso") return "💰 Ingreso guardado";
  if (fila.tipo === "retiro") return "🏧 Retiro guardado";
  return "🔁 Transferencia guardada";
}

// ── Menú para el atajo "💸 Movimiento" ───────────────────────────────────

/**
 * Lo que necesita el atajo para preguntar sin calcular nada (GET finanzas/menu).
 * `preguntas[<tipo elegido>]` dice qué listas mostrar: categorías (+ "✏️ Otro…"), cuentas, destinos o deudas.
 * Todas son listas de texto para "Elegir de la lista"; la API acepta esos mismos textos de vuelta.
 */
export function menuAtajo({ cuentas = [], deudas = [], movimientos = [], hoy }) {
  const activas = ordenarCuentas(cuentas.filter((c) => c.activa !== false));
  const nombres = (lista) => lista.map((c) => c.nombre);
  const noTarjeta = activas.filter((c) => !esTarjeta(c));
  const efectivo = activas.filter((c) => c.tipo === "efectivo");
  const desde = hoy ? sumarDias(hoy, -59) : null;
  const egreso = ordenarPorUso(CATEGORIAS.egreso, movimientos, "egreso", desde);
  const ingreso = ordenarPorUso(CATEGORIAS.ingreso, movimientos, "ingreso", desde);
  const tarjetasLigadas = new Set(activas.filter(esTarjeta).map((c) => c.id));
  const deudasActivas = deudas.filter((d) => d.estado !== "pagada" && !tarjetasLigadas.has(d.cuenta_id));
  const otra = conEmoji(CATEGORIA_OTRA);
  const [gasto, ingresoTipo, transferencia, retiro] = TIPOS_MOVIMIENTO;
  const nada = { categorias: null, pregunta_cuenta: null, cuentas: null, pregunta_destino: null, destinos: null, deudas: null };

  const preguntas = {
    [conEmoji(gasto)]: { ...nada, categorias: [...egreso.map(conEmoji), otra], pregunta_cuenta: "¿Cómo pagaste?", cuentas: nombres(activas) },
    [conEmoji(ingresoTipo)]: { ...nada, categorias: [...ingreso.map(conEmoji), otra], pregunta_cuenta: "¿Dónde ingresó?", cuentas: nombres(activas) },
    [conEmoji(transferencia)]: {
      ...nada,
      pregunta_cuenta: "¿Desde dónde?",
      cuentas: nombres(noTarjeta),
      pregunta_destino: "¿Hacia dónde?",
      destinos: nombres(activas),
    },
    [conEmoji(retiro)]: {
      ...nada,
      pregunta_cuenta: "¿De qué cuenta sacaste?",
      cuentas: nombres(activas.filter((c) => c.tipo !== "efectivo")),
      // Con un solo Efectivo no se pregunta: la API lo pone sola.
      pregunta_destino: efectivo.length > 1 ? "¿A cuál efectivo?" : null,
      destinos: efectivo.length > 1 ? nombres(efectivo) : null,
    },
  };
  const tipos = TIPOS_MOVIMIENTO.map(({ valor, texto, emoji }) => ({ valor, texto, emoji }));
  if (deudasActivas.length > 0) {
    preguntas["📒 Deuda"] = { ...nada, deudas: deudasActivas.map(textoDeuda), pregunta_cuenta: "¿Con qué cuenta?", cuentas: nombres(noTarjeta) };
    tipos.push({ valor: "deuda", texto: "Deuda", emoji: "📒" });
  }

  return {
    tipos,
    categorias: { egreso: [...egreso, CATEGORIA_OTRA], ingreso: [...ingreso, CATEGORIA_OTRA] },
    cuentas: activas.map((c) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo })),
    deudas: deudasActivas.map((d) => ({ id: d.id, nombre: d.nombre, direccion: d.direccion, texto: textoDeuda(d) })),
    opciones_tipo: Object.keys(preguntas),
    preguntas,
  };
}
