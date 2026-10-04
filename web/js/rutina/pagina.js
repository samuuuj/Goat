// Rutina (rutina.html): tu día como línea de tiempo con "Ahora", la semana, las tareas de la U y la plantilla.
// Las reglas están en logica.js (las mismas de la API); aquí solo se pinta y se guarda.

import { iniciarPagina } from "../piezas/pagina.js";
import { crearHoja } from "../piezas/hoja.js";
import { chips } from "../piezas/chips.js";
import { alVerse, avisar, clonar, reducirMovimiento } from "../piezas/ui.js";
import { guardarAjuste, leerAjustes } from "../supabase/ajustes.js";
import { diaLogico, diaYMes, horaBogota, nombreDia } from "../logica/dia.js";
import * as L from "./logica.js";
import * as D from "./datos.js";
import { abrirEncuesta } from "./encuesta.js";
import { ATAJOS } from "./atajos.js";

const $ = (id) => document.getElementById(id);
const MINUTO = 60_000;
const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// ?hora=2026-10-06T10:30 fija "ahora" (para revisar la página en el simulador); el reloj sigue avanzando desde ahí.
const desfase = (() => {
  const p = new URLSearchParams(location.search).get("hora");
  if (!p) return 0;
  const t = Date.parse(/(Z|[+-]\d{2}:\d{2})$/i.test(p) ? p : `${p}-05:00`);
  return Number.isNaN(t) ? 0 : t - Date.now();
})();
const ahora = () => new Date(Date.now() + desfase);

const pagina = await iniciarPagina({ alReintentar: () => cargar() });
const userId = pagina.sesion.user.id;

let datos = null; // { bloques, checks, festivos, tareas, hechasSemana }
let diaElegido = null; // fecha elegida en la semana (null = hoy)
let firmas = {}; // lo último que se pintó en cada parte, para no repintar sin cambios
let reloj = null; // { hasta, desde } de la tarjeta "Ahora"
let ultimaCarga = 0;
let primeraVez = true;

const ahoraLinea = $("lt-ahora");
const hoja = crearHoja({ hoja: $("hoja"), velo: $("velo"), manija: $("hoja-manija"), fondo: [$("contenido")] });
// (El arranque está al final del archivo: primero se declaran todas las variables.)

// ── Carga ────────────────────────────────────────────────────────────────

async function cargar() {
  try {
    datos = await D.cargarRutina(userId, ahora());
    ultimaCarga = Date.now();
    firmas = {};
    pagina.mostrar("contenido");
    pintar();
  } catch (error) {
    pagina.manejarError(error);
  }
}

/** Repinta lo que cambió. Se llama al cargar, al guardar y cada 30 s (los estados dependen de la hora). */
function pintar() {
  const t = ahora();
  const hoy = diaLogico(t);
  const lunes = L.lunesDe(hoy);
  if (diaElegido && (diaElegido < lunes || diaElegido > L.sumarDias(lunes, 6) || diaElegido === hoy)) diaElegido = null;

  const tieneRutina = datos.bloques.length > 0;
  $("sin-rutina").hidden = tieneRutina;
  document.querySelectorAll("[data-con-rutina]").forEach((el) => (el.hidden = !tieneRutina));

  const itemsHoy = L.estadoDelDia(datos.bloques, datos.checks, t, { fecha: hoy, festivos: datos.festivos });
  pintarCabecera(hoy, itemsHoy, tieneRutina);
  if (tieneRutina) {
    pintarAhora(itemsHoy, t, hoy);
    pintarPorConfirmar(itemsHoy, t);
    const fecha = diaElegido ?? hoy;
    const items = fecha === hoy ? itemsHoy : L.estadoDelDia(datos.bloques, datos.checks, t, { fecha, festivos: datos.festivos });
    pintarLinea(items, fecha, hoy, t);
    pintarSemana(t, hoy);
    pintarPlantilla();
  }
  pintarTareas(t);
  primeraVez = false;
}

/** Ejecuta `fn` solo si `firma` cambió desde la última vez. */
function siCambio(clave, firma, fn) {
  const texto = JSON.stringify(firma);
  if (firmas[clave] === texto) return;
  firmas[clave] = texto;
  fn();
}

// ── Cabecera ─────────────────────────────────────────────────────────────

function pintarCabecera(hoy, items, tieneRutina) {
  const festivo = datos.festivos.find((f) => f.fecha === hoy);
  const tipo = L.tipoDia(hoy, datos.festivos);
  $("cabecera-fecha").textContent = `${capital(nombreDia(hoy))} ${diaYMes(hoy)} · ${festivo ? "Festivo" : tipo === "fin_de_semana" ? "Fin de semana" : "Día hábil"}`;

  const c = L.cumplimiento(items);
  let texto;
  if (!tieneRutina) texto = "Una rutina que te recuerda cada cosa a su hora. Tú solo das el visto bueno.";
  else if (c.total === 0) texto = "Hoy no hay bloques en tu plantilla.";
  else texto = `${c.obligatorios.hechos} de ${c.obligatorios.total} obligatorios y ${c.hechos} de ${c.total} bloques hechos.`;
  if (festivo && tieneRutina) texto = `Festivo (${festivo.nombre}): hoy va tu plantilla del domingo. ${texto}`;
  $("cabecera-texto").textContent = texto;

  const avance = $("avance-dia");
  avance.hidden = !tieneRutina || c.obligatorios.total === 0;
  if (!avance.hidden) {
    $("avance-texto").textContent = `${c.obligatorios.hechos}/${c.obligatorios.total}`;
    const relleno = $("avance-relleno");
    const valor = `scaleX(${c.obligatorios.hechos / c.obligatorios.total})`;
    if (primeraVez) alVerse(avance, () => requestAnimationFrame(() => (relleno.style.transform = valor)));
    else relleno.style.transform = valor;
    avance.querySelector(".progreso").setAttribute("aria-valuenow", String(Math.round((c.obligatorios.hechos / c.obligatorios.total) * 100)));
  }
}

// ── Ahora ────────────────────────────────────────────────────────────────

function pintarAhora(items, t, hoy) {
  const { actual, siguiente: proximo } = L.ahoraYSiguiente(items, t);
  const tarjeta = $("ahora");
  const enlace = $("ahora-enlace");
  const botones = $("ahora-botones");
  const marcado = $("ahora-marcado");
  enlace.hidden = true;
  botones.hidden = true;
  marcado.hidden = true;
  reloj = null;

  let modo;
  if (actual) {
    modo = "bloque";
    $("ahora-emoji").textContent = L.emojiDe(actual.tipo);
    $("ahora-titulo").textContent = `${actual.titulo}.`;
    $("ahora-rango").textContent = L.rangoTexto(actual);
    $("ahora-detalle").textContent = [actual.obligatorio ? "● Obligatorio" : null, actual.lugar ? `📍 ${actual.lugar}` : null, actual.materia && actual.materia !== actual.titulo ? actual.materia : null]
      .filter(Boolean)
      .join(" · ");
    if (actual.enlace) {
      enlace.href = actual.enlace;
      enlace.hidden = false;
    }
    if (actual.marcable) {
      if (actual.check) {
        marcado.hidden = false;
        $("ahora-marcado-texto").textContent = actual.check.estado === "hecho" ? "✓ Ya lo marcaste como hecho." : "⤼ Lo marcaste como saltado.";
      } else botones.hidden = false;
    }
    tarjeta.dataset.bloque = actual.id;
    reloj = { hasta: actual.fin, desde: actual.inicio, texto: "quedan" };
  } else if (proximo) {
    const empezo = items.some((b) => b.inicio <= t.getTime());
    modo = empezo ? "libre" : "antes";
    $("ahora-emoji").textContent = empezo ? "🌿" : "🌅";
    $("ahora-titulo").textContent = empezo ? "Libre." : "Aún no empieza.";
    $("ahora-rango").textContent = empezo ? `Hasta las ${L.aHora(proximo.inicioMin)}` : `Arranca a las ${L.aHora(proximo.inicioMin)}`;
    $("ahora-detalle").textContent = empezo && datos.tareas.length ? "Buen rato para dar el primer paso de una tarea." : "";
    reloj = { hasta: proximo.inicio, desde: null, texto: "para empezar" };
  } else {
    modo = "fin";
    $("ahora-emoji").textContent = "🌙";
    $("ahora-titulo").textContent = items.length ? "Día cerrado." : "Día libre.";
    const manana = L.bloquesDelDia(datos.bloques, L.sumarDias(hoy, 1), L.tipoDia(L.sumarDias(hoy, 1), datos.festivos))[0];
    $("ahora-rango").textContent = manana ? `Mañana arranca a las ${L.aHora(manana.inicioMin)}` : "";
    $("ahora-detalle").textContent = items.length ? "Lo que no marcaste lo puedes confirmar abajo." : "Hoy no hay bloques en tu plantilla.";
  }
  tarjeta.dataset.modo = modo;
  $("ahora-reloj").hidden = !reloj;
  $("ahora-progreso-caja").hidden = !reloj?.desde;

  const despues = $("despues");
  despues.hidden = !proximo || !actual;
  if (actual && proximo) {
    $("despues-texto").textContent = `${L.emojiDe(proximo.tipo)} ${proximo.titulo}`;
    $("despues-hora").textContent = L.aHora(proximo.inicioMin);
  }
  tic();
}

/** Cada segundo: el reloj de la tarjeta "Ahora". Al llegar a cero, repinta (cambia el bloque). */
function tic() {
  if (!reloj) return;
  const t = ahora().getTime();
  const quedan = reloj.hasta - t;
  if (quedan <= 0) {
    reloj = null;
    window.setTimeout(pintar, 250);
    return;
  }
  const s = Math.ceil(quedan / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const dos = (n) => String(n).padStart(2, "0");
  $("ahora-quedan").textContent = h ? `${h}:${dos(m)}:${dos(seg)}` : `${dos(m)}:${dos(seg)}`;
  const minutos = Math.ceil(quedan / MINUTO);
  const lector = `${reloj.texto === "quedan" ? "Quedan" : "Faltan"} ${L.duracionTexto(minutos)}`;
  if ($("ahora-lector").textContent !== lector) $("ahora-lector").textContent = lector;
  $("ahora-quedan-texto").textContent = reloj.texto;
  if (reloj.desde) $("ahora-progreso").style.transform = `scaleX(${Math.min(1, (t - reloj.desde) / (reloj.hasta - reloj.desde))})`;
}

/** Lo que terminó y nadie marcó: los obligatorios primero (la web pide confirmarlos). */
function pintarPorConfirmar(items, t) {
  const lista = items
    .filter((b) => b.marcable && !b.check && b.fin <= t.getTime() && (b.obligatorio || b.estado !== "vencido"))
    .sort((a, b) => Number(b.obligatorio) - Number(a.obligatorio) || a.inicio - b.inicio);
  siCambio("confirmar", lista.map((b) => b.id), () => {
    $("por-confirmar").hidden = lista.length === 0;
    $("por-confirmar-lista").replaceChildren(
      ...lista.map((b) => {
        const fila = clonar("plantilla-confirmar");
        fila.querySelector(".fila-icono").textContent = L.emojiDe(b.tipo);
        fila.querySelector(".fila-titulo").textContent = b.titulo;
        fila.querySelector(".fila-detalle").textContent = `Terminó ${L.aHora(b.finMin)}${b.obligatorio ? " · Obligatorio" : ""}`;
        fila.classList.toggle("es-obligatorio", Boolean(b.obligatorio));
        const [hecho, saltar] = fila.querySelectorAll("button");
        hecho.setAttribute("aria-label", `Hecho: ${b.titulo}`);
        saltar.setAttribute("aria-label", `Saltar: ${b.titulo}`);
        hecho.addEventListener("click", () => marcarBloque(b, "hecho"));
        saltar.addEventListener("click", () => marcarBloque(b, "saltado"));
        return fila;
      }),
    );
  });
}

// ── Línea de tiempo (estilo Calendario) ──────────────────────────────────

/** Columnas para bloques que se cruzan (como Calendario: lado a lado). */
function columnas(items) {
  const res = items.map(() => ({ col: 0, cols: 1 }));
  let grupo = [];
  let finGrupo = -Infinity;
  const cerrarGrupo = () => {
    const n = Math.max(...grupo.map((i) => res[i].col)) + 1;
    grupo.forEach((i) => (res[i].cols = n));
  };
  items.forEach((b, i) => {
    if (grupo.length && b.inicioMin >= finGrupo) {
      cerrarGrupo();
      grupo = [];
      finGrupo = -Infinity;
    }
    const ocupadas = grupo.filter((j) => items[j].finMin > b.inicioMin).map((j) => res[j].col);
    let c = 0;
    while (ocupadas.includes(c)) c++;
    res[i].col = c;
    grupo.push(i);
    finGrupo = Math.max(finGrupo, b.finMin);
  });
  if (grupo.length) cerrarGrupo();
  return res;
}

const TEXTO_ESTADO = { hecho: "hecho", saltado: "saltado", vencido: "sin marcar", ahora: "en curso", pendiente: "pendiente" };

function pintarLinea(items, fecha, hoy, t) {
  const esHoy = fecha === hoy;
  $("dia-etiqueta").textContent = esHoy ? "Hoy" : `${capital(nombreDia(fecha))} ${diaYMes(fecha)}`;
  $("volver-hoy").hidden = esHoy;
  const contenedor = $("linea-tiempo");
  const desde = items.length ? Math.floor(Math.min(...items.map((b) => b.inicioMin)) / 60) * 60 : 0;
  const hasta = items.length ? Math.ceil(Math.max(...items.map((b) => b.finMin)) / 60) * 60 : 0;

  siCambio(
    "linea",
    [fecha, items.map((b) => [b.id, b.estado, b.inicioMin, b.finMin, b.titulo, b.obligatorio, b.fin <= t.getTime()])],
    () => {
      $("lt-vacio").hidden = items.length > 0;
      contenedor.hidden = items.length === 0;
      contenedor.style.setProperty("--minutos", String(hasta - desde));
      const horas = [];
      for (let m = desde; m <= hasta; m += 60) {
        const marca = document.createElement("span");
        marca.className = "lt-hora-marca cifras";
        marca.textContent = L.aHora(m);
        marca.style.setProperty("--m", String(m - desde));
        horas.push(marca);
      }
      $("lt-horas").replaceChildren(...horas);

      const cols = columnas(items);
      const bloques = items.map((b, i) => {
        const li = clonar("plantilla-bloque");
        li.style.setProperty("--m", String(b.inicioMin - desde));
        li.style.setProperty("--d", String(b.finMin - b.inicioMin));
        li.style.setProperty("--col", String(cols[i].col));
        li.style.setProperty("--cols", String(cols[i].cols));
        li.style.setProperty("--i", String(Math.min(i, 12)));
        li.classList.add(`es-${b.estado}`);
        li.classList.toggle("es-obligatorio", Boolean(b.obligatorio));
        li.classList.toggle("es-pausa", !b.marcable);
        li.classList.toggle("es-corto", b.finMin - b.inicioMin < 25);
        li.classList.toggle("es-pasado", b.fin <= t.getTime());
        if (primeraVez) li.classList.add("entra");
        li.querySelector(".lt-emoji").textContent = L.emojiDe(b.tipo);
        li.querySelector(".lt-titulo").textContent = b.titulo;
        li.querySelector(".lt-hora").textContent = L.rangoTexto(b);
        const marca = b.estado === "hecho" ? "✓" : b.estado === "saltado" ? "⤼" : b.obligatorio ? "●" : "";
        li.querySelector(".lt-marca").textContent = marca;
        const boton = li.querySelector(".lt-boton");
        boton.setAttribute(
          "aria-label",
          `${b.titulo}, ${L.aHora(b.inicioMin)} a ${L.aHora(b.finMin)}${b.obligatorio ? ", obligatorio" : ""}${b.marcable ? `, ${TEXTO_ESTADO[b.estado]}` : ""}`,
        );
        boton.addEventListener("click", () => abrirDetalle(b, hoy));
        const enlace = li.querySelector(".lt-enlace");
        if (b.enlace) {
          enlace.href = b.enlace;
          enlace.hidden = false;
          enlace.setAttribute("aria-label", `Unirse a ${b.titulo}`);
        }
        return li;
      });
      $("lt-carril").replaceChildren(...bloques, ahoraLinea);
    },
  );

  // La línea de "ahora" avanza sola (solo hoy y dentro del rango).
  const inicioRango = L.instante(fecha, desde);
  const finRango = L.instante(fecha, hasta);
  const visible = esHoy && items.length > 0 && t.getTime() >= inicioRango && t.getTime() <= finRango;
  ahoraLinea.hidden = !visible;
  if (visible) {
    ahoraLinea.style.setProperty("--m", ((t.getTime() - inicioRango) / MINUTO).toFixed(2));
    $("lt-ahora-hora").textContent = horaBogota(t);
  }
}

// ── Semana ───────────────────────────────────────────────────────────────

function pintarSemana(t, hoy) {
  const sem = L.semana(datos.bloques, datos.checks, t, { festivos: datos.festivos });
  const elegido = diaElegido ?? hoy;
  const todos = sem.flatMap((d) => d.items.filter((b) => b.marcable));
  const desde = todos.length ? Math.min(...todos.map((b) => b.inicioMin)) : 360;
  const hasta = todos.length ? Math.max(...todos.map((b) => b.finMin)) : 1380;
  const rango = Math.max(hasta - desde, 60);

  const pasados = sem.filter((d) => !d.futuro);
  const hechos = pasados.reduce((n, d) => n + d.cumplimiento.hechos, 0);
  const total = pasados.reduce((n, d) => n + d.cumplimiento.total, 0);
  $("semana-total").textContent = total ? `${Math.round((hechos / total) * 100)}% hecho` : "";

  siCambio(
    "semana",
    [elegido, sem.map((d) => [d.fecha, d.items.map((b) => [b.id, b.estado, b.inicioMin, b.finMin])])],
    () => {
      $("semana-rejilla").replaceChildren(
        ...sem.map((d) => {
          const columna = clonar("plantilla-semana-dia");
          columna.classList.toggle("es-hoy", d.esHoy);
          columna.classList.toggle("es-futuro", d.futuro);
          columna.setAttribute("aria-pressed", String(d.fecha === elegido));
          columna.querySelector(".sd-letra").textContent = d.dia.corto;
          columna.querySelector(".sd-numero").textContent = String(Number(d.fecha.slice(8)));
          const pct = d.futuro || d.cumplimiento.pct === null ? null : Math.round(d.cumplimiento.pct * 100);
          columna.querySelector(".sd-pct").textContent = pct === null ? "—" : `${pct}%`;
          columna.querySelector(".sd-festivo").hidden = !d.festivo;
          columna.setAttribute(
            "aria-label",
            `${capital(d.dia.nombre)} ${Number(d.fecha.slice(8))}${d.festivo ? `, festivo` : ""}: ${pct === null ? (d.futuro ? "aún no llega" : "sin bloques") : `${pct}% hecho`}`,
          );
          columna.querySelector(".sd-mapa").replaceChildren(
            ...d.items
              .filter((b) => b.marcable)
              .map((b) => {
                const barra = document.createElement("span");
                barra.className = `sd-bloque es-${b.estado}${b.obligatorio ? " es-obligatorio" : ""}`;
                barra.style.setProperty("--t", ((b.inicioMin - desde) / rango).toFixed(4));
                barra.style.setProperty("--h", ((b.finMin - b.inicioMin) / rango).toFixed(4));
                return barra;
              }),
          );
          columna.addEventListener("click", () => {
            diaElegido = d.fecha === hoy ? null : d.fecha;
            pintar();
            $("seccion-dia").scrollIntoView({ behavior: reducirMovimiento() ? "auto" : "smooth", block: "start" });
          });
          return columna;
        }),
      );
    },
  );
}

// ── Tareas de la universidad ─────────────────────────────────────────────

function pintarTareas(t) {
  const lista = L.ordenarTareas(datos.tareas, t);
  siCambio("tareas", [diaLogico(t), Math.floor(t.getTime() / (15 * MINUTO)), lista, datos.hechasSemana], () => {
    $("tareas-vacio").hidden = lista.length > 0;
    $("tareas-hechas").textContent = datos.hechasSemana ? `✓ ${datos.hechasSemana} ${datos.hechasSemana === 1 ? "hecha" : "hechas"} esta semana` : "";
    $("tareas-lista").replaceChildren(
      ...lista.map((tarea, i) => {
        const li = clonar("plantilla-tarea");
        li.classList.toggle("vencida", tarea.vencida);
        li.style.setProperty("--i", String(i));
        li.querySelector(".tarea-titulo").textContent = tarea.titulo;
        li.querySelector(".tarea-vence").textContent = tarea.vence;
        li.querySelector(".tarea-materia").textContent = [tarea.materia, tarea.estado === "en_progreso" ? "En curso" : null].filter(Boolean).join(" · ");
        const paso = li.querySelector(".tarea-paso-texto");
        if (tarea.primer_paso) paso.textContent = tarea.primer_paso;
        else {
          paso.textContent = "Toca para escribir el primer paso.";
          li.querySelector(".tarea-paso").classList.add("sin-paso");
        }
        const check = li.querySelector(".tarea-check");
        check.setAttribute("aria-label", `Marcar hecha: ${tarea.titulo}`);
        check.addEventListener("click", () => completarTarea(tarea));
        li.querySelector(".tarea-cuerpo").addEventListener("click", () => abrirTarea(tarea));
        return li;
      }),
    );
  });
}

async function completarTarea(tarea) {
  const antes = datos.tareas;
  datos.tareas = antes.filter((x) => x.id !== tarea.id);
  datos.hechasSemana++;
  pintar();
  avisar("✅ Tarea hecha");
  try {
    await D.cambiarEstadoTarea(tarea.id, "hecha");
  } catch (error) {
    datos.tareas = antes;
    datos.hechasSemana--;
    pintar();
    pagina.manejarError(error);
  }
}

// ── Plantilla ────────────────────────────────────────────────────────────

function pintarPlantilla() {
  const ordenados = [...datos.bloques]
    .map((b) => ({ ...b, min: L.minutoLogico(L.aMinutos(b.hora_inicio) ?? 0) }))
    .sort((a, b) => a.min - b.min || (a.orden ?? 0) - (b.orden ?? 0));
  siCambio("plantilla", ordenados, () => {
    const obligatorios = ordenados.filter((b) => b.obligatorio).length;
    $("plantilla-resumen").textContent = `${ordenados.length} bloques · ${obligatorios} obligatorios. Toca uno para cambiarlo.`;
    const lista = L.choques(datos.bloques);
    $("choques").hidden = lista.length === 0;
    $("choques-lista").replaceChildren(
      ...lista.slice(0, 8).map((c) => {
        const li = document.createElement("li");
        li.textContent = `${L.textoDias(c.dias)} ${c.desde}–${c.hasta}: ${c.a.titulo} y ${c.b.titulo}`;
        return li;
      }),
    );
    $("plantilla-lista").replaceChildren(
      ...ordenados.map((b) => {
        const li = clonar("plantilla-fila-bloque");
        li.querySelector(".fila-icono").textContent = L.emojiDe(b.tipo);
        li.querySelector(".fila-titulo").textContent = b.titulo;
        li.querySelector(".fila-detalle").textContent = `${L.aHora(b.min)} · ${L.duracionTexto(b.duracion_min)} · ${L.textoDias(b.dias)}`;
        li.querySelector(".punto-obligatorio").hidden = !b.obligatorio;
        li.querySelector("button").addEventListener("click", () => abrirBloque(datos.bloques.find((x) => x.id === b.id)));
        return li;
      }),
    );
  });
}

// ── Marcar ───────────────────────────────────────────────────────────────

async function marcarBloque(b, estado) {
  const previo = datos.checks.find((c) => c.bloque_id === b.id && c.fecha === b.fecha) ?? null;
  const temporal = { id: previo?.id ?? null, bloque_id: b.id, fecha: b.fecha, estado };
  datos.checks = [...datos.checks.filter((c) => c !== previo), temporal];
  hoja.cerrar();
  pintar();
  avisar(estado === "hecho" ? "✅ Hecho" : "⤼ Saltado");
  try {
    Object.assign(temporal, await D.marcar({ bloqueId: b.id, fecha: b.fecha, estado, checkId: previo?.id }));
  } catch (error) {
    datos.checks = [...datos.checks.filter((c) => c !== temporal), ...(previo ? [previo] : [])];
    pintar();
    pagina.manejarError(error);
  }
}

async function quitarMarca(b) {
  const previo = datos.checks.find((c) => c.bloque_id === b.id && c.fecha === b.fecha);
  if (!previo) return;
  datos.checks = datos.checks.filter((c) => c !== previo);
  hoja.cerrar();
  pintar();
  avisar("↩️ Sin marcar");
  try {
    if (previo.id) await D.quitarMarca(previo.id);
  } catch (error) {
    datos.checks = [...datos.checks, previo];
    pintar();
    pagina.manejarError(error);
  }
}

// ── Hoja: detalle de un bloque ───────────────────────────────────────────

/** Si la hoja ya está abierta (del detalle a "Editar bloque"), solo cambia su contenido. */
function abrirHoja() {
  if (hoja.abierta) $("hoja").scrollTop = 0;
  else hoja.abrir();
}

const FORMULARIOS = ["vista-bloque", "form-bloque", "form-tarea"];
function mostrarFormulario(id, titulo) {
  FORMULARIOS.forEach((f) => ($(f).hidden = f !== id));
  $("hoja-titulo").textContent = titulo;
}

let detalle = null;

function abrirDetalle(b, hoy) {
  detalle = b;
  mostrarFormulario("vista-bloque", b.titulo);
  $("vb-rango").textContent = `${L.emojiDe(b.tipo)} ${L.rangoTexto(b)} · ${L.duracionTexto(b.duracion_min)}`;
  const estado = !b.marcable ? "Pausa: no se marca." : { hecho: "✓ Hecho", saltado: "⤼ Saltado", vencido: "Terminó y no lo marcaste.", ahora: "En curso.", pendiente: b.porMarcar ? "Terminó: ¿lo hiciste?" : "Pendiente." }[b.estado];
  $("vb-detalle").textContent = [estado, b.obligatorio ? "● Obligatorio" : null, b.lugar ? `📍 ${b.lugar}` : null, b.materia && b.materia !== b.titulo ? `📚 ${b.materia}` : null]
    .filter(Boolean)
    .join("  ·  ");
  const enlace = $("vb-enlace");
  enlace.hidden = !b.enlace;
  if (b.enlace) enlace.href = b.enlace;
  const futuro = b.fecha > hoy;
  const puede = b.marcable && !futuro;
  $("vb-futuro").hidden = !futuro || !b.marcable;
  const [hecho, saltar, quitar] = ["hecho", "saltado", "quitar"].map((a) => document.querySelector(`[data-vb="${a}"]`));
  hecho.hidden = !puede || b.check?.estado === "hecho";
  saltar.hidden = !puede || b.check?.estado === "saltado";
  quitar.hidden = !puede || !b.check;
  abrirHoja();
}

// ── Hoja: editar un bloque ───────────────────────────────────────────────

const CAMPOS_POR_TIPO = {
  lugar: new Set(["clase_presencial", "ejercicio", "trabajo_uni", "estudio", "otro"]),
  enlace: new Set(["clase_virtual", "otro"]),
  materia: new Set(["clase_presencial", "clase_virtual", "trabajo_uni", "estudio"]),
};
const AVISOS = [0, 5, 10, 15, 30];

let editando = null; // bloque que se edita (null = nuevo)
let diasBloque = [];
let selectorTipo = null;
let selectorAviso = null;

function pintarDiasBloque() {
  for (const b of $("dias-bloque").children) b.setAttribute("aria-pressed", String(diasBloque.includes(Number(b.dataset.dia))));
}

function camposPorTipo(tipo) {
  for (const [campo, tipos] of Object.entries(CAMPOS_POR_TIPO)) {
    document.querySelector(`[data-campo="${campo}"]`).hidden = !tipos.has(tipo);
  }
}

function abrirBloque(bloque) {
  editando = bloque ?? null;
  const f = $("form-bloque");
  const t = ahora();
  const hoyDia = L.diaSemana(diaLogico(t));
  const base = bloque ?? {
    titulo: "",
    tipo: "otro",
    dias: [hoyDia],
    hora_inicio: L.aHora(Math.min(23 * 60, (Math.floor(L.aMinutos(horaBogota(t)) / 60) + 1) * 60)),
    duracion_min: 30,
    obligatorio: false,
    aviso_min: 0,
  };
  mostrarFormulario("form-bloque", bloque ? "Editar bloque." : "Nuevo bloque.");
  f.elements.titulo.value = base.titulo ?? "";
  f.elements.hora_inicio.value = String(base.hora_inicio ?? "").slice(0, 5);
  f.elements.duracion_min.value = String(base.duracion_min ?? 30);
  f.elements.obligatorio.checked = Boolean(base.obligatorio);
  f.elements.lugar.value = base.lugar ?? "";
  f.elements.enlace.value = base.enlace ?? "";
  f.elements.materia.value = base.materia ?? "";
  selectorTipo.poner(base.tipo);
  selectorAviso.poner(String(base.aviso_min ?? 0));
  diasBloque = [...(base.dias ?? [hoyDia])].map(Number);
  pintarDiasBloque();
  camposPorTipo(base.tipo);
  $("error-bloque").textContent = "";
  $("borrar-bloque").hidden = !bloque;
  abrirHoja();
}

async function guardarBloque(evento) {
  evento.preventDefault();
  const f = $("form-bloque");
  const error = $("error-bloque");
  const tipo = selectorTipo.valor ?? "otro";
  const fila = {
    titulo: f.elements.titulo.value.trim() || L.TIPOS[tipo].texto,
    tipo,
    dias: [...diasBloque].sort((a, b) => a - b),
    hora_inicio: f.elements.hora_inicio.value,
    duracion_min: Number(f.elements.duracion_min.value),
    obligatorio: f.elements.obligatorio.checked,
    aviso_min: Number(selectorAviso.valor ?? 0),
    lugar: CAMPOS_POR_TIPO.lugar.has(tipo) ? f.elements.lugar.value.trim().slice(0, 80) : null,
    enlace: CAMPOS_POR_TIPO.enlace.has(tipo) ? f.elements.enlace.value.trim() : null,
    materia: CAMPOS_POR_TIPO.materia.has(tipo) ? f.elements.materia.value.trim().slice(0, 60) : null,
    notas: editando?.notas ?? null,
    orden: editando?.orden ?? datos.bloques.length,
  };
  if (L.aMinutos(fila.hora_inicio) === null) return (error.textContent = "Elige a qué hora empieza.");
  if (!Number.isInteger(fila.duracion_min) || fila.duracion_min < 5 || fila.duracion_min > 600) return (error.textContent = "La duración va de 5 a 600 minutos.");
  if (fila.dias.length === 0) return (error.textContent = "Elige al menos un día.");
  if (fila.enlace && !L.enlaceSeguro(fila.enlace)) return (error.textContent = "El enlace debe empezar por https://");
  fila.titulo = fila.titulo.slice(0, 60);
  fila.enlace = fila.enlace || null;
  error.textContent = "";

  const boton = f.querySelector('[type="submit"]');
  boton.disabled = true;
  try {
    const guardado = await D.guardarBloque(fila, editando?.id);
    datos.bloques = editando ? datos.bloques.map((b) => (b.id === editando.id ? guardado : b)) : [...datos.bloques, guardado];
    hoja.cerrar();
    pintar();
    const choca = L.choques(datos.bloques).some((c) => c.a.id === guardado.id || c.b.id === guardado.id);
    avisar(choca ? "⚠️ Se cruza con otro" : "🗓️ Guardado");
  } catch (e) {
    pagina.manejarError(e);
  } finally {
    boton.disabled = false;
  }
}

async function borrarBloque() {
  if (!editando) return;
  const id = editando.id;
  try {
    await D.quitarBloque(id);
    datos.bloques = datos.bloques.filter((b) => b.id !== id);
    hoja.cerrar();
    pintar();
    avisar("🗑️ Quitado");
  } catch (e) {
    pagina.manejarError(e);
  }
}

// ── Hoja: tarea ──────────────────────────────────────────────────────────

let tareaEditada = null;
let selectorMateria = null;
let selectorCuando = null;

function materiasConocidas() {
  const desdeBloques = datos.bloques.map((b) => b.materia).filter(Boolean);
  const desdeTareas = datos.tareas.map((t) => t.materia).filter(Boolean);
  return [...new Set([...desdeBloques, ...desdeTareas])].slice(0, 6);
}

function abrirTarea(tarea = null) {
  tareaEditada = tarea;
  const f = $("form-tarea");
  mostrarFormulario("form-tarea", tarea ? "Tu tarea." : "Nueva tarea.");
  f.elements.titulo.value = tarea?.titulo ?? "";
  f.elements.primer_paso.value = tarea?.primer_paso ?? "";
  const materias = materiasConocidas();
  selectorMateria.opciones(materias.map((m) => ({ valor: m, texto: m })));
  const materia = tarea?.materia ?? "";
  selectorMateria.poner(materias.includes(materia) ? materia : null);
  f.elements.materia.value = materias.includes(materia) ? "" : materia;
  if (tarea?.fecha_limite) {
    selectorCuando.poner("fecha");
    f.elements.fecha_limite.value = L.isoBogota(Date.parse(tarea.fecha_limite)).slice(0, 16);
  } else {
    selectorCuando.poner(tarea ? "sin" : "manana");
    f.elements.fecha_limite.value = "";
  }
  f.elements.fecha_limite.hidden = selectorCuando.valor !== "fecha";
  $("error-tarea").textContent = "";
  $("tarea-empezar").hidden = !tarea || tarea.estado === "en_progreso";
  $("tarea-borrar").hidden = !tarea;
  abrirHoja();
  if (!tarea) window.setTimeout(() => f.elements.titulo.focus({ preventScroll: true }), 350);
}

async function guardarTarea(evento) {
  evento.preventDefault();
  const f = $("form-tarea");
  const error = $("error-tarea");
  const titulo = f.elements.titulo.value.trim();
  if (!titulo) return (error.textContent = "Escribe qué tienes que entregar.");
  let fechaLimite = null;
  const cuando = selectorCuando.valor;
  if (cuando === "fecha") {
    const valor = f.elements.fecha_limite.value;
    if (!valor) return (error.textContent = "Elige la fecha y hora.");
    fechaLimite = new Date(`${valor}:00-05:00`).toISOString();
  } else if (cuando !== "sin") fechaLimite = L.paraCuando(cuando, ahora());
  const fila = {
    titulo: titulo.slice(0, 120),
    materia: (f.elements.materia.value.trim() || selectorMateria.valor || "").slice(0, 60) || null,
    fecha_limite: fechaLimite,
    primer_paso: f.elements.primer_paso.value.trim().slice(0, 120) || null,
    prioridad: tareaEditada?.prioridad ?? 2,
  };
  error.textContent = "";
  const boton = f.querySelector('[type="submit"]');
  boton.disabled = true;
  try {
    const guardada = await D.guardarTarea(fila, tareaEditada?.id);
    datos.tareas = tareaEditada ? datos.tareas.map((t) => (t.id === tareaEditada.id ? guardada : t)) : [...datos.tareas, guardada];
    hoja.cerrar();
    pintar();
    avisar("📚 Guardada");
  } catch (e) {
    pagina.manejarError(e);
  } finally {
    boton.disabled = false;
  }
}

async function empezarTarea() {
  if (!tareaEditada) return;
  try {
    const guardada = await D.cambiarEstadoTarea(tareaEditada.id, "en_progreso");
    datos.tareas = datos.tareas.map((t) => (t.id === guardada.id ? guardada : t));
    hoja.cerrar();
    pintar();
    avisar("▶️ A darle");
  } catch (e) {
    pagina.manejarError(e);
  }
}

async function borrarTarea() {
  if (!tareaEditada) return;
  const id = tareaEditada.id;
  try {
    await D.borrarTarea(id);
    datos.tareas = datos.tareas.filter((t) => t.id !== id);
    hoja.cerrar();
    pintar();
    avisar("🗑️ Borrada");
  } catch (e) {
    pagina.manejarError(e);
  }
}

// ── Encuesta ─────────────────────────────────────────────────────────────

async function empezarEncuesta() {
  let guardadas = null;
  try {
    guardadas = (await leerAjustes(userId)).rutina?.encuesta ?? null;
  } catch {
    // Sin respuestas guardadas: empieza con las de siempre (6:00, caminar 45 min…).
  }
  abrirEncuesta({
    respuestas: guardadas,
    reemplaza: datos.bloques.length > 0,
    alCrear: async (filas, respuestas) => {
      const nuevas = await D.crearPlantilla(filas, datos.bloques.map((b) => b.id));
      datos.bloques = nuevas ?? [];
      guardarAjuste("rutina", { encuesta: respuestas, creada: new Date().toISOString() }).catch(() => {});
      diaElegido = null;
      firmas = {};
      primeraVez = true;
      pintar();
      avisar("🗓️ Rutina lista");
    },
  });
}

// ── Qué hace el iPhone ───────────────────────────────────────────────────

function pintarAtajos() {
  $("atajos-lista").replaceChildren(
    ...ATAJOS.map((atajo) => {
      const caja = clonar("plantilla-atajo");
      caja.querySelector(".atajo-emoji").textContent = atajo.emoji;
      caja.querySelector(".atajo-nombre").textContent = atajo.nombre;
      caja.querySelector(".atajo-para").textContent = atajo.para;
      caja.querySelector(".atajo-pasos").replaceChildren(
        ...atajo.pasos.map((p) => {
          const li = document.createElement("li");
          li.textContent = p;
          return li;
        }),
      );
      const auto = caja.querySelector(".atajo-auto");
      if (atajo.automatizacion) {
        caja.querySelector(".atajo-disparador").textContent = atajo.automatizacion.disparador;
        caja.querySelector(".atajo-auto-pasos").replaceChildren(
          ...atajo.automatizacion.pasos.map((p) => {
            const li = document.createElement("li");
            li.textContent = p;
            return li;
          }),
        );
      } else auto.hidden = true;
      caja.querySelector(".atajo-permisos").textContent = atajo.permisos.length ? `iOS te pedirá: ${atajo.permisos.join(" · ")}` : "";
      return caja;
    }),
  );
}

// ── Controles ────────────────────────────────────────────────────────────

function conectarControles() {
  document.querySelectorAll("[data-abrir-encuesta]").forEach((b) => b.addEventListener("click", empezarEncuesta));
  $("volver-hoy").addEventListener("click", () => {
    diaElegido = null;
    pintar();
  });

  // Tarjeta "Ahora".
  document.querySelectorAll("#ahora-botones [data-marcar]").forEach((boton) =>
    boton.addEventListener("click", () => {
      const t = ahora();
      const item = L.estadoDelDia(datos.bloques, datos.checks, t, { festivos: datos.festivos }).find((b) => b.id === $("ahora").dataset.bloque);
      if (item) marcarBloque(item, boton.dataset.marcar);
    }),
  );
  $("ahora-cambiar").addEventListener("click", () => {
    const t = ahora();
    const item = L.estadoDelDia(datos.bloques, datos.checks, t, { festivos: datos.festivos }).find((b) => b.id === $("ahora").dataset.bloque);
    if (item) abrirDetalle(item, diaLogico(t));
  });

  // Detalle de un bloque.
  document.querySelector('[data-vb="hecho"]').addEventListener("click", () => detalle && marcarBloque(detalle, "hecho"));
  document.querySelector('[data-vb="saltado"]').addEventListener("click", () => detalle && marcarBloque(detalle, "saltado"));
  document.querySelector('[data-vb="quitar"]').addEventListener("click", () => detalle && quitarMarca(detalle));
  document.querySelector('[data-vb="editar"]').addEventListener("click", () => {
    const original = detalle && datos.bloques.find((b) => b.id === detalle.id);
    if (original) abrirBloque(original);
  });

  // Editar bloque.
  selectorTipo = chips(document.querySelector('[data-chips="tipo"]'), (tipo) => {
    const titulo = $("form-bloque").elements.titulo;
    if (!titulo.value.trim() || Object.values(L.TIPOS).some((t) => t.texto === titulo.value.trim())) titulo.value = L.TIPOS[tipo].texto;
    camposPorTipo(tipo);
  });
  selectorTipo.opciones(Object.entries(L.TIPOS).map(([valor, t]) => ({ valor, texto: `${t.emoji} ${t.texto}` })));
  selectorAviso = chips(document.querySelector('[data-chips="aviso"]'));
  selectorAviso.opciones(AVISOS.map((m) => ({ valor: String(m), texto: m === 0 ? "A la hora" : `${m} min antes` })));
  const grupoDias = $("dias-bloque");
  for (const d of L.DIAS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dia-boton";
    b.dataset.dia = String(d.n);
    b.textContent = d.corto;
    b.setAttribute("aria-label", d.nombre);
    b.addEventListener("click", () => {
      diasBloque = diasBloque.includes(d.n) ? diasBloque.filter((x) => x !== d.n) : [...diasBloque, d.n];
      pintarDiasBloque();
    });
    grupoDias.append(b);
  }
  $("form-bloque").addEventListener("submit", guardarBloque);
  $("borrar-bloque").addEventListener("click", borrarBloque);
  $("nuevo-bloque").addEventListener("click", () => abrirBloque(null));

  // Tareas.
  selectorMateria = chips(document.querySelector('[data-chips="materia"]'), () => ($("form-tarea").elements.materia.value = ""));
  selectorCuando = chips(document.querySelector('[data-chips="cuando"]'), (v) => {
    const campo = $("form-tarea").elements.fecha_limite;
    campo.hidden = v !== "fecha";
    if (v === "fecha" && !campo.value) campo.value = `${L.sumarDias(diaLogico(ahora()), 1)}T23:59`;
  });
  selectorCuando.opciones([
    { valor: "hoy", texto: "Hoy" },
    { valor: "manana", texto: "Mañana" },
    { valor: "semana", texto: "Esta semana" },
    { valor: "fecha", texto: "Elegir fecha" },
    { valor: "sin", texto: "Sin fecha" },
  ]);
  $("form-tarea").elements.materia.addEventListener("input", () => selectorMateria.poner(null));
  $("nueva-tarea").addEventListener("click", () => abrirTarea(null));
  $("form-tarea").addEventListener("submit", guardarTarea);
  $("tarea-empezar").addEventListener("click", empezarTarea);
  $("tarea-borrar").addEventListener("click", borrarTarea);
}

// ── Arranque ─────────────────────────────────────────────────────────────

conectarControles();
pintarAtajos();
await cargar();

window.setInterval(tic, 1000);
window.setInterval(() => datos && pintar(), 30_000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Date.now() - ultimaCarga > 60_000) cargar();
});
