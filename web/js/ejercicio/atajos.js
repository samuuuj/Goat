// Guía de los atajos de iPhone de Movimiento (formato en .claude/objetivos/00-comun.md › Guía de atajos).
// Se ven en ejercicio.html › "Con el iPhone" y el asistente "Conectar iPhone" (conectar.html) las reúne todas.
// Sin Apple Watch: el entreno se marca con un toque al empezar y otro al terminar; pasos y distancia los cuenta el iPhone.
// Los atajos son clientes delgados: piden los tipos a la API y muestran su `mensaje` tal cual.

/** Pasos comunes: sacar la dirección y la llave del atajo base "⚙️ Goat". */
const BASE = [
  "Añade «Ejecutar atajo» y elige «⚙️ Goat» (te devuelve tu dirección y tu llave).",
  "Añade «Obtener valor del diccionario»: Valor para la clave url en «Resultado del atajo». Debajo, «Definir variable» con el nombre url.",
  "Añade otra vez «Obtener valor del diccionario»: Valor para la clave token en «Resultado del atajo». Debajo, «Definir variable» con el nombre token.",
];

/** Cómo llenar cada «Obtener contenido de URL». */
const ENCABEZADO = "Toca «Mostrar más» › Encabezados › Añadir encabezado: clave Authorization, valor «Bearer » (con un espacio) seguido de la variable token.";

export const ATAJOS = [
  {
    id: "ejercicio-entreno",
    emoji: "🏋️",
    nombre: "Entreno",
    para: "Un toque al empezar y otro al terminar: guarda de qué hora a qué hora entrenaste, caminaste o trotaste.",
    pasos: [
      "Abre Atajos › pestaña Atajos › «+» (arriba a la derecha). Toca el nombre y escribe «🏋️ Entreno».",
      ...BASE,
      "Añade «Elegir del menú». Solicitud: Entreno. Opciones: Empezar, Terminar y Ya lo hice.",
      `Dentro de «Empezar»: añade «Obtener contenido de URL». URL: la variable url y después /api/v1/ejercicio/menu. Método: GET. ${ENCABEZADO}`,
      "Debajo (aún en «Empezar»): «Obtener valor del diccionario»: Valor para la clave datos.tipos en «Contenido de URL».",
      "Debajo: «Elegir de la lista» con «Valor del diccionario». Solicitud: ¿Qué vas a hacer?",
      `Debajo: «Obtener contenido de URL». URL: url + /api/v1/ejercicio/inicio. Método: POST. ${ENCABEZADO} Cuerpo de la solicitud: JSON › Añadir campo › Texto: clave tipo, valor «Elemento elegido».`,
      `Dentro de «Terminar»: «Obtener contenido de URL». URL: url + /api/v1/ejercicio/fin. Método: POST. ${ENCABEZADO} Cuerpo de la solicitud: JSON › campo Texto: clave origen, valor atajo.`,
      "Dentro de «Ya lo hice» (un entreno que ya terminó): repite «Obtener contenido de URL» (…/ejercicio/menu), «Obtener valor del diccionario» (datos.tipos) y «Elegir de la lista».",
      "Debajo: «Pedir entrada» tipo Fecha y hora con la pregunta ¿A qué hora empezaste? Luego «Formatear fecha»: Formato de fecha ISO 8601 y activa «Incluir hora ISO 8601» (queda así: 2026-10-03T07:10:00-05:00).",
      "Debajo: «Pedir entrada» tipo Número con la pregunta ¿Cuántos minutos?",
      `Debajo: «Obtener contenido de URL». URL: url + /api/v1/ejercicio/sesion. Método: POST. ${ENCABEZADO} Cuerpo JSON: Texto tipo = «Elemento elegido»; Texto inicio = «Fecha formateada»; Número duracion_min = «Entrada proporcionada».`,
      "Debajo de «Terminar menú» (fuera del menú): «Obtener valor del diccionario»: Valor para la clave mensaje en «Resultado del menú». Luego «Mostrar notificación» con «Valor del diccionario».",
      "Pruébalo: toca el atajo › Empezar › Fuerza. Debe llegar «🏋️ A darle». Al terminar llega algo como «✅ 55 min». Si iOS pregunta si puede conectarse a tu dirección de Goat, toca «Permitir siempre».",
      "Para tenerlo a un toque: mantén presionado el atajo › Compartir › «Añadir a pantalla de inicio», o ponlo en el widget de Atajos.",
    ],
    automatizacion: {
      disparador: "NFC o Llegar al gym (opcional)",
      pasos: [
        "Atajos › Automatización › «+» › NFC › Escanear y acerca una etiqueta NFC (pegada en el bolso o en la puerta del gym). Ponle el nombre Gym.",
        "O, en vez de NFC: «+» › Llegar › elige la ubicación de tu gym.",
        "Marca «Ejecutar inmediatamente» y desactiva «Notificar al ejecutar».",
        "Acción: «Ejecutar atajo» › «🏋️ Entreno». Al tocar la etiqueta (o al llegar) te pregunta Empezar o Terminar.",
      ],
    },
    permisos: ["Ninguno de Salud. Solo internet para hablar con Goat (iOS pregunta una vez: «Permitir siempre»)."],
    prueba: { metodo: "GET", ruta: "ejercicio/menu" },
  },
  {
    id: "ejercicio-actividad",
    emoji: "📈",
    nombre: "Actividad del día",
    para: "Cada noche sube tus pasos, la distancia y la energía que contó el iPhone en Salud (no hace falta Apple Watch).",
    pasos: [
      "Abre Atajos › pestaña Atajos › «+». Toca el nombre y escribe «📈 Actividad del día».",
      ...BASE,
      "Añade «Buscar muestras de salud». Filtros: Tipo es Pasos; Fecha de inicio es hoy. Agrupar por: Día.",
      "Debajo: «Calcular estadísticas» › Suma de «Muestras de salud». Luego «Definir variable» con el nombre pasos.",
      "Añade otro «Buscar muestras de salud»: Tipo es Distancia caminando y corriendo; Fecha de inicio es hoy; Agrupar por: Día; Unidad: km.",
      "Debajo: «Calcular estadísticas» › Suma. Luego «Definir variable» con el nombre km.",
      "Opcional: lo mismo con Tipo es Energía activa (Unidad: kcal) y «Definir variable» con el nombre kcal.",
      "Añade «Fecha actual» y debajo «Formatear fecha»: Formato de fecha ISO 8601 con «Incluir hora ISO 8601» activado (ej. 2026-10-03T21:30:00-05:00).",
      `Añade «Obtener contenido de URL». URL: url + /api/v1/ejercicio/actividad. Método: POST. ${ENCABEZADO} Cuerpo de la solicitud: JSON con Texto fecha = «Fecha formateada»; Número pasos = pasos; Número distancia_km = km; Número energia_kcal = kcal (si lo hiciste).`,
      "Opcional: «Obtener valor del diccionario» (clave mensaje en «Contenido de URL») y «Mostrar notificación». Llega algo como «📈 8.432 pasos».",
      "Pruébalo tocándolo: la primera vez iOS pide permiso para leer Pasos, Distancia y Energía: toca «Permitir». Puedes correrlo varias veces al día; solo actualiza la cifra de ese día.",
    ],
    automatizacion: {
      disparador: "Hora del día › 21:30 › Diariamente",
      pasos: [
        "Atajos › Automatización › «+» › Hora del día.",
        "Elige 21:30 y «Diariamente».",
        "Marca «Ejecutar inmediatamente» y desactiva «Notificar al ejecutar».",
        "Acción: «Ejecutar atajo» › «📈 Actividad del día».",
        "Opcional: otra igual a las 23:50 para guardar el total final del día.",
      ],
    },
    permisos: [
      "Salud › Pasos (leer)",
      "Salud › Distancia caminando y corriendo (leer)",
      "Salud › Energía activa (leer, opcional)",
    ],
    prueba: { metodo: "GET", ruta: "ejercicio/semana" },
  },
];
