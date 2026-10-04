// Pasos del asistente "Configura tu iPhone" y los permisos que iOS pedirá. Solo datos: conectar.html los pinta.

/** Pantallas del asistente, en orden. `principal`: texto del botón naranja. */
export const PASOS = Object.freeze([
  Object.freeze({ id: "hola", principal: "Empezar" }),
  Object.freeze({ id: "instala", principal: "Siguiente" }),
  Object.freeze({ id: "conecta", principal: "Siguiente" }),
  Object.freeze({ id: "permisos", principal: "Entendido" }),
  Object.freeze({ id: "atajos", principal: "Siguiente" }),
  Object.freeze({ id: "widgets", principal: "Siguiente" }),
  Object.freeze({ id: "listo", principal: "Ir a Hoy" }),
]);

/** Índice de un paso por su id (0 si no existe). */
export function indicePaso(id) {
  const i = PASOS.findIndex((p) => p.id === id);
  return i < 0 ? 0 : i;
}

/**
 * Lo que iOS te va a pedir y qué tocar. Una web no puede pedir estos permisos: los pide iOS la primera vez
 * que corre cada atajo. Una línea por permiso: qué se toma y para qué.
 */
export const PERMISOS = Object.freeze([
  {
    emoji: "❤️",
    titulo: "Salud",
    tocar: "Permitir",
    que: "Análisis del sueño, Pasos y Distancia (solo lectura).",
    para: "Saber cuánto dormiste y caminaste, sin Apple Watch.",
  },
  {
    emoji: "☑️",
    titulo: "Recordatorios",
    tocar: "Permitir acceso completo",
    que: "Crear y leer la lista «Goat».",
    para: "Poner cada bloque de tu día con alerta a su hora.",
  },
  {
    emoji: "🔔",
    titulo: "Notificaciones de Atajos",
    tocar: "Permitir",
    que: "Avisos con emoji y una o dos palabras, sin montos.",
    para: "Ver «🍽️ Almuerzo pendiente» o «☀️ Buenos días».",
  },
  {
    emoji: "🌐",
    titulo: "Conectarse a Goat",
    tocar: "Permitir siempre",
    que: "Cada atajo pregunta una vez si puede hablar con tu web.",
    para: "Mandar y pedir datos con tu llave.",
  },
  {
    emoji: "⚡",
    titulo: "Automatizaciones",
    tocar: "Ejecutar inmediatamente · apaga «Notificar al ejecutar»",
    que: "Se eligen al crear cada automatización.",
    para: "Que corran solas, sin preguntarte cada vez.",
  },
  {
    emoji: "🛏️",
    titulo: "Horario de sueño en Salud",
    tocar: "Salud › Explorar › Sueño › Horario completo y opciones",
    que: "Activa el horario y «Registrar tiempo en cama con el iPhone».",
    para: "Las automatizaciones «Hora de dormir» y «Despertar» lo necesitan.",
  },
]);
