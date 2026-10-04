// Formularios de registro rápido en la hoja inferior: gasto, comida, estudio y gym.
// Validan con los catálogos antes de guardar; la base de datos vuelve a validar (checks y RLS).

import { SesionVencida, guardar } from "../supabase/datos.js";
import { cerrarSesion } from "../supabase/sesion.js";
import { horaDecimal } from "../logica/dia.js";
import { formatoCOP, formatoDuracion } from "../logica/formato.js";
import { avisar, nuevoId } from "./ui.js";
import { chips } from "./chips.js";
import { crearHoja } from "./hoja.js";
import {
  CATEGORIAS,
  CUENTAS,
  DURACIONES,
  FRECUENTES,
  MATERIAS,
  MONTOS_RAPIDOS,
  MONTO_MAXIMO,
  RUTINAS,
  TIPOS_COMIDA,
  TIPOS_EJERCICIO,
  TIPOS_MOVIMIENTO,
  VALIDOS,
} from "../logica/catalogos.js";
import { emojiTipo, horarioSugerido, instantesRecientes, minutosEntre, validarSesion } from "../ejercicio/logica.js";

const TITULO = { comida: "Comí", gasto: "Gasto", estudio: "Estudio", gym: "Gym" };

const soloDigitos = (texto) => texto.replace(/\D/g, "");
const entero = (valor, minimo, maximo) => Number.isInteger(valor) && valor >= minimo && valor <= maximo;

/** Entre las 22:00 y las 04:00 toca cerrar el día de gastos. */
function esHoraDeCierre(ahora) {
  const hora = horaDecimal(ahora);
  return hora >= 22 || hora < 4;
}

// ── Gasto ────────────────────────────────────────────────────────────────

function formularioGasto(form, enviar) {
  const campoMonto = form.elements.monto;
  const montos = form.querySelector("[data-montos]");
  const secundario = form.querySelector("[data-secundario]");
  let monto = 0;
  let cierre = false;

  const tipo = chips(form.querySelector('[data-chips="tipo"]'), (nuevo) => {
    categoria.opciones(CATEGORIAS[nuevo]);
    categoria.poner(null);
    montos.hidden = nuevo !== "egreso";
    revisar();
  });
  const categoria = chips(form.querySelector('[data-chips="categoria"]'), () => revisar());
  const cuenta = chips(form.querySelector('[data-chips="cuenta"]'), () => revisar());
  tipo.opciones(TIPOS_MOVIMIENTO);
  cuenta.opciones(CUENTAS);

  function ponerMonto(valor) {
    monto = valor;
    campoMonto.value = valor ? formatoCOP(valor) : "";
    revisar();
  }

  montos.replaceChildren(
    ...MONTOS_RAPIDOS.map((rapido) => {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.textContent = formatoCOP(rapido);
      boton.addEventListener("click", () => ponerMonto(rapido));
      return boton;
    }),
  );
  campoMonto.addEventListener("input", () => ponerMonto(Number(soloDigitos(campoMonto.value).slice(0, 9)) || 0));

  const revisar = () => (form.querySelector("[data-guardar]").disabled = !(monto && categoria.valor && cuenta.valor));

  form.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const t = tipo.valor;
    const valido =
      VALIDOS.tipoMovimiento.has(t) &&
      VALIDOS.categoria[t].has(categoria.valor) &&
      VALIDOS.cuenta.has(cuenta.valor) &&
      entero(monto, 1, MONTO_MAXIMO);
    if (!valido) return avisar("⚠️ Revisa los datos.");
    enviar(
      "finanzas_movimientos",
      { tipo: t, monto, categoria: categoria.valor, cuenta: cuenta.valor },
      t === "egreso" ? "💸 Guardado" : "💰 Guardado",
    );
  });

  // "No he gastado nada" o el cierre del día: también son registros (principio 4).
  secundario.addEventListener("click", () =>
    enviar("checkins", { modulo: "finanzas", tipo: cierre ? "cierre" : "nada_que_registrar" }, cierre ? "🧾 Día cerrado" : "✅ Anotado"),
  );

  return {
    preparar(sugerencia, ahora) {
      tipo.poner("egreso");
      categoria.opciones(CATEGORIAS.egreso);
      categoria.poner(null);
      cuenta.poner("efectivo");
      montos.hidden = false;
      ponerMonto(0);
      cierre = sugerencia === "cierre_finanzas" || esHoraDeCierre(ahora);
      secundario.textContent = cierre ? "🧾 Cerrar gastos del día" : "🙅 No he gastado nada";
    },
    revisar,
  };
}

// ── Comida ───────────────────────────────────────────────────────────────

function sugerirComida(ahora, sugerencia) {
  if (VALIDOS.tipoComida.has(sugerencia)) return sugerencia;
  const hora = horaDecimal(ahora);
  if (hora >= 4 && hora < 10.5) return "desayuno";
  if (hora >= 10.5 && hora < 15) return "almuerzo";
  if (hora >= 15 && hora < 18.5) return "merienda";
  return "cena";
}

function formularioComida(form, enviar) {
  const campoKcal = form.elements.kcal;
  const campoProteina = form.elements.proteina;

  const tipo = chips(form.querySelector('[data-chips="tipo"]'));
  const frecuente = chips(form.querySelector('[data-chips="frecuente"]'), (valor) => {
    const comida = FRECUENTES.find((f) => f.valor === valor);
    campoKcal.value = String(comida.kcal);
    campoProteina.value = String(comida.proteina);
    revisar();
  });
  tipo.opciones(TIPOS_COMIDA);
  frecuente.opciones(FRECUENTES);

  for (const campo of [campoKcal, campoProteina]) {
    campo.addEventListener("input", () => {
      frecuente.poner(null);
      campo.value = soloDigitos(campo.value).slice(0, 4);
      revisar();
    });
  }

  const revisar = () => (form.querySelector("[data-guardar]").disabled = !(Number(campoKcal.value) > 0));

  form.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const kcal = Number(campoKcal.value);
    const proteina = Number(campoProteina.value) || 0;
    if (!VALIDOS.tipoComida.has(tipo.valor) || !entero(kcal, 1, 10_000) || !entero(proteina, 0, 1_000)) {
      return avisar("⚠️ Revisa los datos.");
    }
    const elegida = FRECUENTES.find((f) => f.valor === frecuente.valor);
    enviar(
      "comidas",
      {
        tipo: tipo.valor,
        kcal,
        proteina_g: proteina,
        descripcion: elegida?.texto ?? null,
        fuente: elegida ? "frecuente" : "manual",
      },
      "🍽️ Guardado",
    );
  });

  form.querySelector("[data-secundario]").addEventListener("click", () => {
    if (VALIDOS.tipoComida.has(tipo.valor)) enviar("comidas", { tipo: tipo.valor, omitida: true }, "🚫 Anotado");
  });

  return {
    preparar(sugerencia, ahora) {
      tipo.poner(sugerirComida(ahora, sugerencia));
      frecuente.poner(null);
      campoKcal.value = "";
      campoProteina.value = "";
    },
    revisar,
  };
}

// ── Estudio ──────────────────────────────────────────────────────────────

function formularioEstudio(form, enviar) {
  const materia = chips(form.querySelector('[data-chips="materia"]'), () => revisar());
  const minutos = chips(form.querySelector('[data-chips="minutos"]'));
  materia.opciones(MATERIAS);
  minutos.opciones(DURACIONES);

  const revisar = () => (form.querySelector("[data-guardar]").disabled = !materia.valor);

  form.addEventListener("submit", (evento) => {
    evento.preventDefault();
    if (!VALIDOS.materia.has(materia.valor) || !VALIDOS.duracion.has(minutos.valor)) return avisar("⚠️ Revisa los datos.");
    const total = Number(minutos.valor);
    enviar("uni_sesiones", { materia: materia.valor, minutos: total }, `📚 +${total} min`);
  });

  return {
    preparar() {
      materia.poner(null);
      minutos.poner("50");
    },
    revisar,
  };
}

// ── Gym ──────────────────────────────────────────────────────────────────

// Tipo + hora de inicio y fin (sugeridas: terminó ahora, empezó hace 60 min). Las reglas son las de
// js/ejercicio/logica.js (las mismas de la página Movimiento y de la API).

function formularioGym(form, enviar) {
  const campoInicio = form.elements.inicio;
  const campoFin = form.elements.fin;
  const campoRutina = form.querySelector("[data-campo-rutina]");
  const textoDuracion = form.querySelector("[data-duracion]");

  const tipo = chips(form.querySelector('[data-chips="tipo"]'), () => revisar());
  const rutina = chips(form.querySelector('[data-chips="rutina"]'), () => revisar());
  tipo.opciones(TIPOS_EJERCICIO);
  rutina.opciones(RUTINAS);

  /** Lo de la hoja revisado: { fila } o { error }, más los minutos entre las dos horas. */
  function leer() {
    const horas = instantesRecientes(new Date(), campoInicio.value, campoFin.value);
    if (!horas) return { error: "⚠️ Revisa las horas", minutos: null };
    const minutos = minutosEntre(horas.inicio, horas.fin);
    const r = validarSesion(
      { tipo: tipo.valor, rutina: tipo.valor === "fuerza" ? rutina.valor : null, inicio: horas.inicio, fin: horas.fin },
      new Date(),
    );
    return { ...r, minutos };
  }

  function revisar() {
    campoRutina.hidden = tipo.valor !== "fuerza";
    const r = leer();
    if (r.fila) textoDuracion.textContent = `⏱️ ${formatoDuracion(r.fila.duracion_min)}`;
    else if (!tipo.valor) textoDuracion.textContent = r.minutos ? `⏱️ ${formatoDuracion(r.minutos)}` : r.error;
    else textoDuracion.textContent = r.error;
    form.querySelector("[data-guardar]").disabled = !r.fila;
  }

  campoInicio.addEventListener("input", revisar);
  campoFin.addEventListener("input", revisar);

  form.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const r = leer();
    if (!r.fila || !VALIDOS.tipoEjercicio.has(r.fila.tipo)) return avisar(r.error ?? "⚠️ Revisa los datos.");
    enviar("gym_sesiones", r.fila, `${emojiTipo(r.fila.tipo)} Entreno anotado`);
  });

  // Para un entreno que empieza ahora: la página Movimiento tiene el cronómetro.
  form.querySelector("[data-cronometro]").addEventListener("click", () => location.assign("ejercicio.html#entreno"));

  return {
    preparar() {
      const sugerido = horarioSugerido(new Date());
      campoInicio.value = sugerido.inicio;
      campoFin.value = sugerido.fin;
      tipo.poner(null);
      rutina.poner(null);
    },
    revisar,
  };
}

// ── Hoja inferior ────────────────────────────────────────────────────────

/**
 * Conecta la hoja y sus cuatro formularios. `alGuardar(mensaje)` se llama después de guardar
 * (la pantalla de inicio muestra el aviso y vuelve a cargar los datos).
 */
export function iniciarRegistros({ alGuardar }) {
  const titulo = document.getElementById("hoja-titulo");
  // Lo que queda detrás de la hoja se vuelve inerte mientras está abierta.
  const fondo = [...document.querySelectorAll("[data-fondo-hoja]")];

  let abierta = null;
  let idCliente = null; // Uno por cada vez que se abre: un doble toque no guarda dos veces.
  let enviando = false;

  const hoja = crearHoja({
    hoja: document.getElementById("hoja"),
    velo: document.getElementById("velo"),
    manija: document.getElementById("hoja-manija"),
    fondo,
    alCerrar: () => (abierta = null),
  });

  async function enviar(tabla, fila, mensaje) {
    if (enviando) return;
    ponerEnviando(true);
    try {
      if (await guardar(tabla, { ...fila, id_cliente: idCliente })) {
        cerrar();
        await alGuardar(mensaje);
      } else {
        avisar(navigator.onLine ? "⚠️ No se guardó. Intenta otra vez." : "⚠️ Sin conexión. Intenta otra vez.");
      }
    } catch (error) {
      if (error instanceof SesionVencida) return cerrarSesion();
      avisar("⚠️ Sin conexión. Intenta otra vez.");
    } finally {
      ponerEnviando(false);
    }
  }

  const formularios = {
    gasto: formularioGasto(document.getElementById("form-gasto"), enviar),
    comida: formularioComida(document.getElementById("form-comida"), enviar),
    estudio: formularioEstudio(document.getElementById("form-estudio"), enviar),
    gym: formularioGym(document.getElementById("form-gym"), enviar),
  };

  function ponerEnviando(valor) {
    enviando = valor;
    if (!abierta) return;
    const form = document.getElementById(`form-${abierta}`);
    const principal = form.querySelector("[data-guardar]");
    principal.dataset.texto ??= principal.textContent;
    principal.textContent = valor ? "Guardando…" : principal.dataset.texto;
    principal.setAttribute("aria-busy", String(valor));
    form.querySelectorAll("button").forEach((boton) => (boton.disabled = valor));
    if (!valor) formularios[abierta].revisar();
  }

  /** Abre el registro. `sugerencia`: clave del pendiente que lo abrió ("desayuno", "cierre_finanzas"…). */
  function abrir(accion, sugerencia) {
    if (!formularios[accion]) return;
    abierta = accion;
    idCliente = nuevoId();
    titulo.textContent = TITULO[accion];
    for (const nombre of Object.keys(formularios)) document.getElementById(`form-${nombre}`).hidden = nombre !== accion;
    formularios[accion].preparar(sugerencia, new Date());
    formularios[accion].revisar();
    hoja.abrir();
  }

  const cerrar = () => hoja.cerrar();

  return { abrir, cerrar };
}
