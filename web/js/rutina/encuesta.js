// Encuesta para crear la rutina: un asistente estilo "Configura tu iPhone", una pregunta por pantalla,
// selectores grandes. Con las respuestas, generarPlantilla() (logica.js) arma la semana.
// Todo se dibuja con createElement + textContent (CSP estricta: nada de innerHTML ni estilos en línea).

import { chips } from "../piezas/chips.js";
import { DIAS, ENCUESTA_BASE, aHora, aMinutos, bloquesDelDia, choques, duracionTexto, emojiDe, enlaceSeguro, generarPlantilla, textoDias } from "./logica.js";

const $ = (id) => document.getElementById(id);

/** Lunes de una semana cualquiera, solo para ver la plantilla por día en la vista previa. */
const LUNES_MUESTRA = "2026-10-05";

let contador = 0;
const idNuevo = (prefijo) => `${prefijo}-${++contador}`;

function el(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;
  return e;
}

function boton(texto, clase, alTocar) {
  const b = el("button", clase, texto);
  b.type = "button";
  b.addEventListener("click", alTocar);
  return b;
}

// ── Controles grandes ────────────────────────────────────────────────────

/** Hora grande (en el iPhone abre la rueda) + atajos de horas comunes. */
function campoHora(etiqueta, valor, alCambiar, rapidas = []) {
  const caja = el("div", "campo-encuesta");
  const id = idNuevo("hora");
  const titulo = el("label", "etiqueta", etiqueta);
  titulo.htmlFor = id;
  const entrada = el("input", "titular cifras hora-grande");
  entrada.type = "time";
  entrada.id = id;
  entrada.step = 300;
  entrada.value = valor;
  entrada.required = true;
  caja.append(titulo, entrada);
  if (rapidas.length) {
    const fila = el("div", "chips");
    fila.setAttribute("role", "radiogroup");
    fila.setAttribute("aria-label", `${etiqueta}: horas comunes`);
    const selector = chips(fila, (v) => {
      entrada.value = v;
      alCambiar(v);
    });
    selector.opciones(rapidas.map((h) => ({ valor: h, texto: h })));
    selector.poner(valor);
    entrada.addEventListener("input", () => selector.poner(entrada.value));
    caja.append(fila);
  }
  entrada.addEventListener("input", () => {
    if (aMinutos(entrada.value) !== null) alCambiar(entrada.value);
  });
  return caja;
}

/** − 45 min + (pasos de 5) + duraciones comunes. */
function campoMinutos(etiqueta, valor, alCambiar, { min = 5, max = 240, paso = 5, rapidas = [] } = {}) {
  let actual = valor;
  const caja = el("div", "campo-encuesta");
  const titulo = el("p", "etiqueta", etiqueta);
  const fila = el("div", "paso-a-paso");
  const salida = el("output", "titular cifras minutos-grande");
  salida.setAttribute("aria-live", "polite");
  const texto = (m) => (m === 0 ? "Nada" : duracionTexto(m));
  let selector = null;
  const poner = (m) => {
    actual = Math.min(Math.max(m, min), max);
    salida.textContent = texto(actual);
    menos.disabled = actual <= min;
    mas.disabled = actual >= max;
    selector?.poner(String(actual));
    alCambiar(actual);
  };
  const menos = boton("−", "boton-redondo", () => poner(actual - paso));
  menos.setAttribute("aria-label", `${etiqueta}: ${paso} minutos menos`);
  const mas = boton("+", "boton-redondo", () => poner(actual + paso));
  mas.setAttribute("aria-label", `${etiqueta}: ${paso} minutos más`);
  fila.append(menos, salida, mas);
  caja.append(titulo, fila);
  if (rapidas.length) {
    const lista = el("div", "chips");
    lista.setAttribute("role", "radiogroup");
    lista.setAttribute("aria-label", `${etiqueta}: duraciones comunes`);
    selector = chips(lista, (v) => poner(Number(v)));
    selector.opciones(rapidas.map((m) => ({ valor: String(m), texto: texto(m) })));
    caja.append(lista);
  }
  poner(actual);
  return caja;
}

/** L M M J V S D como botones que se prenden y apagan (siempre queda al menos uno). */
function campoDias(etiqueta, dias, alCambiar) {
  const caja = el("div", "campo-encuesta");
  const titulo = el("p", "etiqueta", etiqueta);
  const grupo = el("div", "dias");
  grupo.setAttribute("role", "group");
  grupo.setAttribute("aria-label", etiqueta);
  const resumen = el("p", "campo-ayuda");
  let elegidos = new Set(dias);
  const pintar = () => {
    for (const b of grupo.children) b.setAttribute("aria-pressed", String(elegidos.has(Number(b.dataset.dia))));
    resumen.textContent = textoDias([...elegidos]);
  };
  for (const d of DIAS) {
    const b = boton(d.corto, "dia-boton", () => {
      if (elegidos.has(d.n) && elegidos.size === 1) return;
      if (elegidos.has(d.n)) elegidos.delete(d.n);
      else elegidos.add(d.n);
      pintar();
      alCambiar([...elegidos].sort((a, c) => a - c));
    });
    b.dataset.dia = d.n;
    b.setAttribute("aria-label", d.nombre);
    grupo.append(b);
  }
  pintar();
  caja.append(titulo, grupo, resumen);
  return caja;
}

/** Tarjetas grandes de una opción (Sí / No, 50/10 / 25/5). */
function campoOpciones(etiqueta, opciones, valor, alCambiar) {
  const grupo = el("div", "opciones");
  grupo.setAttribute("role", "radiogroup");
  grupo.setAttribute("aria-label", etiqueta);
  const pintar = (v) => {
    for (const b of grupo.children) b.setAttribute("aria-checked", String(b.dataset.valor === String(v)));
  };
  for (const o of opciones) {
    const b = boton(null, "opcion", () => {
      pintar(o.valor);
      alCambiar(o.valor);
    });
    b.setAttribute("role", "radio");
    b.dataset.valor = String(o.valor);
    if (o.emoji) b.append(el("span", "opcion-emoji", o.emoji));
    b.append(el("span", "opcion-titulo", o.titulo));
    if (o.texto) b.append(el("span", "opcion-texto", o.texto));
    grupo.append(b);
  }
  pintar(valor);
  return grupo;
}

const siNo = (etiqueta, valor, alCambiar, si, no) =>
  campoOpciones(etiqueta, [{ valor: "si", emoji: si.emoji, titulo: si.titulo }, { valor: "no", emoji: no.emoji, titulo: no.titulo }], valor ? "si" : "no", (v) =>
    alCambiar(v === "si"),
  );

function interruptor(texto, ayuda, valor, alCambiar) {
  const caja = el("label", "interruptor");
  const entrada = el("input");
  entrada.type = "checkbox";
  entrada.setAttribute("role", "switch");
  entrada.checked = valor;
  entrada.addEventListener("change", () => alCambiar(entrada.checked));
  const textos = el("span", "interruptor-textos");
  textos.append(el("span", "interruptor-titulo", texto));
  if (ayuda) textos.append(el("span", "interruptor-ayuda", ayuda));
  caja.append(textos, entrada, el("span", "interruptor-pista"));
  return caja;
}

function campoTexto(etiqueta, valor, alCambiar, { tipo = "text", max = 60, ayuda = "", modo } = {}) {
  const caja = el("label", "campo-encuesta");
  caja.append(el("span", "etiqueta", etiqueta));
  const entrada = el("input", "entrada");
  entrada.type = tipo;
  entrada.maxLength = max;
  entrada.value = valor ?? "";
  entrada.autocomplete = "off";
  if (ayuda) entrada.placeholder = ayuda;
  if (modo) entrada.inputMode = modo;
  entrada.addEventListener("input", () => alCambiar(entrada.value));
  caja.append(entrada);
  return caja;
}

/** Muestra u oculta un bloque según una condición (se llama al cambiar la respuesta). */
function dependiente(nodos, condicion) {
  const caja = el("div", "dependiente");
  caja.append(...nodos);
  const actualizar = () => (caja.hidden = !condicion());
  actualizar();
  return { caja, actualizar };
}

// ── Clases y trabajos (listas que se agregan) ────────────────────────────

const LISTAS = {
  presencial: { nombre: "clase", campo: "lugar", etiquetaCampo: "Lugar (salón, bloque)", dias: [2, 3], inicio: "09:00", fin: "11:00" },
  virtual: { nombre: "clase virtual", campo: "enlace", etiquetaCampo: "Enlace (https://…)", dias: [1], inicio: "18:00", fin: "20:00" },
  uni: { nombre: "horario de trabajos", campo: null, dias: [2, 4], inicio: "14:00", fin: "16:00" },
};

function listaEditable(lista, clase, alCambiar) {
  const cfg = LISTAS[clase];
  const caja = el("div", "lista-encuesta");
  const filas = el("ul", "lista-agrupada");
  const vacio = el("p", "campo-ayuda", clase === "uni" ? "Sin horarios fijos todavía." : "Sin clases todavía. Si no tienes, toca Siguiente.");

  const pintarFilas = () => {
    filas.replaceChildren(
      ...lista.map((item, i) => {
        const li = el("li", "fila");
        const texto = el("span", "fila-texto");
        texto.append(el("span", "fila-titulo", item.materia || item.titulo || (clase === "uni" ? "Trabajos de la U" : "Clase")));
        texto.append(el("span", "fila-detalle", `${textoDias(item.dias)} · ${item.inicio}–${item.fin}${item.lugar ? ` · ${item.lugar}` : ""}`));
        const quitar = boton("✕", "boton-circulo", () => {
          lista.splice(i, 1);
          pintarFilas();
          alCambiar();
        });
        quitar.setAttribute("aria-label", `Quitar ${item.materia || "este horario"}`);
        li.append(el("span", "fila-icono", clase === "virtual" ? "💻" : clase === "uni" ? "📝" : "🏫"), texto, quitar);
        return li;
      }),
    );
    filas.hidden = lista.length === 0;
    vacio.hidden = lista.length > 0;
  };

  // Formulario corto para agregar una más.
  const nuevo = { materia: "", dias: [...cfg.dias], inicio: cfg.inicio, fin: cfg.fin, lugar: "", enlace: "" };
  const formulario = el("div", "agregar-item tarjeta");
  formulario.hidden = true;
  const error = el("p", "error-form");
  error.setAttribute("role", "alert");
  const horas = el("div", "dos-columnas");
  const hora = (etiqueta, clave) => {
    const c = el("label", "campo-encuesta");
    c.append(el("span", "etiqueta", etiqueta));
    const entrada = el("input", "entrada");
    entrada.type = "time";
    entrada.step = 300;
    entrada.value = nuevo[clave];
    entrada.addEventListener("input", () => (nuevo[clave] = entrada.value));
    c.append(entrada);
    return c;
  };
  horas.append(hora("Empieza", "inicio"), hora("Termina", "fin"));
  formulario.append(
    campoTexto(clase === "uni" ? "Para qué (opcional)" : "Materia", "", (v) => (nuevo.materia = v), { ayuda: clase === "uni" ? "Proyecto final" : "Cálculo" }),
    campoDias("Días", nuevo.dias, (d) => (nuevo.dias = d)),
    horas,
  );
  if (cfg.campo) {
    formulario.append(
      campoTexto(cfg.etiquetaCampo, "", (v) => (nuevo[cfg.campo] = v), {
        tipo: cfg.campo === "enlace" ? "url" : "text",
        max: cfg.campo === "enlace" ? 300 : 80,
        modo: cfg.campo === "enlace" ? "url" : undefined,
        ayuda: cfg.campo === "enlace" ? "https://meet.google.com/…" : "Bloque 5, salón 301",
      }),
    );
  }
  const agregar = boton(`Añadir ${cfg.nombre}`, "boton-principal", () => {
    const a = aMinutos(nuevo.inicio);
    const b = aMinutos(nuevo.fin);
    if (a === null || b === null || a === b) return (error.textContent = "Revisa las horas: deben ser distintas.");
    if (cfg.campo === "enlace" && nuevo.enlace.trim() && !enlaceSeguro(nuevo.enlace)) {
      return (error.textContent = "El enlace debe empezar por https://");
    }
    error.textContent = "";
    lista.push({
      materia: nuevo.materia.trim().slice(0, 60),
      titulo: clase === "uni" ? nuevo.materia.trim().slice(0, 60) : undefined,
      dias: [...nuevo.dias],
      inicio: nuevo.inicio,
      fin: nuevo.fin,
      lugar: cfg.campo === "lugar" ? nuevo.lugar.trim().slice(0, 80) : undefined,
      enlace: cfg.campo === "enlace" ? enlaceSeguro(nuevo.enlace) ?? undefined : undefined,
    });
    formulario.hidden = true;
    abrir.hidden = false;
    pintarFilas();
    alCambiar();
    abrir.focus();
  });
  formulario.append(error, agregar);

  const abrir = boton(`＋ Agregar ${cfg.nombre}`, "boton-secundario", () => {
    formulario.hidden = false;
    abrir.hidden = true;
    formulario.querySelector("input")?.focus();
  });

  pintarFilas();
  caja.append(vacio, filas, abrir, formulario);
  return caja;
}

// ── Pasos ────────────────────────────────────────────────────────────────

const PASOS = [
  {
    id: "inicio",
    titulo: "Armemos tu día.",
    ayuda: "12 preguntas cortas, una por pantalla. Con tus respuestas Goat arma tu semana y después ajustas cada bloque.",
    boton: "Empezar",
    pintar() {
      const lista = el("ul", "encuesta-indice");
      for (const [emoji, texto] of [
        ["⏰", "Levantarte, caminar y desayunar"],
        ["🎯", "Trabajo útil con pausas"],
        ["🏋️", "Comidas, ejercicio y estudio"],
        ["🏫", "Clases presenciales y virtuales"],
        ["📝", "Horas para trabajos de la U"],
      ]) {
        const li = el("li");
        li.append(el("span", "encuesta-indice-emoji", emoji), el("span", null, texto));
        lista.append(li);
      }
      return [lista];
    },
  },
  {
    id: "despertar",
    titulo: "¿A qué hora te levantas?",
    ayuda: "La hora a la que quieres levantarte, aunque hoy todavía no lo logres.",
    pintar(r) {
      const finde = dependiente(
        [campoHora("Fines de semana", r.despertar.finDeSemana ?? "07:30", (v) => (r.despertar.finDeSemana = v), ["07:00", "07:30", "08:00", "09:00"])],
        () => r.despertar.finDeSemana !== null,
      );
      return [
        campoHora("Días de semana", r.despertar.habil, (v) => (r.despertar.habil = v), ["05:30", "06:00", "06:30", "07:00"]),
        interruptor("Otra hora el fin de semana", null, r.despertar.finDeSemana !== null, (si) => {
          r.despertar.finDeSemana = si ? "07:30" : null;
          finde.actualizar();
        }),
        finde.caja,
      ];
    },
  },
  {
    id: "caminata",
    titulo: "¿Caminas al despertar?",
    ayuda: "Queda como obligatoria: es lo primero que te activa.",
    pintar(r) {
      const minutos = dependiente([campoMinutos("Cuánto", r.caminata.minutos, (m) => (r.caminata.minutos = m), { min: 10, max: 120, rapidas: [20, 30, 45, 60] })], () => r.caminata.activa);
      return [
        siNo("¿Caminas al despertar?", r.caminata.activa, (v) => {
          r.caminata.activa = v;
          minutos.actualizar();
        }, { emoji: "🚶", titulo: "Sí, camino" }, { emoji: "🛏️", titulo: "No" }),
        minutos.caja,
      ];
    },
  },
  {
    id: "desayuno",
    titulo: "Desayuno.",
    ayuda: "Preparar y comer, sin afán. Va justo después de caminar.",
    pintar(r) {
      return [
        campoMinutos("Preparar", r.desayuno.preparar, (m) => (r.desayuno.preparar = m), { min: 0, max: 60, rapidas: [0, 10, 15, 20] }),
        campoMinutos("Comer", r.desayuno.comer, (m) => (r.desayuno.comer = m), { min: 10, max: 60, rapidas: [15, 20, 30] }),
      ];
    },
  },
  {
    id: "trabajo",
    titulo: "Trabajo útil.",
    ayuda: "Bloques de foco con pausas en medio. Si un día tienes clase a esa hora, Goat lo corre solo.",
    pintar(r) {
      const horas = el("div", "campo-encuesta");
      horas.append(el("p", "etiqueta", "Cuántas horas"));
      const fila = el("div", "chips");
      fila.setAttribute("role", "radiogroup");
      fila.setAttribute("aria-label", "Cuántas horas");
      const selector = chips(fila, (v) => (r.trabajo.horas = Number(v)));
      selector.opciones([2, 3, 4, 5, 6].map((h) => ({ valor: String(h), texto: `${h} h` })));
      selector.poner(String(r.trabajo.horas));
      horas.append(fila);
      return [
        campoHora("Desde", r.trabajo.inicio, (v) => (r.trabajo.inicio = v), ["07:30", "08:00", "08:30", "09:00"]),
        horas,
        campoOpciones(
          "Ritmo",
          [
            { valor: "50/10", emoji: "🎯", titulo: "50 / 10", texto: "50 min de foco y 10 de pausa. Para trabajo profundo." },
            { valor: "25/5", emoji: "🍅", titulo: "25 / 5", texto: "Pomodoro: 25 de foco y 5 de pausa. Para arrancar cuando cuesta." },
          ],
          r.trabajo.ritmo,
          (v) => (r.trabajo.ritmo = v),
        ),
        campoDias("Qué días", r.trabajo.dias, (d) => (r.trabajo.dias = d)),
      ];
    },
  },
  {
    id: "almuerzo",
    titulo: "Almuerzo.",
    ayuda: "Una hora fija ayuda a no saltártelo.",
    pintar(r) {
      return [
        campoHora("A qué hora", r.almuerzo.hora, (v) => (r.almuerzo.hora = v), ["12:00", "12:30", "13:00"]),
        campoMinutos("Cuánto", r.almuerzo.minutos, (m) => (r.almuerzo.minutos = m), { min: 15, max: 120, rapidas: [30, 45, 60] }),
      ];
    },
  },
  {
    id: "ejercicio",
    titulo: "Ejercicio.",
    ayuda: "Gym, trote o lo que hagas. Es obligatorio: ocupa su espacio en la semana.",
    pintar(r) {
      const detalle = dependiente(
        [
          campoDias("Qué días", r.ejercicio.dias, (d) => (r.ejercicio.dias = d)),
          campoHora("A qué hora", r.ejercicio.hora, (v) => (r.ejercicio.hora = v), ["06:30", "17:00", "18:00", "19:00"]),
          campoMinutos("Cuánto", r.ejercicio.minutos, (m) => (r.ejercicio.minutos = m), { min: 15, max: 180, rapidas: [45, 60, 90] }),
          interruptor("Obligatorio", "Si no lo marcas 30 min después de terminar, aparece en lo que falta.", r.ejercicio.obligatorio !== false, (v) => (r.ejercicio.obligatorio = v)),
        ],
        () => r.ejercicio.activo,
      );
      return [
        siNo("¿Haces ejercicio?", r.ejercicio.activo, (v) => {
          r.ejercicio.activo = v;
          detalle.actualizar();
        }, { emoji: "🏋️", titulo: "Sí" }, { emoji: "⏸️", titulo: "Por ahora no" }),
        detalle.caja,
      ];
    },
  },
  {
    id: "cena",
    titulo: "Cena y caminata.",
    ayuda: "Una caminata corta después de cenar también queda como obligatoria.",
    pintar(r) {
      const caminata = dependiente(
        [campoMinutos("Cuánto caminas", r.caminataNoche.minutos, (m) => (r.caminataNoche.minutos = m), { min: 10, max: 90, rapidas: [15, 20, 30] })],
        () => r.caminataNoche.activa,
      );
      return [
        campoHora("Cena", r.cena.hora, (v) => (r.cena.hora = v), ["18:30", "19:00", "19:30", "20:00"]),
        campoMinutos("Cuánto", r.cena.minutos, (m) => (r.cena.minutos = m), { min: 15, max: 90, rapidas: [20, 30, 45] }),
        siNo("¿Caminas después de cenar?", r.caminataNoche.activa, (v) => {
          r.caminataNoche.activa = v;
          caminata.actualizar();
        }, { emoji: "🚶", titulo: "Sí, camino" }, { emoji: "🛋️", titulo: "No" }),
        caminata.caja,
      ];
    },
  },
  {
    id: "estudio",
    titulo: "Estudio.",
    ayuda: "Tu rato fijo para repasar, aparte de las clases.",
    pintar(r) {
      const detalle = dependiente(
        [
          campoDias("Qué días", r.estudio.dias, (d) => (r.estudio.dias = d)),
          campoHora("A qué hora", r.estudio.hora, (v) => (r.estudio.hora = v), ["19:00", "20:00", "21:00"]),
          campoMinutos("Cuánto", r.estudio.minutos, (m) => (r.estudio.minutos = m), { min: 25, max: 240, rapidas: [50, 90, 120] }),
        ],
        () => r.estudio.activo,
      );
      return [
        siNo("¿Estudias en un horario fijo?", r.estudio.activo, (v) => {
          r.estudio.activo = v;
          detalle.actualizar();
        }, { emoji: "📚", titulo: "Sí" }, { emoji: "🤷", titulo: "No" }),
        detalle.caja,
      ];
    },
  },
  {
    id: "presenciales",
    titulo: "Clases presenciales.",
    ayuda: "Agrega cada materia con sus días y horas (ej. martes y miércoles). El recordatorio te avisa 15 min antes.",
    pintar(r, alCambiar) {
      return [listaEditable(r.clasesPresenciales, "presencial", alCambiar)];
    },
  },
  {
    id: "virtuales",
    titulo: "Clases virtuales.",
    ayuda: "Con su enlace: te llega en el recordatorio y entras con un toque.",
    pintar(r, alCambiar) {
      return [listaEditable(r.clasesVirtuales, "virtual", alCambiar)];
    },
  },
  {
    id: "trabajos",
    titulo: "Trabajos de la U.",
    ayuda: "Horas fijas para talleres, informes y proyectos. Las tareas con fecha las anotas aparte.",
    pintar(r, alCambiar) {
      return [listaEditable(r.trabajosUni, "uni", alCambiar)];
    },
  },
  {
    id: "dormir",
    titulo: "¿A qué hora te acuestas?",
    ayuda: "",
    pintar(r) {
      const sugerida = aHora((aMinutos(r.despertar.habil) ?? 360) - 8 * 60);
      const ayuda = el("p", "campo-ayuda", `Para dormir 8 horas y levantarte a las ${r.despertar.habil}, acuéstate hacia las ${sugerida}.`);
      return [campoHora("A dormir", r.dormir.hora, (v) => (r.dormir.hora = v), [...new Set([sugerida, "21:30", "22:00", "22:30", "23:00"])].sort()), ayuda];
    },
  },
  {
    id: "vista",
    titulo: "Tu semana.",
    ayuda: "Así queda. Después puedes cambiar cualquier bloque.",
    pintar(r) {
      return vistaPrevia(generarPlantilla(r));
    },
  },
];

/** Vista previa: día por día, choques en naranja. */
function vistaPrevia(filas) {
  const lista = choques(filas);
  const nodos = [];
  const resumen = el("p", "vista-resumen cifras");
  const obligatorios = filas.filter((f) => f.obligatorio).reduce((n, f) => n + f.dias.length, 0);
  resumen.textContent = `${filas.length} bloques · ${obligatorios} obligatorios a la semana · ${lista.length ? `${lista.length} ${lista.length === 1 ? "choque" : "choques"}` : "sin choques"}`;
  nodos.push(resumen);

  if (lista.length) {
    const avisos = el("ul", "choques-lista");
    for (const c of lista.slice(0, 6)) {
      avisos.append(el("li", null, `⚠️ ${textoDias(c.dias)} ${c.desde}–${c.hasta}: ${c.a.titulo} y ${c.b.titulo}`));
    }
    nodos.push(avisos);
  }

  const dias = el("div", "chips vista-dias");
  dias.setAttribute("role", "radiogroup");
  dias.setAttribute("aria-label", "Día");
  const contenido = el("ol", "vista-dia");
  const pintarDia = (n) => {
    const fecha = new Date(Date.parse(`${LUNES_MUESTRA}T12:00:00Z`) + (Number(n) - 1) * 86_400_000).toISOString().slice(0, 10);
    contenido.replaceChildren(
      ...bloquesDelDia(filas, fecha).map((b) => {
        const li = el("li", `vista-bloque${b.tipo === "descanso" ? " es-pausa" : ""}`);
        li.append(el("span", "vista-hora cifras", aHora(b.inicioMin)), el("span", "vista-emoji", emojiDe(b.tipo)));
        const texto = el("span", "vista-titulo", b.titulo);
        li.append(texto, el("span", "vista-duracion cifras", duracionTexto(b.duracion_min)));
        if (b.obligatorio) {
          const punto = el("span", "punto-obligatorio", "●");
          punto.setAttribute("aria-label", "obligatorio");
          li.append(punto);
        }
        return li;
      }),
    );
  };
  const selector = chips(dias, pintarDia);
  selector.opciones(DIAS.map((d) => ({ valor: String(d.n), texto: d.abrev })));
  selector.poner("1");
  pintarDia(1);
  nodos.push(dias, contenido);
  return nodos;
}

// ── El asistente ─────────────────────────────────────────────────────────

/**
 * Abre la encuesta a pantalla completa.
 * `respuestas`: las guardadas (para rehacer) o nada. `reemplaza`: ya hay una rutina (cambia el botón final).
 * `alCrear(filas, respuestas)`: guarda; si falla, lanza y la encuesta sigue abierta.
 */
export function abrirEncuesta({ respuestas = null, reemplaza = false, alCrear }) {
  const r = structuredClone({ ...ENCUESTA_BASE, ...(respuestas ?? {}) });
  for (const clave of ["clasesPresenciales", "clasesVirtuales", "trabajosUni"]) r[clave] = Array.isArray(r[clave]) ? r[clave] : [];

  const caja = $("encuesta");
  const cuerpo = $("encuesta-cuerpo");
  const siguienteBoton = $("encuesta-siguiente");
  const atras = $("encuesta-atras");
  const cerrarBoton = $("encuesta-cerrar");
  const relleno = $("encuesta-relleno");
  const fondo = [...document.body.children].filter((e) => e !== caja && !e.classList.contains("aviso-zona") && e.tagName !== "TEMPLATE");
  const focoPrevio = document.activeElement;
  let paso = 0;
  let guardando = false;

  function pintar(direccion = "adelante") {
    const def = PASOS[paso];
    const contenido = el("div", `paso entra-${direccion}`);
    const cabeza = el("header", "paso-cabeza");
    cabeza.append(el("p", "etiqueta cifras", paso === 0 ? "Tu rutina" : paso === PASOS.length - 1 ? "Vista previa" : `${paso} de ${PASOS.length - 2}`));
    const titulo = el("h2", "titular paso-titulo", def.titulo);
    titulo.id = "encuesta-titulo";
    titulo.tabIndex = -1;
    cabeza.append(titulo);
    if (def.ayuda) cabeza.append(el("p", "paso-ayuda", def.ayuda));
    const campos = el("div", "paso-campos");
    campos.append(...def.pintar(r, () => {}));
    contenido.append(cabeza, campos);
    cuerpo.replaceChildren(contenido);
    cuerpo.scrollTop = 0;

    atras.hidden = paso === 0;
    const ultimo = paso === PASOS.length - 1;
    siguienteBoton.textContent = def.boton ?? (ultimo ? (reemplaza ? "Reemplazar mi rutina" : "Crear mi rutina") : "Siguiente");
    relleno.style.transform = `scaleX(${paso / (PASOS.length - 1)})`;
    titulo.focus({ preventScroll: true });
  }

  async function siguiente() {
    if (guardando) return;
    if (paso < PASOS.length - 1) {
      paso++;
      return pintar("adelante");
    }
    guardando = true;
    siguienteBoton.disabled = true;
    siguienteBoton.replaceChildren(el("span", "girando"), document.createTextNode("Guardando…"));
    try {
      await alCrear(generarPlantilla(r), r);
      cerrar();
    } catch (error) {
      console.error(error);
      siguienteBoton.textContent = "Intentar otra vez";
      const aviso = el("p", "error-form", "No se pudo guardar. Revisa tu conexión e intenta otra vez.");
      aviso.setAttribute("role", "alert");
      cuerpo.querySelector(".paso-campos")?.prepend(aviso);
    } finally {
      guardando = false;
      siguienteBoton.disabled = false;
    }
  }

  function anterior() {
    if (paso === 0) return;
    paso--;
    pintar("atras");
  }

  function teclas(evento) {
    if (evento.key === "Escape") cerrar();
  }

  function cerrar() {
    caja.hidden = true;
    document.documentElement.classList.remove("con-encuesta");
    fondo.forEach((e) => (e.inert = false));
    siguienteBoton.removeEventListener("click", siguiente);
    atras.removeEventListener("click", anterior);
    cerrarBoton.removeEventListener("click", cerrar);
    window.removeEventListener("keydown", teclas);
    focoPrevio?.focus?.({ preventScroll: true });
  }

  siguienteBoton.addEventListener("click", siguiente);
  atras.addEventListener("click", anterior);
  cerrarBoton.addEventListener("click", cerrar);
  window.addEventListener("keydown", teclas);
  fondo.forEach((e) => (e.inert = true));
  document.documentElement.classList.add("con-encuesta");
  caja.hidden = false;
  pintar();
}
