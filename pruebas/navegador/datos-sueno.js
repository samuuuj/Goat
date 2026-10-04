// Datos de prueba de Sueño para el simulador (pruebas/navegador/simulador.js). Nada de esto existe en Supabase.
// Una semana variada que termina anoche: cargador antes de "En cama", celular hasta tarde, una noche sin datos,
// solo Salud, acostarse después de medianoche, y la última con "Hora de dormir" + cargador + alarma.

import { diaLogico } from "/js/logica/dia.js";
import { sumarDias } from "/js/logica/calculo.js";
import { duracionCorta, resumenSueno } from "/js/sueno/logica.js";
import { momento } from "./datos.js";

/** Momento ISO de una noche: las horas antes de mediodía son de la madrugada siguiente. */
function deNoche(fecha, hora) {
  return momento(hora < "12:00" ? sumarDias(fecha, 1) : fecha, hora);
}

export function agregar(datos, _usuario) {
  const hoy = diaLogico(new Date());
  const noche = (dias) => sumarDias(hoy, -dias);
  const eventos = [];
  const muestras = [];
  const evento = (fecha, tipo, fuente, hora) => {
    const m = deNoche(fecha, hora);
    eventos.push({ tipo, fuente, momento: m, origen: fuente === "manual" ? "web" : "atajo", creado_en: m });
  };
  const enCama = (fecha, desde, hasta) => {
    const fin = deNoche(fecha, hasta);
    muestras.push({ inicio: deNoche(fecha, desde), fin, tipo: "en_cama", fuente: "salud", creado_en: fin });
  };

  // Hace 7 noches: horario de Salud + cargador, en cama casi enseguida.
  evento(noche(7), "acostarse", "hora_dormir", "22:30");
  evento(noche(7), "acostarse", "cargador", "22:45");
  enCama(noche(7), "22:50", "06:10");
  evento(noche(7), "despertar", "despertar", "06:10");
  // Hace 6: se acostó a la 01:30 (anotado a mano) y la alarma a las 07:00.
  evento(noche(6), "acostarse", "manual", "01:30");
  evento(noche(6), "despertar", "alarma", "07:00");
  // Hace 5: solo Salud.
  enCama(noche(5), "23:10", "07:20");
  // Hace 4: nada (el atajo no corrió).
  // Hace 3: cargador y alarma.
  evento(noche(3), "acostarse", "cargador", "22:50");
  evento(noche(3), "despertar", "alarma", "06:00");
  // Hace 2: Modo Sueño a las 22:30 pero siguió con el celular hasta las 00:40.
  evento(noche(2), "acostarse", "modo_sueno", "22:30");
  enCama(noche(2), "00:40", "07:00");
  evento(noche(2), "despertar", "despertar", "06:55");
  // Anoche: hora de dormir, cargador a las 23:20, en cama 23:35 y alarma a las 06:05.
  evento(noche(1), "acostarse", "hora_dormir", "22:30");
  evento(noche(1), "acostarse", "cargador", "23:20");
  enCama(noche(1), "23:35", "06:12");
  evento(noche(1), "despertar", "alarma", "06:05");

  datos.tablas.sueno_eventos = eventos;
  datos.tablas.sueno_muestras = muestras;
}

/** Respuestas simuladas de /api/v1 de Sueño (para el botón "Probar" del asistente Conectar). */
export function api(api, _usuario) {
  const leer = (datos) => ({
    metas: { ...(datos.tablas.perfil?.[0]?.metas ?? {}), ...(datos.tablas.perfil?.[0]?.ajustes?.sueno ?? {}) },
    eventos: datos.tablas.sueno_eventos ?? [],
    muestras: datos.tablas.sueno_muestras ?? [],
  });

  api["GET sueno/resumen"] = async ({ datos }) => {
    const resumen = resumenSueno(leer(datos), new Date());
    const n = resumen.ultimaNoche;
    const mensaje = n?.completa ? `🌙 ${n.etiqueta} ${duracionCorta(n.duracionMin)}` : "🌙 Sin noches todavía";
    return { ok: true, mensaje, datos: resumen };
  };

  api["POST sueno/evento"] = async ({ cuerpo, datos }) => {
    const tipo = cuerpo.tipo === "despertar" ? "despertar" : "acostarse";
    const ahora = new Date().toISOString();
    (datos.tablas.sueno_eventos ??= []).push({ tipo, fuente: cuerpo.fuente || "manual", momento: cuerpo.momento || ahora, creado_en: ahora });
    const mensaje = tipo === "acostarse" ? "🌙 Buenas noches" : "☀️ Buenos días";
    return { estado: 201, ok: true, mensaje, datos: { guardado: true, aviso: mensaje } };
  };

  api["POST sueno/sync"] = async () => ({ ok: true, mensaje: "🛏️ Salud sincronizada", datos: { guardadas: 0, nuevas: 0, omitidas: 0 } });
}
