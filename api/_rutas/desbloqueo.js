// Rutas de /api/v1 del desbloqueo por puntaje (D-054). Las reglas están en web/js/desbloqueo/logica.js.
//   GET  desbloqueo/gate?app=tiktok  → la puerta: ¿puedo abrir? (y anota la apertura)
//   POST desbloqueo/evento           → { app, evento: "cerrar" | "abrir" }
//   POST desbloqueo/pase             → { app } pase de emergencia de 10 min, 1 al día
//   GET  desbloqueo/estado           → todo lo de hoy, sin anotar nada (widget, botón "Probar")
// Si la API no responde, el atajo deja pasar (D-015): eso lo maneja el atajo, no el servidor.
// Mensajes: emoji + pocas palabras, nunca montos (D-020).

import { randomUUID } from "node:crypto";
import { ErrorApi, ok } from "../_lib/respuesta.js";
import { cargarRegistrosServidor } from "../_lib/registros.js";
import { notificar } from "../_lib/notificar.js";
import { esUuid, fechaIso, idCliente, origen, texto, uno } from "../_lib/validar.js";
import { construirResumen } from "../../web/js/logica/calculo.js";
import { diaLogico } from "../../web/js/logica/dia.js";
import {
  APP_VALIDA,
  PASE,
  buscarApp,
  comoRegistrar,
  estadoApp,
  estadoDesbloqueo,
  listaFaltan,
  mensajeGate,
  minutosUsados,
  pista,
  slugApp,
} from "../../web/js/desbloqueo/logica.js";

const MINUTO_MS = 60_000;

/** "TikTok" o "tiktok" → "tiktok". Si no sirve: 400 "⚠️ Revisa: app" (y el atajo deja pasar). */
function leerApp(valor) {
  const id = slugApp(texto(valor, 40, "app"));
  if (!APP_VALIDA.test(id)) throw new ErrorApi("DATO_INVALIDO", "⚠️ Revisa: app");
  return id;
}

/** Origen de la web ("https://goat.vercel.app") a partir de la petición, para los enlaces de "Registrar ahora". */
function origenWeb(encabezados = {}) {
  const host = String(encabezados["x-forwarded-host"] ?? encabezados.host ?? "")
    .split(",")[0]
    .trim();
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return null;
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  return `${local ? "http" : "https"}://${host}`;
}

/**
 * Lo que necesita la regla, leído desde el servidor: resumen del día (mismo cálculo que Hoy),
 * ajustes del desbloqueo, eventos y pases de hoy. El widget (E) también lo puede usar.
 */
export async function cargarDesbloqueo(db, ahora = new Date()) {
  const hoy = diaLogico(ahora);
  const [registros, perfil, eventos, pases] = await Promise.all([
    cargarRegistrosServidor(db, ahora),
    db.select("perfil", { columnas: "ajustes", limite: 1 }),
    db.select("apps_eventos", { columnas: "app,evento,permitido,momento,fecha", filtros: { fecha: `eq.${hoy}` }, orden: "momento.asc" }),
    db.select("desbloqueo_pases", { columnas: "app,minutos,momento,fecha,id_cliente", filtros: { fecha: `eq.${hoy}` }, orden: "momento.asc" }),
  ]);
  return {
    hoy,
    resumen: construirResumen(registros, ahora),
    ajustes: perfil[0]?.ajustes?.desbloqueo,
    eventos,
    pases,
  };
}

/** Lo que falta registrar, con el atajo o la página que lo registra. */
function faltanParaAtajo(faltan, web) {
  return faltan.map((p) => ({ clave: p.clave, texto: p.texto, emoji: p.emoji, ...comoRegistrar(p, web) }));
}

/** 🎉 al ganar un nivel por encima de "al día" (una sola vez por día y nivel, gracias a `clave`). */
async function avisarNivel(db, estado, hoy, ahora) {
  if (estado.nivel.indice < 1) return;
  await notificar(db, {
    modulo: "desbloqueo",
    emoji: "🎉",
    titulo: `${estado.nivel.minutos} min desbloqueados`,
    cuerpo: `${estado.nivel.nombre}: cada app tiene ${estado.nivel.minutos} min hoy.`,
    url: "desbloqueo.html",
    clave: `desbloqueo:nivel:${hoy}:${estado.nivel.puntaje}`,
    momento: ahora,
  });
}

export default {
  /** La puerta. La llama "🔒 Puerta" cada vez que se abre una app. */
  "GET desbloqueo/gate": async ({ db, query, ahora, encabezados }) => {
    const app = leerApp(query.app);
    const datos = await cargarDesbloqueo(db, ahora);
    const estado = estadoApp({ ...datos, app, ahora });

    await db.insert(
      "apps_eventos",
      {
        app,
        evento: "abrir",
        permitido: estado.permitido,
        momento: ahora.toISOString(),
        origen: origen(query.origen ?? "automatizacion"),
        id_cliente: randomUUID(),
      },
      { devolver: false },
    );
    // Un aviso que no se pudo guardar no cierra la puerta.
    await avisarNivel(db, estado, datos.hoy, ahora).catch(() => {});

    const faltan = faltanParaAtajo(estado.faltan, origenWeb(encabezados));
    const mensaje = mensajeGate(estado);
    return ok(mensaje, {
      app,
      nombre: estado.nombre,
      permitido: estado.permitido,
      // Texto para el "Si" del atajo: solo "bloquear" cierra; cualquier otra cosa (o un error) deja pasar.
      accion: estado.permitido ? "pasar" : "bloquear",
      mensaje,
      minutos_restantes: estado.restantes,
      minutos_ganados: estado.ganados,
      minutos_usados: estado.usados,
      minutos_pase: estado.pase,
      pase_disponible: estado.paseDisponible,
      faltan,
      abrir: faltan[0]?.abrir ?? null,
      puntaje: estado.score,
      nivel: { nombre: estado.nivel.nombre, minutos: estado.nivel.minutos },
      siguiente: estado.siguienteNivel ? { puntaje: estado.siguienteNivel.puntaje, minutos: estado.siguienteNivel.minutos } : null,
      pista: pista(estado),
    });
  },

  /** Cierre (o apertura sin puerta) de una app. La llama "🔓 Cerré app". */
  "POST desbloqueo/evento": async ({ db, cuerpo, ahora }) => {
    const app = leerApp(cuerpo.app);
    const evento = uno(cuerpo.evento ?? "cerrar", ["abrir", "cerrar"], "evento");
    const momento = fechaIso(cuerpo.momento, "momento", ahora);
    if (momento.getTime() > ahora.getTime() + 5 * MINUTO_MS || momento.getTime() < ahora.getTime() - 2 * 24 * 60 * MINUTO_MS) {
      throw new ErrorApi("DATO_INVALIDO", "⚠️ Revisa: momento");
    }
    const fila = { app, evento, momento: momento.toISOString(), origen: origen(cuerpo.origen) };
    fila.id_cliente = await idCliente(db, "apps_eventos", fila, ["app", "evento", "momento"], cuerpo.id_cliente, ahora);
    if (fila.id_cliente) await db.insert("apps_eventos", fila, { devolver: false });

    const eventos = await db.select("apps_eventos", {
      columnas: "app,evento,momento,fecha",
      filtros: { fecha: `eq.${diaLogico(ahora)}`, app: `eq.${app}` },
      orden: "momento.asc",
    });
    const usados = Math.round(minutosUsados(eventos, app, ahora));
    const { nombre } = buscarApp(app);
    const mensaje = evento === "cerrar" ? `👋 ${usados} min hoy en ${nombre}` : `👀 ${nombre}`;
    return ok(mensaje, { app, evento, minutos_usados: usados }, 201);
  },

  /** Pase de emergencia: 10 min para esa app, uno al día. */
  "POST desbloqueo/pase": async ({ db, cuerpo, ahora }) => {
    const app = leerApp(cuerpo.app);
    if (cuerpo.id_cliente != null && cuerpo.id_cliente !== "" && !esUuid(cuerpo.id_cliente)) {
      throw new ErrorApi("DATO_INVALIDO", "⚠️ Revisa: id_cliente");
    }
    const hoy = diaLogico(ahora);
    const deHoy = () =>
      db.select("desbloqueo_pases", { columnas: "app,minutos,momento,id_cliente", filtros: { fecha: `eq.${hoy}` }, orden: "momento.asc" });
    const { nombre } = buscarApp(app);
    const listo = (minutos) => ok(`🆘 ${minutos} min en ${nombre}`, { app, minutos, pase_disponible: false }, 201);

    // ¿Es un reintento del mismo pase? (mismo id_cliente, o misma app hace menos de 60 s sin id_cliente)
    const esReintento = (p) =>
      cuerpo.id_cliente ? p.id_cliente === cuerpo.id_cliente : p.app === app && Math.abs(ahora - Date.parse(p.momento)) < MINUTO_MS;

    const previos = await deHoy();
    const repetido = previos.find(esReintento);
    if (repetido) return listo(Number(repetido.minutos) || PASE.minutos);
    if (previos.length >= PASE.porDia) throw new ErrorApi("PASE_USADO", "🔒 Ya usaste el pase de hoy", 409);

    const fila = {
      app,
      minutos: PASE.minutos,
      momento: ahora.toISOString(),
      origen: origen(cuerpo.origen),
      id_cliente: cuerpo.id_cliente || randomUUID(),
    };
    const guardadas = await db.insert("desbloqueo_pases", fila);
    if (guardadas.length === 0) {
      // Chocó con el índice "uno por día" (dos toques a la vez) o con su propio id_cliente.
      const ahoraHay = await deHoy();
      if (!ahoraHay.some((p) => p.id_cliente === fila.id_cliente)) {
        throw new ErrorApi("PASE_USADO", "🔒 Ya usaste el pase de hoy", 409);
      }
    }
    return listo(PASE.minutos);
  },

  /** Estado completo de hoy (no anota aperturas). */
  "GET desbloqueo/estado": async ({ db, ahora }) => {
    const datos = await cargarDesbloqueo(db, ahora);
    const estado = estadoDesbloqueo({ ...datos, ahora });
    const mensaje = estado.abierto ? `✅ ${estado.nivel.minutos} min por app` : `🔒 Falta: ${listaFaltan(estado.faltan)}`;
    return ok(mensaje, {
      fecha: estado.fecha,
      abierto: estado.abierto,
      puntaje: estado.score,
      nivel: estado.nivel,
      siguiente: estado.siguienteNivel,
      niveles: estado.niveles,
      faltan: faltanParaAtajo(estado.faltan, null).map(({ clave, texto: t, emoji, atajo }) => ({ clave, texto: t, emoji, atajo })),
      pase_disponible: estado.paseDisponible,
      pase_usado: estado.paseUsado,
      apps: estado.apps.map((a) => ({
        app: a.app,
        nombre: a.nombre,
        emoji: a.emoji,
        permitido: a.permitido,
        minutos_restantes: a.restantes,
        minutos_ganados: a.ganados,
        minutos_usados: a.usados,
        minutos_pase: a.pase,
      })),
      minutos_usados_total: estado.usadosTotal,
      pista: pista({ nivel: estado.nivel, siguienteNivel: estado.siguienteNivel }),
    });
  },
};
