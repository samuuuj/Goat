// Guía de los atajos de iPhone del desbloqueo (formato en .claude/objetivos/00-comun.md › Guía de atajos).
// El asistente "Conectar iPhone" (conectar.html) las reúne todas; desbloqueo.html también las muestra.
// Nombres de acciones como aparecen en Atajos en español (iOS 17/18).

const CONECTAR_GOAT = [
  "Agrega la acción «Ejecutar atajo» y elige «⚙️ Goat» (te devuelve tu dirección y tu llave).",
  "Agrega «Obtener valor del diccionario»: Obtener Valor para la clave url en «Resultado del atajo». Debajo, «Ajustar variable» con el nombre url.",
  "Agrega otra vez «Obtener valor del diccionario»: Obtener Valor para la clave token en «Resultado del atajo». Debajo, «Ajustar variable» con el nombre token.",
];

const ENCABEZADO = "Toca «Mostrar más». En Encabezados toca «Añadir nuevo encabezado»: Clave Authorization, Texto Bearer y un espacio, y luego la variable token.";

export const ATAJOS = [
  {
    id: "desbloqueo-puerta",
    emoji: "🔒",
    nombre: "Puerta",
    para: "Cada vez que abres TikTok, Instagram, YouTube o un juego, le pregunta a Goat si tienes minutos. Si no, te manda al inicio y te dice qué registrar.",
    pasos: [
      "Abre Atajos › pestaña Atajos › ＋. Toca el nombre de arriba y llámalo 🔒 Puerta.",
      ...CONECTAR_GOAT,
      "Agrega «Texto» y escribe: la variable url, luego /desbloqueo/gate?app= y al final la variable «Entrada del atajo» (sin espacios).",
      `Agrega «Obtener contenido de URL» con ese Texto. Método: GET. ${ENCABEZADO}`,
      "Agrega «Obtener valor del diccionario»: Obtener Valor para la clave datos.accion en «Contenido de URL». (Si tu iPhone no acepta el punto, usa dos acciones: primero la clave datos y luego accion.)",
      "Agrega «Si»: «Valor del diccionario» · es · bloquear. Lo que sigue va DENTRO del Si:",
      "«Ir a la pantalla de inicio».",
      "«Obtener valor del diccionario»: Valor para mensaje en «Contenido de URL». Luego «Mostrar notificación» con ese Valor del diccionario.",
      "«Elegir del menú» con la indicación «Valor del diccionario» (el mensaje) y tres opciones: 📝 Registrar ahora · 🆘 Usar pase · Ahora no.",
      "En 📝 Registrar ahora: «Obtener valor del diccionario» con la clave datos.abrir en «Contenido de URL», y luego «Abrir URL» con ese valor (abre el atajo o la página que registra lo que falta).",
      `En 🆘 Usar pase: «Texto» con la variable url y /desbloqueo/pase. «Obtener contenido de URL» con ese Texto, Método POST, el mismo encabezado Authorization, y en Cuerpo de la solicitud elige JSON › «Añadir nuevo campo» › Texto: clave app, valor «Entrada del atajo». Después «Obtener valor del diccionario» con la clave mensaje y «Mostrar notificación» con ese valor.`,
      "En Ahora no: no pongas nada.",
      "Opcional: en «De lo contrario» del Si, «Mostrar notificación» con el mensaje para ver cuántos minutos te quedan (ej. ✅ 42 min en TikTok).",
      "Si no hay internet, «Obtener contenido de URL» falla, el atajo se detiene y la app queda abierta: sin conexión, la puerta deja pasar.",
      "Tócalo una vez desde Atajos para que iOS pregunte si puede conectarse a Goat y mostrar notificaciones: toca «Permitir siempre» / «Permitir».",
    ],
    automatizacion: {
      disparador: "App › TikTok (y cada app o juego) › Se abre",
      pasos: [
        "Atajos › pestaña Automatización › ＋ › App.",
        "Toca «Elegir», marca TikTok y toca «Listo». Deja marcado solo «Se abre».",
        "Elige «Ejecutar inmediatamente» y apaga «Notificar al ejecutar». Toca «Siguiente».",
        "Toca «Nuevo atajo en blanco». Agrega «Texto» y escribe tiktok (en minúsculas).",
        "Agrega «Ejecutar atajo», elige «🔒 Puerta» (su entrada es el Texto de arriba). Toca «Listo».",
        "Repite con Instagram (texto instagram), YouTube (texto youtube) y cada juego, con el texto que te muestra la página Tu tiempo.",
      ],
    },
    permisos: ["Conectarse a Goat (Permitir siempre)", "Notificaciones de Atajos (para el aviso)"],
    prueba: { metodo: "GET", ruta: "desbloqueo/estado" },
  },
  {
    id: "desbloqueo-cerre",
    emoji: "🔓",
    nombre: "Cerré app",
    para: "Cuando sales de la app, anota el cierre para descontar solo el tiempo que de verdad la usaste.",
    pasos: [
      "Abre Atajos › pestaña Atajos › ＋. Llámalo 🔓 Cerré app.",
      ...CONECTAR_GOAT,
      "Agrega «Texto»: la variable url y luego /desbloqueo/evento.",
      `Agrega «Obtener contenido de URL» con ese Texto. Método: POST. ${ENCABEZADO}`,
      "En Cuerpo de la solicitud elige JSON y agrega dos campos de Texto: app = «Entrada del atajo» y evento = cerrar.",
      "No agregues notificaciones: corre en silencio.",
      "Tócalo una vez desde Atajos y acepta «Permitir siempre» cuando pregunte por Goat.",
    ],
    automatizacion: {
      disparador: "App › TikTok (y cada app o juego) › Se cierra",
      pasos: [
        "Atajos › pestaña Automatización › ＋ › App.",
        "Toca «Elegir», marca TikTok y toca «Listo». Deja marcado solo «Se cierra».",
        "Elige «Ejecutar inmediatamente» y apaga «Notificar al ejecutar». Toca «Siguiente».",
        "Toca «Nuevo atajo en blanco». Agrega «Texto» y escribe tiktok.",
        "Agrega «Ejecutar atajo» y elige «🔓 Cerré app». Toca «Listo».",
        "Repite para Instagram, YouTube y cada juego. Son dos automatizaciones por app: una al abrir y otra al cerrar.",
      ],
    },
    permisos: ["Conectarse a Goat (Permitir siempre)"],
    prueba: { metodo: "GET", ruta: "desbloqueo/estado" },
  },
];

/** Lo que conviene saber antes de armarlos (desbloqueo.html lo muestra tal cual). */
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
