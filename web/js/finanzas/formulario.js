// Hoja "Movimiento" con el flujo exacto de Samuel: Tipo → Valor → Categoría (u "Otro…" escrito) o Origen/Destino
// → Cuenta → Descripción. La usan la hoja "Gasto" de Hoy (js/piezas/registros.js) y finanzas.html.
// Valida con logica.js antes de guardar; la base de datos vuelve a validar (checks, llaves y RLS).

import { chips } from "../piezas/chips.js";
import { avisar } from "../piezas/ui.js";
import { formatoCOP } from "../logica/formato.js";
import { diaLogico } from "../logica/dia.js";
import { sumarDias } from "../logica/calculo.js";
import { CATEGORIAS, CATEGORIA_OTRA, MONTOS_RAPIDOS, TIPOS_MOVIMIENTO } from "../logica/catalogos.js";
import {
  DatoInvalido,
  aEntradaLocal,
  buscarCuenta,
  deEntradaLocal,
  emojiCuenta,
  esTarjeta,
  etiquetaCategoria,
  mensajeGuardado,
  ordenarCuentas,
  ordenarPorUso,
  prepararMovimiento,
} from "./logica.js";

/** Última cuenta usada por tipo, en este navegador (para dejarla elegida la próxima vez). */
const CLAVE_ULTIMAS = "goat:finanzas:cuentas";

const TITULOS = {
  egreso: { cuenta: "Cómo pagaste", destino: null },
  ingreso: { cuenta: "Dónde ingresó", destino: null },
  transferencia: { cuenta: "Desde", destino: "Hacia" },
  retiro: { cuenta: "Desde", destino: "A" },
};

const soloDigitos = (texto) => texto.replace(/\D/g, "");
const valorDe = (cuenta) => cuenta.id ?? cuenta.nombre;
const conCategoria = (tipo) => tipo === "egreso" || tipo === "ingreso";

function leerUltimas() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_ULTIMAS) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

function recordarUltima(tipo, valor) {
  try {
    localStorage.setItem(CLAVE_ULTIMAS, JSON.stringify({ ...leerUltimas(), [tipo]: valor }));
  } catch {
    // Modo privado: no se recuerda, y no pasa nada.
  }
}

/**
 * `form` necesita: [data-chips="tipo|categoria|cuenta|destino"], input[name="monto"], input[name="categoria_otra"],
 * input[name="descripcion"], opcional input[name="momento"] (datetime-local), [data-bloque="categoria|otra|destino"],
 * [data-titulo="cuenta|destino"], [data-montos] y [data-guardar].
 * `alEnviar({ fila, momento, mensaje, editando })` guarda: la página decide si inserta o actualiza.
 * Devuelve { preparar(opciones), ponerContexto(contexto), revisar(), editando }.
 */
export function formularioMovimiento(form, { alEnviar }) {
  const $ = (selector) => form.querySelector(selector);
  const campoMonto = form.elements.monto;
  const campoOtra = form.elements.categoria_otra;
  const campoDescripcion = form.elements.descripcion;
  const campoMomento = form.elements.momento ?? null;
  const montos = $("[data-montos]");
  const botonGuardar = $("[data-guardar]");

  let contexto = { legado: true, cuentas: [], movimientos: [] };
  let monto = 0;
  let editando = null;
  let tocado = false; // Si ya empezó a llenar, un contexto que llega tarde no le borra lo escrito.

  const tipo = chips($('[data-chips="tipo"]'), (valor) => {
    tocado = true;
    cambiarTipo(valor);
  });
  const categoria = chips($('[data-chips="categoria"]'), (valor) => {
    tocado = true;
    mostrarOtra(valor === CATEGORIA_OTRA.valor, true);
    revisar();
  });
  const cuenta = chips($('[data-chips="cuenta"]'), () => {
    tocado = true;
    pintarDestinos();
    revisar();
  });
  const destino = chips($('[data-chips="destino"]'), () => {
    tocado = true;
    revisar();
  });

  // ── Valor ──
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
      boton.addEventListener("click", () => {
        tocado = true;
        ponerMonto(rapido);
      });
      return boton;
    }),
  );
  campoMonto.addEventListener("input", () => {
    tocado = true;
    ponerMonto(Number(soloDigitos(campoMonto.value).slice(0, 9)) || 0);
  });
  campoOtra.addEventListener("input", () => revisar());

  // ── Categoría, cuentas y destino según el tipo ──
  function opcionesCategoria(t) {
    const desde = sumarDias(diaLogico(new Date()), -59);
    return [...ordenarPorUso(CATEGORIAS[t], contexto.movimientos ?? [], t, desde), CATEGORIA_OTRA].map((c) => ({
      valor: c.valor,
      texto: `${c.emoji} ${c.texto}`,
    }));
  }

  function cuentasPara(t, lado) {
    const activas = ordenarCuentas(contexto.cuentas.filter((c) => c.activa !== false));
    if (lado === "origen") {
      if (t === "transferencia") return activas.filter((c) => !esTarjeta(c));
      if (t === "retiro") return activas.filter((c) => c.tipo !== "efectivo");
      return activas;
    }
    if (t === "retiro") return activas.filter((c) => c.tipo === "efectivo");
    return activas.filter((c) => valorDe(c) !== cuenta.valor);
  }

  const comoChip = (c) => ({ valor: valorDe(c), texto: `${emojiCuenta(c.tipo)} ${c.nombre}` });
  const elegible = (lista) => (v) => v && lista.some((c) => valorDe(c) === v);

  function pintarCuentas(t, inicial = null) {
    const lista = cuentasPara(t, "origen");
    const previa = cuenta.valor;
    cuenta.opciones(lista.map(comoChip));
    const elegida = [inicial, previa, leerUltimas()[t]].find(elegible(lista));
    cuenta.poner(elegida ?? (lista[0] ? valorDe(lista[0]) : null));
  }

  function pintarDestinos(inicial = null) {
    const t = tipo.valor;
    if (!TITULOS[t]?.destino) return destino.poner(null);
    const lista = cuentasPara(t, "destino");
    const previa = destino.valor;
    destino.opciones(lista.map(comoChip));
    const elegida = [inicial, previa].find(elegible(lista));
    destino.poner(elegida ?? (t === "retiro" && lista[0] ? valorDe(lista[0]) : null));
  }

  function mostrarOtra(visible, enfocar = false) {
    $('[data-bloque="otra"]').hidden = !visible;
    if (!visible) campoOtra.value = "";
    else if (enfocar) campoOtra.focus({ preventScroll: false });
  }

  function cambiarTipo(t, { cuentaInicial = null, destinoInicial = null } = {}) {
    const titulos = TITULOS[t] ?? TITULOS.egreso;
    $('[data-bloque="categoria"]').hidden = !conCategoria(t);
    if (conCategoria(t)) {
      categoria.opciones(opcionesCategoria(t));
      categoria.poner(null);
    }
    mostrarOtra(false);
    $('[data-titulo="cuenta"]').textContent = titulos.cuenta;
    $('[data-chips="cuenta"]').setAttribute("aria-label", titulos.cuenta);
    $('[data-bloque="destino"]').hidden = !titulos.destino;
    if (titulos.destino) {
      $('[data-titulo="destino"]').textContent = titulos.destino;
      $('[data-chips="destino"]').setAttribute("aria-label", titulos.destino);
    }
    montos.hidden = t !== "egreso";
    pintarCuentas(t, cuentaInicial);
    pintarDestinos(destinoInicial);
    revisar();
  }

  function revisar() {
    const t = tipo.valor;
    const categoriaLista = !conCategoria(t) || (categoria.valor && (categoria.valor !== CATEGORIA_OTRA.valor || campoOtra.value.trim()));
    const destinoListo = !TITULOS[t]?.destino || destino.valor;
    botonGuardar.disabled = !(t && monto > 0 && cuenta.valor && categoriaLista && destinoListo);
  }

  // ── Guardar ──
  form.addEventListener("submit", (evento) => {
    evento.preventDefault();
    if (botonGuardar.disabled) return;
    let fila;
    try {
      fila = prepararMovimiento(
        {
          tipo: tipo.valor,
          monto,
          categoria: categoria.valor,
          categoria_otra: campoOtra.value,
          cuenta: cuenta.valor,
          cuenta_destino: destino.valor,
          descripcion: campoDescripcion?.value,
        },
        { cuentas: contexto.cuentas },
      );
    } catch (error) {
      if (error instanceof DatoInvalido) return avisar(`⚠️ ${error.message}`);
      throw error;
    }
    let momento = null;
    if (campoMomento?.value) {
      momento = deEntradaLocal(campoMomento.value);
      if (!momento) return avisar("⚠️ Revisa: cuándo");
    }
    // Base de datos sin la v2: solo las columnas de siempre.
    if (contexto.legado) {
      fila = { tipo: fila.tipo, monto: fila.monto, categoria: fila.categoria, cuenta: fila.cuenta, descripcion: fila.descripcion };
    }
    recordarUltima(fila.tipo, cuenta.valor);
    alEnviar({ fila, momento, mensaje: mensajeGuardado(fila), editando });
  });

  /** Cuenta de origen de un movimiento guardado (los viejos solo tienen el nombre). */
  function origenDe(mov) {
    if (mov.tipo === "transferencia" || mov.tipo === "retiro") return mov.cuenta_id;
    const hallada = mov.cuenta_id ? contexto.cuentas.find((c) => c.id === mov.cuenta_id) : buscarCuenta(mov.cuenta, contexto.cuentas);
    return hallada ? valorDe(hallada) : null;
  }

  /**
   * Deja la hoja lista. `movimiento`: uno guardado para editarlo · `tipo`, `cuenta`, `destino`: valores iniciales
   * (ej. pagar una tarjeta = transferencia con destino la tarjeta).
   */
  function preparar({ contexto: nuevo = null, movimiento = null, tipo: tipoInicial = "egreso", cuenta: cuentaInicial = null, destino: destinoInicial = null } = {}) {
    if (nuevo) contexto = nuevo;
    editando = movimiento;
    tocado = false;
    const tipos = contexto.legado ? TIPOS_MOVIMIENTO.filter((t) => conCategoria(t.valor)) : TIPOS_MOVIMIENTO;
    tipo.opciones(tipos.map((t) => ({ valor: t.valor, texto: t.texto })));
    const t = tipos.some((x) => x.valor === (movimiento?.tipo ?? tipoInicial)) ? (movimiento?.tipo ?? tipoInicial) : "egreso";
    tipo.poner(t);
    cambiarTipo(t, {
      cuentaInicial: movimiento ? origenDe(movimiento) : cuentaInicial,
      destinoInicial: movimiento?.cuenta_destino_id ?? destinoInicial,
    });

    ponerMonto(movimiento ? Number(movimiento.monto) : 0);
    if (movimiento && conCategoria(t)) {
      const enLista = !movimiento.categoria_libre && CATEGORIAS[t].some((c) => c.valor === movimiento.categoria);
      if (enLista) categoria.poner(movimiento.categoria);
      else {
        // Escrita a mano o de la versión anterior: queda como "Otro…" con su texto.
        categoria.poner(CATEGORIA_OTRA.valor);
        mostrarOtra(true);
        campoOtra.value = movimiento.categoria_libre ? movimiento.categoria : etiquetaCategoria(movimiento).texto;
      }
    }
    if (campoDescripcion) campoDescripcion.value = movimiento?.descripcion ?? "";
    if (campoMomento) campoMomento.value = aEntradaLocal(movimiento ? new Date(movimiento.momento) : new Date());
    revisar();
  }

  return {
    preparar,
    /** Llegaron las cuentas reales: si la hoja sigue sin tocar, se vuelve a preparar con ellas. */
    ponerContexto(nuevo) {
      contexto = nuevo;
      if (!tocado && !editando) preparar({ tipo: tipo.valor ?? "egreso" });
    },
    revisar,
    get editando() {
      return editando;
    },
  };
}
