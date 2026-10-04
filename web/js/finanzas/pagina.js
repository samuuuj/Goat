// Finanzas (finanzas.html): saldos por cuenta, el mes por categoría, movimientos agrupados y deudas.
// Lee y escribe directo en Supabase (RLS); las reglas están en ./logica.js (las mismas de la API).
// Todo lo que viene de la base de datos se pinta con textContent sobre <template> (nunca innerHTML).

import { iniciarPagina } from "../piezas/pagina.js";
import { crearHoja } from "../piezas/hoja.js";
import { chips } from "../piezas/chips.js";
import { alVerse, avisar, clonar, contar, nuevoId } from "../piezas/ui.js";
import { SesionVencida } from "../supabase/datos.js";
import { formatoCOP } from "../logica/formato.js";
import { diaLogico, diaYMes, horaBogota } from "../logica/dia.js";
import { DIRECCIONES_DEUDA, TIPOS_CUENTA, TIPOS_DEUDA, TIPOS_MOVIMIENTO } from "../logica/catalogos.js";
import {
  DatoInvalido,
  aEntradaLocal,
  ajustarSaldoInicial,
  agrupar,
  deEntradaLocal,
  deudasVista,
  diasEntre,
  emojiCuenta,
  emojiDeuda,
  enriquecer,
  esTarjeta,
  filtrar,
  fraseMes,
  mesDe,
  movimientoDePrestamo,
  nombreMes,
  ordenar,
  ordenarCuentas,
  prepararAbono,
  prepararCuenta,
  prepararDeuda,
  resumenMes,
  saldoDeuda,
  saldosPorCuenta,
  signoEn,
  sumarMeses,
  tituloDia,
  total,
  totalesDeudas,
} from "./logica.js";
import { NombreRepetido, actualizar, borrar, cargarFinanzas, insertar, insertarCuenta } from "./datos.js";
import { formularioMovimiento } from "./formulario.js";

const $ = (id) => document.getElementById(id);
const soloDigitos = (texto) => String(texto ?? "").replace(/\D/g, "");
const numeroDe = (campo) => Number(soloDigitos(campo.value).slice(0, 11)) || 0;
const conSigno = (valor) => (valor > 0 ? `+${formatoCOP(valor)}` : formatoCOP(valor));
const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);
const listaTexto = new Intl.ListFormat("es", { type: "conjunction" });
const CATEGORIAS_DEUDA = new Set(["abono_deuda", "cobro_deuda", "prestamo_recibido", "prestamo_dado"]);
const PLURAL = { egreso: "Gastos", ingreso: "Ingresos", transferencia: "Transferencias", retiro: "Retiros" };
const FILTROS = [{ valor: "todos", texto: "Todos" }, ...TIPOS_MOVIMIENTO.map((t) => ({ valor: t.valor, texto: PLURAL[t.valor] }))];
/** Filas que se pintan antes de "Ver más". */
const PASO_LISTA = 60;

const pagina = await iniciarPagina({ alReintentar: () => cargar() });
const userId = pagina.sesion.user.id;

const estado = {
  datos: null, // { cuentas, deudas, movimientos } tal como llegan de Supabase
  hoy: diaLogico(new Date()),
  mes: mesDe(diaLogico(new Date())),
  agrupar: "dia",
  filtro: "todos",
  orden: "recientes",
  texto: "",
  limite: PASO_LISTA,
  pestanaDeuda: "debo",
  verArchivadas: false,
  animar: true, // Las entradas animadas, solo la primera vez.
  cargadoEn: 0,
};
let vista = null; // Lo calculado: saldos, lista enriquecida y deudas.

// ── Carga ────────────────────────────────────────────────────────────────

async function cargar() {
  try {
    estado.datos = await cargarFinanzas(userId);
    estado.cargadoEn = Date.now();
    estado.hoy = diaLogico(new Date());
    derivar();
    pagina.mostrar("contenido");
    pintar();
  } catch (error) {
    pagina.manejarError(error);
  }
}

function derivar() {
  const { cuentas, deudas, movimientos } = estado.datos;
  const saldos = saldosPorCuenta(cuentas, movimientos);
  vista = {
    saldos,
    lista: enriquecer(movimientos, cuentas, deudas),
    deudas: deudasVista(deudas, saldos, movimientos, estado.hoy),
  };
}

function pintar() {
  pintarCabecera();
  pintarSaldos();
  pintarMes();
  pintarMovimientos();
  pintarDeudas();
  estado.animar = false;
}

/** Número grande: ajusta el tamaño a su largo (--largo) y cuenta desde 0 la primera vez. */
function ponerCifra(elemento, valor, formatear = formatoCOP) {
  elemento.closest(".titular, .cuenta-saldo")?.style.setProperty("--largo", String(Math.max(formatear(valor).length, 3)));
  if (estado.animar) contar(elemento, valor, formatear);
  else elemento.textContent = formatear(valor);
}

/** Barra fina (.progreso) que se llena al verse. */
function llenarBarra(relleno, fraccion) {
  const final = `scaleX(${Math.min(Math.max(fraccion, 0), 1)})`;
  if (!estado.animar) return relleno.style.setProperty("transform", final);
  alVerse(relleno, () => requestAnimationFrame(() => relleno.style.setProperty("transform", final)));
}

/** Elementos .aparece que entran suaves, uno tras otro. */
function aparecer(elementos) {
  elementos.forEach((el, i) => {
    el.style.setProperty("--i", String(i));
    if (estado.animar) alVerse(el, () => el.classList.add("visto"));
    else el.classList.add("visto");
  });
}

// ── Cabecera ─────────────────────────────────────────────────────────────

function pintarCabecera() {
  const activas = vista.saldos.filter((c) => c.activa !== false);
  const deudas = vista.deudas.filter((d) => !d.virtual && d.estado !== "pagada").length;
  const partes = [`${activas.length} ${activas.length === 1 ? "cuenta" : "cuentas"}`];
  if (deudas > 0) partes.push(`${deudas} ${deudas === 1 ? "deuda activa" : "deudas activas"}`);
  $("cabecera-texto").textContent = `${listaTexto.format(partes)}. Todo en su sitio.`;
}

// ── 1. Saldos ────────────────────────────────────────────────────────────

function pintarSaldos() {
  const disponibles = vista.saldos.filter((c) => c.activa !== false && !esTarjeta(c));
  ponerCifra($("total"), total(vista.saldos));
  const nombres = disponibles.map((c) => c.nombre);
  $("total-frase").textContent =
    nombres.length === 0 ? "Agrega una cuenta para empezar." : nombres.length <= 4 ? `Entre ${listaTexto.format(nombres)}.` : `En ${nombres.length} cuentas.`;

  const archivadas = vista.saldos.filter((c) => c.activa === false);
  const visibles = vista.saldos.filter((c) => c.activa !== false || estado.verArchivadas);
  const tarjetas = visibles.map((cuenta) => {
    const item = clonar("plantilla-cuenta");
    const boton = item.querySelector(".cuenta-tarjeta");
    const tarjeta = esTarjeta(cuenta);
    boton.classList.toggle("archivada", cuenta.activa === false);
    item.querySelector(".cuenta-icono").textContent = emojiCuenta(cuenta.tipo);
    item.querySelector(".cuenta-nombre").textContent = cuenta.nombre;
    item.querySelector(".cuenta-banco").textContent =
      cuenta.activa === false ? "Archivada" : (cuenta.banco ?? TIPOS_CUENTA.find((t) => t.valor === cuenta.tipo)?.texto ?? "");
    item.querySelector(".cuenta-rotulo").textContent = tarjeta ? "Deuda" : "Saldo";
    ponerCifra(item.querySelector(".cuenta-saldo"), tarjeta ? cuenta.deuda : cuenta.saldo);
    if (tarjeta && cuenta.cupo) {
      item.querySelector(".cuenta-cupo").hidden = false;
      llenarBarra(item.querySelector(".progreso-relleno"), cuenta.cupoUsado ?? 0);
      item.querySelector(".cuenta-cupo-texto").textContent = `${Math.round((cuenta.cupoUsado ?? 0) * 100)}% del cupo`;
    }
    boton.addEventListener("click", () => abrirCuenta(cuenta));
    return item;
  });

  const nueva = clonar("plantilla-cuenta-nueva");
  nueva.querySelector("button").addEventListener("click", () => abrirCuenta(null));
  tarjetas.push(nueva);
  if (archivadas.length > 0) {
    const ver = clonar("plantilla-cuenta-nueva");
    const boton = ver.querySelector("button");
    boton.classList.add("cuenta-archivadas");
    boton.querySelector(".cuenta-nueva-mas").textContent = estado.verArchivadas ? "−" : "🗂️";
    boton.lastElementChild.textContent = estado.verArchivadas ? "Ocultar archivadas" : `Archivadas (${archivadas.length})`;
    boton.addEventListener("click", () => {
      estado.verArchivadas = !estado.verArchivadas;
      pintarSaldos();
    });
    tarjetas.push(ver);
  }
  $("cuentas").replaceChildren(...tarjetas);
  aparecer(tarjetas);
}

// ── 2. El mes ────────────────────────────────────────────────────────────

function primerMes() {
  const fechas = estado.datos.movimientos.map((m) => mesDe(m.fecha ?? "")).filter(Boolean).sort();
  return fechas[0] ?? mesDe(estado.hoy);
}

function pintarMes() {
  const esteMes = mesDe(estado.hoy);
  const actual = estado.mes === esteMes;
  const resumen = resumenMes(estado.datos.movimientos, estado.mes, estado.datos.cuentas);
  $("mes-titulo").textContent = actual ? `Este mes · ${nombreMes(estado.mes)}` : mayuscula(nombreMes(estado.mes, estado.hoy));
  $("mes-siguiente").disabled = estado.mes >= esteMes;
  $("mes-anterior").disabled = estado.mes <= primerMes();

  ponerCifra($("mes-gastos"), resumen.gastos);
  ponerCifra($("mes-ingresos"), resumen.ingresos);
  $("mes-neto").textContent = conSigno(resumen.neto);
  $("mes-frase").textContent = fraseMes(resumen, actual);

  const lista = $("categorias");
  const mayor = resumen.porCategoria[0]?.total ?? 0;
  lista.replaceChildren(
    ...resumen.porCategoria.map((categoria, i) => {
      const item = clonar("plantilla-categoria");
      item.style.setProperty("--i", String(i));
      item.style.setProperty("--ancho", String(mayor > 0 ? categoria.total / mayor : 0));
      item.querySelector(".categoria-emoji").textContent = categoria.emoji;
      item.querySelector(".categoria-nombre").textContent = categoria.texto;
      item.querySelector(".categoria-pct").textContent = `${Math.round(categoria.pct * 100)}%`;
      item.querySelector(".categoria-monto").textContent = formatoCOP(categoria.total);
      return item;
    }),
  );
  $("categorias-vacio").hidden = resumen.porCategoria.length > 0;
  $("categorias-vacio").textContent = actual ? "Sin gastos este mes." : "Ese mes no tuvo gastos.";
  lista.classList.remove("visto");
  if (estado.animar) alVerse(lista, () => lista.classList.add("visto"));
  else requestAnimationFrame(() => lista.classList.add("visto"));
}

function cambiarMes(paso) {
  estado.mes = sumarMeses(estado.mes, paso);
  estado.limite = PASO_LISTA;
  pintarMes();
  pintarMovimientos();
}

$("mes-anterior").addEventListener("click", () => cambiarMes(-1));
$("mes-siguiente").addEventListener("click", () => cambiarMes(1));

// ── 3. Movimientos ───────────────────────────────────────────────────────

/** "Comida · Nequi · 19:42" o "Nu → Nequi · ayer 08:10". */
function detalleDe(mov) {
  const partes = [];
  if (mov.descripcion) partes.push(mov.etiqueta.texto);
  if (mov.tipo === "egreso" || mov.tipo === "ingreso") partes.push(mov.origen ?? mov.destino ?? "Sin cuenta");
  else partes.push(`${mov.origen ?? "—"} → ${mov.destino ?? "—"}`);
  const hora = mov.momento ? horaBogota(new Date(mov.momento)) : "";
  partes.push(estado.agrupar === "dia" ? hora : `${tituloDia(mov.fecha, estado.hoy)} ${hora}`.trim());
  return partes.filter(Boolean).join(" · ");
}

function pintarMovimientos() {
  const { cuentas } = estado.datos;
  // Con algo en el buscador se busca en todos los meses.
  const base = estado.texto ? vista.lista : vista.lista.filter((m) => m.fecha.startsWith(estado.mes));
  const filtrados = ordenar(filtrar(base, { tipo: estado.filtro, texto: estado.texto }), estado.orden);
  const grupos = agrupar(filtrados, estado.agrupar, { hoy: estado.hoy, cuentas });

  $("movimientos-titulo").textContent = estado.texto ? "Movimientos · todos los meses" : `Movimientos · ${nombreMes(estado.mes, estado.hoy)}`;
  $("movimientos-cuantos").textContent = filtrados.length ? `${filtrados.length} ${filtrados.length === 1 ? "movimiento" : "movimientos"}` : "";

  let pintadas = 0;
  let totalFilas = 0;
  const secciones = [];
  for (const grupo of grupos) {
    totalFilas += grupo.movimientos.length;
    if (pintadas >= estado.limite) continue;
    const seccion = clonar("plantilla-grupo");
    seccion.querySelector(".grupo-titulo").textContent = grupo.emoji ? `${grupo.emoji} ${grupo.titulo}` : grupo.titulo;
    const subtotal = seccion.querySelector(".grupo-subtotal");
    const neutro = estado.agrupar === "categoria" && grupo.clase === "ninguno";
    subtotal.textContent = neutro ? formatoCOP(grupo.subtotal) : conSigno(grupo.subtotal);
    subtotal.hidden = grupo.subtotal === 0;
    const filas = [];
    for (const mov of grupo.movimientos) {
      if (pintadas >= estado.limite) break;
      filas.push(filaMovimiento(mov, grupo.cuentaId));
      pintadas++;
    }
    seccion.querySelector(".lista-agrupada").replaceChildren(...filas);
    secciones.push(seccion);
  }
  $("lista").replaceChildren(...secciones);
  $("ver-mas").hidden = totalFilas <= estado.limite;

  const vacia = $("lista-vacia");
  vacia.hidden = filtrados.length > 0;
  if (filtrados.length === 0) {
    vacia.textContent = estado.texto
      ? `Nada con «${estado.texto}».`
      : base.length > 0
        ? "Nada de ese tipo en este mes."
        : estado.mes === mesDe(estado.hoy)
          ? "Aún no hay movimientos este mes. Toca ＋ Movimiento."
          : "Ese mes no tuvo movimientos.";
  }
}

function filaMovimiento(mov, cuentaId) {
  const item = clonar("plantilla-movimiento");
  item.querySelector(".fila-icono").textContent = mov.etiqueta.emoji;
  item.querySelector(".fila-titulo").textContent = mov.titulo;
  item.querySelector(".fila-detalle").textContent = detalleDe(mov);
  const signo = signoEn(mov, cuentaId);
  const valor = item.querySelector(".fila-valor");
  valor.textContent = signo > 0 ? `+${formatoCOP(mov.monto)}` : signo < 0 ? formatoCOP(-mov.monto) : formatoCOP(mov.monto);
  valor.classList.toggle("neutro", signo === 0);
  item.querySelector("button").addEventListener("click", () => abrirMovimiento(mov));
  return item;
}

// Agrupar: Día · Categoría · Cuenta (control segmentado).
function conectarSegmentado(contenedor, atributo, alCambiar) {
  contenedor.addEventListener("click", (evento) => {
    const boton = evento.target.closest("button[data-valor]");
    if (!boton) return;
    contenedor.querySelectorAll("button[data-valor]").forEach((b) => {
      b.setAttribute("aria-selected", String(b === boton));
      if (atributo === "radio") b.setAttribute("aria-checked", String(b === boton));
    });
    alCambiar(boton.dataset.valor);
  });
}

conectarSegmentado($("agrupar"), "tab", (valor) => {
  estado.agrupar = valor;
  estado.limite = PASO_LISTA;
  pintarMovimientos();
});
conectarSegmentado($("orden"), "radio", (valor) => {
  estado.orden = valor;
  pintarMovimientos();
});
const filtro = chips(document.querySelector('[data-chips="filtro"]'), (valor) => {
  estado.filtro = valor;
  estado.limite = PASO_LISTA;
  pintarMovimientos();
});
filtro.opciones(FILTROS);
filtro.poner("todos");

let temporizadorBusqueda;
$("buscar").addEventListener("input", (evento) => {
  window.clearTimeout(temporizadorBusqueda);
  temporizadorBusqueda = window.setTimeout(() => {
    estado.texto = evento.target.value.trim();
    estado.limite = PASO_LISTA;
    pintarMovimientos();
  }, 150);
});
$("ver-mas").addEventListener("click", () => {
  estado.limite += PASO_LISTA;
  pintarMovimientos();
});

// ── 4. Deudas ────────────────────────────────────────────────────────────

/** "hoy", "mañana", "en 5 días" o "15 oct"; `pronto` si faltan 3 días o menos. */
function cuandoPago(fecha) {
  const dias = diasEntre(estado.hoy, fecha);
  const cuando = dias === 0 ? "hoy" : dias === 1 ? "mañana" : dias <= 7 ? `en ${dias} días` : diaYMes(fecha).replace(/^0/, "");
  return { cuando, pronto: dias <= 3 };
}

function pintarDeudas() {
  const debo = estado.pestanaDeuda === "debo";
  const lista = vista.deudas.filter((d) => d.direccion === estado.pestanaDeuda);
  const totales = totalesDeudas(vista.deudas);
  ponerCifra($("deudas-total"), debo ? totales.debo : totales.meDeben);

  const activas = lista.filter((d) => d.estado !== "pagada" && d.saldo > 0);
  const proxima = activas.find((d) => d.proximoPago);
  if (debo) {
    $("deudas-frase").textContent =
      activas.length === 0
        ? "No debes nada. 🙌"
        : `${activas.length} ${activas.length === 1 ? "deuda activa" : "deudas activas"}.${proxima ? ` La próxima: ${proxima.nombre}, ${cuandoPago(proxima.proximoPago).cuando}.` : ""}`;
  } else {
    $("deudas-frase").textContent =
      activas.length === 0 ? "Nadie te debe." : activas.length === 1 ? `${activas[0].nombre} te debe.` : `${activas.length} personas te deben.`;
  }

  const items = lista.map(tarjetaDeuda);
  $("deudas-lista").replaceChildren(...items);
  aparecer(items);
  const vacio = $("deudas-vacio");
  vacio.hidden = items.length > 0;
  vacio.textContent = debo ? "Sin deudas. Si le debes a alguien, toca ＋ Deuda." : "Si le prestas a alguien, anótalo con ＋ Deuda.";
}

function tarjetaDeuda(deuda) {
  const item = clonar("plantilla-deuda");
  const tarjeta = item.querySelector(".deuda-tarjeta");
  const pagada = deuda.estado === "pagada";
  tarjeta.classList.toggle("pagada", pagada);
  item.querySelector(".deuda-icono").textContent = deuda.tarjeta ? "💳" : emojiDeuda(deuda.tipo);
  item.querySelector(".deuda-nombre").textContent = deuda.nombre;
  const tipo = TIPOS_DEUDA.find((t) => t.valor === deuda.tipo)?.texto ?? "Deuda";
  item.querySelector(".deuda-tipo").textContent = [deuda.tarjeta ? "Tarjeta de crédito" : tipo, deuda.banco].filter(Boolean).join(" · ");
  const saldo = item.querySelector(".deuda-saldo");
  ponerCifra(saldo.querySelector(".sensible"), deuda.saldo);

  if (deuda.cuota) {
    const cuota = item.querySelector(".deuda-cuota");
    cuota.hidden = false;
    cuota.querySelector(".sensible").textContent = formatoCOP(Number(deuda.cuota));
  }
  const proximo = item.querySelector(".deuda-proximo");
  if (deuda.proximoPago && !pagada) {
    const { cuando, pronto } = cuandoPago(deuda.proximoPago);
    proximo.textContent = `Próximo pago ${cuando}`;
    proximo.classList.toggle("pronto", pronto);
  }

  const virtualCupo = deuda.virtual;
  llenarBarra(item.querySelector(".progreso-relleno"), deuda.pct ?? 0);
  item.querySelector(".deuda-avance").textContent = pagada
    ? "Pagada ✓"
    : virtualCupo
      ? deuda.cupo
        ? `${Math.round(deuda.pct * 100)}% del cupo usado`
        : "Tarjeta de crédito"
      : `${Math.round((deuda.pct ?? 0) * 100)}% ${deuda.direccion === "debo" ? "pagado" : "cobrado"}`;
  item.querySelector(".progreso").hidden = virtualCupo && !deuda.cupo;

  const accion = item.querySelector(".deuda-accion");
  accion.hidden = pagada || deuda.saldo <= 0;
  accion.textContent = deuda.tarjeta ? "Pagar" : deuda.direccion === "debo" ? "Abonar" : "Cobrar";
  accion.addEventListener("click", () => {
    if (deuda.tarjeta) abrirPagoTarjeta(deuda.cuenta_id);
    else abrirAbono(deuda);
  });
  item.querySelector(".deuda-abrir").addEventListener("click", () => {
    if (deuda.virtual) abrirCuenta(vista.saldos.find((c) => c.id === deuda.cuenta_id));
    else abrirDeuda(deuda);
  });
  return item;
}

conectarSegmentado($("deudas-pestanas"), "tab", (valor) => {
  estado.pestanaDeuda = valor;
  pintarDeudas();
});

// ── Hoja inferior ────────────────────────────────────────────────────────

const FORMULARIOS = ["movimiento", "abono", "cuenta", "deuda"];
let idCliente = null; // Uno por cada vez que se abre la hoja: un doble toque no guarda dos veces.
let enviandoAhora = false;

const hoja = crearHoja({
  hoja: $("hoja"),
  velo: $("velo"),
  manija: $("hoja-manija"),
  fondo: [...document.querySelectorAll("[data-fondo-hoja]")],
  alCerrar: () => desarmarBorrados(),
});

function abrirFormulario(nombre, titulo) {
  idCliente = nuevoId();
  desarmarBorrados();
  $("hoja-titulo").textContent = titulo;
  for (const f of FORMULARIOS) $(`form-${f}`).hidden = f !== nombre;
  if (!hoja.abierta) hoja.abrir();
}

/** Desactiva el formulario mientras guarda; si algo falla, avisa sin perder lo escrito. */
async function enviando(form, accion) {
  if (enviandoAhora) return;
  enviandoAhora = true;
  const principal = form.querySelector("[data-guardar]");
  principal.dataset.texto ??= principal.textContent;
  principal.textContent = "Guardando…";
  principal.setAttribute("aria-busy", "true");
  const botones = [...form.querySelectorAll("button")];
  const antes = botones.map((b) => b.disabled);
  botones.forEach((b) => (b.disabled = true));
  try {
    await accion();
  } catch (error) {
    if (error instanceof SesionVencida) return pagina.manejarError(error);
    if (error instanceof DatoInvalido) avisar(`⚠️ ${error.message}`);
    else if (error instanceof NombreRepetido) avisar("⚠️ Ya tienes una cuenta con ese nombre");
    else {
      console.error(error);
      avisar(navigator.onLine ? "⚠️ No se guardó. Intenta otra vez." : "⚠️ Sin conexión. Intenta otra vez.");
    }
  } finally {
    enviandoAhora = false;
    principal.textContent = principal.dataset.texto;
    principal.removeAttribute("aria-busy");
    botones.forEach((b, i) => (b.disabled = antes[i]));
  }
}

/** Después de guardar: cierra, avisa y vuelve a leer todo (los saldos salen de la historia completa). */
async function terminar(mensaje) {
  hoja.cerrar();
  avisar(mensaje);
  try {
    estado.datos = await cargarFinanzas(userId);
    estado.cargadoEn = Date.now();
    derivar();
    pintar();
  } catch (error) {
    pagina.manejarError(error);
  }
}

// Borrar pide un segundo toque (sin ventanas de confirmación).
const borrados = [];
function confirmarBorrado(boton, accion) {
  let armado = false;
  let temporizador;
  const desarmar = () => {
    if (!armado) return;
    armado = false;
    window.clearTimeout(temporizador);
    boton.textContent = boton.dataset.normal ?? boton.textContent;
    boton.classList.remove("confirmar");
  };
  boton.addEventListener("click", async () => {
    if (!armado) {
      armado = true;
      boton.dataset.normal = boton.textContent;
      boton.textContent = "¿Seguro? Toca otra vez";
      boton.classList.add("confirmar");
      temporizador = window.setTimeout(desarmar, 4000);
      return;
    }
    desarmar();
    await accion.hacer();
  });
  borrados.push(desarmar);
}
const desarmarBorrados = () => borrados.forEach((desarmar) => desarmar());

const contextoFormulario = () => ({ legado: false, cuentas: estado.datos.cuentas, movimientos: estado.datos.movimientos });

// ── Hoja: movimiento ─────────────────────────────────────────────────────

const formMovimiento = $("form-movimiento");
const borrarMovimiento = formMovimiento.querySelector("[data-borrar]");

const movimiento = formularioMovimiento(formMovimiento, {
  alEnviar: ({ fila, momento, mensaje, editando }) =>
    enviando(formMovimiento, async () => {
      const registro = momento ? { ...fila, momento: momento.toISOString() } : fila;
      if (editando) await actualizar("finanzas_movimientos", editando.id, registro);
      else await insertar("finanzas_movimientos", { ...registro, id_cliente: idCliente });
      await terminar(editando ? "✏️ Cambios guardados" : mensaje);
    }),
});

function abrirNuevoMovimiento(opciones = {}) {
  movimiento.preparar({ contexto: contextoFormulario(), tipo: "egreso", ...opciones });
  borrarMovimiento.hidden = true;
  abrirFormulario("movimiento", opciones.tipo === "transferencia" && opciones.destino ? "Pagar" : "Movimiento");
}

function abrirPagoTarjeta(cuentaId) {
  abrirNuevoMovimiento({ tipo: "transferencia", destino: cuentaId });
}

function abrirMovimiento(mov) {
  if (mov.deuda_id && CATEGORIAS_DEUDA.has(mov.categoria)) {
    const deuda = vista.deudas.find((d) => d.id === mov.deuda_id);
    if (deuda) return abrirAbono(deuda, mov);
  }
  const original = estado.datos.movimientos.find((m) => m.id === mov.id) ?? mov;
  movimiento.preparar({ contexto: contextoFormulario(), movimiento: original });
  borrarMovimiento.hidden = false;
  abrirFormulario("movimiento", "Editar");
}

confirmarBorrado(borrarMovimiento, {
  hacer: () =>
    enviando(formMovimiento, async () => {
      await borrar("finanzas_movimientos", movimiento.editando.id);
      await terminar("🗑️ Movimiento borrado");
    }),
});

$("nuevo-movimiento").addEventListener("click", () => abrirNuevoMovimiento());

// ── Hoja: abonar o cobrar ────────────────────────────────────────────────

const formAbono = $("form-abono");
const abonoCampo = formAbono.elements.monto;
const abonoMomento = formAbono.elements.momento;
const abonoGuardar = formAbono.querySelector("[data-guardar]");
const abonoBorrar = formAbono.querySelector("[data-borrar]");
let abono = { deuda: null, editando: null, monto: 0 };

const abonoCuenta = chips(formAbono.querySelector('[data-chips="cuenta"]'), () => revisarAbono());

function ponerMontoAbono(valor) {
  abono.monto = valor;
  abonoCampo.value = valor ? formatoCOP(valor) : "";
  revisarAbono();
}
abonoCampo.addEventListener("input", () => ponerMontoAbono(Number(soloDigitos(abonoCampo.value).slice(0, 11)) || 0));

function revisarAbono() {
  abonoGuardar.disabled = !(abono.monto > 0 && abonoCuenta.valor);
}

function abrirAbono(deuda, mov = null) {
  const debo = deuda.direccion === "debo";
  const prestamo = mov && (mov.categoria === "prestamo_recibido" || mov.categoria === "prestamo_dado");
  abono = { deuda, editando: mov, monto: 0 };
  formAbono.querySelector("[data-abono-etiqueta]").textContent = prestamo ? "Préstamo" : debo ? "Le debes a" : "Te debe";
  formAbono.querySelector("[data-abono-nombre]").textContent = deuda.nombre;
  formAbono.querySelector("[data-abono-saldo]").textContent = formatoCOP(deuda.saldo);
  const entra = prestamo ? mov.categoria === "prestamo_recibido" : !debo;
  formAbono.querySelector('[data-titulo="cuenta"]').textContent = entra ? "A qué cuenta llegó" : "Desde";

  const cuentas = ordenarCuentas(estado.datos.cuentas.filter((c) => c.activa !== false && !esTarjeta(c)));
  abonoCuenta.opciones(cuentas.map((c) => ({ valor: c.id, texto: `${emojiCuenta(c.tipo)} ${c.nombre}` })));
  const elegida = mov ? (mov.cuenta_id ?? mov.cuenta_destino_id) : abonoCuenta.valor;
  abonoCuenta.poner(cuentas.some((c) => c.id === elegida) ? elegida : (cuentas[0]?.id ?? null));

  // Montos rápidos sin cifras (se leen aunque el modo discreto esté activo).
  const rapidos = formAbono.querySelector("[data-montos]");
  const opciones = [];
  if (!prestamo && deuda.cuota && Number(deuda.cuota) <= deuda.saldo) opciones.push(["La cuota", Number(deuda.cuota)]);
  if (!prestamo && deuda.saldo > 0) opciones.push(["Todo el saldo", deuda.saldo]);
  rapidos.replaceChildren(
    ...opciones.map(([texto, valor]) => {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.textContent = texto;
      boton.addEventListener("click", () => ponerMontoAbono(valor));
      return boton;
    }),
  );
  rapidos.hidden = opciones.length === 0;

  ponerMontoAbono(mov ? Number(mov.monto) : 0);
  abonoMomento.value = aEntradaLocal(mov ? new Date(mov.momento) : new Date());
  abonoGuardar.textContent = prestamo ? "Guardar" : debo ? "Guardar abono" : "Guardar cobro";
  abonoGuardar.dataset.texto = abonoGuardar.textContent;
  abonoBorrar.hidden = !mov;
  abrirFormulario("abono", mov ? "Editar" : debo ? "Abonar" : "Cobrar");
}

/** Después de abonar/editar/borrar: si la deuda quedó en cero se marca pagada; si volvió a tener saldo, se reabre. */
async function sincronizarDeuda(deudaId, movimientos) {
  const fila = estado.datos.deudas.find((d) => d.id === deudaId);
  if (!fila || fila.cuenta_id) return false;
  const { saldo } = saldoDeuda({ ...fila, estado: "activa" }, movimientos);
  const debe = saldo === 0 ? "pagada" : "activa";
  if (fila.estado === debe) return false;
  await actualizar("finanzas_deudas", deudaId, { estado: debe });
  return debe === "pagada";
}

formAbono.addEventListener("submit", (evento) => {
  evento.preventDefault();
  if (abonoGuardar.disabled) return;
  enviando(formAbono, async () => {
    const { deuda, editando, monto } = abono;
    const momento = deEntradaLocal(abonoMomento.value);
    if (!momento) throw new DatoInvalido("cuándo");
    const cuenta = estado.datos.cuentas.find((c) => c.id === abonoCuenta.valor);
    const prestamo = editando && (editando.categoria === "prestamo_recibido" || editando.categoria === "prestamo_dado");
    const otros = estado.datos.movimientos.filter((m) => m.id !== editando?.id);
    const fila = prestamo
      ? { ...movimientoDePrestamo({ ...deuda, monto_inicial: monto }, cuenta), descripcion: editando.descripcion }
      : prepararAbono(
          { deuda: deuda.id, monto, cuenta: cuenta?.id },
          // Al editar, la deuda puede estar "pagada" justo por este abono.
          { cuentas: estado.datos.cuentas, deudas: estado.datos.deudas.map((d) => (d.id === deuda.id ? { ...d, estado: "activa" } : d)), movimientos: otros },
        );
    const registro = { ...fila, momento: momento.toISOString() };
    let guardada = registro;
    if (editando) await actualizar("finanzas_movimientos", editando.id, registro);
    else {
      guardada = { ...registro, id: nuevoId() };
      await insertar("finanzas_movimientos", { ...guardada, id_cliente: idCliente });
    }
    const saldada = prestamo ? false : await sincronizarDeuda(deuda.id, [...otros, { ...guardada, id: editando?.id ?? guardada.id }]);
    await terminar(editando ? "✏️ Cambios guardados" : saldada ? "🎉 Deuda saldada" : fila.categoria === "cobro_deuda" ? "📒 Cobro guardado" : "📒 Abono guardado");
  });
});

confirmarBorrado(abonoBorrar, {
  hacer: () =>
    enviando(formAbono, async () => {
      const { deuda, editando } = abono;
      await borrar("finanzas_movimientos", editando.id);
      await sincronizarDeuda(
        deuda.id,
        estado.datos.movimientos.filter((m) => m.id !== editando.id),
      );
      await terminar("🗑️ Borrado");
    }),
});

// ── Hoja: cuenta ─────────────────────────────────────────────────────────

const formCuenta = $("form-cuenta");
const cuentaGuardar = formCuenta.querySelector("[data-guardar]");
const cuentaBorrar = formCuenta.querySelector("[data-borrar]");
let cuentaEditando = null;
let saldoTocado = false;

const tipoCuenta = chips(formCuenta.querySelector('[data-chips="tipo"]'), () => ajustarTipoCuenta());
tipoCuenta.opciones(TIPOS_CUENTA.map((t) => ({ valor: t.valor, texto: `${t.emoji} ${t.texto}` })));

function ajustarTipoCuenta() {
  const tarjeta = tipoCuenta.valor === "tarjeta_credito";
  formCuenta.querySelector('[data-bloque="tarjeta"]').hidden = !tarjeta;
  formCuenta.querySelector('[data-titulo="saldo"]').textContent = tarjeta ? "Deuda de hoy" : "Saldo de hoy";
  formCuenta.querySelector("[data-nota-saldo]").textContent = tarjeta
    ? "Lo que debes hoy en la tarjeta. Cada compra la sube y cada pago la baja."
    : "Lo que hay hoy en la cuenta. Desde aquí, cada movimiento lo actualiza solo.";
  revisarCuenta();
}

function revisarCuenta() {
  cuentaGuardar.disabled = !(formCuenta.elements.nombre.value.trim() && tipoCuenta.valor);
}

for (const nombre of ["saldo", "cupo"]) {
  const campo = formCuenta.elements[nombre];
  campo.addEventListener("input", () => {
    if (nombre === "saldo") saldoTocado = true;
    const valor = numeroDe(campo);
    campo.value = valor ? formatoCOP(valor) : "";
  });
}
formCuenta.elements.dia_pago.addEventListener("input", (e) => (e.target.value = soloDigitos(e.target.value).slice(0, 2)));
formCuenta.elements.nombre.addEventListener("input", () => revisarCuenta());

function abrirCuenta(cuenta, { tipo = "banco" } = {}) {
  cuentaEditando = cuenta;
  saldoTocado = false;
  const f = formCuenta.elements;
  f.nombre.value = cuenta?.nombre ?? "";
  f.banco.value = cuenta?.banco ?? "";
  tipoCuenta.poner(cuenta?.tipo ?? tipo);
  const actual = cuenta ? (esTarjeta(cuenta) ? cuenta.deuda : cuenta.saldo) : 0;
  f.saldo.value = actual > 0 ? formatoCOP(actual) : "";
  f.cupo.value = cuenta?.cupo ? formatoCOP(Number(cuenta.cupo)) : "";
  f.dia_pago.value = cuenta?.dia_pago ? String(cuenta.dia_pago) : "";
  ajustarTipoCuenta();

  cuentaBorrar.hidden = !cuenta;
  if (cuenta) {
    const usada = estado.datos.movimientos.some((m) => m.cuenta_id === cuenta.id || m.cuenta_destino_id === cuenta.id);
    cuentaBorrar.dataset.accion = cuenta.activa === false ? "reactivar" : usada ? "archivar" : "borrar";
    cuentaBorrar.textContent = { reactivar: "Reactivar cuenta", archivar: "Archivar cuenta", borrar: "Borrar cuenta" }[cuentaBorrar.dataset.accion];
  }
  abrirFormulario("cuenta", "Cuenta");
  if (!cuenta) window.setTimeout(() => f.nombre.focus({ preventScroll: true }), 350);
}

formCuenta.addEventListener("submit", (evento) => {
  evento.preventDefault();
  if (cuentaGuardar.disabled) return;
  enviando(formCuenta, async () => {
    const f = formCuenta.elements;
    const fila = prepararCuenta({ nombre: f.nombre.value, tipo: tipoCuenta.valor, banco: f.banco.value, cupo: f.cupo.value, dia_pago: f.dia_pago.value });
    const deseado = numeroDe(f.saldo) * (fila.tipo === "tarjeta_credito" ? -1 : 1);
    if (cuentaEditando) {
      const cambios = { ...fila };
      // El saldo solo se recalcula si lo cambiaste (o si cambió entre tarjeta y cuenta normal).
      if (saldoTocado || esTarjeta(cuentaEditando) !== (fila.tipo === "tarjeta_credito")) {
        cambios.saldo_inicial = ajustarSaldoInicial(cuentaEditando, deseado);
      }
      await actualizar("finanzas_cuentas", cuentaEditando.id, cambios);
    } else {
      const orden = Math.min(1000, Math.max(-1, ...estado.datos.cuentas.map((c) => c.orden ?? 0)) + 1);
      await insertarCuenta({ ...fila, saldo_inicial: deseado, orden });
    }
    await terminar(cuentaEditando ? "✏️ Cuenta guardada" : `${emojiCuenta(fila.tipo)} Cuenta creada`);
  });
});

cuentaBorrar.addEventListener(
  "click",
  (evento) => {
    // Reactivar no necesita confirmación; archivar con saldo no se permite.
    if (cuentaBorrar.dataset.accion === "reactivar") {
      evento.stopImmediatePropagation();
      enviando(formCuenta, async () => {
        await actualizar("finanzas_cuentas", cuentaEditando.id, { activa: true });
        await terminar("✅ Cuenta reactivada");
      });
    } else if (cuentaBorrar.dataset.accion === "archivar" && (cuentaEditando.saldo ?? 0) !== 0) {
      evento.stopImmediatePropagation();
      avisar("⚠️ Primero deja su saldo en cero");
    }
  },
  { capture: true },
);
confirmarBorrado(cuentaBorrar, {
  hacer: () =>
    enviando(formCuenta, async () => {
      if (cuentaBorrar.dataset.accion === "borrar") await borrar("finanzas_cuentas", cuentaEditando.id);
      else await actualizar("finanzas_cuentas", cuentaEditando.id, { activa: false });
      await terminar(cuentaBorrar.dataset.accion === "borrar" ? "🗑️ Cuenta borrada" : "🗂️ Cuenta archivada");
    }),
});

$("nueva-cuenta").addEventListener("click", () => abrirCuenta(null));

// ── Hoja: deuda ──────────────────────────────────────────────────────────

const formDeuda = $("form-deuda");
const deudaGuardar = formDeuda.querySelector("[data-guardar]");
const deudaEstado = formDeuda.querySelector("[data-estado]");
const deudaBorrar = formDeuda.querySelector("[data-borrar]");
let deudaEditando = null;

const direccion = chips(formDeuda.querySelector('[data-chips="direccion"]'), () => ajustarDeuda());
const tipoDeuda = chips(formDeuda.querySelector('[data-chips="tipo"]'), () => ajustarDeuda());
const movio = chips(formDeuda.querySelector('[data-chips="movio"]'));
direccion.opciones(DIRECCIONES_DEUDA);
tipoDeuda.opciones(TIPOS_DEUDA.map((t) => ({ valor: t.valor, texto: `${t.emoji} ${t.texto}` })));

function ajustarDeuda() {
  const debo = direccion.valor === "debo";
  const tarjeta = tipoDeuda.valor === "tarjeta_credito" && !deudaEditando;
  formDeuda.querySelector("[data-nota-tarjeta]").hidden = !tarjeta;
  formDeuda.querySelector('[data-bloque="datos"]').hidden = tarjeta;
  deudaGuardar.hidden = tarjeta;
  formDeuda.querySelector('[data-titulo="nombre"]').textContent = debo ? "¿A quién le debes?" : "¿Quién te debe?";
  formDeuda.querySelector('[data-bloque="banco"]').hidden = tipoDeuda.valor === "persona";
  formDeuda.querySelector('[data-bloque="tasa"]').hidden = !["prestamo", "tarjeta_credito"].includes(tipoDeuda.valor);
  formDeuda.querySelector('[data-bloque="movio"]').hidden = Boolean(deudaEditando);
  formDeuda.querySelector('[data-titulo="movio"]').textContent = debo ? "¿Te lo depositaron en una cuenta?" : "¿Salió de una de tus cuentas?";
  revisarDeuda();
}

function revisarDeuda() {
  deudaGuardar.disabled = !(direccion.valor && tipoDeuda.valor && formDeuda.elements.nombre.value.trim() && numeroDe(formDeuda.elements.monto) > 0);
}

for (const nombre of ["monto", "cuota"]) {
  const campo = formDeuda.elements[nombre];
  campo.addEventListener("input", () => {
    const valor = numeroDe(campo);
    campo.value = valor ? formatoCOP(valor) : "";
    revisarDeuda();
  });
}
formDeuda.elements.dia_pago.addEventListener("input", (e) => (e.target.value = soloDigitos(e.target.value).slice(0, 2)));
formDeuda.elements.nombre.addEventListener("input", () => revisarDeuda());
formDeuda.querySelector("[data-crear-tarjeta]").addEventListener("click", () => abrirCuenta(null, { tipo: "tarjeta_credito" }));

function abrirDeuda(deuda = null) {
  deudaEditando = deuda;
  const f = formDeuda.elements;
  direccion.poner(deuda?.direccion ?? estado.pestanaDeuda);
  tipoDeuda.poner(deuda?.tipo ?? "persona");
  f.nombre.value = deuda?.nombre ?? "";
  f.banco.value = deuda?.banco ?? "";
  f.monto.value = deuda ? formatoCOP(Number(deuda.monto_inicial)) : "";
  f.cuota.value = deuda?.cuota ? formatoCOP(Number(deuda.cuota)) : "";
  f.dia_pago.value = deuda?.dia_pago ? String(deuda.dia_pago) : "";
  f.tasa_mensual.value = deuda?.tasa_mensual != null ? String(deuda.tasa_mensual).replace(".", ",") : "";
  f.notas.value = deuda?.notas ?? "";

  const cuentas = ordenarCuentas(estado.datos.cuentas.filter((c) => c.activa !== false && !esTarjeta(c)));
  movio.opciones([{ valor: "no", texto: "No" }, ...cuentas.map((c) => ({ valor: c.id, texto: `${emojiCuenta(c.tipo)} ${c.nombre}` }))]);
  movio.poner("no");

  deudaEstado.hidden = !deuda;
  deudaEstado.textContent = deuda?.estado === "pagada" ? "Reabrir deuda" : "Marcar como pagada";
  deudaBorrar.hidden = !deuda;
  ajustarDeuda();
  abrirFormulario("deuda", "Deuda");
}

formDeuda.addEventListener("submit", (evento) => {
  evento.preventDefault();
  if (deudaGuardar.disabled) return;
  enviando(formDeuda, async () => {
    const f = formDeuda.elements;
    const fila = prepararDeuda(
      {
        direccion: direccion.valor,
        tipo: tipoDeuda.valor,
        nombre: f.nombre.value,
        banco: tipoDeuda.valor === "persona" ? "" : f.banco.value,
        monto: numeroDe(f.monto),
        cuota: numeroDe(f.cuota) || "",
        dia_pago: f.dia_pago.value,
        tasa_mensual: f.tasa_mensual.value,
        notas: f.notas.value,
      },
      { cuentas: estado.datos.cuentas },
    );
    if (deudaEditando) {
      const { cuenta_id: _cuenta, ...cambios } = fila; // La tarjeta ligada no se cambia desde aquí.
      await actualizar("finanzas_deudas", deudaEditando.id, cambios);
      return terminar("✏️ Deuda guardada");
    }
    const id = nuevoId();
    await insertar("finanzas_deudas", { ...fila, id, id_cliente: idCliente });
    const cuenta = movio.valor !== "no" ? estado.datos.cuentas.find((c) => c.id === movio.valor) : null;
    if (cuenta) await insertar("finanzas_movimientos", { ...movimientoDePrestamo({ ...fila, id }, cuenta), id_cliente: nuevoId() });
    estado.pestanaDeuda = fila.direccion;
    document.querySelectorAll("#deudas-pestanas [data-valor]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.valor === fila.direccion)));
    await terminar("📒 Deuda guardada");
  });
});

deudaEstado.addEventListener("click", () =>
  enviando(formDeuda, async () => {
    const pagada = deudaEditando.estado === "pagada";
    await actualizar("finanzas_deudas", deudaEditando.id, { estado: pagada ? "activa" : "pagada" });
    await terminar(pagada ? "📒 Deuda reabierta" : "✅ Marcada como pagada");
  }),
);

confirmarBorrado(deudaBorrar, {
  hacer: () =>
    enviando(formDeuda, async () => {
      await borrar("finanzas_deudas", deudaEditando.id);
      await terminar("🗑️ Deuda borrada");
    }),
});

$("nueva-deuda").addEventListener("click", () => abrirDeuda(null));

// ── Arranque ─────────────────────────────────────────────────────────────

await cargar();

// finanzas.html#nuevo abre directo la hoja (útil desde un atajo o el widget).
if (location.hash === "#nuevo" && estado.datos) abrirNuevoMovimiento();

// Al volver a la app después de un rato, trae lo que hayan registrado los atajos.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && estado.datos && !hoja.abierta && Date.now() - estado.cargadoEn > 60_000) cargar();
});
