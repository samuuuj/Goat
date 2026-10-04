// Opciones de los formularios de registro. También sirven para validar antes de guardar:
// si un valor no está aquí, no se guarda. Cada módulo las pasará a su tabla cuando las madure.

const valores = (opciones) => new Set(opciones.map((o) => o.valor));

// ── Finanzas ─────────────────────────────────────────────────────────────

export const TIPOS_MOVIMIENTO = [
  { valor: "egreso", texto: "Egreso" },
  { valor: "ingreso", texto: "Ingreso" },
];

export const CATEGORIAS = {
  egreso: [
    { valor: "comida_fuera", texto: "Comida fuera" },
    { valor: "mercado", texto: "Mercado" },
    { valor: "transporte", texto: "Transporte" },
    { valor: "universidad", texto: "Universidad" },
    { valor: "ocio", texto: "Ocio" },
    { valor: "suscripciones", texto: "Suscripciones" },
    { valor: "salud", texto: "Salud" },
    { valor: "ropa", texto: "Ropa" },
    { valor: "otros", texto: "Otros" },
  ],
  ingreso: [
    { valor: "mesada", texto: "Mesada" },
    { valor: "trabajo", texto: "Trabajo" },
    { valor: "beca", texto: "Beca" },
    { valor: "otros", texto: "Otros" },
  ],
};

export const CUENTAS = [
  { valor: "efectivo", texto: "Efectivo" },
  { valor: "nequi", texto: "Nequi" },
  { valor: "debito", texto: "Débito" },
  { valor: "credito", texto: "Crédito" },
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

/** Rutinas de fuerza (solo aplican al tipo "fuerza"). "Cardio" pasó a ser un tipo de ejercicio. */
export const RUTINAS = [
  { valor: "empuje", texto: "Empuje" },
  { valor: "tiron", texto: "Tirón" },
  { valor: "pierna", texto: "Pierna" },
  { valor: "full", texto: "Full body" },
];

/** Tipos de sesión de ejercicio (gym_sesiones.tipo). Sin Apple Watch: se registran con inicio y fin. */
export const TIPOS_EJERCICIO = [
  { valor: "fuerza", texto: "Fuerza", emoji: "🏋️" },
  { valor: "caminata", texto: "Caminata", emoji: "🚶" },
  { valor: "trote", texto: "Trote", emoji: "🏃" },
  { valor: "cardio", texto: "Cardio", emoji: "🚴" },
  { valor: "deporte", texto: "Deporte", emoji: "⚽" },
  { valor: "movilidad", texto: "Movilidad", emoji: "🧘" },
  { valor: "otro", texto: "Otro", emoji: "✨" },
];

// ── Conjuntos para validar antes de guardar ──────────────────────────────

export const VALIDOS = {
  tipoMovimiento: valores(TIPOS_MOVIMIENTO),
  categoria: { egreso: valores(CATEGORIAS.egreso), ingreso: valores(CATEGORIAS.ingreso) },
  cuenta: valores(CUENTAS),
  tipoComida: valores(TIPOS_COMIDA),
  frecuente: valores(FRECUENTES),
  materia: valores(MATERIAS),
  duracion: valores(DURACIONES),
  rutina: valores(RUTINAS),
  tipoEjercicio: valores(TIPOS_EJERCICIO),
};
