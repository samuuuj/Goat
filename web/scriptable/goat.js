// Goat · widget para Scriptable (https://scriptable.app). Un solo script para todos los tamaños:
// pequeño, mediano, grande y los tres de la pantalla bloqueada (circular, rectangular y en línea).
//
// Cómo se instala (la guía completa está en la página Widgets de tu Goat):
//  1. Scriptable › "+" › pega este archivo completo › toca el título y ponle "Goat".
//  2. Toca ▶︎ una vez: te pide la dirección de tu Goat y tu llave, las mismas del atajo "⚙️ Goat".
//     Se guardan en el Llavero de este iPhone. Este archivo nunca lleva tu llave: no la escribas aquí.
//  3. Pantalla de inicio › mantén presionado › "+" › Scriptable › elige el tamaño › toca el widget › Script: Goat.
//
// Lee GET /api/v1/widget y se actualiza cada 15 min. Sin internet usa la última respuesta guardada.
// Dinero: apagado. Se enciende desde el menú de este script (solo mediano y grande, nunca en la pantalla bloqueada),
// o solo en un widget escribiendo "dinero" en su campo Parameter.

const LLAVE_URL = "goat.url";
const LLAVE_TOKEN = "goat.token";
const LLAVE_DINERO = "goat.dinero";
const ARCHIVO = "goat-widget.json";
const REFRESCO_MIN = 15;
const ESPERA_SEG = 12;
const URL_VALIDA = /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i;
const TOKEN_VALIDO = /^[A-Za-z0-9_-]{32,64}$/;

// Colores de Goat: negro, grises de Apple y un solo acento naranja (lo que falta). Los anillos llevan los suyos.
const COLOR = {
  fondo: new Color("#000000"),
  fondo2: new Color("#0d0d0f"),
  texto: new Color("#f5f5f7"),
  texto2: new Color("#a1a1a6"),
  texto3: new Color("#6e6e73"),
  acento: new Color("#ff6a1f"),
  blanco: new Color("#ffffff"),
};
const ANILLO = { registro: "#ff6a1f", cuerpo: "#b4f03c", mente: "#3cd2ff" };
const ORDEN_ANILLOS = ["registro", "cuerpo", "mente"];

const LETRA = {
  numero: (t) => Font.boldRoundedSystemFont(t),
  redonda: (t) => Font.semiboldRoundedSystemFont(t),
  texto: (t) => Font.systemFont(t),
  medio: (t) => Font.mediumSystemFont(t),
  fuerte: (t) => Font.semiboldSystemFont(t),
  etiqueta: (t) => Font.boldSystemFont(t),
};

// ── Configuración (Llavero del iPhone) ──────────────────────────────────

function leerLlave(llave) {
  return Keychain.contains(llave) ? Keychain.get(llave) : "";
}

function leerConfig() {
  return { url: leerLlave(LLAVE_URL), token: leerLlave(LLAVE_TOKEN), dinero: leerLlave(LLAVE_DINERO) === "1" };
}

/** "tu-goat.vercel.app/api/v1/" → "https://tu-goat.vercel.app" (acepta lo que guarda el atajo "⚙️ Goat"). */
function limpiarUrl(entrada) {
  let url = String(entrada || "").trim().replace(/\/+$/, "");
  url = url.replace(/\/api\/v1$/i, "").replace(/\/+$/, "");
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

// ── Datos: la API y lo guardado para cuando no hay internet ─────────────

const archivos = FileManager.local();
const rutaGuardado = archivos.joinPath(archivos.documentsDirectory(), ARCHIVO);

/** { datos } si respondió bien · { error: { estado, codigo, mensaje } } si respondió con error · {} sin conexión. */
async function pedirDatos(conf, conDinero) {
  const peticion = new Request(`${conf.url}/api/v1/widget${conDinero ? "?dinero=1" : ""}`);
  peticion.method = "GET";
  peticion.headers = { Authorization: `Bearer ${conf.token}`, Accept: "application/json" };
  peticion.timeoutInterval = ESPERA_SEG;
  let cuerpo = null;
  try {
    cuerpo = await peticion.loadJSON();
  } catch (e) {
    return {};
  }
  const estado = peticion.response ? peticion.response.statusCode : 0;
  if (cuerpo && cuerpo.ok && cuerpo.datos) return { datos: cuerpo.datos };
  return { error: { estado, codigo: cuerpo ? cuerpo.codigo : null, mensaje: cuerpo ? cuerpo.mensaje : null } };
}

function leerGuardado() {
  try {
    if (!archivos.fileExists(rutaGuardado)) return null;
    const guardado = JSON.parse(archivos.readString(rutaGuardado));
    return guardado && guardado.datos ? guardado : null;
  } catch (e) {
    return null;
  }
}

/** Guarda la última respuesta, sin el dinero (no se deja en el teléfono y la pantalla bloqueada también lee esto). */
function guardar(datos) {
  try {
    const copia = Object.assign({}, datos);
    delete copia.dinero;
    archivos.writeString(rutaGuardado, JSON.stringify({ guardado: new Date().toISOString(), datos: copia }));
  } catch (e) {
    // Sin espacio o sin permiso: el widget sigue, solo no queda copia.
  }
}

// ── Formato ─────────────────────────────────────────────────────────────

const capital = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "");
const miles = (n) => String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const pesos = (n) => `${n < 0 ? "−" : ""}$${miles(n)}`;

function hace(iso) {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 60) return `hace ${min} min`;
  const horas = Math.round(min / 60);
  return horas < 24 ? `hace ${horas} h` : `hace ${Math.round(horas / 24)} d`;
}

/** iPhone SE y otros de pantalla baja: anillos y barras un poco más chicos para que todo quepa. */
const compacto = () => Device.screenSize().height < 700;

function enlace(base, ruta) {
  return `${base}/${ruta && ruta !== "index.html" ? ruta : ""}`;
}

function progresoDe(anillos, clave) {
  const anillo = (anillos || []).find((a) => a.clave === clave);
  return anillo ? Math.max(0, Number(anillo.progreso) || 0) : 0;
}

// ── Dibujo (DrawContext) ────────────────────────────────────────────────

function lienzo(ancho, alto) {
  const ctx = new DrawContext();
  ctx.size = new Size(ancho, alto);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  return ctx;
}

/** Arco desde arriba en sentido horario, con extremos redondeados (DrawContext no tiene "line cap"). */
function arco(ctx, cx, cy, radio, grosor, desde, barrido, color) {
  const pasos = Math.max(2, Math.ceil((barrido / (2 * Math.PI)) * 160));
  const camino = new Path();
  for (let i = 0; i <= pasos; i++) {
    const a = desde + (barrido * i) / pasos;
    const punto = new Point(cx + radio * Math.cos(a), cy + radio * Math.sin(a));
    if (i === 0) camino.move(punto);
    else camino.addLine(punto);
  }
  ctx.setStrokeColor(color);
  ctx.setLineWidth(grosor);
  ctx.addPath(camino);
  ctx.strokePath();
  ctx.setFillColor(color);
  for (const a of [desde, desde + barrido]) {
    ctx.fillEllipse(new Rect(cx + radio * Math.cos(a) - grosor / 2, cy + radio * Math.sin(a) - grosor / 2, grosor, grosor));
  }
}

/** Número centrado en (cx, cy). */
function numeroCentrado(ctx, texto, cx, cy, tam, color, ancho) {
  ctx.setFont(LETRA.numero(tam));
  ctx.setTextColor(color);
  ctx.setTextAlignedCenter();
  ctx.drawTextInRect(texto, new Rect(cx - ancho / 2, cy - tam * 0.62, ancho, tam * 1.3));
}

/** Los tres anillos (Registro, Cuerpo, Mente) sobre pistas al 20 %, con el puntaje en el centro. */
function imagenAnillos(anillos, tam, puntaje) {
  const ctx = lienzo(tam, tam);
  const c = tam / 2;
  const grosor = tam * 0.088;
  const hueco = tam * 0.02;
  ORDEN_ANILLOS.forEach((clave, i) => {
    const radio = c - grosor / 2 - i * (grosor + hueco);
    ctx.setStrokeColor(new Color(ANILLO[clave], 0.2));
    ctx.setLineWidth(grosor);
    ctx.strokeEllipse(new Rect(c - radio, c - radio, 2 * radio, 2 * radio));
    const p = Math.min(progresoDe(anillos, clave), 1);
    if (p > 0.004) arco(ctx, c, c, radio, grosor, -Math.PI / 2, p * 2 * Math.PI, new Color(ANILLO[clave]));
  });
  if (puntaje !== null && puntaje !== undefined) {
    const libre = 2 * (c - 3 * grosor - 2 * hueco);
    const texto = String(puntaje);
    numeroCentrado(ctx, texto, c, c, libre * (texto.length > 2 ? 0.46 : 0.62), COLOR.texto, libre);
  }
  return ctx.getImage();
}

/** Medidor abierto abajo (estilo Apple) para la pantalla bloqueada: monocromo, con el número en el centro. */
function imagenMedidor(progreso, tam, texto) {
  const ctx = lienzo(tam, tam);
  const c = tam / 2;
  const grosor = tam * 0.09;
  const radio = c - grosor / 2 - 1;
  const desde = (3 * Math.PI) / 4;
  const barrido = (3 * Math.PI) / 2;
  arco(ctx, c, c, radio, grosor, desde, barrido, new Color("#ffffff", 0.3));
  const p = Math.min(Math.max(progreso, 0), 1);
  if (p > 0.004) arco(ctx, c, c, radio, grosor, desde, barrido * p, COLOR.blanco);
  numeroCentrado(ctx, texto, c, c - tam * 0.02, tam * (texto.length > 2 ? 0.3 : 0.36), COLOR.blanco, tam);
  ctx.setFont(LETRA.etiqueta(tam * 0.13));
  ctx.setTextAlignedCenter();
  ctx.drawTextInRect("PTS", new Rect(0, tam * 0.78, tam, tam * 0.2));
  return ctx.getImage();
}

/** La semana: 7 barras de puntaje (hoy en naranja) con la letra del día debajo. */
function imagenSemana(semana, ancho, alto) {
  const ctx = lienzo(ancho, alto);
  const letra = 10;
  const altoBarras = alto - letra - 6;
  const paso = ancho / Math.max(semana.length, 1);
  const grosor = Math.min(paso * 0.42, 14);
  semana.forEach((dia, i) => {
    const x = i * paso + (paso - grosor) / 2;
    const pista = new Path();
    pista.addRoundedRect(new Rect(x, 0, grosor, altoBarras), grosor / 2, grosor / 2);
    ctx.setFillColor(new Color("#ffffff", 0.08));
    ctx.addPath(pista);
    ctx.fillPath();
    if (dia.score !== null && dia.score !== undefined) {
      const h = Math.max(grosor, (altoBarras * Math.min(Math.max(dia.score, 0), 100)) / 100);
      const barra = new Path();
      barra.addRoundedRect(new Rect(x, altoBarras - h, grosor, h), grosor / 2, grosor / 2);
      ctx.setFillColor(dia.hoy ? COLOR.acento : new Color("#f5f5f7", 0.5));
      ctx.addPath(barra);
      ctx.fillPath();
    }
    ctx.setFont(LETRA.etiqueta(letra));
    ctx.setTextColor(dia.hoy ? COLOR.acento : COLOR.texto3);
    ctx.setTextAlignedCenter();
    ctx.drawTextInRect(dia.dia || "", new Rect(i * paso, alto - letra - 3, paso, letra + 3));
  });
  return ctx.getImage();
}

// ── Piezas de texto ─────────────────────────────────────────────────────

function texto(pila, contenido, fuente, color, lineas = 1, escala = 0.75) {
  const t = pila.addText(String(contenido));
  t.font = fuente;
  t.textColor = color;
  t.lineLimit = lineas;
  t.minimumScaleFactor = escala;
  return t;
}

function fila(pila) {
  const s = pila.addStack();
  s.layoutHorizontally();
  s.centerAlignContent();
  return s;
}

function columna(pila) {
  const s = pila.addStack();
  s.layoutVertically();
  return s;
}

function racha(pila, n, tam) {
  if (n > 0) texto(pila, `🔥${n}`, LETRA.redonda(tam), COLOR.texto);
}

function avisos(pila, d, tam) {
  if (d.avisos && d.avisos.sinLeer > 0) {
    texto(pila, `🔔${d.avisos.sinLeer}`, LETRA.fuerte(tam), COLOR.texto2);
    pila.addSpacer(6);
  }
}

/** Lo que falta (en naranja) o "Todo al día". */
function pendiente(pila, d, tam) {
  const falta = d.pendientes && d.pendientes.total > 0;
  return texto(pila, falta ? `● Falta ${d.pendientes.texto}` : "✓ Todo al día", LETRA.fuerte(tam), falta ? COLOR.acento : COLOR.texto2);
}

/** Ahora y siguiente de la rutina (2 líneas). Sin rutina: el sueño de anoche o una invitación a crearla. */
function rutina(pila, d, ctx, tam) {
  const r = d.rutina;
  const caja = columna(pila);
  caja.url = enlace(ctx.base, "rutina.html");
  if (r && r.ahora) {
    texto(caja, `${r.emojiAhora || ""} ${r.ahora}`.trim(), LETRA.fuerte(tam), COLOR.texto);
    texto(caja, r.siguiente ? `${r.quedan} · luego ${r.hora} ${r.siguiente}` : `Quedan ${r.quedan}`, LETRA.texto(tam - 3), COLOR.texto2);
  } else if (r && r.siguiente) {
    texto(caja, `${r.emojiSiguiente || ""} ${r.siguiente}`.trim(), LETRA.fuerte(tam), COLOR.texto);
    texto(caja, `Siguiente · ${r.hora}`, LETRA.texto(tam - 3), COLOR.texto2);
  } else if (r) {
    texto(caja, "Nada más por hoy", LETRA.fuerte(tam), COLOR.texto);
    texto(caja, "Lo que queda es descansar 🌙", LETRA.texto(tam - 3), COLOR.texto2);
  } else {
    texto(caja, "Sin rutina hoy", LETRA.fuerte(tam), COLOR.texto);
    texto(caja, "Ármala en Goat › Tu día", LETRA.texto(tam - 3), COLOR.texto2);
  }
}

function desbloqueo(pila, d, ctx, tam) {
  const b = d.desbloqueo;
  if (!b) return;
  const caja = fila(pila);
  caja.url = enlace(ctx.base, "desbloqueo.html");
  texto(caja, b.abierto ? `🔓 ${b.minutos} min por app` : "🔒 Registra para abrir", LETRA.medio(tam), COLOR.texto2);
}

function sueno(pila, d, ctx, tam) {
  const s = d.sueno;
  if (!s) return;
  const caja = fila(pila);
  caja.url = enlace(ctx.base, "sueno.html");
  let linea = s.enCama ? "🌙 En cama" : `🌙 ${s.etiqueta}${s.duracion ? ` ${s.duracion}` : " a medias"}`;
  if (s.indice !== null && s.indice !== undefined) linea += ` · índice ${s.indice}`;
  texto(caja, linea, LETRA.medio(tam), COLOR.texto2);
}

function dinero(pila, d, ctx, tam) {
  if (!ctx.dinero || !d.dinero) return false;
  const caja = fila(pila);
  caja.url = enlace(ctx.base, "finanzas.html");
  texto(caja, "💸 Hoy ", LETRA.medio(tam), COLOR.texto2);
  texto(caja, pesos(d.dinero.disponibleHoy), LETRA.redonda(tam), COLOR.texto);
  return true;
}

// ── Tamaños ─────────────────────────────────────────────────────────────

function nuevoWidget(familia) {
  const w = new ListWidget();
  if (familia.indexOf("accessory") !== 0) {
    const degradado = new LinearGradient();
    degradado.colors = [COLOR.fondo, COLOR.fondo2];
    degradado.locations = [0, 1];
    degradado.startPoint = new Point(0, 0);
    degradado.endPoint = new Point(0, 1);
    w.backgroundGradient = degradado;
  }
  w.refreshAfterDate = new Date(Date.now() + REFRESCO_MIN * 60 * 1000);
  return w;
}

/** Pequeño: anillo triple con el puntaje, racha arriba y lo que falta abajo. */
function pequeno(w, d, ctx) {
  w.setPadding(14, 14, 14, 14);
  w.url = enlace(ctx.base, d.abrir);
  const arriba = fila(w);
  texto(arriba, ctx.viejo || capital(d.dia), LETRA.etiqueta(11), ctx.viejo ? COLOR.texto3 : COLOR.texto2);
  arriba.addSpacer();
  racha(arriba, d.racha, 13);
  w.addSpacer();
  const centro = fila(w);
  centro.addSpacer();
  const tam = compacto() ? 82 : 90;
  const anillos = centro.addImage(imagenAnillos(d.anillos, tam, d.score));
  anillos.imageSize = new Size(tam, tam);
  centro.addSpacer();
  w.addSpacer();
  const abajo = fila(w);
  abajo.addSpacer();
  pendiente(abajo, d, 12);
  abajo.addSpacer();
}

/** Mediano: anillos y puntaje a la izquierda; ahora/siguiente, lo que falta y minutos a la derecha; frase abajo. */
function mediano(w, d, ctx) {
  w.setPadding(14, 14, 12, 16);
  w.url = enlace(ctx.base, d.abrir);
  const arriba = fila(w);
  const izquierda = arriba.addStack();
  izquierda.url = enlace(ctx.base, "index.html");
  const anillos = izquierda.addImage(imagenAnillos(d.anillos, 96, d.score));
  anillos.imageSize = new Size(96, 96);
  arriba.addSpacer(14);
  const derecha = columna(arriba);
  const cabeza = fila(derecha);
  texto(cabeza, (ctx.viejo || d.dia || "").toUpperCase(), LETRA.etiqueta(10), COLOR.texto3);
  cabeza.addSpacer();
  avisos(cabeza, d, 11);
  racha(cabeza, d.racha, 13);
  derecha.addSpacer(5);
  rutina(derecha, d, ctx, 15);
  derecha.addSpacer(6);
  pendiente(derecha, d, 12);
  derecha.addSpacer(2);
  if (!dinero(derecha, d, ctx, 12)) desbloqueo(derecha, d, ctx, 12);
  w.addSpacer();
  texto(w, d.frase || "", LETRA.texto(11), COLOR.texto3, 1, 0.7);
}

/** Grande: lo del mediano + leyenda de anillos, semana en barras, sueño de anoche y la frase destacada. */
function grande(w, d, ctx) {
  w.setPadding(16, 16, 14, 16);
  w.url = enlace(ctx.base, d.abrir);
  const ancho = Math.min(306, Device.screenSize().width - 88);
  const chico = compacto();

  const cabeza = fila(w);
  texto(cabeza, "Goat", LETRA.numero(15), COLOR.texto);
  texto(cabeza, `  ${ctx.viejo || `${capital(d.dia)} ${d.fechaCorta || ""}`}`, LETRA.fuerte(13), ctx.viejo ? COLOR.texto3 : COLOR.texto2);
  cabeza.addSpacer();
  avisos(cabeza, d, 12);
  racha(cabeza, d.racha, 15);
  w.addSpacer(8);

  const arriba = fila(w);
  const izquierda = arriba.addStack();
  izquierda.url = enlace(ctx.base, "index.html");
  const tam = chico ? 90 : 104;
  const anillos = izquierda.addImage(imagenAnillos(d.anillos, tam, d.score));
  anillos.imageSize = new Size(tam, tam);
  arriba.addSpacer(16);
  const leyenda = columna(arriba);
  ORDEN_ANILLOS.forEach((clave, i) => {
    const anillo = (d.anillos || []).find((a) => a.clave === clave);
    const linea = fila(leyenda);
    texto(linea, "● ", LETRA.etiqueta(12), new Color(ANILLO[clave]));
    texto(linea, anillo ? anillo.nombre : capital(clave), LETRA.medio(13), COLOR.texto2);
    linea.addSpacer();
    texto(linea, `${Math.round(progresoDe(d.anillos, clave) * 100)}%`, LETRA.redonda(15), COLOR.texto);
    if (i < 2) leyenda.addSpacer(7);
  });
  leyenda.addSpacer(9);
  if (d.scoreAyer !== null && d.scoreAyer !== undefined) {
    texto(leyenda, `Ayer ${d.scoreAyer} · hoy ${d.score}`, LETRA.texto(11), COLOR.texto3);
  }
  w.addSpacer(10);

  rutina(w, d, ctx, 15);
  w.addSpacer(8);
  const estado = fila(w);
  pendiente(estado, d, 12);
  estado.addSpacer();
  desbloqueo(estado, d, ctx, 12);
  w.addSpacer(10);

  const alto = chico ? 32 : 40;
  const semana = w.addImage(imagenSemana(d.semana || [], ancho, alto));
  semana.imageSize = new Size(ancho, alto);
  w.addSpacer(8);

  const pie = fila(w);
  sueno(pie, d, ctx, 12);
  pie.addSpacer();
  dinero(pie, d, ctx, 12);
  w.addSpacer();
  texto(w, d.frase || "", LETRA.redonda(15), COLOR.texto, 2, 0.8);
}

/** Pantalla bloqueada · circular: medidor del puntaje. Sin dinero. */
function circular(w, d, ctx) {
  w.addAccessoryWidgetBackground = true;
  w.url = enlace(ctx.base, "index.html");
  w.addSpacer();
  const centro = fila(w);
  centro.addSpacer();
  const medidor = centro.addImage(imagenMedidor((Number(d.score) || 0) / 100, 58, String(d.score)));
  medidor.imageSize = new Size(58, 58);
  centro.addSpacer();
  w.addSpacer();
}

/** Pantalla bloqueada · rectangular: "72 pts · 🔥5", lo que falta y lo siguiente. Sin dinero. */
function rectangular(w, d, ctx) {
  w.url = enlace(ctx.base, d.abrir);
  const b = d.bloqueo || {};
  texto(w, b.titulo || `${d.score} pts`, LETRA.numero(15), COLOR.texto);
  texto(w, b.detalle || "", LETRA.fuerte(13), COLOR.texto);
  if (b.extra) texto(w, b.extra, LETRA.texto(13), COLOR.texto2);
}

/** Pantalla bloqueada · en línea: "Goat 72 · 🔥5". Sin dinero. */
function enLinea(w, d, ctx) {
  w.url = enlace(ctx.base, "index.html");
  texto(w, (d.bloqueo && d.bloqueo.linea) || `Goat ${d.score}`, LETRA.fuerte(12), COLOR.texto);
}

const DIBUJAR = {
  small: pequeno,
  medium: mediano,
  large: grande,
  extraLarge: grande,
  accessoryCircular: circular,
  accessoryRectangular: rectangular,
  accessoryInline: enLinea,
};

/** Widget con un aviso (falta configurar, token inválido, sin conexión y sin nada guardado). */
function widgetAviso(familia, titulo, detalle) {
  const w = nuevoWidget(familia);
  if (familia === "accessoryInline") {
    texto(w, titulo, LETRA.fuerte(12), COLOR.texto);
    return w;
  }
  if (familia.indexOf("accessory") === 0) {
    texto(w, "Goat", LETRA.numero(14), COLOR.texto);
    texto(w, titulo, LETRA.fuerte(13), COLOR.texto, 2);
    return w;
  }
  w.setPadding(16, 16, 16, 16);
  texto(w, "Goat", LETRA.numero(15), COLOR.texto);
  w.addSpacer();
  texto(w, titulo, LETRA.redonda(familia === "small" ? 17 : 20), COLOR.acento, 2);
  w.addSpacer(4);
  texto(w, detalle, LETRA.texto(12), COLOR.texto2, familia === "small" ? 4 : 3);
  return w;
}

async function crearWidget(familia) {
  const conf = leerConfig();
  if (!conf.url || !conf.token) {
    return widgetAviso(familia, "⚙️ Conecta Goat", "Abre Scriptable y toca el script Goat una vez para poner tu dirección y tu llave.");
  }
  const bloqueo = familia.indexOf("accessory") === 0;
  const parametro = String(args.widgetParameter || "").toLowerCase();
  // Nunca se pide dinero para la pantalla bloqueada ni para el pequeño.
  const conDinero = !bloqueo && (familia === "medium" || familia === "large" || familia === "extraLarge") && (conf.dinero || parametro.indexOf("dinero") >= 0);

  const respuesta = await pedirDatos(conf, conDinero);
  const error = respuesta.error;
  if (error && (error.estado === 401 || error.estado === 403)) {
    return widgetAviso(familia, "🔑 Revisa el token", "La llave no sirve o fue revocada. Crea otra en Goat › Conectar iPhone y vuelve a tocar el script.");
  }
  let datos = respuesta.datos;
  let viejo = null;
  if (datos) {
    guardar(datos);
  } else {
    const guardado = leerGuardado();
    if (!guardado) {
      return error
        ? widgetAviso(familia, error.mensaje || "⚠️ Algo falló", "Lo intento otra vez en unos minutos.")
        : widgetAviso(familia, "📡 Sin conexión", "Cuando vuelva el internet, aquí aparece tu día.");
    }
    datos = guardado.datos;
    viejo = hace(guardado.guardado);
  }

  const w = nuevoWidget(familia);
  const dibujar = DIBUJAR[familia] || pequeno;
  dibujar(w, datos, { base: conf.url, viejo, dinero: conDinero });
  return w;
}

// ── Dentro de la app: conectar y ver ────────────────────────────────────

async function avisar(titulo, mensaje) {
  const alerta = new Alert();
  alerta.title = titulo;
  alerta.message = mensaje;
  alerta.addAction("OK");
  await alerta.presentAlert();
}

/** Pide la dirección y la llave, las prueba y las guarda en el Llavero. Devuelve true si quedaron guardadas. */
async function configurar() {
  const actual = leerConfig();
  const alerta = new Alert();
  alerta.title = "Conecta Goat";
  alerta.message =
    "Pega la dirección de tu Goat y tu llave: las mismas del atajo ⚙️ Goat. Se guardan solo en el Llavero de este iPhone.";
  alerta.addTextField("https://tu-goat.vercel.app", actual.url);
  alerta.addSecureTextField("Llave", "");
  alerta.addAction("Guardar");
  alerta.addCancelAction("Cancelar");
  if ((await alerta.presentAlert()) === -1) return false;

  const url = limpiarUrl(alerta.textFieldValue(0));
  const token = String(alerta.textFieldValue(1) || "").trim() || actual.token;
  if (!URL_VALIDA.test(url) || !TOKEN_VALIDO.test(token)) {
    await avisar("Revisa los datos", "La dirección empieza por https:// y la llave tiene de 32 a 64 letras, números, - o _.");
    return false;
  }
  Keychain.set(LLAVE_URL, url);
  Keychain.set(LLAVE_TOKEN, token);

  const prueba = await pedirDatos({ url, token }, false);
  if (prueba.datos) {
    guardar(prueba.datos);
    await avisar("✅ Conectado", "Ahora agrega el widget: mantén presionada la pantalla de inicio › + › Scriptable.");
  } else if (prueba.error && (prueba.error.estado === 401 || prueba.error.estado === 403)) {
    await avisar("🔑 Revisa el token", "Goat no reconoce esa llave. Copia la del atajo ⚙️ Goat o crea otra en Conectar iPhone.");
  } else {
    await avisar("📡 Guardado", "No pude probar la conexión ahora. El widget lo intentará solo.");
  }
  return true;
}

async function ver(familia) {
  const w = await crearWidget(familia);
  const mostrar = {
    small: "presentSmall",
    medium: "presentMedium",
    large: "presentLarge",
    accessoryCircular: "presentAccessoryCircular",
    accessoryRectangular: "presentAccessoryRectangular",
    accessoryInline: "presentAccessoryInline",
  }[familia];
  if (typeof w[mostrar] === "function") await w[mostrar]();
  else await w.presentMedium();
}

async function menu() {
  let conf = leerConfig();
  if (!conf.url || !conf.token) {
    if (!(await configurar())) return;
    await ver("medium");
    return;
  }
  const opciones = [
    ["Ver mediano", () => ver("medium")],
    ["Ver pequeño", () => ver("small")],
    ["Ver grande", () => ver("large")],
    ["Ver pantalla bloqueada", () => ver("accessoryRectangular")],
    [
      conf.dinero ? "Ocultar el dinero" : "Mostrar dinero (mediano y grande)",
      async () => {
        Keychain.set(LLAVE_DINERO, conf.dinero ? "0" : "1");
        await avisar(conf.dinero ? "🙈 Dinero oculto" : "💸 Dinero visible", "Nunca sale en la pantalla bloqueada. Los widgets cambian en el próximo refresco.");
      },
    ],
    ["Cambiar dirección o llave", configurar],
  ];
  const alerta = new Alert();
  alerta.title = "Goat";
  alerta.message = `Conectado a ${conf.url.replace(/^https?:\/\//, "")}`;
  opciones.forEach(([titulo]) => alerta.addAction(titulo));
  alerta.addDestructiveAction("Desconectar este iPhone");
  alerta.addCancelAction("Cerrar");
  const elegida = await alerta.presentSheet();
  if (elegida === opciones.length) {
    [LLAVE_URL, LLAVE_TOKEN, LLAVE_DINERO].forEach((llave) => {
      if (Keychain.contains(llave)) Keychain.remove(llave);
    });
    if (archivos.fileExists(rutaGuardado)) archivos.remove(rutaGuardado);
    await avisar("Desconectado", "Se borraron la dirección, la llave y lo guardado.");
  } else if (elegida >= 0 && elegida < opciones.length) {
    await opciones[elegida][1]();
  }
}

// ── Arranque ────────────────────────────────────────────────────────────

if (config.runsInWidget || config.runsInAccessoryWidget) {
  Script.setWidget(await crearWidget(config.widgetFamily || "small"));
} else if (config.runsWithSiri) {
  await ver("medium");
} else {
  await menu();
}
Script.complete();
