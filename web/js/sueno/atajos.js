// Guía de los atajos de iPhone de Sueño (formato en .claude/objetivos/00-comun.md › Guía de atajos).
// El asistente "Conectar iPhone" (conectar.html) las reúne todas; sueno.html también las muestra.
// Sin Apple Watch: la noche sale del horario de sueño de Salud ("En cama") + estas automatizaciones.
//
// Además del formato común, cada atajo trae:
//   requisitos: lo que hay que tener listo antes;
//   automatizaciones: TODAS sus automatizaciones (automatizacion = la principal, por compatibilidad).

const BASE = [
  'Añade la acción "Ejecutar atajo" y elige "⚙️ Goat". Toca la flecha › desactiva "Mostrar al ejecutar".',
  'Añade "Obtener valor de diccionario": Obtener "Valor" para la clave url en "Resultado del atajo".',
  'Añade otra "Obtener valor de diccionario" con la clave token. Toca el campo del diccionario y elige otra vez "Resultado del atajo".',
];

const URL_EVENTO = 'Añade "Texto": toca "Valor del diccionario" (el de url) y escribe justo después /api/v1/sueno/evento — queda algo como https://tu-goat.vercel.app/api/v1/sueno/evento.';

const PETICION = [
  'Añade "Obtener contenido de URL" y pon la variable "Texto" como URL. Toca la flecha › Método: POST.',
  'En "Encabezados" toca "Añadir nuevo encabezado": clave Authorization, valor Bearer + un espacio + el "Valor del diccionario" del token.',
];

const AVISO = [
  'Añade "Obtener valor de diccionario": clave aviso en "Contenido de la URL".',
  'Añade "Si": "Valor del diccionario" › "tiene algún valor". Dentro, "Mostrar notificación" con "Valor del diccionario" y desactiva "Reproducir sonido". Deja el "Fin del si" como está.',
];

const SALUD_LISTO =
  'En Salud › Explorar › Sueño › "Horario completo y opciones": activa el "Horario de sueño" (hora de dormir y de despertar) y, en Opciones, "Registrar tiempo en cama con el iPhone". Así el iPhone anota "En cama" sin reloj.';

/** Pasos de una automatización de iOS 17/18 que corre un atajo pasándole su fuente como texto. */
function automatizacion(disparador, eleccion, fuente, atajo, extra = []) {
  return {
    disparador,
    pasos: [
      `Atajos › pestaña "Automatización" › + › ${eleccion}.`,
      'Marca "Ejecutar inmediatamente" y desactiva "Notificar al ejecutar". Toca "Siguiente".',
      `Toca "Nueva automatización en blanco" › "Añadir acción" › "Texto" y escribe ${fuente} (así, en minúsculas).`,
      `Añade "Ejecutar atajo" › ${atajo}. Toca la flecha y en "Entrada" elige la variable "Texto". Toca "OK".`,
      ...extra,
    ],
  };
}

const ME_ACUESTO = [
  automatizacion("Sueño › Hora de dormir comienza", '"Sueño" › "Hora de dormir comienza"', "hora_dormir", "🌙 Me acuesto"),
  automatizacion("Modo de concentración › Sueño › Al activarse", '"Modo de concentración" › "Sueño" › "Al activarse"', "modo_sueno", "🌙 Me acuesto"),
  automatizacion("Cargador › Se conecta", '"Cargador" › "Se conecta"', "cargador", "🌙 Me acuesto", [
    "No hace falta filtrar la hora: Goat solo cuenta el cargador de 21:00 a 03:00. De día no guarda nada ni te avisa.",
  ]),
];

const DESPERTE = [
  automatizacion("Sueño › Despertar", '"Sueño" › "Despertar"', "despertar", "☀️ Desperté"),
  automatizacion("Alarma › Se detiene", '"Alarma" › "Se detiene" › elige la alarma "Despertar" de tu horario de sueño (o "Cualquiera")', "alarma", "☀️ Desperté", [
    "Si corren las dos automatizaciones (Despertar y alarma), Goat guarda ambas y te avisa una sola vez.",
  ]),
];

export const ATAJOS = [
  {
    id: "sueno-acostarse",
    emoji: "🌙",
    nombre: "Me acuesto",
    para: "Anota cuándo dejas el celular para dormir. Corre solo con tu hora de dormir, el Modo Sueño o el cargador.",
    requisitos: ['El atajo base "⚙️ Goat" (lo arma el asistente Conectar iPhone).', SALUD_LISTO],
    pasos: [
      'Abre Atajos › pestaña "Atajos" › toca + (arriba a la derecha). Toca el nombre de arriba y escribe "🌙 Me acuesto".',
      ...BASE,
      'Añade "Fecha actual" y luego "Formatear fecha": Formato de fecha "ISO 8601" y activa "Incluir hora".',
      URL_EVENTO,
      ...PETICION,
      'En "Cuerpo de la solicitud" elige JSON y añade 3 campos de tipo Texto: tipo = acostarse · fuente = la variable "Entrada del atajo" · momento = "Fecha formateada".',
      'Arriba aparece "Recibir … entrada": deja "Si no hay entrada: Continuar". Si lo tocas a mano, la fuente queda como "manual".',
      ...AVISO,
      'Opcional: Ajustes › Accesibilidad › Tocar › "Tocar atrás" › "Doble toque" › 🌙 Me acuesto, para correrlo con dos toques en la espalda del iPhone.',
      'Pruébalo una vez: debe salir "🌙 Buenas noches" y en Goat › Tu noche verás "Esta noche te acostaste a las…".',
    ],
    automatizacion: ME_ACUESTO[0],
    automatizaciones: ME_ACUESTO,
    permisos: ['La primera vez, "¿Permitir que se conecte a tu Goat?": toca "Permitir siempre".'],
    prueba: { metodo: "GET", ruta: "sueno/resumen" },
  },
  {
    id: "sueno-desperte",
    emoji: "☀️",
    nombre: "Desperté",
    para: "Anota cuándo te levantas y manda lo que Salud registró \"En cama\" en las últimas 18 h. Te dice cuánto dormiste.",
    requisitos: ['El atajo base "⚙️ Goat" (lo arma el asistente Conectar iPhone).', SALUD_LISTO],
    pasos: [
      'Abre Atajos › pestaña "Atajos" › toca +. Ponle de nombre "☀️ Desperté".',
      ...BASE,
      'Añade "Buscar muestras de salud": Tipo "Análisis del sueño". Toca "Añadir filtro" › "Fecha de inicio" › "está en los últimos" › 18 horas. Ordenar por "Fecha de inicio"; sin límite.',
      'Añade "Repetir con cada" y elige "Muestras de salud".',
      'Dentro de la repetición: "Formatear fecha" con "Elemento de repetición" › "Fecha de inicio", formato "ISO 8601" con "Incluir hora".',
      'Dentro de la repetición: otro "Formatear fecha" con "Elemento de repetición" › "Fecha de finalización", también "ISO 8601" con hora.',
      'Dentro de la repetición: "Texto" con las dos fechas formateadas y "Elemento de repetición" › "Valor", separados por punto y coma y sin espacios: inicio;fin;valor (queda como 2026-10-02T23:45:00-05:00;2026-10-03T06:10:00-05:00;En cama).',
      'Después de "Fin de la repetición", añade "Combinar texto": "Resultados de la repetición" con "Nueva línea".',
      'Añade "Fecha actual" y "Formatear fecha": "ISO 8601" con "Incluir hora".',
      URL_EVENTO,
      ...PETICION,
      'En "Cuerpo de la solicitud" elige JSON y añade 4 campos de tipo Texto: tipo = despertar · fuente = "Entrada del atajo" · momento = la última "Fecha formateada" (la de ahora) · muestras = "Texto combinado".',
      'Arriba aparece "Recibir … entrada": deja "Si no hay entrada: Continuar".',
      ...AVISO,
      'Pruébalo una vez: iOS te pide leer "Análisis del sueño" de Salud (Permitir). Debe salir "☀️ Buenos días · 7 h 10".',
    ],
    automatizacion: DESPERTE[0],
    automatizaciones: DESPERTE,
    permisos: [
      'Salud › "Análisis del sueño" (solo lectura): toca "Permitir".',
      '"¿Permitir que se conecte a tu Goat?": "Permitir siempre".',
      "Notificaciones de Atajos, para ver el aviso de buenos días.",
    ],
    prueba: { metodo: "GET", ruta: "sueno/resumen" },
  },
];
