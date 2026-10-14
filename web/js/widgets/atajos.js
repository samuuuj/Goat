// Widgets: el widget de Scriptable (GUIA_SCRIPTABLE, GUIA_BLOQUEO) y los botones del widget de Atajos.
// Las guías de atajos viven en web/js/conectar/guias.js (D-063): aquí solo se eligen. Los botones son atajos
// de 2 bloques que abren «🐐 Goat» directo en un registro (Texto «dinero» › Ejecutar atajo 🐐 Goat).

import { atajosDe } from "../conectar/guias.js";

export const ATAJOS = atajosDe("widgets");

/** Botones del widget de Atajos (los muestra la vista previa de widgets.html). */
export const BOTONES_ATAJOS = [
  { emoji: "💸", nombre: "Dinero" },
  { emoji: "🍽️", nombre: "Comí" },
  { emoji: "✅", nombre: "Terminé" },
  { emoji: "🎯", nombre: "¿Qué hago?" },
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
