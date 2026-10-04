// Atajos base de Goat (formato en .claude/objetivos/00-comun.md › Guía de atajos).
// El asistente "Conectar iPhone" (conectar.html) los muestra en el paso "Tu llave" y en la lista de atajos.
//
// "⚙️ Goat" devuelve un diccionario { url, token }:
//   url   = la dirección de tu Goat, SIN barra al final y SIN /api/v1 (ej. https://tu-goat.vercel.app);
//   token = tu llave (se crea en conectar.html y se ve una sola vez).
// Los demás atajos lo corren con «Ejecutar atajo» y arman cada dirección como url + /api/v1/<ruta>.

export const ATAJOS = [
  {
    id: "conectar-goat",
    emoji: "⚙️",
    nombre: "Goat",
    para: "El atajo base: guarda la dirección de tu Goat y tu llave. Los demás lo usan con «Ejecutar atajo», así nunca repites la llave.",
    pasos: [
      "Abre Atajos › pestaña Atajos › + (arriba a la derecha). Toca el nombre y escribe «⚙️ Goat», con el emoji: los demás atajos lo buscan con ese nombre.",
      "Agrega la acción «Diccionario». Toca «Añadir nuevo elemento» › Texto. Clave: url. Valor: pega la dirección de tu Goat (en Conectar › Tu llave, botón Copiar). Va sin barra al final y sin /api/v1, por ejemplo https://tu-goat.vercel.app.",
      "Toca otra vez «Añadir nuevo elemento» › Texto. Clave: token. Valor: pega tu llave.",
      "Agrega «Detener y generar salida» (búscala escribiendo «Detener») y elige «Diccionario». Así el atajo devuelve la dirección y la llave a quien lo llame.",
      "Toca (i) abajo y desactiva «Mostrar en la hoja para compartir». Toca «Listo».",
      "No compartas este atajo: lleva tu llave. Si pierdes el iPhone, revoca la llave en Goat › Ajustes › Dispositivos conectados.",
    ],
    automatizacion: null,
    permisos: [],
    prueba: null,
  },
  {
    id: "conectar-probar",
    emoji: "🧪",
    nombre: "Goat · Probar",
    para: "Comprueba en dos segundos que tu iPhone habla con Goat. Úsalo cuando algo no funcione.",
    pasos: [
      "Abre Atajos › + y llámalo «🧪 Goat · Probar».",
      "Agrega «Ejecutar atajo» y elige «⚙️ Goat». Toca la flecha y desactiva «Mostrar al ejecutar».",
      "Agrega «Obtener valor del diccionario»: Valor para la clave url en «Resultado del atajo». Debajo, «Definir variable» con el nombre url.",
      "Agrega otra vez «Obtener valor del diccionario»: clave token en «Resultado del atajo». Debajo, «Definir variable» con el nombre token.",
      "Agrega «Obtener contenido de URL». URL: la variable url y justo después /api/v1/ping (sin espacios). Toca «Mostrar más» › Encabezados › «Añadir nuevo encabezado»: clave Authorization, valor «Bearer » (con un espacio) seguido de la variable token.",
      "Agrega «Obtener valor del diccionario»: clave mensaje en «Contenido de URL». Luego «Mostrar notificación» con ese valor.",
      "Tócalo. La primera vez iOS pregunta si puede conectarse a tu Goat («Permitir siempre») y mostrar notificaciones («Permitir»). Debe salir «✅ Conectado». Si sale «👋 Goat responde», la llave no sirve: revisa que la pegaste completa.",
    ],
    automatizacion: null,
    permisos: ["Conectarse a tu Goat (Permitir siempre)", "Notificaciones de Atajos (Permitir)"],
    prueba: { metodo: "GET", ruta: "ping" },
  },
];
