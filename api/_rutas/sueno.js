// Rutas de /api/v1 de Sueño (D-055): las usan los atajos "🌙 Me acuesto" y "☀️ Desperté".
// Los atajos solo mandan lo que pasó; la noche, la duración y el índice se calculan con web/js/sueno/logica.js.
// Mensajes cortos con emoji (la duración sí puede ir: no es dinero).

import { ok, ErrorApi } from "../_lib/respuesta.js";
import { idCliente, origen } from "../_lib/validar.js";
import { notificar } from "../_lib/notificar.js";
import {
  FUENTES,
  TIPOS_EVENTO,
  cuentaCargador,
  duracionCorta,
  leerFecha,
  leerMuestras,
  resumenSueno,
} from "../../web/js/sueno/logica.js";

const DIA_MS = 86_400_000;
/** Días que se leen para armar la semana y el índice (con margen). */
const DIAS_HISTORIA = 21;
/** Un evento del mismo tipo dentro de esta ventana ya fue avisado (Hora de dormir + Modo Sueño, alarma + Despertar). */
const VENTANA_REPETIDO_MIN = { acostarse: 10, despertar: 30 };

const invalido = (campo) => new ErrorApi("DATO_INVALIDO", `⚠️ Revisa: ${campo}`);

/** "Modo sueño", "hora de dormir", "CARGADOR" → valor de la lista. Vacío = manual (atajo tocado a mano). */
function leerFuente(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === "") return "manual";
  const texto = String(valor)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/^hora_de_dormir$/, "hora_dormir");
  if (!FUENTES.includes(texto)) throw invalido("fuente");
  return texto;
}

function leerTipo(valor) {
  const texto = String(valor ?? "").trim().toLowerCase();
  if (!TIPOS_EVENTO.includes(texto)) throw invalido("tipo");
  return texto;
}

/** Momento del evento: ISO 8601 (o la fecha sin formatear de Atajos). Sin valor = ahora. Máximo 7 días atrás. */
function leerMomento(valor, ahora) {
  if (valor === undefined || valor === null || valor === "") return ahora;
  const fecha = leerFecha(valor);
  if (!fecha) throw invalido("momento");
  const t = fecha.getTime();
  if (t > ahora.getTime() + 10 * 60_000 || t < ahora.getTime() - 7 * DIA_MS) throw invalido("momento");
  return fecha;
}

/** Lo que hace falta para resumenSueno(): metas, eventos y muestras de las últimas 3 semanas. */
async function cargar(db, ahora) {
  const desde = new Date(ahora.getTime() - DIAS_HISTORIA * DIA_MS).toISOString();
  const [perfil, eventos, muestras] = await Promise.all([
    db.select("perfil", { columnas: "metas", limite: 1 }),
    db.select("sueno_eventos", {
      columnas: "tipo,fuente,momento,creado_en",
      filtros: { momento: `gte.${desde}` },
      orden: "momento.asc",
    }),
    db.select("sueno_muestras", { columnas: "inicio,fin,tipo", filtros: { fin: `gte.${desde}` }, orden: "inicio.asc" }),
  ]);
  return { metas: perfil[0]?.metas ?? {}, eventos, muestras };
}

/** Guarda las muestras sin duplicar (única por usuario + inicio + tipo). Devuelve cuántas eran nuevas. */
async function guardarMuestras(db, muestras, origenFila) {
  if (muestras.length === 0) return 0;
  const inicios = muestras.map((m) => m.inicio).sort();
  const existentes = await db.select("sueno_muestras", {
    columnas: "inicio,tipo",
    filtros: { inicio: [`gte.${inicios[0]}`, `lte.${inicios.at(-1)}`] },
  });
  const ya = new Set(existentes.map((e) => `${Date.parse(e.inicio)}|${e.tipo}`));
  const nuevas = muestras.filter((m) => !ya.has(`${Date.parse(m.inicio)}|${m.tipo}`)).length;
  const filas = muestras.map((m) => ({ inicio: m.inicio, fin: m.fin, tipo: m.tipo, fuente: "salud", origen: origenFila }));
  for (let i = 0; i < filas.length; i += 100) {
    await db.upsert("sueno_muestras", filas.slice(i, i + 100), { conflicto: "user_id,inicio,tipo" });
  }
  return nuevas;
}

/** ¿Ya había un evento del mismo tipo hace poco? (para no avisar dos veces). */
async function yaAvisado(db, tipo, momento) {
  const ventana = VENTANA_REPETIDO_MIN[tipo] * 60_000;
  const filas = await db.select("sueno_eventos", {
    columnas: "id",
    filtros: {
      tipo: `eq.${tipo}`,
      momento: [`gte.${new Date(momento.getTime() - ventana).toISOString()}`, `lte.${new Date(momento.getTime() + ventana).toISOString()}`],
    },
    limite: 1,
  });
  return filas.length > 0;
}

/** Datos cortos de una noche para el atajo y el widget. */
function nocheCorta(noche) {
  if (!noche) return null;
  const { fecha, acostarse, despertar, duracionMin, completa, fuente, fuenteDespertar, celularMin } = noche;
  return { fecha, acostarse, despertar, duracionMin, duracion: duracionCorta(duracionMin), completa, fuente, fuenteDespertar, celularMin };
}

export default {
  /**
   * "Me acuesto" o "Desperté". Cuerpo: { tipo, fuente?, momento?, muestras?, id_cliente?, origen? }.
   * `muestras` (opcional, con "desperté"): lo de Salud de las últimas 18 h, para mandar todo en una sola llamada.
   * `datos.aviso`: texto para "Mostrar notificación"; vacío cuando no hay nada que avisar (cargador de día, repetido).
   */
  "POST sueno/evento": async ({ db, cuerpo, ahora }) => {
    const tipo = leerTipo(cuerpo.tipo);
    const fuente = leerFuente(cuerpo.fuente);
    const momento = leerMomento(cuerpo.momento, ahora);
    const origenFila = origen(cuerpo.origen);

    // El cargador de día no es "me acuesto" (la regla vive aquí, no en el atajo).
    if (tipo === "acostarse" && fuente === "cargador" && !cuentaCargador(momento)) {
      return ok("🔌 Cargando", { guardado: false, aviso: "", motivo: "fuera_de_horario" });
    }

    let muestras = { nuevas: 0, omitidas: 0 };
    if (cuerpo.muestras !== undefined && cuerpo.muestras !== null && cuerpo.muestras !== "") {
      const leidas = leerMuestras(cuerpo.muestras);
      muestras = { nuevas: await guardarMuestras(db, leidas.muestras, origenFila), omitidas: leidas.omitidas };
    }

    const fila = { tipo, fuente, momento: momento.toISOString(), origen: origenFila };
    const repetido = await yaAvisado(db, tipo, momento);
    fila.id_cliente = await idCliente(db, "sueno_eventos", fila, ["tipo", "fuente"], cuerpo.id_cliente, ahora);
    const guardado = Boolean(fila.id_cliente) && (await db.insert("sueno_eventos", fila)).length > 0;
    const avisar = guardado && !repetido;

    if (tipo === "acostarse") {
      return ok("🌙 Buenas noches", { guardado, aviso: avisar ? "🌙 Buenas noches" : "", evento: fila, muestras }, guardado ? 201 : 200);
    }

    // Desperté: la noche que acaba de terminar, con su duración.
    const resumen = resumenSueno(await cargar(db, ahora), ahora);
    const noche = resumen.ultimaNoche;
    const conDuracion = noche?.completa && noche.etiqueta === "Anoche";
    const mensaje = conDuracion ? `☀️ Buenos días · ${duracionCorta(noche.duracionMin)}` : "☀️ Buenos días";

    if (avisar && conDuracion) {
      const indice = resumen.indice.valor === null ? "" : `Índice ${resumen.indice.valor} · `;
      await notificar(db, {
        modulo: "sueno",
        emoji: "☀️",
        titulo: `Dormiste ${duracionCorta(noche.duracionMin)}`,
        cuerpo: `${indice}${resumen.indice.frase}`.slice(0, 160),
        url: "sueno.html",
        clave: `sueno:${noche.fecha}`,
      }).catch((e) => console.error("[sueno] notificar:", e?.message ?? e));
    }

    return ok(
      mensaje,
      { guardado, aviso: avisar ? mensaje : "", evento: fila, muestras, noche: nocheCorta(noche), indice: resumen.indice.valor },
      guardado ? 201 : 200,
    );
  },

  /** Muestras de "Buscar muestras de salud" (Análisis del sueño). Repetir la misma no duplica. */
  "POST sueno/sync": async ({ db, cuerpo }) => {
    const { muestras, omitidas } = leerMuestras(cuerpo.muestras ?? cuerpo);
    if (muestras.length === 0) {
      if (omitidas > 0) throw invalido("muestras");
      return ok("🛏️ Nada nuevo de Salud", { guardadas: 0, nuevas: 0, omitidas: 0 });
    }
    const nuevas = await guardarMuestras(db, muestras, origen(cuerpo.origen));
    return ok("🛏️ Salud sincronizada", { guardadas: muestras.length, nuevas, omitidas });
  },

  /** Última noche, índice, promedios y la semana (lo mismo que ve sueno.html). */
  "GET sueno/resumen": async ({ db, ahora }) => {
    const resumen = resumenSueno(await cargar(db, ahora), ahora);
    const noche = resumen.ultimaNoche;
    let mensaje = "🌙 Sin noches todavía";
    if (noche?.completa) {
      const indice = resumen.indice.valor === null ? "" : ` · índice ${resumen.indice.valor}`;
      mensaje = `🌙 ${noche.etiqueta} ${duracionCorta(noche.duracionMin)}${indice}`;
    } else if (noche) mensaje = "🌙 Noche a medias";
    return ok(mensaje, resumen);
  },
};
