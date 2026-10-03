// Datos de prueba del simulador (pruebas/navegador/simulador.js). Nada de esto existe en Supabase.
// Cada módulo agrega los suyos en pruebas/navegador/datos-<modulo>.js:
//   export function agregar(datos, usuario) { datos.tablas.mi_tabla = [...] }
//   export function api(api, usuario) { api["GET mi/ruta"] = async ({ cuerpo, query, datos }) => ({ ok: true, mensaje: "…", datos: {} }) }

import { diaLogico } from "/js/logica/dia.js";
import { sumarDias } from "/js/logica/calculo.js";

const hoy = () => diaLogico(new Date());
/** Momento ISO de un día lógico a una hora de Bogotá ("2026-10-02", "13:10"). */
export const momento = (fecha, hora) => new Date(`${fecha}T${hora}:00-05:00`).toISOString();

function apiBase() {
  const tokens = [];
  return {
    "GET ping": async () => ({ ok: true, mensaje: "✅ Conectado", datos: { version: "1", conectado: true } }),
    "GET tokens": async () => ({ ok: true, mensaje: "🔑 Tus llaves", datos: { tokens } }),
    "POST tokens": async ({ cuerpo }) => {
      const fila = { id: crypto.randomUUID(), nombre: cuerpo.nombre ?? "iPhone", revocado: false, ultimo_uso: null, creado_en: new Date().toISOString() };
      tokens.unshift(fila);
      return { estado: 201, ok: true, mensaje: "🔑 Llave creada", datos: { ...fila, token: "PRUEBA_" + "x".repeat(36) } };
    },
    "DELETE tokens": async ({ cuerpo }) => {
      const t = tokens.find((x) => x.id === cuerpo.id);
      if (t) t.revocado = true;
      return { ok: true, mensaje: "🔒 Llave revocada", datos: { id: cuerpo.id } };
    },
  };
}

export function vacio() {
  return {
    tablas: {
      perfil: [{ user_id: "11111111-1111-4111-8111-111111111111", nombre: "Samuel", metas: {}, ajustes: {} }],
      festivos: [],
    },
    api: apiBase(),
  };
}

export function ejemplo(usuario) {
  const d = vacio();
  const f = hoy();
  const ayer = sumarDias(f, -1);
  d.tablas.perfil[0].user_id = usuario;
  d.tablas.comidas = [
    { tipo: "desayuno", kcal: 520, proteina_g: 28, omitida: false, fecha: f, momento: momento(f, "07:40") },
    { tipo: "desayuno", kcal: 480, proteina_g: 24, omitida: false, fecha: ayer, momento: momento(ayer, "07:30") },
    { tipo: "almuerzo", kcal: 950, proteina_g: 40, omitida: false, fecha: ayer, momento: momento(ayer, "13:10") },
    { tipo: "cena", kcal: 700, proteina_g: 35, omitida: false, fecha: ayer, momento: momento(ayer, "20:00") },
  ];
  d.tablas.finanzas_movimientos = [
    { tipo: "egreso", monto: 12000, categoria: "comida", cuenta: "nequi", fecha: f, momento: momento(f, "08:10") },
    { tipo: "egreso", monto: 25000, categoria: "comida", cuenta: "nequi", descripcion: "Cena", fecha: ayer, momento: momento(ayer, "19:42") },
  ];
  d.tablas.checkins = [{ modulo: "finanzas", tipo: "cierre", fecha: ayer, momento: momento(ayer, "22:30") }];
  d.tablas.uni_sesiones = [{ materia: "calculo", minutos: 50, fecha: f }];
  d.tablas.gym_sesiones = [{ rutina: "pierna", fecha: ayer, momento: momento(ayer, "17:00") }];
  d.tablas.notificaciones = [];
  return d;
}
