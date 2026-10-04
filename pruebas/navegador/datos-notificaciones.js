// Datos de prueba del centro de notificaciones para el simulador (pruebas/navegador/simulador.js).
// Varias notificaciones de distintos módulos y días, sin montos. Nada de esto existe en Supabase.
// Ver en http://localhost:3000/_pruebas/index.html → tocar la 🔔.

import { diaLogico } from "/js/logica/dia.js";

const MINUTO = 60_000;

function fila(usuario, minutosAtras, datos, { leida = false } = {}) {
  const momento = new Date(Date.now() - minutosAtras * MINUTO);
  return {
    id: crypto.randomUUID(),
    user_id: usuario,
    emoji: "🔔",
    cuerpo: null,
    url: null,
    clave: `demo:${datos.modulo}:${minutosAtras}`,
    leida_en: leida ? new Date(momento.getTime() + MINUTO).toISOString() : null,
    descartada_en: null,
    momento: momento.toISOString(),
    fecha: diaLogico(momento),
    origen: "automatizacion",
    creado_en: momento.toISOString(),
    ...datos,
  };
}

/**
 * Agrega filas a la tabla `notificaciones` del simulador. Idempotente: el simulador puede llamarla
 * más de una vez si varias consultas arrancan a la vez (ver SOLICITUDES.md).
 */
export function agregar(datos, usuario) {
  const hora = 60;
  const dia = 24 * hora;
  datos.tablas.notificaciones = [
    ...(datos.tablas.notificaciones ?? []).filter((n) => !String(n.clave ?? "").startsWith("demo:")),
    // Hoy
    fila(usuario, 2, { modulo: "rutina", emoji: "🗓️", titulo: "Clase presencial en 15 min", cuerpo: "Cálculo integral · salón 204. Sal con tiempo.", url: "rutina.html" }),
    fila(usuario, 12, { modulo: "finanzas", emoji: "💸", titulo: "Movimiento guardado", cuerpo: "Desde el iPhone · Comida · Nequi.", url: "finanzas.html" }),
    fila(usuario, 25, { modulo: "desbloqueo", emoji: "🔓", titulo: "Ganaste 60 min para tus apps", cuerpo: "Pasaste los 80 puntos. TikTok, Instagram y YouTube tienen más tiempo hoy.", url: "desbloqueo.html" }),
    fila(usuario, 48, { modulo: "finanzas", emoji: "🧾", titulo: "Gastos del día al día", cuerpo: "Registraste todo lo de la mañana.", url: "finanzas.html" }),
    fila(usuario, 3 * hora, { modulo: "finanzas", emoji: "💳", titulo: "Pago de la tarjeta en 3 días", cuerpo: "Revisa tus deudas en Dinero.", url: "finanzas.html" }, { leida: true }),
    fila(usuario, 2 * hora, { modulo: "ejercicio", emoji: "🏋️", titulo: "Entreno guardado", cuerpo: "Fuerza · 55 min. Te faltan 2 esta semana.", url: "ejercicio.html" }, { leida: true }),
    fila(usuario, 5 * hora, { modulo: "sueno", emoji: "🌙", titulo: "Dormiste 7 h 20 min", cuerpo: "Te acostaste a las 23:40 y te levantaste a las 07:00. Mejor que tu promedio de la semana.", url: "sueno.html" }, { leida: true }),
    // Esta semana
    fila(usuario, dia + 2 * hora, { modulo: "puntuacion", emoji: "🔥", titulo: "7 días seguidos", cuerpo: "Una semana completa registrando. Sigue así.", url: "index.html#semana" }),
    fila(usuario, dia + 4 * hora, { modulo: "comidas", emoji: "🌙", titulo: "Cena pendiente", cuerpo: "Regístrala antes de dormir. «No comí» también cuenta.", url: "index.html#pendientes" }, { leida: true }),
    fila(usuario, 2 * dia, { modulo: "sueno", emoji: "🌙", titulo: "Hora de relajarte", cuerpo: "Mañana tienes clase temprano.", url: "sueno.html" }, { leida: true }),
    fila(usuario, 3 * dia, { modulo: "universidad", emoji: "📚", titulo: "Entrega de Física mañana", cuerpo: "Primer paso: abrir el enunciado y leer la parte 1.", url: "rutina.html" }, { leida: true }),
    fila(usuario, 3 * dia + hora, { modulo: "universidad", emoji: "📝", titulo: "Parcial de Cálculo el viernes", cuerpo: "Repasa integrales por partes.", url: "rutina.html" }, { leida: true }),
    // Antes
    fila(usuario, 12 * dia, { modulo: "conectar", emoji: "📲", titulo: "iPhone conectado", cuerpo: "Los atajos ya pueden hablar con Goat.", url: "conectar.html" }, { leida: true }),
    fila(usuario, 15 * dia, { modulo: "puntuacion", emoji: "⭐", titulo: "Día de 100", cuerpo: "Puntaje perfecto. Hoy no hay nada más que pedir.", url: "index.html#anillos" }, { leida: true }),
  ];
}

/** Respuestas simuladas de /api/v1 del módulo (las mismas formas que api/_rutas/notificaciones.js). */
export function api(rutas) {
  const propias = (datos) => (datos.tablas.notificaciones ?? []).filter((n) => !n.descartada_en);

  rutas["GET notificaciones/ahora"] = async () => ({
    ok: true,
    mensaje: "🍽️ Almuerzo pendiente",
    datos: { notificar: true, mensaje: "🍽️ Almuerzo pendiente", aviso: "🍽️ Almuerzo pendiente", pendientes: 1 },
  });

  rutas["GET notificaciones"] = async ({ datos }) => {
    const lista = propias(datos).sort((a, b) => (a.momento < b.momento ? 1 : -1));
    const noLeidas = lista.filter((n) => !n.leida_en).length;
    return {
      ok: true,
      mensaje: noLeidas ? `🔔 ${noLeidas} sin leer` : "🔔 Al día",
      datos: { no_leidas: noLeidas, notificaciones: lista.slice(0, 20) },
    };
  };

  rutas["POST notificaciones/leidas"] = async ({ cuerpo, datos }) => {
    const ids = new Set(cuerpo.ids ?? []);
    let marcadas = 0;
    for (const n of propias(datos)) {
      if (!n.leida_en && (cuerpo.todas === true || ids.has(n.id))) {
        n.leida_en = new Date().toISOString();
        marcadas++;
      }
    }
    return { ok: true, mensaje: "✅ Leídas", datos: { marcadas } };
  };
}
