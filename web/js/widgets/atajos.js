// Guía de los atajos de iPhone de Widgets (formato en .claude/objetivos/00-comun.md › Guía de atajos).
// El asistente "Conectar iPhone" (conectar.html) las reúne todas; widgets.html también las muestra.
//
// El widget de la app Atajos pone tus atajos como botones en la pantalla de inicio (Comí, Movimiento, Estudio, Entreno).
// "🍽️ Comí" y "📚 Estudio" son atajos de una sola idea: abren Goat con la hoja de registro lista
// (index.html#registrar=comida | estudio). Los demás botones son atajos de otros módulos (💸 Movimiento, 🏋️ Entreno).
// Todos usan el atajo base "⚙️ Goat" (diccionario { url, token }); "Reemplazar texto" quita /api/v1 si la url lo trae.

/** Pasos de un atajo que abre Goat con una hoja de registro. */
function abrirHoja(nombre, accion) {
  return [
    `Abre Atajos › pestaña Atajos › "+" (arriba a la derecha). Ponle de nombre "${nombre}".`,
    'Añade "Ejecutar atajo" y elige "⚙️ Goat". Desactiva "Mostrar al ejecutar".',
    'Añade "Obtener valor del diccionario": clave "url" en "Resultado del atajo".',
    'Añade "Reemplazar texto": busca /api/v1 y reemplázalo por nada, en "Valor del diccionario" (así queda la dirección de Goat).',
    `Añade "Texto" y escribe: (toca "Texto actualizado") seguido de /index.html#registrar=${accion} — sin espacios.`,
    'Añade "Abrir URLs" con ese "Texto". Toca Listo.',
    `Pruébalo: debe abrir Goat con la hoja de ${accion === "comida" ? "comida" : "estudio"} lista para llenar.`,
  ];
}

export const ATAJOS = [
  {
    id: "widgets-comi",
    emoji: "🍽️",
    nombre: "Comí",
    para: "Un botón que abre Goat con la hoja de comida lista: registrar toma 10 segundos.",
    pasos: abrirHoja("🍽️ Comí", "comida"),
    automatizacion: null,
    permisos: [],
    prueba: { metodo: "GET", ruta: "widget" },
  },
  {
    id: "widgets-estudio",
    emoji: "📚",
    nombre: "Estudio",
    para: "Un botón que abre Goat con la hoja de estudio lista para anotar la sesión.",
    pasos: abrirHoja("📚 Estudio", "estudio"),
    automatizacion: null,
    permisos: [],
    prueba: { metodo: "GET", ruta: "widget" },
  },
  {
    id: "widgets-botones",
    emoji: "🧩",
    nombre: "Widget de Atajos",
    para: "Tus registros como 4 botones en la pantalla de inicio: Comí, Movimiento, Estudio y Entreno.",
    pasos: [
      'En Atajos, pestaña Atajos › "‹ Atajos" › "Nueva carpeta" (ícono de carpeta arriba). Llámala "Goat".',
      'Mueve a esa carpeta "🍽️ Comí", "💸 Movimiento", "📚 Estudio" y "🏋️ Entreno" (mantén presionado cada uno › Mover). Todos usan "⚙️ Goat" por dentro, no hay que mover ese.',
      'En la pantalla de inicio, mantén presionado un espacio vacío › "Editar" › "Añadir widget" › Atajos › el mediano (4 botones) › "Añadir widget".',
      'Mantén presionado el widget › "Editar widget" › Carpeta › "Goat". Listo: cada botón corre su atajo sin abrir la app Atajos.',
    ],
    automatizacion: null,
    permisos: [],
    prueba: { metodo: "GET", ruta: "widget" },
  },
];

/** Botones del widget de Atajos (los muestra la vista previa de widgets.html). */
export const BOTONES_ATAJOS = [
  { emoji: "🍽️", nombre: "Comí" },
  { emoji: "💸", nombre: "Movimiento" },
  { emoji: "📚", nombre: "Estudio" },
  { emoji: "🏋️", nombre: "Entreno" },
];

/** Instalación del widget de Scriptable (la muestran widgets.html y el asistente Conectar). */
export const GUIA_SCRIPTABLE = [
  { titulo: "Instala Scriptable", texto: "Es gratis. Es la app que deja tener widgets propios en el iPhone, sin pasar por la App Store." },
  { titulo: "Copia el script", texto: "Un solo archivo para todos los tamaños. No trae tu llave: esa la pones tú, una vez." },
  {
    titulo: "Pégalo en Scriptable",
    texto: 'Abre Scriptable › "+" arriba a la derecha › pega › toca el título "Untitled Script" y escribe Goat › Listo.',
  },
  {
    titulo: "Conéctalo",
    texto: "Toca el script una vez. Te pide la dirección de tu Goat y tu llave, las mismas del atajo ⚙️ Goat. Se guardan en el Llavero del iPhone.",
  },
  {
    titulo: "Pon el widget",
    texto:
      'Mantén presionado un espacio vacío de la pantalla de inicio › "Editar" › "Añadir widget" › Scriptable › elige pequeño, mediano o grande. Tócalo › Script: Goat.',
  },
];

/** Pantalla bloqueada (iOS 16 o más nuevo). */
export const GUIA_BLOQUEO = [
  'Mantén presionada la pantalla bloqueada › "Personalizar" › Pantalla bloqueada.',
  "Toca el recuadro de widgets bajo la hora › Scriptable › elige el circular o el rectangular. Para el de una línea, toca la fecha arriba de la hora.",
  "Toca el widget que pusiste › Script: Goat › Listo.",
];
