// Guías de los atajos del iPhone (D-063): UN solo lugar para todas, en el orden en que se arman.
// Las pinta web/js/piezas/guia.js (Conectar › Atajos y las páginas de cada sección).
//
// Idea: casi todo pasa por un solo atajo, «🐐 Goat», que pregunta lo que Goat le dice (D-063). Los demás son
// automatizaciones de 2 bloques («Texto» + «Ejecutar atajo 🐐 Goat») o los pocos que necesitan algo del iPhone
// que Goat no puede pedir (Salud y Recordatorios).
//
// Formato de cada paso: { titulo, hacer: [líneas cortas], escribir?: [textos con botón Copiar], nota? }.
// Nombres de acciones: los del iPhone en español de Samuel («Establecer variable», «Seleccionar variable»,
// «tiene cualquier valor», «Elegir del menú»…). Si una acción tiene otro nombre en algún iPhone, va en `nota`.

/** Grupos en el orden en que conviene armarlos. */
export const GRUPOS = Object.freeze([
  { id: "base", emoji: "⚙️", nombre: "1 · La base", intro: "Tu llave y la prueba. Ya los tienes si «🧪 Probar» dice «✅ Conectado»." },
  { id: "motor", emoji: "🐐", nombre: "2 · El atajo que lo hace todo", intro: "Se arma UNA vez. Desde aquí registras todo en segundos." },
  { id: "dia", emoji: "☀️", nombre: "3 · Tu día solo", intro: "Atajos que corren solos: al despertar, en la noche y a ciertas horas." },
  { id: "puerta", emoji: "🔒", nombre: "4 · La puerta de TikTok y compañía", intro: "Registrar desbloquea tu ocio. Automatizaciones de 2 bloques." },
]);

// ── Piezas que se repiten ────────────────────────────────────────────────

/** Crear un atajo nuevo con su nombre exacto. */
const crear = (nombre) => ({
  titulo: "Crea el atajo",
  hacer: [
    "Abre la app Atajos (ícono de cuadros de colores).",
    "Abajo toca la pestaña «Atajos».",
    "Arriba a la derecha toca «+». Se abre un atajo vacío.",
    "Arriba toca el nombre («Atajo nuevo») › «Renombrar» y escribe el nombre de abajo, con el emoji.",
  ],
  escribir: [nombre],
  nota: "El nombre lo inventas tú: no aparece en ningún lado hasta que lo escribes.",
});

/** Los 3 pasos que traen la dirección y la llave desde «⚙️ Goat». */
const CONECTAR = [
  {
    titulo: "Trae tu llave de «⚙️ Goat»",
    hacer: [
      "Toca la barra de búsqueda de abajo («Buscar apps y acciones»).",
      "Escribe «Ejecutar atajo» y tócala.",
      "En el bloque, toca la palabra azul «Atajo» y elige «⚙️ Goat».",
    ],
    nota: "Así este atajo usa la dirección y la llave guardadas en «⚙️ Goat» (nunca la escribes otra vez).",
  },
  {
    titulo: "Guarda la dirección en una variable «url»",
    hacer: [
      "Busca y agrega «Obtener valor del diccionario».",
      "Toca «Clave» y escribe url.",
      "Toca «Diccionario» y elige «Resultado del atajo».",
      "Debajo, agrega «Establecer variable». Nombre: url. Valor: «Valor del diccionario».",
    ],
    escribir: ["url"],
    nota: "Debe leerse: Obtener «Valor» para «url» en «Resultado del atajo».",
  },
  {
    titulo: "Guarda la llave en una variable «token»",
    hacer: [
      "Agrega otra vez «Obtener valor del diccionario».",
      "Clave: token. Diccionario: toca y elige otra vez «Resultado del atajo» (no «Valor del diccionario»).",
      "Debajo, «Establecer variable». Nombre: token. Valor: el «Valor del diccionario» de arriba.",
    ],
    escribir: ["token"],
  },
];

/** «Obtener contenido de URL» a una ruta de Goat, con la llave en el encabezado. */
const pedir = (ruta, { post = false, campos = [] } = {}) => ({
  titulo: post ? "Habla con Goat (POST)" : "Habla con Goat",
  hacer: [
    "Agrega «Obtener contenido de URL».",
    "Toca el campo de la URL › «Seleccionar variable» › elige url. Justo después (sin espacios) escribe la ruta de abajo.",
    "Toca la flechita › (o «Mostrar más»).",
    ...(post ? ["«Método»: elige POST."] : []),
    "«Encabezados» › «Añadir nuevo encabezado». Clave: Authorization. Valor: escribe Bearer, un espacio, y luego «Seleccionar variable» › token.",
    ...(campos.length
      ? [
          "«Cuerpo de la solicitud»: elige JSON.",
          ...campos.map((c) => `«Añadir nuevo campo» › Texto. Clave: ${c.clave}. Valor: ${c.valor}.`),
        ]
      : []),
  ],
  escribir: [ruta, "Authorization", "Bearer "],
  nota: "La URL queda como «url/api/v1/…». Bearer lleva un espacio antes de la variable token.",
});

/** Un «Si» de una sola condición (iOS 26 agrega una segunda vacía: se quita). */
const si = (titulo, variable, condicion, valor, dentro, nota) => ({
  titulo,
  hacer: [
    "Agrega «Si».",
    `Toca la condición › «Seleccionar variable» › ${variable}. Elige «${condicion}»${valor ? ` y escribe ${valor}` : ""}.`,
    "Si aparece una segunda condición vacía, quítala con ⊖.",
    ...dentro,
    "Deja «De lo contrario» vacío.",
  ],
  escribir: valor ? [valor] : undefined,
  nota,
});

/** Automatización de iOS que corre «🐐 Goat» con un texto (2 bloques). */
const autoGoat = (disparador, eleccion, textoFlujo, extra = []) => ({
  disparador,
  pasos: [
    {
      titulo: "Crea la automatización",
      hacer: [
        "Atajos › pestaña «Automatización» › «+» (o «Nueva automatización»).",
        `Elige ${eleccion}.`,
        "Marca «Ejecutar inmediatamente» y apaga «Notificar al ejecutar». Toca «Siguiente».",
        "Toca «Nueva automatización en blanco».",
      ],
    },
    {
      titulo: "Dile a 🐐 Goat qué hacer",
      hacer: [
        "Agrega «Texto» y escribe la palabra de abajo, en minúsculas.",
        "Agrega «Ejecutar atajo» › elige «🐐 Goat».",
        "Toca la flechita › del bloque. En «Entrada» elige «Texto».",
        ...extra,
        "Toca «Listo».",
      ],
      escribir: [textoFlujo],
      nota: "Son solo 2 bloques: «Texto» › «Ejecutar atajo 🐐 Goat».",
    },
  ],
});

// ── Los atajos ───────────────────────────────────────────────────────────

export const ATAJOS = [
  // ── 1 · Base ──
  {
    id: "conectar-goat",
    grupo: "base",
    modulo: "conectar",
    emoji: "⚙️",
    nombre: "Goat",
    tiempo: "3 min",
    para: "Guarda la dirección de tu Goat y tu llave. Los demás atajos la leen de aquí.",
    uso: "Nunca lo tocas. Los otros atajos lo llaman solos.",
    solo: null,
    mapa: ["Diccionario (url, token)", "Detener y generar salida › Diccionario"],
    pasos: [
      crear("⚙️ Goat"),
      {
        titulo: "Pon tu dirección y tu llave",
        hacer: [
          "Busca y agrega «Diccionario».",
          "Toca «Añadir nuevo elemento» › Texto. En «Clave» escribe url. En «Texto» pega tu dirección (botón Copiar en Conectar › Tu llave).",
          "Otra vez «Añadir nuevo elemento» › Texto. Clave: token. Texto: pega tu llave.",
        ],
        escribir: ["url", "token"],
        nota: "La dirección va sin barra al final y sin /api/v1, ej. https://goat-samuuuj.vercel.app",
      },
      {
        titulo: "Que entregue el diccionario",
        hacer: ["Busca «Detener y generar salida» y agrégala.", "En el bloque elige «Diccionario».", "Toca «Listo»."],
        nota: "No compartas este atajo: lleva tu llave. Si pierdes el iPhone, revoca la llave en Goat › Ajustes.",
      },
    ],
    automatizaciones: [],
    permisos: [],
    prueba: null,
  },
  {
    id: "conectar-probar",
    grupo: "base",
    modulo: "conectar",
    emoji: "🧪",
    nombre: "Goat · Probar",
    tiempo: "3 min",
    para: "Dice en 2 segundos si tu iPhone habla con Goat.",
    uso: "Córrelo solo cuando algo no funcione.",
    solo: null,
    mapa: ["Ejecutar atajo ⚙️ Goat", "url y token (2 variables)", "Obtener contenido de URL › /api/v1/ping", "Obtener valor «mensaje» › Mostrar notificación"],
    pasos: [
      crear("🧪 Goat · Probar"),
      ...CONECTAR,
      pedir("/api/v1/ping"),
      {
        titulo: "Muestra la respuesta",
        hacer: [
          "Agrega «Obtener valor del diccionario». Clave: mensaje. Diccionario: «Contenido de URL».",
          "Agrega «Mostrar notificación» y pon «Valor del diccionario».",
          "Toca ▶︎ abajo. Debe salir «✅ Conectado».",
        ],
        escribir: ["mensaje"],
        nota: "Si sale «👋 Goat responde», la llave está mal copiada en «⚙️ Goat».",
      },
    ],
    automatizaciones: [],
    permisos: ["Conectarse a tu Goat: «Permitir siempre»", "Notificaciones de Atajos: «Permitir»"],
    prueba: { metodo: "GET", ruta: "ping" },
  },

  // ── 2 · El motor ──
  {
    id: "goat-motor",
    grupo: "motor",
    modulo: "conectar",
    emoji: "🐐",
    nombre: "Goat",
    tiempo: "15 min, una sola vez",
    para: "El atajo que registra todo: dinero, comidas, lo que terminaste, lo que tienes que hacer, entrenos y estudio.",
    uso:
      "Lo tocas (ícono, doble toque atrás del iPhone o botón de acción) y te pregunta con listas: primero lo que te falta. Dinero sigue tu lógica: Gasto, Ingreso, Transferencia o Retiro, y solo pregunta lo que toca a cada uno.",
    solo: "Las automatizaciones también lo usan: la puerta de TikTok, los avisos y el repaso de la noche.",
    mapa: [
      "Ejecutar atajo ⚙️ Goat",
      "url y token (2 variables)",
      "Texto vacío › variables estado y respuesta",
      "Repetir 20 veces:",
      "  Obtener contenido de URL › /api/v1/asistente (POST)",
      "  tipo, estado, pregunta, opciones (4 variables)",
      "  Si tipo es fin › Mostrar notificación › Detener este atajo",
      "  Si tipo es silencio › Detener este atajo",
      "  Si tipo es inicio › Ir a la pantalla de inicio",
      "  Si tipo es lista › Elegir de la lista › respuesta",
      "  Si tipo es numero › Solicitar entrada (Número) › respuesta",
      "  Si tipo es texto › Solicitar entrada (Texto) › respuesta",
      "Fin de la repetición",
    ],
    pasos: [
      crear("🐐 Goat"),
      ...CONECTAR,
      {
        titulo: "Prepara dos cajitas vacías",
        hacer: [
          "Agrega «Texto» y déjalo vacío.",
          "Debajo, «Establecer variable». Nombre: estado. Valor: «Texto».",
          "Debajo, otra «Establecer variable». Nombre: respuesta. Valor: el mismo «Texto».",
        ],
        escribir: ["estado", "respuesta"],
        nota: "Hacen falta antes del bucle: Atajos solo deja elegir variables que ya existen más arriba.",
      },
      {
        titulo: "Abre el bucle",
        hacer: ["Agrega «Repetir».", "Toca el número y pon 20.", "TODO lo que sigue va DENTRO, antes de «Fin de la repetición»."],
        escribir: ["20"],
        nota: "Cada vuelta es una pregunta. 20 alcanza de sobra.",
      },
      pedir("/api/v1/asistente", {
        post: true,
        campos: [
          { clave: "flujo", valor: "«Seleccionar variable» › «Entrada del atajo»" },
          { clave: "estado", valor: "«Seleccionar variable» › estado" },
          { clave: "respuesta", valor: "«Seleccionar variable» › respuesta" },
        ],
      }),
      {
        titulo: "Guarda lo que Goat responde (4 veces lo mismo)",
        hacer: [
          "«Obtener valor del diccionario»: Clave tipo · Diccionario «Contenido de URL». Debajo «Establecer variable» tipo.",
          "«Obtener valor del diccionario»: Clave estado · Diccionario «Contenido de URL». Debajo «Establecer variable» estado.",
          "«Obtener valor del diccionario»: Clave pregunta · Diccionario «Contenido de URL». Debajo «Establecer variable» pregunta.",
          "«Obtener valor del diccionario»: Clave opciones · Diccionario «Contenido de URL». Debajo «Establecer variable» opciones.",
        ],
        escribir: ["tipo", "estado", "pregunta", "opciones"],
        nota: "En cada uno toca «Diccionario» y elige «Contenido de URL»: Atajos tiende a poner el bloque anterior.",
      },
      si("Si terminó: avisa y para", "tipo", "es", "fin", [
        "Dentro del «Si»: «Mostrar notificación» con «Seleccionar variable» › pregunta.",
        "Debajo, dentro del mismo «Si»: «Detener este atajo».",
      ]),
      si("Si no hay nada que decir: para", "tipo", "es", "silencio", ["Dentro: «Detener este atajo»."]),
      si(
        "Si hay que ir al inicio: ve",
        "tipo",
        "es",
        "inicio",
        ["Dentro: «Ir a la pantalla de inicio»."],
        "Lo usa la puerta de TikTok: te saca de la app antes de preguntarte.",
      ),
      si(
        "Si es una lista: elige",
        "tipo",
        "es",
        "lista",
        [
          "Dentro: «Elegir de la lista». En la lista pon «Seleccionar variable» › opciones.",
          "Toca la flechita › y en «Solicitud» pon «Seleccionar variable» › pregunta.",
          "Debajo, dentro: «Establecer variable» respuesta = «Elemento elegido».",
        ],
        "Si no la encuentras, busca «lista»: en algunos iPhone se llama «Seleccionar de la lista».",
      ),
      si("Si pide un número: pregunta con teclado de números", "tipo", "es", "numero", [
        "Dentro: «Solicitar entrada». Toca «Texto» y cámbialo a «Número».",
        "En la pregunta pon «Seleccionar variable» › pregunta.",
        "Debajo, dentro: «Establecer variable» respuesta = «Entrada proporcionada».",
      ]),
      si("Si pide un texto: pregunta", "tipo", "es", "texto", [
        "Dentro: «Solicitar entrada» (deja «Texto»).",
        "En la pregunta pon «Seleccionar variable» › pregunta.",
        "Debajo, dentro: «Establecer variable» respuesta = «Entrada proporcionada».",
      ]),
      {
        titulo: "Pruébalo",
        hacer: [
          "Revisa que todo quedó dentro de «Repetir» (compara con «Así debe quedar» arriba).",
          "Toca ▶︎. Debe salir «🐐 ¿Qué hacemos?» con una lista.",
          "Elige «💸 Dinero» › «💸 Gasto» › 1000 › una categoría › una cuenta › escribe prueba. Debe decir «💸 Guardado · …».",
          "Bórralo luego en Goat › Dinero (toca el movimiento › Borrar).",
        ],
      },
      {
        titulo: "Tenlo a un toque",
        hacer: [
          "Pantalla de inicio: en el atajo toca ⓘ (o Compartir) › «Agregar a pantalla de inicio».",
          "Doble toque atrás del iPhone: Ajustes › Accesibilidad › Tocar › Tocar atrás › Doble toque › 🐐 Goat.",
          "iPhone con botón de acción: Ajustes › Botón de acción › Atajo › 🐐 Goat.",
        ],
        nota: "Así registrar te toma menos de 15 segundos sin abrir la web.",
      },
    ],
    automatizaciones: [],
    permisos: ["Conectarse a tu Goat: «Permitir siempre»", "Notificaciones de Atajos: «Permitir»"],
    prueba: { metodo: "POST", ruta: "asistente" },
  },

  {
    id: "goat-botones",
    grupo: "motor",
    modulo: "widgets",
    emoji: "🧩",
    nombre: "Botones directos",
    tiempo: "1 min por botón",
    para: "Botones en tu pantalla de inicio que saltan el menú: 💸 Dinero, 🍽️ Comí, ✅ Terminé, 🎯 ¿Qué hago?",
    uso: "Un toque al botón y 🐐 Goat empieza directo en eso. Opcional: el menú de 🐐 Goat ya lo tiene todo.",
    solo: null,
    requisitos: ["«🐐 Goat» armado."],
    mapa: ["Texto «dinero»", "Ejecutar atajo 🐐 Goat (Entrada: Texto)"],
    pasos: [
      crear("💸 Dinero"),
      {
        titulo: "Dos bloques",
        hacer: [
          "Agrega «Texto» y escribe dinero.",
          "Agrega «Ejecutar atajo» › elige «🐐 Goat». Flechita › «Entrada»: «Texto». Toca «Listo».",
        ],
        escribir: ["dinero"],
      },
      {
        titulo: "Repite con los otros",
        hacer: [
          "«🍽️ Comí» con el texto comida.",
          "«✅ Terminé» con el texto hecho.",
          "«🎯 ¿Qué hago?» con el texto ahora.",
          "«📝 Pendiente» con el texto pendiente.",
        ],
        escribir: ["comida", "hecho", "ahora", "pendiente"],
      },
      {
        titulo: "Ponlos en un widget",
        hacer: [
          "En Atajos crea una carpeta: «‹ Atajos» › ícono de carpeta › nómbrala Goat. Mueve ahí los botones.",
          "Pantalla de inicio: mantén pulsado un espacio vacío › «Editar» › «Añadir widget» › Atajos › el mediano (4 botones).",
          "Mantén pulsado el widget › «Editar widget» › Carpeta: Goat.",
        ],
        escribir: ["Goat"],
      },
    ],
    automatizaciones: [],
    permisos: [],
    prueba: { metodo: "POST", ruta: "asistente" },
  },

  // ── 3 · Tu día solo ──
  {
    id: "sueno-acostarse",
    grupo: "dia",
    modulo: "sueno",
    emoji: "🌙",
    nombre: "Me acuesto",
    tiempo: "2 min por automatización",
    para: "Anota a qué hora te acostaste, sin tocar nada.",
    uso: "No lo usas: corre solo cuando empieza tu hora de dormir, al activar el modo Sueño o al conectar el cargador de noche.",
    solo: "Sí. Goat solo cuenta el cargador entre las 21:00 y las 03:00; de día no hace nada.",
    requisitos: ["«🐐 Goat» armado.", "Salud › Explorar › Sueño › «Horario completo y opciones»: activa tu horario de sueño."],
    mapa: ["Automatización: Texto «dormir hora_dormir» › Ejecutar atajo 🐐 Goat"],
    pasos: [],
    automatizaciones: [
      autoGoat("Sueño › Hora de dormir comienza", "«Sueño» › «Hora de dormir comienza»", "dormir hora_dormir"),
      autoGoat("Cargador › Se conecta", "«Cargador» › «Se conecta»", "dormir cargador"),
    ],
    permisos: [],
    prueba: { metodo: "POST", ruta: "asistente" },
  },
  {
    id: "sueno-desperte",
    grupo: "dia",
    modulo: "sueno",
    emoji: "☀️",
    nombre: "Desperté",
    tiempo: "10 min",
    para: "Anota cuándo te levantaste, manda lo que Salud registró de tu noche y te dice cuánto dormiste.",
    uso: "No lo usas: corre solo al apagar la alarma. Al final arma tu «☀️ Plan del día».",
    solo: "Sí, con la automatización «Alarma › Se detiene».",
    requisitos: ["Salud › Sueño › Opciones: activa «Registrar tiempo en cama con el iPhone»."],
    mapa: [
      "Ejecutar atajo ⚙️ Goat",
      "url y token (2 variables)",
      "Buscar muestras de salud (Análisis del sueño, últimas 18 h)",
      "Repetir con cada › 2 Formatear fecha + Texto (inicio;fin;valor)",
      "Combinar texto (Nueva línea)",
      "Fecha actual › Formatear fecha (ISO 8601)",
      "Obtener contenido de URL › /api/v1/sueno/evento (POST)",
      "Obtener valor «mensaje» › Mostrar notificación",
      "Ejecutar atajo ☀️ Plan del día",
    ],
    pasos: [
      crear("☀️ Desperté"),
      ...CONECTAR,
      {
        titulo: "Lee tu noche en Salud",
        hacer: [
          "Agrega «Buscar muestras de salud». Tipo: «Análisis del sueño».",
          "«Añadir filtro» › «Fecha de inicio» › «está en los últimos» › 18 horas.",
        ],
        escribir: ["18"],
      },
      {
        titulo: "Convierte cada muestra en una línea",
        hacer: [
          "Agrega «Repetir con cada» con «Muestras de salud».",
          "Dentro: «Formatear fecha» con «Elemento de repetición» › «Fecha de inicio». Formato ISO 8601 con «Incluir hora».",
          "Dentro: otro «Formatear fecha» con «Elemento de repetición» › «Fecha de finalización», igual ISO 8601 con hora.",
          "Dentro: «Texto» con: la 1.ª fecha formateada ; la 2.ª ; «Elemento de repetición» › «Valor». Separados por punto y coma, sin espacios.",
          "Después de «Fin de la repetición»: «Combinar texto» › «Resultados de la repetición» con «Nueva línea».",
        ],
        nota: "Cada línea queda así: 2026-10-02T23:45:00-05:00;2026-10-03T06:10:00-05:00;En cama",
      },
      {
        titulo: "La hora de ahora",
        hacer: ["Agrega «Fecha actual».", "Agrega «Formatear fecha»: ISO 8601 con «Incluir hora»."],
      },
      pedir("/api/v1/sueno/evento", {
        post: true,
        campos: [
          { clave: "tipo", valor: "escribe despertar" },
          { clave: "fuente", valor: "escribe alarma" },
          { clave: "momento", valor: "la última «Fecha formateada» (la de ahora)" },
          { clave: "muestras", valor: "«Texto combinado»" },
        ],
      }),
      {
        titulo: "Te dice cuánto dormiste y arma tu día",
        hacer: [
          "«Obtener valor del diccionario»: Clave mensaje · Diccionario «Contenido de URL».",
          "«Mostrar notificación» con «Valor del diccionario».",
          "Al final: «Ejecutar atajo» › «☀️ Plan del día» (arma ese atajo después).",
        ],
        escribir: ["mensaje"],
        nota: "Si ya lo tienes armado y funciona, solo agrégale «Ejecutar atajo ☀️ Plan del día» al final.",
      },
    ],
    automatizaciones: [
      {
        disparador: "Alarma › Se detiene",
        pasos: [
          {
            titulo: "Que corra al apagar la alarma",
            hacer: [
              "Atajos › «Automatización» › «+» › «Alarma» › «Se detiene» › elige tu alarma de despertar (o «Cualquiera»).",
              "Marca «Ejecutar inmediatamente», apaga «Notificar al ejecutar» › «Siguiente».",
              "Elige el atajo «☀️ Desperté» (o «Nueva automatización en blanco» › «Ejecutar atajo» › ☀️ Desperté).",
            ],
          },
        ],
      },
    ],
    permisos: ["Salud › «Análisis del sueño»: «Permitir»", "Conectarse a tu Goat: «Permitir siempre»"],
    prueba: { metodo: "GET", ruta: "sueno/resumen" },
  },
  {
    id: "rutina-plan",
    grupo: "dia",
    modulo: "rutina",
    emoji: "☀️",
    nombre: "Plan del día",
    tiempo: "10 min",
    para: "Pone tu rutina de hoy en Recordatorios: cada bloque te avisa a SU hora.",
    uso: "No lo usas: lo corre «☀️ Desperté». Cuando te llegue un aviso y lo hagas, toca «Completado» en la notificación. Si lo corres dos veces, no repite.",
    solo: "Sí, desde «☀️ Desperté».",
    requisitos: ["En Recordatorios crea una lista llamada Goat.", "Haz la encuesta en Goat › Tu día."],
    mapa: [
      "Ejecutar atajo ⚙️ Goat",
      "url y token (2 variables)",
      "Obtener contenido de URL › /api/v1/rutina/plan (POST)",
      "Obtener valor «datos» › Obtener valor «recordatorios»",
      "Repetir con cada:",
      "  minutos, titulo, notas (3 variables)",
      "  Fecha actual › Ajustar fecha (+ minutos)",
      "  Agregar recordatorio nuevo (lista Goat, alerta = Fecha ajustada)",
      "Obtener valor «mensaje» › Mostrar notificación",
    ],
    pasos: [
      crear("☀️ Plan del día"),
      ...CONECTAR,
      pedir("/api/v1/rutina/plan", { post: true }),
      {
        titulo: "Saca la lista de recordatorios",
        hacer: [
          "«Obtener valor del diccionario»: Clave datos · Diccionario «Contenido de URL».",
          "«Obtener valor del diccionario»: Clave recordatorios · Diccionario el «Valor del diccionario» de arriba.",
          "Agrega «Repetir con cada» con ese último «Valor del diccionario».",
        ],
        escribir: ["datos", "recordatorios"],
      },
      {
        titulo: "Dentro: lee cada bloque",
        hacer: [
          "«Obtener valor del diccionario»: Clave en_minutos · Diccionario «Elemento de repetición». Debajo «Establecer variable» minutos.",
          "«Obtener valor del diccionario»: Clave recordatorio · Diccionario «Elemento de repetición». Debajo «Establecer variable» titulo.",
          "«Obtener valor del diccionario»: Clave notas · Diccionario «Elemento de repetición». Debajo «Establecer variable» notas.",
        ],
        escribir: ["en_minutos", "minutos", "recordatorio", "titulo", "notas"],
      },
      {
        titulo: "Dentro: calcula la hora del aviso",
        hacer: [
          "Agrega «Fecha actual».",
          "Agrega «Ajustar fecha»: «Añadir» › toca el número › «Seleccionar variable» › minutos › unidad «minutos» › a «Fecha actual».",
        ],
        nota: "Así cada aviso suena a su hora exacta. (Antes la alerta se leía como 12:00 p. m. y llegaban todos juntos.)",
      },
      {
        titulo: "Dentro: crea el recordatorio",
        hacer: [
          "Agrega «Agregar recordatorio nuevo».",
          "Texto del recordatorio: «Seleccionar variable» › titulo. Lista: Goat.",
          "Toca la flechita ›: «Alerta» › «A una hora» › elige «Fecha ajustada».",
          "«Notas»: «Seleccionar variable» › notas.",
        ],
        nota: "Las notas llevan «goat:…»: con eso el cierre de la noche sabe qué completaste.",
      },
      {
        titulo: "Después del bucle: confirma",
        hacer: [
          "Fuera de «Repetir con cada»: «Obtener valor del diccionario» Clave mensaje · Diccionario «Contenido de URL».",
          "«Mostrar notificación» con ese valor. Dice cuántos avisos y cuál es el primero.",
        ],
        escribir: ["mensaje"],
      },
    ],
    automatizaciones: [],
    permisos: ["Recordatorios: «Permitir acceso completo»"],
    prueba: { metodo: "GET", ruta: "rutina/hoy" },
  },
  {
    id: "rutina-cierre",
    grupo: "dia",
    modulo: "rutina",
    emoji: "🌙",
    nombre: "Cierre del día",
    tiempo: "8 min",
    para: "En la noche sube lo que completaste en Recordatorios y te pregunta, uno por uno, lo que quedó sin marcar.",
    uso: "No lo usas: corre solo a las 21:45. Responde Sí o No a cada bloque, y si falta, cierra tus gastos del día.",
    solo: "Sí, con la automatización «Hora del día» 21:45.",
    mapa: [
      "Ejecutar atajo ⚙️ Goat",
      "url y token (2 variables)",
      "Buscar recordatorios (lista Goat, completados, hoy)",
      "Obtener detalles de recordatorios › Notas › Combinar texto",
      "Obtener contenido de URL › /api/v1/rutina/checks (POST, hechos)",
      "Texto «repaso» › Ejecutar atajo 🐐 Goat",
    ],
    pasos: [
      crear("🌙 Cierre del día"),
      ...CONECTAR,
      {
        titulo: "Busca lo que completaste hoy",
        hacer: [
          "Agrega «Buscar recordatorios».",
          "«Añadir filtro»: «Lista» es Goat · «Está completado» · «Fecha de finalización» es hoy.",
          "Agrega «Obtener detalles de recordatorios» › «Notas».",
          "Agrega «Combinar texto» con «Nueva línea».",
        ],
        nota: "Si ya tienes «🌙 Cierre del día» y dice «✅ … marcado», no lo rehagas: solo agrégale el último paso.",
      },
      pedir("/api/v1/rutina/checks", { post: true, campos: [{ clave: "hechos", valor: "«Texto combinado»" }] }),
      {
        titulo: "Repasa lo que quedó",
        hacer: ["Al final agrega «Texto» y escribe repaso.", "Agrega «Ejecutar atajo» › «🐐 Goat». Flechita › «Entrada»: «Texto»."],
        escribir: ["repaso"],
        nota: "🐐 Goat te pregunta «¿Hiciste 🏋️ Ejercicio?» por cada bloque sin marcar. Sí y No cuentan igual: lo que importa es registrar.",
      },
    ],
    automatizaciones: [
      {
        disparador: "Hora del día › 21:45",
        pasos: [
          {
            titulo: "Que corra cada noche",
            hacer: [
              "«Automatización» › «+» › «Hora del día» › 21:45 › «Diariamente».",
              "«Ejecutar inmediatamente» › «Siguiente» › elige «🌙 Cierre del día».",
            ],
            escribir: ["21:45"],
          },
        ],
      },
    ],
    permisos: ["Recordatorios: «Permitir acceso completo»"],
    prueba: { metodo: "GET", ruta: "rutina/hoy" },
  },
  {
    id: "notificaciones-avisos",
    grupo: "dia",
    modulo: "notificaciones",
    emoji: "🔔",
    nombre: "Avisos",
    tiempo: "2 min por hora",
    para: "A ciertas horas te avisa si te falta registrar algo. Si vas al día, no dice nada.",
    uso: "No lo usas. Si te llega «🍽️ Almuerzo pendiente», abre 🐐 Goat: lo que falta sale de primero.",
    solo: "Sí, con «Hora del día». Sugerencia: 11:00, 15:30 y 20:30.",
    mapa: ["Automatización: Texto «aviso» › Ejecutar atajo 🐐 Goat"],
    pasos: [],
    automatizaciones: [autoGoat("Hora del día › 11:00 (y 15:30, 20:30)", "«Hora del día» › 11:00 › «Diariamente»", "aviso")],
    permisos: [],
    prueba: { metodo: "POST", ruta: "asistente" },
  },
  {
    id: "ejercicio-actividad",
    grupo: "dia",
    modulo: "ejercicio",
    emoji: "📈",
    nombre: "Actividad",
    tiempo: "6 min",
    para: "En la noche manda tus pasos y la distancia del día (el iPhone los cuenta sin reloj).",
    uso: "No lo usas: corre solo a las 21:30.",
    solo: "Sí, con «Hora del día» 21:30.",
    mapa: [
      "Ejecutar atajo ⚙️ Goat",
      "url y token (2 variables)",
      "Buscar muestras de salud (Pasos, hoy, agrupar por día) › Valor",
      "Buscar muestras de salud (Distancia caminando y corriendo, hoy, por día) › Valor",
      "Obtener contenido de URL › /api/v1/ejercicio/actividad (POST)",
    ],
    pasos: [
      crear("📈 Actividad"),
      ...CONECTAR,
      {
        titulo: "Tus pasos de hoy",
        hacer: [
          "Agrega «Buscar muestras de salud». Tipo: «Pasos». Filtro: «Fecha de inicio» es hoy.",
          "«Agrupar por»: Día. Límite: 1.",
          "Debajo: «Obtener detalles de muestras de salud» › «Valor». Debajo «Establecer variable» pasos.",
        ],
        escribir: ["pasos"],
      },
      {
        titulo: "Tu distancia de hoy",
        hacer: [
          "Otra «Buscar muestras de salud»: Tipo «Distancia caminando y corriendo», hoy, agrupar por Día, límite 1.",
          "«Obtener detalles de muestras de salud» › «Valor». Debajo «Establecer variable» km.",
        ],
        escribir: ["km"],
      },
      pedir("/api/v1/ejercicio/actividad", {
        post: true,
        campos: [
          { clave: "pasos", valor: "«Seleccionar variable» › pasos" },
          { clave: "distancia_km", valor: "«Seleccionar variable» › km" },
        ],
      }),
    ],
    automatizaciones: [
      {
        disparador: "Hora del día › 21:30",
        pasos: [
          {
            titulo: "Que corra cada noche",
            hacer: ["«Automatización» › «+» › «Hora del día» › 21:30 › «Diariamente».", "«Ejecutar inmediatamente» › elige «📈 Actividad»."],
            escribir: ["21:30"],
          },
        ],
      },
    ],
    permisos: ["Salud › «Pasos» y «Distancia»: «Permitir»"],
    prueba: { metodo: "GET", ruta: "ejercicio/semana" },
  },

  // ── 4 · La puerta ──
  {
    id: "desbloqueo-puerta",
    grupo: "puerta",
    modulo: "desbloqueo",
    emoji: "🔒",
    nombre: "Puerta",
    tiempo: "2 min por app",
    para: "Al abrir TikTok, Instagram, YouTube o un juego: si te falta registrar algo, te saca al inicio y te deja registrarlo ahí mismo.",
    uso: "No lo usas. Te ofrece: registrar lo que falta (en segundos), usar tu pase de 10 min del día o dejarlo. Con todo al día, ni lo notas.",
    solo: "Sí. Una automatización «Se abre» y otra «Se cierra» por app. Empieza solo con TikTok y prueba unos días.",
    requisitos: ["«🐐 Goat» armado (con el bloque «Si tipo es inicio»)."],
    mapa: ["Se abre: Texto «puerta tiktok» › Ejecutar atajo 🐐 Goat", "Se cierra: Texto «cerre tiktok» › Ejecutar atajo 🐐 Goat"],
    pasos: [],
    automatizaciones: [
      autoGoat("App › TikTok › Se abre", "«App» › elige TikTok › marca «Se abre» (solo esa)", "puerta tiktok", [
        "Para Instagram o YouTube repite con «puerta instagram» o «puerta youtube».",
      ]),
      autoGoat("App › TikTok › Se cierra", "«App» › elige TikTok › marca «Se cierra» (solo esa)", "cerre tiktok", [
        "Así Goat cuenta cuántos minutos la usaste.",
      ]),
    ],
    permisos: [],
    prueba: { metodo: "POST", ruta: "asistente" },
  },
];

/**
 * Atajos que ya no se usan: lo hace «🐐 Goat». Si los armaste, bórralos (mantén pulsado › Eliminar).
 * Conectar los muestra en una nota para que no queden duplicados.
 */
export const RETIRADOS = Object.freeze([
  { nombre: "✅ Hecho", motivo: "Ahora es 🐐 Goat › ✅ Terminé algo: te muestra la lista y tú eliges." },
  { nombre: "🔔 Avisos (atajo)", motivo: "Ahora es una automatización de 2 bloques con 🐐 Goat." },
  { nombre: "💸 Movimiento", motivo: "Ahora es 🐐 Goat › 💸 Dinero, con tu lógica completa." },
  { nombre: "🏋️ Entreno", motivo: "Ahora es 🐐 Goat › 🏋️ Entreno." },
  { nombre: "📚 Tarea", motivo: "Ahora es 🐐 Goat › 📝 Tengo que hacer algo." },
]);

/** Los atajos de una sección (para su página). */
export const atajosDe = (modulo) => ATAJOS.filter((a) => a.modulo === modulo);
