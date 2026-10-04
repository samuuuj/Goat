// Hoja inferior de Movimiento: registrar un entreno a mano (tipo, día, hora de inicio y fin, distancia, notas),
// editar o borrar uno del historial, y terminar el entreno en curso con su distancia.

import { chips } from "../piezas/chips.js";
import { crearHoja } from "../piezas/hoja.js";
import { avisar, nuevoId } from "../piezas/ui.js";
import { diaLogico, diaYMes, horaBogota, nombreDia } from "../logica/dia.js";
import { formatoDuracion } from "../logica/formato.js";
import { RUTINAS, TIPOS_EJERCICIO } from "../logica/catalogos.js";
import {
  TIPOS_CON_DISTANCIA,
  TIPOS_CON_RITMO,
  decimalFlexible,
  duracion,
  fechaCalendario,
  fechaDe,
  formatoRitmo,
  horarioSugerido,
  instantesDesdeHoras,
  nombreTipo,
  ritmo,
  sumarDias,
  validarSesion,
} from "./logica.js";

const DIAS = [
  { valor: "hoy", texto: "Hoy" },
  { valor: "ayer", texto: "Ayer" },
  { valor: "otro", texto: "Otro día" },
];

/** "4,5" → 4.5 ; vacío → null ; inválido → NaN */
function leerKm(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  const n = decimalFlexible(t);
  return n == null ? Number.NaN : n;
}

/**
 * `alGuardar(fila, original)`: fila completa lista para la cola (original = la sesión editada o null).
 * `alTerminar(sesion, extra)`: terminar el entreno en curso con { distancia_km }.
 * `alBorrar(original)`. Devuelve { nuevo(), editar(sesion), terminar(sesion) }.
 */
export function crearFormulario({ alGuardar, alTerminar, alBorrar }) {
  const titulo = document.getElementById("hoja-titulo");
  const formSesion = document.getElementById("form-sesion");
  const formTerminar = document.getElementById("form-terminar");
  const hoja = crearHoja({
    hoja: document.getElementById("hoja"),
    velo: document.getElementById("velo"),
    manija: document.getElementById("hoja-manija"),
    fondo: [...document.querySelectorAll("[data-fondo-hoja]")],
  });

  // ── Registrar / editar ────────────────────────────────────────────────
  const f = formSesion.elements;
  const campo = (nombre) => formSesion.querySelector(`[data-campo="${nombre}"]`);
  const resumen = formSesion.querySelector("[data-resumen]");
  const textoRitmo = formSesion.querySelector("[data-ritmo]");
  const botonGuardar = formSesion.querySelector("[data-guardar]");
  const botonBorrar = formSesion.querySelector("[data-borrar]");
  let original = null;
  let confirmarBorrado = 0;

  const tipo = chips(formSesion.querySelector('[data-chips="tipo"]'), () => revisar());
  const rutina = chips(formSesion.querySelector('[data-chips="rutina"]'), () => revisar());
  const dia = chips(formSesion.querySelector('[data-chips="dia"]'), () => revisar());
  tipo.opciones(TIPOS_EJERCICIO.map((t) => ({ valor: t.valor, texto: t.texto })));
  rutina.opciones(RUTINAS);
  dia.opciones(DIAS);

  /** Día lógico elegido (YYYY-MM-DD). */
  function fechaElegida() {
    const hoy = diaLogico(new Date());
    if (dia.valor === "hoy") return hoy;
    if (dia.valor === "ayer") return sumarDias(hoy, -1);
    return f.fecha.value || null;
  }

  /** Lo que dice el formulario, revisado con las mismas reglas de la API. */
  function leer() {
    const fecha = fechaElegida();
    const horas = fecha ? instantesDesdeHoras(fecha, f.inicio.value, f.fin.value) : null;
    if (!horas) return { error: "⚠️ Revisa el día y las horas", horas: null };
    const km = leerKm(f.distancia.value);
    if (Number.isNaN(km)) return { error: "⚠️ Revisa la distancia", horas };
    const r = validarSesion(
      {
        tipo: tipo.valor,
        rutina: tipo.valor === "fuerza" ? rutina.valor : null,
        inicio: horas.inicio,
        fin: horas.fin,
        distancia_km: km,
        notas: f.notas.value,
      },
      new Date(),
    );
    return { ...r, horas };
  }

  function revisar() {
    campo("rutina").hidden = tipo.valor !== "fuerza";
    campo("distancia").hidden = !TIPOS_CON_DISTANCIA.has(tipo.valor);
    campo("otro-dia").hidden = dia.valor !== "otro";

    const r = leer();
    const minutos = r.horas ? Math.round((r.horas.fin - r.horas.inicio) / 60000) : null;
    if (r.fila) {
      const cruza = fechaCalendario(r.horas.fin) !== fechaCalendario(r.horas.inicio);
      resumen.textContent = `⏱️ ${formatoDuracion(r.fila.duracion_min)}${cruza ? " · pasada la medianoche" : ""}`;
      resumen.classList.remove("error");
    } else if (r.error === "⚠️ Elige el tipo" && minutos > 0) {
      resumen.textContent = `⏱️ ${formatoDuracion(minutos)}`;
      resumen.classList.remove("error");
    } else {
      resumen.textContent = r.error;
      resumen.classList.add("error");
    }

    const km = leerKm(f.distancia.value);
    const r2 = r.fila && TIPOS_CON_RITMO.has(tipo.valor) && km > 0 ? ritmo(km, r.fila.duracion_min) : null;
    textoRitmo.textContent = r2 ? `Ritmo ${formatoRitmo(r2)}` : "";
    botonGuardar.disabled = !r.fila;
    return r;
  }

  for (const nombre of ["inicio", "fin", "fecha", "distancia", "notas"]) f[nombre].addEventListener("input", () => revisar());

  formSesion.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const r = revisar();
    if (!r.fila) return avisar(r.error);
    const fila = { ...r.fila, origen: original?.origen ?? "web" };
    if (original?.id) fila.id = original.id;
    // Nuevo: id_cliente propio (un doble toque o un reintento sin internet no duplica). Editado: el que ya tenía.
    if (original?.id_cliente) fila.id_cliente = original.id_cliente;
    else if (!original) fila.id_cliente = nuevoId();
    hoja.cerrar();
    alGuardar(fila, original);
  });

  botonBorrar.addEventListener("click", () => {
    if (Date.now() - confirmarBorrado > 3000) {
      confirmarBorrado = Date.now();
      botonBorrar.textContent = "¿Seguro? Toca otra vez";
      return;
    }
    hoja.cerrar();
    alBorrar(original);
  });

  function mostrarForm(cual, texto) {
    titulo.textContent = texto;
    formSesion.hidden = cual !== formSesion;
    formTerminar.hidden = cual !== formTerminar;
  }

  function prepararSesion(sesion) {
    original = sesion;
    confirmarBorrado = 0;
    botonBorrar.textContent = "Borrar";
    botonBorrar.hidden = !sesion || sesion.en_curso;
    f.notas.value = sesion?.notas ?? "";
    f.distancia.value = sesion?.distancia_km ? String(sesion.distancia_km).replace(".", ",") : "";

    const hoy = diaLogico(new Date());
    if (sesion?.inicio) {
      const fecha = fechaDe(sesion);
      dia.poner(fecha === hoy ? "hoy" : fecha === sumarDias(hoy, -1) ? "ayer" : "otro");
      f.fecha.value = fecha;
      f.inicio.value = horaBogota(new Date(sesion.inicio));
      // Sin fin (en curso u olvidada): sugiere una hora después del inicio.
      const fin = sesion.fin ? new Date(sesion.fin) : new Date(Math.min(Date.parse(sesion.inicio) + 3_600_000, Date.now()));
      f.fin.value = horaBogota(fin);
    } else {
      // Nuevo: terminó ahora y empezó hace 1 h. Registro viejo de Hoy (solo la hora de guardado): esa es la hora de fin.
      const sugerido = horarioSugerido(sesion?.momento ? new Date(sesion.momento) : new Date(), duracion(sesion ?? {}) ?? 60);
      dia.poner(sugerido.fecha === hoy ? "hoy" : sugerido.fecha === sumarDias(hoy, -1) ? "ayer" : "otro");
      f.fecha.value = sugerido.fecha;
      f.inicio.value = sugerido.inicio;
      f.fin.value = sugerido.fin;
    }
    tipo.poner(sesion?.tipo ?? null);
    rutina.poner(sesion?.rutina ?? null);
    f.fecha.max = hoy;
    revisar();
  }

  // ── Terminar con distancia ────────────────────────────────────────────
  const t = formTerminar.elements;
  const resumenTerminar = formTerminar.querySelector("[data-resumen]");
  const ritmoTerminar = formTerminar.querySelector("[data-ritmo]");
  let enCurso = null;

  function revisarTerminar() {
    const km = leerKm(t.distancia.value);
    const minutos = duracion(enCurso, new Date());
    const r = TIPOS_CON_RITMO.has(enCurso.tipo) && km > 0 && minutos > 0 ? ritmo(km, minutos) : null;
    ritmoTerminar.textContent = Number.isNaN(km) ? "⚠️ Revisa la distancia" : r ? `Ritmo ${formatoRitmo(r)}` : "";
    formTerminar.querySelector("[data-guardar]").disabled = Number.isNaN(km);
  }
  t.distancia.addEventListener("input", revisarTerminar);

  formTerminar.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const km = leerKm(t.distancia.value);
    if (Number.isNaN(km)) return avisar("⚠️ Revisa la distancia");
    hoja.cerrar();
    alTerminar(enCurso, km == null ? {} : { distancia_km: km });
  });
  formTerminar.querySelector("[data-sin-distancia]").addEventListener("click", () => {
    hoja.cerrar();
    alTerminar(enCurso, {});
  });

  return {
    nuevo() {
      mostrarForm(formSesion, "Registrar");
      prepararSesion(null);
      hoja.abrir();
    },
    editar(sesion) {
      mostrarForm(formSesion, sesion.en_curso ? "Hora de fin" : "Editar");
      prepararSesion(sesion);
      hoja.abrir();
    },
    terminar(sesion) {
      enCurso = sesion;
      mostrarForm(formTerminar, "Terminar");
      const minutos = duracion(sesion, new Date()) ?? 0;
      resumenTerminar.textContent = `${nombreTipo(sesion.tipo)} · ${formatoDuracion(Math.max(minutos, 1))} · ${nombreDia(fechaDe(sesion)).slice(0, 3)} ${diaYMes(fechaDe(sesion))}`;
      t.distancia.value = sesion.distancia_km ? String(sesion.distancia_km).replace(".", ",") : "";
      revisarTerminar();
      hoja.abrir();
    },
  };
}
