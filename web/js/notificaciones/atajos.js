// Guía de los atajos de iPhone de este módulo (formato en .claude/objetivos/00-comun.md › Guía de atajos).
// El asistente "Conectar iPhone" (conectar.html) las reúne todas.
// Avisos nativos del iPhone (D-057): una automatización "Hora del día" pregunta a Goat si falta algo y,
// si falta, muestra una notificación con solo emoji + 1–2 palabras (sin montos, D-020) y sin sonido.

const HORARIOS = ["9:00", "13:00", "16:00", "20:00", "22:15"];

export const ATAJOS = [
  {
    id: "notificaciones-avisos",
    emoji: "🔔",
    nombre: "Avisos de Goat",
    para: "Un aviso discreto en el iPhone cuando te falta registrar algo (ej. «🍽️ Almuerzo pendiente»). Si no falta nada, no hace nada.",
    pasos: [
      "Abre Atajos › pestaña Atajos › + (arriba a la derecha). Ponle de nombre «🔔 Avisos de Goat».",
      "Añade la acción «Ejecutar atajo» y elige «⚙️ Goat». Toca la flecha y desactiva «Mostrar al ejecutar».",
      "Añade «Obtener valor de diccionario»: Obtener «Valor» de la clave «url» en «Resultado del atajo».",
      "Añade «Texto» y escribe: (toca «Valor del diccionario») seguido de /api/v1/notificaciones/ahora — sin espacios.",
      "Añade otra «Obtener valor de diccionario»: clave «token» en «Resultado del atajo». Renómbrala «Token» (mantén presionada › Renombrar).",
      "Añade «Obtener contenido de URL» con el «Texto» anterior. Toca «Mostrar más»: Método GET · Encabezados › Añadir: clave «Authorization», valor «Bearer » (con un espacio) seguido de la variable «Token».",
      "Añade «Obtener valor de diccionario»: clave «datos» en «Contenido de la URL».",
      "Añade otra «Obtener valor de diccionario»: clave «aviso» en el «Valor del diccionario» anterior.",
      "Añade «Si»: «Valor del diccionario» (el de «aviso») · «tiene algún valor».",
      "Dentro del «Si», añade «Mostrar notificación» con la variable «Valor del diccionario» (el aviso). Toca «Mostrar más», título «Goat» y desactiva «Reproducir sonido».",
      "Deja vacío el «De lo contrario» (si no falta nada, el atajo termina sin avisar). Toca «Listo».",
      "Pruébalo con ▶︎: la primera vez iOS pregunta si el atajo puede conectarse a tu web de Goat y mostrar notificaciones: toca «Permitir».",
    ],
    automatizacion: {
      disparador: `Hora del día · ${HORARIOS.join(", ")} (una automatización por horario)`,
      pasos: [
        "Abre Atajos › pestaña Automatización › + (o «Nueva automatización»).",
        "Elige «Hora del día», pon 9:00 y «Diariamente».",
        "Marca «Ejecutar inmediatamente» y desactiva «Notificar al ejecutar». Toca «Siguiente».",
        "Elige el atajo «🔔 Avisos de Goat». Listo.",
        `Repite para cada horario: ${HORARIOS.slice(1).join(", ")}. Puedes cambiar las horas a tu gusto.`,
        "Para que lleguen sin sonido: Ajustes › Notificaciones › Atajos › desactiva «Sonidos» (déjalo en «Pantalla bloqueada» y «Centro de notificaciones»).",
      ],
    },
    permisos: [
      "Atajos: permitir que «Avisos de Goat» se conecte a tu web de Goat (la primera vez que corre)",
      "Notificaciones de Atajos (la primera vez que muestra un aviso)",
    ],
    prueba: { metodo: "GET", ruta: "notificaciones/ahora" },
  },
];
