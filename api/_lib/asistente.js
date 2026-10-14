// Motor del atajo "🐐 Goat" (D-063). El atajo es un bucle tonto: pide a POST /api/v1/asistente la siguiente
// pregunta, la muestra con «Elegir de la lista», «Solicitar entrada» (número o texto) o una notificación, y manda
// la respuesta. Todas las reglas viven aquí: cambiar una pregunta no exige tocar el iPhone.
//
// Cada respuesta trae, además de { ok, mensaje }:
//   tipo:     "lista" | "numero" | "texto" | "fin" (notificación y se detiene) | "silencio" (se detiene sin aviso)
//             | "inicio" (va a la pantalla de inicio y sigue: lo usa la puerta de TikTok y compañía)
//   pregunta: lo que se muestra · opciones: textos de la lista · estado: lo que el atajo devuelve en la próxima vuelta.
// El estado es la conversación hasta ahora (flujo, respuestas y pregunta pendiente) en base64url: el servidor
// no guarda nada entre vueltas. Solo trae lo que ya respondiste; los permisos los pone el token en cada llamada.
//
// Un flujo es una función (ctx, d, arg) que mira las respuestas `d` y devuelve la pregunta que falta,
// { fin }, { silencio } o { ir: "otro flujo" }. Solo escribe en la base cuando ya tiene todo (sin efectos a medias).

import { ErrorApi } from "./respuesta.js";
import { unirRutas } from "./enrutador.js";
import { idCliente } from "./validar.js";
import central from "../_rutas/central.js";
import finanzas from "../_rutas/finanzas.js";
import sueno from "../_rutas/sueno.js";
import desbloqueo from "../_rutas/desbloqueo.js";
import rutina from "../_rutas/rutina.js";
import ejercicio from "../_rutas/ejercicio.js";
import notificaciones from "../_rutas/notificaciones.js";
import { MONTO_MAXIMO, FRECUENTES, MATERIAS, DURACIONES } from "../../web/js/logica/catalogos.js";
import { horaDecimal } from "../../web/js/logica/dia.js";

/** Las rutas que el motor reutiliza (las mismas reglas y mensajes que los atajos de cada módulo). */
const RUTAS = unirRutas(central, finanzas, sueno, desbloqueo, rutina, ejercicio, notificaciones);

const MAX_ESTADO = 4000;
const MAX_SALTOS = 8;
const OTRA_CATEGORIA = "✏️ Otro…";

// ── Estado (base64url de { f, a, d, p }) ─────────────────────────────────

const codificar = (s) => Buffer.from(JSON.stringify(s), "utf8").toString("base64url");

function decodificar(texto) {
  if (typeof texto !== "string" || texto.length > MAX_ESTADO) return null;
  try {
    const s = JSON.parse(Buffer.from(texto.trim(), "base64url").toString("utf8"));
    if (!s || typeof s !== "object" || typeof s.f !== "string" || typeof s.d !== "object" || s.d === null) return null;
    return { f: s.f, a: typeof s.a === "string" ? s.a : "", d: s.d, p: typeof s.p === "string" ? s.p : null };
  } catch {
    return null;
  }
}

/** "Comida  Almuerzo" → ["comida", "almuerzo"]; sin tildes ni mayúsculas. */
function palabras(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_:\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const comparable = (t) => palabras(t).join(" ");

// ── Preguntas ────────────────────────────────────────────────────────────

/** Opciones: textos o { texto, valor }. Se guarda `valor` (o el texto si no trae valor). */
const lista = (clave, pregunta, opciones) => ({
  clave,
  tipo: "lista",
  pregunta,
  opciones: opciones.map((o) => (typeof o === "string" ? { texto: o, valor: o } : o)),
});
const numero = (clave, pregunta, leer) => ({ clave, tipo: "numero", pregunta, leer });
const texto = (clave, pregunta, { opcional = false, max = 120 } = {}) => ({ clave, tipo: "texto", pregunta, opcional, max });
const fin = (mensaje) => ({ fin: mensaje });

/** Lee lo que respondió el iPhone para la pregunta `q`. Devuelve { valor } o { error }. */
function leerRespuesta(q, respuesta) {
  const crudo = respuesta == null ? "" : String(respuesta).trim();
  if (q.tipo === "lista") {
    const elegida =
      q.opciones.find((o) => o.texto === crudo) ?? q.opciones.find((o) => comparable(o.texto) === comparable(crudo) && comparable(crudo));
    return elegida ? { valor: elegida.valor } : { error: "⚠️ Elige una de la lista" };
  }
  if (q.tipo === "numero") {
    const valor = q.leer(crudo);
    return valor == null ? { error: "⚠️ Escribe solo el número" } : { valor };
  }
  if (!crudo || crudo === "-") return q.opcional ? { valor: null } : { error: "⚠️ No puede ir vacío" };
  return crudo.length > q.max ? { error: `⚠️ Máximo ${q.max} letras` } : { valor: crudo };
}

/**
 * Plata escrita como sea: 25000 · 25.000 · $25.000 · 25k · 25 mil · 1,5 millones. Entero en COP o null.
 * Con punto o coma seguidos de 3 cifras es separador de miles; con 1 o 2 cifras, decimal.
 */
export function leerMonto(valor) {
  let t = String(valor ?? "")
    .toLowerCase()
    .replace(/[$\s]|cop|pesos?/g, "");
  let factor = 1;
  const sufijo = t.match(/(millones|millon|mill|m|mil|k|lucas?)$/);
  if (sufijo) {
    factor = /^(mil|k|lucas?)$/.test(sufijo[1]) ? 1000 : 1_000_000;
    t = t.slice(0, -sufijo[1].length);
  }
  if (!/^\d[\d.,]*$/.test(t)) return null;
  const n = /[.,]\d{3}(?!\d)/.test(t) && !/[.,]\d{1,2}$/.test(t) ? Number(t.replace(/[.,]/g, "")) : Number(t.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  const monto = Math.round(n * factor);
  return Number.isFinite(monto) && monto >= 1 && monto <= MONTO_MAXIMO ? monto : null;
}

// ── Llamar a las demás rutas (mismas reglas, sin pasar por internet) ─────

async function llamar(ctx, clave, { cuerpo = {}, query = {} } = {}) {
  const definicion = RUTAS[clave];
  if (!definicion) throw new Error(`El asistente pidió una ruta que no existe: ${clave}`);
  try {
    const r = await definicion.manejar({ ...ctx, cuerpo: { origen: ctx.origen, ...cuerpo }, query });
    return { ...r.cuerpo, estado: r.estado };
  } catch (e) {
    if (e instanceof ErrorApi) return { ok: false, mensaje: e.message, codigo: e.codigo, estado: e.estado };
    throw e;
  }
}

/** Mensaje de una ruta para terminar ("✅ Hecho · Almuerzo" o el error humano que dio). */
const finDe = (r, extra = "") => fin(`${r.mensaje ?? "⚠️ Algo falló"}${r.ok && extra ? `\n${extra}` : ""}`);

// ── Flujos ───────────────────────────────────────────────────────────────

/**
 * De un pendiente de "Lo que falta" (Hoy o la puerta) al flujo que lo registra. Basta la clave:
 * desayuno · almuerzo · cena · checkin_finanzas · cierre_finanzas · rutina:<id del bloque>.
 */
function flujoDePendiente({ clave = "" } = {}) {
  if (clave === "cierre_finanzas") return { ir: "cierre_gastos" };
  if (clave === "checkin_finanzas") return { ir: "dinero" };
  if (["desayuno", "almuerzo", "cena"].includes(clave)) return { ir: "comida", a: clave };
  if (clave.startsWith("rutina:")) return { ir: "bloque", a: clave.slice(7) };
  return { ir: "menu" };
}

/** Atajos del menú principal, en el orden en que más se usan. */
const MENU = [
  { texto: "💸 Dinero", valor: { ir: "dinero" } },
  { texto: "🍽️ Comí", valor: { ir: "comida" } },
  { texto: "✅ Terminé algo", valor: { ir: "hecho" } },
  { texto: "📝 Tengo que hacer algo", valor: { ir: "pendiente" } },
  { texto: "🎯 ¿Qué hago ahora?", valor: { ir: "ahora" } },
  { texto: "🏋️ Entreno", valor: { ir: "entreno" } },
  { texto: "📚 Estudié", valor: { ir: "estudio" } },
  { texto: "📊 ¿Cómo voy?", valor: { ir: "como_voy" } },
  { texto: "🌙 Me voy a dormir", valor: { ir: "dormir" } },
];

async function menu(ctx, d) {
  if (d.opcion) return d.opcion;
  const hoy = await llamar(ctx, "GET hoy");
  const faltan = (hoy.datos?.pendientes ?? []).slice(0, 3).map((p) => ({ texto: `${p.emoji} Falta: ${p.texto}`, valor: flujoDePendiente(p) }));
  return lista("opcion", faltan.length ? "🐐 Primero lo que falta. ¿Qué hacemos?" : "🐐 ¿Qué hacemos?", [...faltan, ...MENU]);
}

/**
 * 💸 Dinero, con la lógica de IDEAS/Atajo_gastos_movimientos_logica.md:
 *   Gasto:         tipo → valor → categoría (u Otro escrito) → con qué pagaste → descripción
 *   Ingreso:       tipo → valor → categoría de ingreso (u Otro) → dónde entró → descripción
 *   Transferencia: tipo → valor → de dónde sale → a dónde llega → descripción (sin categoría)
 *   Retiro:        tipo → valor → de qué cuenta sacaste (llega a Efectivo) → descripción
 *   Deuda (si tienes): tipo → valor → cuál deuda → con qué cuenta → descripción
 * Las opciones salen de GET finanzas/menu: tus cuentas y categorías (las más usadas primero).
 */
async function dinero(ctx, d) {
  const menuFinanzas = (await llamar(ctx, "GET finanzas/menu")).datos;
  if (!menuFinanzas) return fin("⚠️ No pude leer tus cuentas");
  if (!d.tipo) {
    return lista("tipo", "💸 ¿Qué pasó con tu plata?", [
      ...menuFinanzas.opciones_tipo,
      { texto: "🙅 Hoy no he gastado nada", valor: "nada" },
    ]);
  }
  if (d.tipo === "nada") {
    const r = await llamar(ctx, "POST checkins", { cuerpo: { modulo: "finanzas", tipo: "nada_que_registrar" } });
    return r.ok ? fin("✅ Anotado: hoy sin gastos") : finDe(r);
  }
  const p = menuFinanzas.preguntas?.[d.tipo];
  if (!p) return fin("⚠️ Ese tipo ya no existe. Empieza otra vez");
  const esIngreso = /ingreso/i.test(d.tipo);

  if (d.monto == null) return numero("monto", "💲 ¿Cuánto? (en pesos, ej. 25000)", leerMonto);
  if (p.deudas && d.deuda == null) return lista("deuda", "📒 ¿Cuál deuda?", p.deudas);
  if (p.categorias && d.categoria == null) {
    return lista("categoria", esIngreso ? "💰 ¿De dónde vino?" : "🧾 ¿En qué fue?", p.categorias);
  }
  if (d.categoria === OTRA_CATEGORIA && d.categoria_otra == null) {
    return texto("categoria_otra", esIngreso ? "✏️ ¿Qué tipo de ingreso fue? (ej. Beca)" : "✏️ ¿Qué categoría es? (ej. Cita)", { max: 40 });
  }
  const cuentas = p.cuentas ?? [];
  const cuenta = d.cuenta ?? (cuentas.length === 1 ? cuentas[0] : null);
  if (cuentas.length > 1 && cuenta == null) return lista("cuenta", p.pregunta_cuenta ?? "¿Qué cuenta?", cuentas);
  const destinos = (p.destinos ?? []).filter((c) => c !== cuenta);
  const destino = d.destino ?? (destinos.length === 1 ? destinos[0] : null);
  if (destinos.length > 1 && destino == null) return lista("destino", p.pregunta_destino ?? "¿Hacia dónde?", destinos);
  if (d.descripcion === undefined) {
    return texto("descripcion", "📝 ¿Qué fue? (ej. Cena). Si no quieres, deja vacío o escribe -", { opcional: true, max: 200 });
  }

  const r = await llamar(ctx, "POST finanzas/movimientos", {
    cuerpo: {
      tipo: d.tipo,
      monto: d.monto,
      categoria: d.categoria ?? null,
      categoria_otra: d.categoria_otra ?? null,
      deuda: d.deuda ?? null,
      cuenta,
      cuenta_destino: destino,
      descripcion: d.descripcion,
    },
  });
  return finDe(r);
}

/** 🧾 Cierre de gastos del día ("¿anotaste todo?"). */
async function cierreGastos(ctx, d) {
  if (!d.listo) {
    return lista("listo", "🧾 ¿Ya anotaste todo lo que gastaste hoy?", [
      { texto: "✅ Sí, cierro el día", valor: "si" },
      { texto: "💸 Me falta anotar algo", valor: "falta" },
    ]);
  }
  if (d.listo === "falta") return { ir: "dinero" };
  const r = await llamar(ctx, "POST checkins", { cuerpo: { modulo: "finanzas", tipo: "cierre" } });
  return finDe(r);
}

const COMIDAS = [
  { valor: "desayuno", texto: "🍳 Desayuno" },
  { valor: "almuerzo", texto: "🍽️ Almuerzo" },
  { valor: "merienda", texto: "🥪 Merienda" },
  { valor: "cena", texto: "🌙 Cena" },
];

/** Lo que más probablemente comiste a esta hora (va de primero en la lista). */
function comidaDeLaHora(ahora) {
  const hora = horaDecimal(ahora);
  if (hora >= 4 && hora < 10.5) return "desayuno";
  if (hora >= 10.5 && hora < 15) return "almuerzo";
  if (hora >= 15 && hora < 18.5) return "merienda";
  return "cena";
}

/** Tamaños para no tener que saber calorías: un toque y listo (se corrige en la web si hace falta). */
const TAMANOS = [
  { texto: "🥗 Algo ligero", valor: { kcal: 400, proteina: 15, descripcion: "Ligera" } },
  { texto: "🍛 Plato normal", valor: { kcal: 700, proteina: 30, descripcion: "Normal" } },
  { texto: "🍔 Algo pesado", valor: { kcal: 1000, proteina: 35, descripcion: "Pesada" } },
];

/** 🍽️ Comí: qué comida → qué comiste (frecuentes o tamaño) o "No comí" (también es registro). */
async function comida(ctx, d, arg) {
  const preset = COMIDAS.find((c) => c.valor === arg)?.valor;
  const tipo = d.tipo ?? preset;
  if (!tipo) {
    const primera = comidaDeLaHora(ctx.ahora);
    const orden = [...COMIDAS].sort((a, b) => (b.valor === primera) - (a.valor === primera));
    return lista("tipo", "🍽️ ¿Qué comida?", orden);
  }
  const nombre = COMIDAS.find((c) => c.valor === tipo)?.texto.replace(/^\S+\s/, "") ?? "Comida";
  if (!d.que) {
    return lista("que", `🍽️ ${nombre}: ¿qué comiste?`, [
      ...FRECUENTES.map((f) => ({ texto: f.texto, valor: { kcal: f.kcal, proteina: f.proteina, descripcion: f.texto, frecuente: true } })),
      ...TAMANOS,
      { texto: `🚫 No comí ${nombre.toLowerCase()}`, valor: { omitida: true } },
    ]);
  }
  const omitida = d.que.omitida === true;
  const fila = omitida
    ? { tipo, omitida: true, kcal: null, proteina_g: null, descripcion: null, fuente: "manual" }
    : {
        tipo,
        omitida: false,
        kcal: Number(d.que.kcal),
        proteina_g: Number(d.que.proteina),
        descripcion: String(d.que.descripcion ?? "").slice(0, 200) || null,
        fuente: d.que.frecuente ? "frecuente" : "manual",
      };
  fila.momento = ctx.ahora.toISOString();
  fila.origen = ctx.origen;
  fila.id_cliente = await idCliente(ctx.db, "comidas", fila, ["tipo", "omitida"], null, ctx.ahora);
  if (fila.id_cliente) await ctx.db.insert("comidas", fila, { devolver: false });
  return fin(omitida ? `🚫 Anotado · sin ${nombre.toLowerCase()}` : `🍽️ Guardado · ${nombre}`);
}

/** ✅ Terminé algo: los bloques de hoy que ya empezaron sin marcar (el más reciente primero) y tus tareas. */
async function hecho(ctx, d) {
  if (!d.que) {
    const [dia, tareas] = await Promise.all([llamar(ctx, "GET rutina/hoy"), llamar(ctx, "GET uni/tareas")]);
    const t = ctx.ahora.getTime();
    const bloques = (dia.datos?.bloques ?? [])
      .filter((b) => b.marcable && b.estado !== "hecho" && b.estado !== "saltado" && Date.parse(b.inicio) <= t)
      .sort((a, b) => Math.abs(Date.parse(a.fin) - t) - Math.abs(Date.parse(b.fin) - t))
      .slice(0, 8)
      .map((b) => ({ texto: `${b.emoji} ${b.titulo} · ${b.hora}`, valor: { bloque: b.id } }));
    const pendientes = (tareas.datos?.tareas ?? []).slice(0, 6).map((x) => ({ texto: `📝 ${x.titulo}`, valor: { tarea: x.id } }));
    return lista("que", "✅ ¿Qué terminaste?", [...bloques, ...pendientes, { texto: "🍽️ Una comida", valor: { ir: "comida" } }]);
  }
  if (d.que.ir) return { ir: d.que.ir };
  if (d.que.tarea) return finDe(await llamar(ctx, "POST uni/tareas/hecha", { cuerpo: { id: d.que.tarea, estado: "hecha" } }));
  const r = await llamar(ctx, "POST rutina/check", { cuerpo: { bloque_id: d.que.bloque, estado: "hecho" } });
  return finDe(r, r.datos?.siguiente ? `Sigue: ${r.datos.siguiente}` : "");
}

/** Un bloque obligatorio que venció sin marcar: ¿lo hiciste o no? (los dos cuentan como registro). */
async function bloque(ctx, d, arg) {
  const dia = await llamar(ctx, "GET rutina/hoy");
  const b = (dia.datos?.bloques ?? []).find((x) => x.id === arg);
  if (!b) return { ir: "hecho" };
  if (!d.hizo) {
    return lista("hizo", `${b.emoji} ¿Hiciste ${b.titulo} (${b.hora})?`, [
      { texto: "✅ Sí, lo hice", valor: "hecho" },
      { texto: "⤼ No lo hice", valor: "saltado" },
    ]);
  }
  return finDe(await llamar(ctx, "POST rutina/check", { cuerpo: { bloque_id: b.id, estado: d.hizo } }));
}

/** 🌙 Repaso de la noche: pregunta uno por uno los bloques de hoy que quedaron sin marcar. */
async function repaso(ctx, d) {
  const dia = await llamar(ctx, "GET rutina/hoy");
  const t = ctx.ahora.getTime();
  const sinMarcar = (dia.datos?.bloques ?? []).filter(
    (b) => b.marcable && b.estado !== "hecho" && b.estado !== "saltado" && Date.parse(b.inicio) <= t,
  );
  for (const b of sinMarcar) {
    if (!d[`b${b.id}`]) {
      return lista(`b${b.id}`, `🌙 ¿Hiciste ${b.emoji} ${b.titulo} (${b.hora})?`, [
        { texto: "✅ Sí", valor: "hecho" },
        { texto: "⤼ No", valor: "saltado" },
      ]);
    }
  }
  const items = sinMarcar.map((b) => ({ bloque_id: b.id, estado: d[`b${b.id}`] }));
  if (items.length) await llamar(ctx, "POST rutina/checks", { cuerpo: { items } });
  const c = (await llamar(ctx, "GET rutina/hoy")).datos?.cumplimiento;
  const hoy = await llamar(ctx, "GET hoy");
  if ((hoy.datos?.pendientes ?? []).some((p) => p.clave === "cierre_finanzas")) return { ir: "cierre_gastos" };
  return fin(c?.total ? `🌙 Día repasado · ${c.hechos} de ${c.total} hechos` : "🌙 Día repasado");
}

const PARA_CUANDO = [
  { texto: "📅 Hoy", valor: "hoy" },
  { texto: "🌅 Mañana", valor: "manana" },
  { texto: "🗓️ Esta semana", valor: "semana" },
  { texto: "∞ Sin fecha", valor: "nunca" },
];

/** 📝 Tengo que hacer algo: qué → para cuándo → primer paso de 2 minutos (lo que más ayuda a empezar). */
async function pendiente(ctx, d) {
  if (d.titulo == null) return texto("titulo", "📝 ¿Qué tienes que hacer? (ej. Taller de cálculo)");
  if (d.para == null) return lista("para", "⏰ ¿Para cuándo?", PARA_CUANDO);
  if (d.paso === undefined) {
    return texto("paso", "👣 ¿Cuál es el primer paso de 2 minutos? (ej. abrir el PDF). Puedes dejarlo vacío", { opcional: true });
  }
  const r = await llamar(ctx, "POST uni/tareas", {
    cuerpo: { titulo: d.titulo, para: d.para === "nunca" ? null : d.para, primer_paso: d.paso },
  });
  return r.ok ? fin(`📝 Anotado · ${d.titulo}`) : finDe(r);
}

/** Lo que conviene hacer ahora, en orden: bloque en curso, obligatorios vencidos, lo que falta registrar, tareas. */
async function candidatos(ctx) {
  const [ahora, hoy, tareas] = await Promise.all([llamar(ctx, "GET rutina/ahora"), llamar(ctx, "GET hoy"), llamar(ctx, "GET uni/tareas")]);
  const cosas = [];
  const actual = ahora.datos?.actual;
  if (actual && actual.marcable && actual.estado !== "hecho" && actual.estado !== "saltado") {
    cosas.push({ texto: `${actual.emoji} ${actual.titulo}`, detalle: `Hasta las ${actual.fin.slice(11, 16)}`, bloque: actual.id });
  }
  for (const p of hoy.datos?.pendientes ?? []) {
    const deRutina = String(p.clave ?? "").startsWith("rutina:");
    if (deRutina && p.bloque_id !== actual?.id) {
      cosas.push({ texto: `${p.emoji} ${p.texto}`, detalle: "Quedó sin marcar", bloque: p.bloque_id });
    } else if (!deRutina) {
      cosas.push({ texto: `${p.emoji} Registrar: ${p.texto}`, detalle: "Te toma menos de 15 segundos", ir: flujoDePendiente(p) });
    }
  }
  for (const t of tareas.datos?.tareas ?? []) {
    cosas.push({ texto: `📝 ${t.titulo}`, detalle: t.primer_paso ? `Empieza por: ${t.primer_paso}` : t.vence, tarea: t.id, paso: t.primer_paso });
  }
  return cosas;
}

/** 🎯 ¿Qué hago ahora?: una sola cosa a la vez, con su primer paso. "Otra cosa" muestra la siguiente. */
async function queHago(ctx, d) {
  const opciones = await candidatos(ctx);
  let n = 0;
  while (d[`c${n}`] === "otra") n++;
  const c = opciones[n];
  if (!c) return fin(n === 0 ? "🎉 Nada urgente. Adelanta algo o descansa" : "🎉 Eso era todo por ahora");
  const elegido = d[`c${n}`];
  if (!elegido) {
    const botones = c.ir
      ? [{ texto: "▶️ Registrar ya", valor: "voy" }]
      : [
          { texto: "▶️ Voy", valor: "voy" },
          { texto: "✅ Ya lo hice", valor: "ya" },
        ];
    return lista(`c${n}`, `🎯 Ahora: ${c.texto}\n${c.detalle ?? ""}`.trim(), [
      ...botones,
      { texto: "⏭️ Otra cosa", valor: "otra" },
      { texto: "😴 Ahora no", valor: "no" },
    ]);
  }
  if (elegido === "no") return fin("😴 Vale. Cuando vuelvas, empieza solo 2 minutos");
  if (c.ir) return c.ir;
  if (elegido === "ya") {
    return c.tarea
      ? finDe(await llamar(ctx, "POST uni/tareas/hecha", { cuerpo: { id: c.tarea, estado: "hecha" } }))
      : finDe(await llamar(ctx, "POST rutina/check", { cuerpo: { bloque_id: c.bloque, estado: "hecho" } }));
  }
  if (c.tarea) await llamar(ctx, "POST uni/tareas/hecha", { cuerpo: { id: c.tarea, estado: "en_progreso" } });
  return fin(`▶️ Vamos: ${c.paso ?? c.texto.replace(/^\S+\s/, "")}. 25 min sin celular`);
}

/** 🏋️ Entreno: si hay uno corriendo, terminarlo; si no, empezar uno del tipo que elijas. */
async function entreno(ctx, d) {
  const menuEjercicio = await llamar(ctx, "GET ejercicio/menu");
  if (menuEjercicio.datos?.en_curso) {
    if (!d.fin) {
      return lista("fin", menuEjercicio.mensaje, [
        { texto: "🏁 Terminé", valor: "si" },
        { texto: "↩️ Sigo entrenando", valor: "no" },
      ]);
    }
    if (d.fin === "no") return fin("💪 Dale, sigue");
    return finDe(await llamar(ctx, "POST ejercicio/fin"));
  }
  if (!d.tipo) return lista("tipo", "🏋️ ¿Qué vas a hacer?", menuEjercicio.datos?.tipos ?? []);
  const r = await llamar(ctx, "POST ejercicio/inicio", { cuerpo: { tipo: d.tipo } });
  return finDe(r, r.ok ? "Al terminar, abre 🐐 Goat › 🏋️ Entreno" : "");
}

/** 📚 Estudié: materia → cuánto tiempo. */
async function estudio(ctx, d) {
  if (!d.materia) return lista("materia", "📚 ¿Qué estudiaste?", MATERIAS.map((m) => m.texto));
  if (d.materia === "Otra" && d.otra == null) return texto("otra", "📚 ¿Qué materia?", { max: 60 });
  if (!d.minutos) return lista("minutos", "⏱️ ¿Cuánto tiempo?", DURACIONES.map((x) => ({ texto: x.texto, valor: Number(x.valor) })));
  const materia = d.materia === "Otra" ? d.otra : d.materia;
  const fila = { materia, minutos: d.minutos, momento: ctx.ahora.toISOString(), origen: ctx.origen };
  fila.id_cliente = await idCliente(ctx.db, "uni_sesiones", fila, ["materia", "minutos"], null, ctx.ahora);
  if (fila.id_cliente) await ctx.db.insert("uni_sesiones", fila, { devolver: false });
  return fin(`📚 Guardado · ${materia}`);
}

/** 🌙 / ☀️ sin automatización (o desde ella: "dormir cargador", "desperte alarma"). */
const evento = (tipo) => async (ctx, _d, arg) => {
  const r = await llamar(ctx, "POST sueno/evento", { cuerpo: { tipo, fuente: arg || "manual" } });
  if (!r.ok) return finDe(r);
  return r.datos?.aviso ? fin(r.datos.aviso) : { silencio: true };
};

/** 📊 ¿Cómo voy?: puntaje, racha y lo primero que falta. */
async function comoVoy(ctx) {
  const r = await llamar(ctx, "GET hoy");
  const h = r.datos;
  if (!h) return finDe(r);
  const falta = h.pendientes?.[0];
  return fin(
    [`📊 ${h.score} puntos${h.racha ? ` · 🔥 ${h.racha} ${h.racha === 1 ? "día" : "días"}` : ""}`, falta ? `${falta.emoji} Falta: ${falta.texto}` : "✅ Todo al día"].join(
      "\n",
    ),
  );
}

/** 🔔 Para la automatización "Hora del día": avisa solo si falta algo; si no, no molesta. */
async function aviso(ctx) {
  const r = await llamar(ctx, "GET notificaciones/ahora");
  return r.datos?.aviso ? fin(r.datos.aviso) : { silencio: true };
}

/**
 * 🔒 Puerta: la automatización "App › TikTok › Se abre" corre 🐐 Goat con «puerta tiktok».
 * Con minutos, deja pasar en silencio. Sin minutos, manda al iPhone a la pantalla de inicio y sigue con
 * "bloqueado": registrar lo que falta, usar el pase o dejarlo. La puerta se consulta una sola vez por apertura.
 */
async function puerta(ctx, d, arg) {
  const app = arg || "tiktok";
  if (!d.accion) {
    const r = await llamar(ctx, "GET desbloqueo/gate", { query: { app, origen: "automatizacion" } });
    // Si Goat no responde, la puerta queda abierta (D-015).
    if (!r.ok || r.datos?.accion !== "bloquear") return { silencio: true };
    d.accion = "bloquear";
    return { inicio: true };
  }
  return { ir: "bloqueado", a: app };
}

/** 🔓 "App › TikTok › Se cierra": anota el cierre para contar los minutos usados, sin avisar. */
async function cerre(ctx, _d, arg) {
  await llamar(ctx, "POST desbloqueo/evento", { cuerpo: { app: arg || "tiktok", evento: "cerrar", origen: "automatizacion" } });
  return { silencio: true };
}

/** 🔒 Después de que la Puerta te mandó al inicio: registrar lo que falta, usar el pase o dejarlo. */
async function bloqueado(ctx, d, arg) {
  const app = arg || "tiktok";
  const r = await llamar(ctx, "GET desbloqueo/estado");
  const e = r.datos;
  if (!e) return finDe(r);
  const nombre = e.apps?.find((a) => a.app === app)?.nombre ?? app;
  if (!d.opcion) {
    const faltan = (e.faltan ?? []).slice(0, 4).map((f) => ({ texto: `${f.emoji} Registrar ${f.texto}`, valor: flujoDePendiente(f) }));
    const pase = e.pase_disponible ? [{ texto: "🆘 Usar mi pase (10 min)", valor: { pase: true } }] : [];
    const pregunta = faltan.length ? `🔒 ${nombre}: primero lo que falta` : `⌛ Se acabó tu tiempo en ${nombre} hoy`;
    return lista("opcion", pregunta, [...faltan, ...pase, { texto: "😌 Ahora no", valor: { no: true } }]);
  }
  if (d.opcion.no) return fin("😌 Bien. Tu tiempo te lo agradece");
  if (d.opcion.pase) {
    const p = await llamar(ctx, "POST desbloqueo/pase", { cuerpo: { app } });
    return finDe(p, p.ok ? "Ábrela otra vez" : "");
  }
  return d.opcion;
}

export const FLUJOS = {
  menu,
  dinero,
  cierre_gastos: cierreGastos,
  comida,
  hecho,
  bloque,
  repaso,
  pendiente,
  ahora: queHago,
  entreno,
  estudio,
  dormir: evento("acostarse"),
  desperte: evento("despertar"),
  como_voy: comoVoy,
  aviso,
  puerta,
  cerre,
  bloqueado,
};

/** Nombres que se pueden escribir en la automatización («Texto» antes de «Ejecutar atajo»). */
const ALIAS = {
  "": "menu",
  gasto: "dinero",
  plata: "dinero",
  movimiento: "dinero",
  comi: "comida",
  terminado: "hecho",
  tarea: "pendiente",
  pendientes: "pendiente",
  que_hago: "ahora",
  gym: "entreno",
  estudie: "estudio",
  acostarse: "dormir",
  me_acuesto: "dormir",
  despertar: "desperte",
  cierre: "repaso",
  cerrar: "cerre",
  como: "como_voy",
};

/** "Comida almuerzo" → { f: "comida", a: "almuerzo" }. Un flujo que no existe abre el menú. */
function empezar(flujo) {
  const [primera = "", ...resto] = palabras(flujo);
  const nombre = FLUJOS[primera] ? primera : (ALIAS[primera] ?? "menu");
  return { f: nombre, a: nombre === "menu" ? "" : resto.join(" "), d: {}, p: null };
}

// ── Respuestas al atajo ──────────────────────────────────────────────────

function cuerpo(tipo, mensaje, extra = {}) {
  return {
    estado: 200,
    cuerpo: { ok: true, mensaje, tipo, pregunta: extra.pregunta ?? mensaje, opciones: extra.opciones ?? null, estado: extra.estado ?? "", datos: extra.datos ?? {} },
  };
}

/**
 * Una vuelta del atajo: { flujo?, estado?, respuesta? } → la siguiente pregunta o el final.
 * `flujo` solo cuenta al empezar (sin estado). Una respuesta que no sirve repite la pregunta con un aviso.
 */
export async function responder(ctxBase, { flujo, estado, respuesta } = {}) {
  const ctx = { ...ctxBase, origen: ctxBase.origen ?? "atajo" };
  let s = estado ? decodificar(String(estado)) : null;
  if (estado && !s) return cuerpo("fin", "⚠️ Se perdió la conversación. Abre 🐐 Goat otra vez");
  if (!s || !FLUJOS[s.f]) s = empezar(flujo);

  let aviso = "";
  if (s.p) {
    const pendienteAntes = await FLUJOS[s.f](ctx, s.d, s.a);
    if (pendienteAntes?.clave === s.p) {
      const leida = leerRespuesta(pendienteAntes, respuesta);
      if (leida.error) aviso = leida.error;
      else s.d[s.p] = leida.valor;
    }
    s.p = null;
  }

  for (let salto = 0; salto < MAX_SALTOS; salto++) {
    const r = await FLUJOS[s.f](ctx, s.d, s.a);
    if (r?.ir) {
      s = { f: FLUJOS[r.ir] ? r.ir : "menu", a: r.a ?? "", d: {}, p: null };
      continue;
    }
    if (r?.silencio) return cuerpo("silencio", "", { datos: { flujo: s.f } });
    // "inicio": el atajo va a la pantalla de inicio y vuelve a preguntar (sin respuesta pendiente).
    if (r?.inicio) return cuerpo("inicio", "🏠", { estado: codificar({ ...s, p: null }), datos: { flujo: s.f } });
    if (r?.fin !== undefined) return cuerpo("fin", r.fin, { datos: { flujo: s.f } });

    s.p = r.clave;
    const codificado = codificar(s);
    if (codificado.length > MAX_ESTADO) return cuerpo("fin", "⚠️ Demasiadas respuestas. Empieza otra vez");
    const pregunta = aviso ? `${aviso}\n${r.pregunta}` : r.pregunta;
    return cuerpo(r.tipo, pregunta, {
      pregunta,
      opciones: r.tipo === "lista" ? r.opciones.map((o) => o.texto) : null,
      estado: codificado,
      datos: { flujo: s.f, paso: r.clave },
    });
  }
  return cuerpo("fin", "⚠️ Me enredé. Abre 🐐 Goat otra vez");
}

export const _pruebas = { codificar, decodificar, empezar, leerRespuesta };
