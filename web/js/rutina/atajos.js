// Guía de los atajos de iPhone de Rutina (formato en .claude/objetivos/00-comun.md › Guía de atajos).
// El asistente "Conectar iPhone" (conectar.html) las reúne todas; rutina.html también las muestra.
// Todos usan el atajo base "⚙️ Goat", que devuelve un diccionario { url, token } (url ya termina en /api/v1).
// Las fechas que manda la API vienen en ISO 8601 con la zona de Bogotá (ej. 2026-10-06T06:10:00-05:00).

/** Los primeros pasos de todos los atajos de Goat: traer la dirección y la llave. */
const BASE = [
  'Añade "Ejecutar atajo" y elige "⚙️ Goat". Desactiva "Mostrar al ejecutar".',
  'Añade "Obtener valor del diccionario": Obtener Valor de la clave "url" en "Resultado del atajo". Mantén presionado el resultado › Renombrar › "URL".',
  'Añade otra vez "Obtener valor del diccionario": clave "token" en "Resultado del atajo". Renómbralo "Llave".',
];

/** "Obtener contenido de URL" con la llave. */
const pedir = (metodo, ruta, cuerpo) =>
  [
    `Añade "Obtener contenido de URL". URL: la variable URL seguida de /${ruta} (sin espacios). Toca "Mostrar más": Método ${metodo}.`,
    'En "Encabezados" toca "Añadir encabezado nuevo": clave Authorization, valor Bearer (con un espacio) seguido de la variable Llave.',
    cuerpo ? `En "Cuerpo de la solicitud" elige JSON y agrega: ${cuerpo}.` : null,
  ].filter(Boolean);

const AVISAR = [
  'Añade "Obtener valor del diccionario": clave "mensaje" en "Contenido de la URL".',
  'Añade "Mostrar notificación" con ese Valor del diccionario. Desactiva el sonido.',
];

export const ATAJOS = [
  {
    id: "rutina-plan",
    emoji: "☀️",
    nombre: "Plan del día",
    para: "Al despertar, pone cada bloque de tu día en Recordatorios (lista \"Goat\") con alerta a su hora. Te llegan avisos nativos y los marcas desde la pantalla bloqueada.",
    pasos: [
      'Antes: en la app Recordatorios crea una lista llamada exactamente "Goat".',
      'Abre Atajos › pestaña Atajos › "+" (arriba a la derecha). Ponle de nombre "☀️ Plan del día".',
      ...BASE,
      ...pedir("GET", "rutina/hoy"),
      'Opcional (borrar los de ayer): añade "Buscar recordatorios" con el filtro Lista es "Goat" y después "Eliminar recordatorios". iOS puede pedirte confirmar; si te molesta, quita estos dos pasos.',
      'Añade "Obtener valor del diccionario": clave "datos.recordatorios" en "Contenido de la URL" (es la lista de bloques que faltan hoy).',
      'Añade "Repetir con cada" y elige ese Valor del diccionario.',
      'Dentro del Repetir: "Obtener valor del diccionario", clave "alerta" en "Elemento de repetición". Después "Obtener fechas de la entrada" con ese valor (convierte 2026-10-06T06:10:00-05:00 en una fecha).',
      'Dentro del Repetir: "Añadir recordatorio nuevo". Recordatorio: el valor "recordatorio" del Elemento de repetición (ej. "🚶 Caminar · 06:10–06:55"). Lista: Goat. Toca "Mostrar más": Alertar › A una hora › la variable Fechas. Notas: el valor "notas" del Elemento de repetición. URL: el valor "enlace" (la clase virtual queda tocable).',
      'Cierra el Repetir (el atajo pone "Fin de la repetición" solo).',
      ...AVISAR,
    ],
    automatizacion: {
      disparador: "Sueño › Despertar (o Alarma › Se detiene). Respaldo: Hora del día 6:05",
      pasos: [
        'Atajos › pestaña Automatización › "+" › Sueño › "Despertar" (necesita el horario de sueño de Salud). Si no lo usas: Alarma › "Se detiene".',
        'Elige "Ejecutar inmediatamente" y apaga "Notificar al ejecutar".',
        'Toca "Siguiente" › "Nuevo atajo en blanco" › añade "Ejecutar atajo" › "☀️ Plan del día".',
        'Respaldo: otra automatización "Hora del día" 6:05, diaria, con lo mismo. Correrlo dos veces no duplica si dejaste el paso de borrar los de ayer.',
      ],
    },
    permisos: ["Recordatorios: acceso completo (crear y borrar en la lista Goat)", "Notificaciones de Atajos"],
    prueba: { metodo: "GET", ruta: "rutina/hoy" },
  },
  {
    id: "rutina-hecho",
    emoji: "✅",
    nombre: "Hecho",
    para: "Un toque y marca como hecho el bloque que acabas de terminar (o el que está en curso). Ideal con doble toque en la parte trasera del iPhone.",
    pasos: [
      'Abre Atajos › "+". Nombre: "✅ Hecho".',
      ...BASE,
      ...pedir("POST", "rutina/check", 'bloque_id (Texto) = actual y estado (Texto) = hecho'),
      ...AVISAR,
      'Copia el atajo (mantener presionado › Duplicar), llámalo "⤼ Saltar" y cambia estado a saltado: registrar que no lo hiciste también cuenta.',
    ],
    automatizacion: {
      disparador: "Toque posterior (doble toque) o widget de Atajos",
      pasos: [
        "Ajustes › Accesibilidad › Tocar › Toque posterior › Doble toque › elige \"✅ Hecho\".",
        'O mantén presionada la pantalla de inicio › "+" › Atajos › widget pequeño › elige "✅ Hecho".',
      ],
    },
    permisos: ["Notificaciones de Atajos"],
    prueba: { metodo: "GET", ruta: "rutina/ahora" },
  },
  {
    id: "rutina-cierre",
    emoji: "🌙",
    nombre: "Cierre del día",
    para: "En la noche sube a Goat los recordatorios que completaste hoy en la lista \"Goat\". Lo obligatorio que quede sin marcar te lo pide la web.",
    pasos: [
      'Abre Atajos › "+". Nombre: "🌙 Cierre del día".',
      ...BASE,
      'Añade "Buscar recordatorios" con los filtros: Lista es "Goat" · Está completado (activado) · Fecha de finalización es Hoy.',
      'Añade "Obtener detalles de los recordatorios" › Notas (ahí va el código goat:… de cada bloque).',
      'Añade "Combinar texto" con esas Notas, usando "Línea nueva".',
      ...pedir("POST", "rutina/checks", "hechos (Texto) = Texto combinado"),
      ...AVISAR,
    ],
    automatizacion: {
      disparador: "Hora del día 21:45 (o Cargador › Se conecta)",
      pasos: [
        'Atajos › Automatización › "+" › "Hora del día" › 21:45 › Diariamente.',
        'Elige "Ejecutar inmediatamente", apaga "Notificar al ejecutar" y añade "Ejecutar atajo" › "🌙 Cierre del día".',
        "Correrlo dos veces no duplica nada: marcar de nuevo solo actualiza.",
      ],
    },
    permisos: ["Recordatorios: acceso completo (leer la lista Goat)", "Notificaciones de Atajos"],
    prueba: { metodo: "GET", ruta: "rutina/hoy" },
  },
  {
    id: "rutina-tarea",
    emoji: "📚",
    nombre: "Tarea",
    para: "Anota una tarea de la universidad en 10 segundos: qué es, el primer paso y para cuándo.",
    pasos: [
      'Abre Atajos › "+". Nombre: "📚 Tarea".',
      ...BASE,
      'Añade "Pedir entrada" (Texto) con la pregunta "¿Qué tarea?". Renombra el resultado "Tarea".',
      'Añade otro "Pedir entrada" (Texto): "Primer paso (lo más pequeño)". Renómbralo "Paso".',
      'Añade "Elegir del menú" con 3 opciones: Hoy, Mañana, Esta semana. Dentro de cada opción pon una acción "Texto" con hoy, manana o semana (así, sin tilde).',
      ...pedir("POST", "uni/tareas", "titulo (Texto) = Tarea, primer_paso (Texto) = Paso, para (Texto) = Resultado del menú"),
      ...AVISAR,
    ],
    automatizacion: null,
    permisos: ["Notificaciones de Atajos"],
    prueba: { metodo: "GET", ruta: "uni/tareas" },
  },
];
