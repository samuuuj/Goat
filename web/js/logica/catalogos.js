// Opciones de los formularios de registro. También sirven para validar antes de guardar:
// si un valor no está aquí, no se guarda. Cada módulo las pasará a su tabla cuando las madure.

const valores = (opciones) => new Set(opciones.map((o) => o.valor));

// ── Finanzas (D-053; reglas en js/finanzas/logica.js) ───────────────────
// En la base de datos "Gasto" sigue siendo `egreso`. Solo `egreso` cuenta para el presupuesto.

export const TIPOS_MOVIMIENTO = [
  { valor: "egreso", texto: "Gasto", emoji: "💸" },
  { valor: "ingreso", texto: "Ingreso", emoji: "💰" },
  { valor: "transferencia", texto: "Transferencia", emoji: "🔁" },
  { valor: "retiro", texto: "Retiro", emoji: "🏧" },
];

export const CATEGORIAS = {
  egreso: [
    { valor: "comida", texto: "Comida", emoji: "🍔" },
    { valor: "transporte", texto: "Transporte", emoji: "🚌" },
    { valor: "compras", texto: "Compras", emoji: "🛍️" },
    { valor: "hogar", texto: "Hogar", emoji: "🏠" },
    { valor: "ocio", texto: "Ocio", emoji: "🎮" },
    { valor: "salud", texto: "Salud", emoji: "💊" },
    { valor: "estudio", texto: "Estudio", emoji: "📚" },
    { valor: "servicios", texto: "Servicios", emoji: "💡" },
    { valor: "intereses", texto: "Intereses y cuotas", emoji: "💳" },
    { valor: "otros", texto: "Otros", emoji: "📦" },
  ],
  ingreso: [
    { valor: "salario", texto: "Salario", emoji: "💼" },
    { valor: "trabajo", texto: "Trabajo", emoji: "🛠️" },
    { valor: "venta", texto: "Venta", emoji: "🏷️" },
    { valor: "devolucion", texto: "Devolución", emoji: "↩️" },
    { valor: "regalo", texto: "Regalo", emoji: "🎁" },
  ],
};

/** "Otro": la categoría se escribe a mano (ej. Gasto · Otro → "Cita"). Se guarda con categoria_libre = true. */
export const CATEGORIA_OTRA = { valor: "otro", texto: "Otro…", emoji: "✏️" };

/** Las cuentas con las que arranca todo usuario (se crean en finanzas_cuentas la primera vez). */
export const CUENTAS = [
  { valor: "efectivo", texto: "Efectivo", tipo: "efectivo", banco: null },
  { valor: "nu", texto: "Nu", tipo: "banco", banco: "Nu" },
  { valor: "nequi", texto: "Nequi", tipo: "billetera", banco: "Nequi" },
];

export const TIPOS_CUENTA = [
  { valor: "efectivo", texto: "Efectivo", emoji: "💵" },
  { valor: "banco", texto: "Banco", emoji: "🏦" },
  { valor: "billetera", texto: "Billetera", emoji: "📱" },
  { valor: "tarjeta_credito", texto: "Tarjeta de crédito", emoji: "💳" },
];

export const DIRECCIONES_DEUDA = [
  { valor: "debo", texto: "Debo" },
  { valor: "me_deben", texto: "Me deben" },
];

export const TIPOS_DEUDA = [
  { valor: "persona", texto: "Persona", emoji: "👤" },
  { valor: "prestamo", texto: "Préstamo", emoji: "🏦" },
  { valor: "tarjeta_credito", texto: "Tarjeta", emoji: "💳" },
  { valor: "otro", texto: "Otro", emoji: "📒" },
];

/** Montos rápidos: con un presupuesto menor a $500.000, los gastos hormiga pesan (D-034). */
export const MONTOS_RAPIDOS = [2000, 5000, 10000, 20000];

export const MONTO_MAXIMO = 100_000_000;

// ── Comidas ──────────────────────────────────────────────────────────────

export const TIPOS_COMIDA = [
  { valor: "desayuno", texto: "Desayuno" },
  { valor: "almuerzo", texto: "Almuerzo" },
  { valor: "merienda", texto: "Merienda" },
  { valor: "cena", texto: "Cena" },
];

/** Valores aproximados; 02 · Comidas los reemplaza por tus comidas frecuentes de la base de datos. */
export const FRECUENTES = [
  { valor: "pericos", texto: "Pericos + arepa", kcal: 400, proteina: 17 },
  { valor: "corrientazo", texto: "Corrientazo", kcal: 950, proteina: 40 },
  { valor: "pechuga", texto: "Pechuga + arroz", kcal: 600, proteina: 48 },
  { valor: "batido", texto: "Batido de proteína", kcal: 120, proteina: 24 },
];

// ── Estudio y gym ────────────────────────────────────────────────────────

/** De ejemplo hasta tener tus materias del semestre (P-08). */
export const MATERIAS = [
  { valor: "calculo", texto: "Cálculo" },
  { valor: "fisica", texto: "Física" },
  { valor: "historia", texto: "Historia" },
  { valor: "investigacion", texto: "Investigación" },
  { valor: "otra", texto: "Otra" },
];

export const DURACIONES = [
  { valor: "25", texto: "25 min" },
  { valor: "50", texto: "50 min" },
  { valor: "90", texto: "1h 30" },
  { valor: "120", texto: "2h" },
];

export const RUTINAS = [
  { valor: "empuje", texto: "Empuje" },
  { valor: "tiron", texto: "Tirón" },
  { valor: "pierna", texto: "Pierna" },
  { valor: "full", texto: "Full body" },
  { valor: "cardio", texto: "Cardio" },
];

// ── Conjuntos para validar antes de guardar ──────────────────────────────

export const VALIDOS = {
  tipoMovimiento: valores(TIPOS_MOVIMIENTO),
  categoria: { egreso: valores(CATEGORIAS.egreso), ingreso: valores(CATEGORIAS.ingreso) },
  cuenta: valores(CUENTAS),
  tipoCuenta: valores(TIPOS_CUENTA),
  direccionDeuda: valores(DIRECCIONES_DEUDA),
  tipoDeuda: valores(TIPOS_DEUDA),
  tipoComida: valores(TIPOS_COMIDA),
  frecuente: valores(FRECUENTES),
  materia: valores(MATERIAS),
  duracion: valores(DURACIONES),
  rutina: valores(RUTINAS),
};
