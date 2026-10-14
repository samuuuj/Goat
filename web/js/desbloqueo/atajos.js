// Atajos del iPhone de Tu tiempo. Las guías de atajos viven en web/js/conectar/guias.js (D-063): aquí solo se eligen.
// GUIA: lo que no es un atajo (qué es la puerta, el candado de Tiempo en pantalla y Safari).

import { atajosDe } from "../conectar/guias.js";

export const ATAJOS = atajosDe("desbloqueo");

export const GUIA = {
  friccion: [
    "Una web no puede bloquear apps en el iPhone. Goat usa una automatización: al abrir TikTok, el atajo le pregunta a Goat y, si no tienes minutos, te manda a la pantalla de inicio y te dice qué registrar.",
    "Es un freno, no un candado: si vuelves a abrir la app, la puerta vuelve a preguntar. Lo que sí cuenta es que cada intento queda anotado.",
    "La puerta revisa al abrir; no te saca a mitad de un video. Si te pasas, se descuenta y el contador queda en 0, nunca en negativo.",
    "Sin internet, la puerta deja pasar. Prefiere dejarte entrar a molestarte por una falla.",
  ],
  candado: {
    titulo: "Candado de verdad (opcional)",
    pasos: [
      "Ajustes › Tiempo en pantalla › Límites de apps › Agregar límite.",
      "Elige TikTok, Instagram, YouTube y tus juegos › Siguiente › pon un tope diario (por ejemplo 1 h 30, el máximo que Goat te da) › activa «Bloquear al final del límite».",
      "Ajustes › Tiempo en pantalla › «Bloquear ajustes de Tiempo en pantalla»: pide a otra persona que escriba el código y lo guarde. Sin el código no puedes darte «un minuto más».",
      "Ese tope es fijo: Goat no lo puede cambiar solo (iOS no deja que una web ni un atajo toquen Tiempo en pantalla). Úsalo como techo y deja que Goat decida lo de cada día.",
    ],
  },
  safari: {
    titulo: "Cierra la puerta de Safari",
    pasos: [
      "La automatización solo ve la app, no la página web. Para que no te escapes por Safari:",
      "Ajustes › Tiempo en pantalla › Restricciones de contenido y privacidad (actívalo) › Restricciones de contenido › Contenido web › Limitar sitios web para adultos.",
      "En «Nunca permitir» toca «Agregar sitio web» y escribe tiktok.com, instagram.com y youtube.com.",
      "Los nombres pueden variar un poco según tu versión de iOS.",
    ],
  },
};
