// Guía de los atajos de iPhone de Finanzas (formato en .claude/objetivos/00-comun.md › Guía de atajos).
// El asistente "Conectar iPhone" (conectar.html) las reúne todas.
// El atajo es un cliente delgado: pide el menú a la API, pregunta y manda lo elegido. No calcula nada.

export const ATAJOS = [
  {
    id: "finanzas-movimiento",
    emoji: "💸",
    nombre: "Movimiento",
    para: "Registrar un gasto, ingreso, transferencia, retiro o abono a una deuda en segundos, sin abrir Goat.",
    pasos: [
      "Abre Atajos › toca + (arriba a la derecha) › toca el nombre y escribe «💸 Movimiento».",
      "Agrega «Ejecutar atajo» y elige «⚙️ Goat». Su resultado (la URL y el token) aparece como «Resultado del atajo».",
      "Agrega «Obtener contenido de URL». En URL pon la variable «Resultado del atajo», tócala › «Obtener valor de clave» › escribe url; justo después escribe /api/v1/finanzas/menu.",
      "En esa acción toca «Mostrar más» › Encabezados › «Añadir nuevo encabezado»: clave Authorization y valor «Bearer » (con un espacio) seguido de «Resultado del atajo» con la clave token.",
      "Agrega «Obtener valor del diccionario»: valor de la clave datos en «Contenido de la URL». Luego «Definir variable» con el nombre Menú.",
      "Agrega «Obtener valor del diccionario»: clave opciones_tipo en Menú. Luego «Elegir de la lista» con el mensaje «¿Qué movimiento?» y «Definir variable» Tipo.",
      "Agrega «Obtener valor del diccionario»: clave preguntas en Menú. Después otro «Obtener valor del diccionario» cuya clave es la variable Tipo, y «Definir variable» Pregunta.",
      "Agrega «Pedir entrada»: tipo Número, pregunta «¿Cuánto?». Luego «Definir variable» Valor.",
      "Agrega «Obtener valor del diccionario»: clave categorias en Pregunta. Agrega «Si» › «tiene cualquier valor». Dentro: «Elegir de la lista» («¿Qué categoría?») y «Definir variable» Categoría; después otro «Si» Categoría «es» ✏️ Otro… con «Pedir entrada» (Texto, «¿Cuál categoría?») y «Definir variable» Otra.",
      "Agrega «Obtener valor del diccionario»: clave deudas en Pregunta. «Si» tiene cualquier valor: «Elegir de la lista» («¿Cuál deuda?») y «Definir variable» Deuda.",
      "Agrega «Obtener valor del diccionario»: clave cuentas en Pregunta, y «Elegir de la lista». Como mensaje usa Pregunta con la clave pregunta_cuenta. Luego «Definir variable» Cuenta.",
      "Agrega «Obtener valor del diccionario»: clave destinos en Pregunta. «Si» tiene cualquier valor: «Elegir de la lista» («¿Hacia dónde?») y «Definir variable» Destino.",
      "Agrega «Pedir entrada»: tipo Texto, pregunta «Descripción (opcional)», y «Definir variable» Descripción. Puedes dejarla vacía.",
      "Agrega «Obtener contenido de URL» con la URL de «⚙️ Goat» + /api/v1/finanzas/movimientos, Método POST, el mismo encabezado Authorization y Cuerpo JSON: tipo = Tipo, monto = Valor (Número), categoria = Categoría, categoria_otra = Otra, deuda = Deuda, cuenta = Cuenta, cuenta_destino = Destino, descripcion = Descripción, origen = atajo.",
      "Agrega «Obtener valor del diccionario»: clave mensaje en «Contenido de la URL», y «Mostrar notificación» con ese valor. Dirá algo como «💸 Guardado · Comida» (nunca montos).",
      "Para tenerlo a un toque: en el atajo toca (i) › «Añadir a pantalla de inicio», o ponlo en Ajustes › Accesibilidad › Tocar › Toque posterior, o en el widget de Atajos.",
    ],
    automatizacion: null,
    permisos: ["Conexión a tu web de Goat (iOS pregunta la primera vez que el atajo usa internet: toca «Permitir siempre»)"],
    prueba: { metodo: "GET", ruta: "finanzas/menu" },
  },
];
