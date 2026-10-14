// Pinta la guía de un atajo (web/js/conectar/guias.js) para leerla en el iPhone mientras lo armas:
// qué hace y cómo se usa, "Así debe quedar" (el mapa de bloques), y cada paso en piezas cortas:
// título, qué tocar, qué escribir (con botón Copiar) y una nota. Todo con textContent (CSP, docs/SEGURIDAD.md).

const crear = (etiqueta, clase, texto) => {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto != null) el.textContent = texto;
  return el;
};

/** Un texto para copiar: «/api/v1/asistente» [Copiar]. */
function copiable(texto) {
  const fila = crear("div", "ga-copiable");
  const valor = crear("code", "ga-copiable-valor", texto.trim() || texto);
  if (texto !== texto.trim()) valor.dataset.espacio = "con espacio al final";
  const boton = crear("button", "ga-copiar", "Copiar");
  boton.type = "button";
  boton.dataset.copiarTexto = texto;
  boton.setAttribute("aria-label", `Copiar ${texto.trim()}`);
  fila.append(valor, boton);
  return fila;
}

/** Un paso: número, título, líneas de "qué tocar", textos para copiar y nota. */
function paso(p, numero) {
  const li = crear("li", "ga-paso");
  const cabeza = crear("div", "ga-paso-cabeza");
  cabeza.append(crear("span", "ga-numero cifras", String(numero)), crear("h3", "ga-paso-titulo", p.titulo));
  li.append(cabeza);
  if (p.hacer?.length) {
    const lista = crear("ul", "ga-hacer");
    for (const linea of p.hacer) lista.append(crear("li", null, linea));
    li.append(lista);
  }
  if (p.escribir?.length) {
    const caja = crear("div", "ga-escribir");
    caja.append(crear("p", "ga-escribir-titulo", "Escribe o copia"));
    for (const t of p.escribir) caja.append(copiable(t));
    li.append(caja);
  }
  if (p.nota) li.append(crear("p", "ga-nota", p.nota));
  return li;
}

/** Lista de pasos (también sirve suelta, para «⚙️ Goat» y «🧪 Probar» dentro del asistente). */
export function pintarPasos(lista, pasos = []) {
  lista.classList.add("ga-pasos");
  lista.replaceChildren(...pasos.map((p, i) => (typeof p === "string" ? paso({ titulo: p }, i + 1) : paso(p, i + 1))));
  return lista;
}

function bloque(titulo, ...hijos) {
  const caja = crear("section", "ga-bloque");
  caja.append(crear("p", "etiqueta ga-bloque-titulo", titulo), ...hijos);
  return caja;
}

/** La guía completa de un atajo dentro de `caja`. `conPara: false` si quien la muestra ya dice qué hace. */
export function pintarGuia(caja, atajo, { conPara = true } = {}) {
  const partes = [];

  const resumen = crear("dl", "ga-resumen");
  const fila = (dt, dd) => dd && resumen.append(crear("dt", null, dt), crear("dd", null, dd));
  if (conPara) fila("Qué hace", atajo.para);
  fila("Cómo lo usas", atajo.uso);
  // Solo los atajos (con id) dicen si corren solos; las guías sueltas (candado, Safari) no.
  if (atajo.id) fila("¿Corre solo?", atajo.solo ?? "No: lo tocas tú.");
  fila("Toma", atajo.tiempo);
  if (resumen.childElementCount) partes.push(resumen);

  if (atajo.requisitos?.length) {
    const lista = crear("ul", "ga-puntos");
    for (const r of atajo.requisitos) lista.append(crear("li", null, r));
    partes.push(bloque("Antes", lista));
  }

  if (atajo.mapa?.length) {
    const mapa = crear("ol", "ga-mapa");
    for (const linea of atajo.mapa) {
      const li = crear("li", linea.startsWith("  ") ? "dentro" : null, linea.trim());
      mapa.append(li);
    }
    partes.push(bloque("Así debe quedar", mapa));
  }

  if (atajo.pasos?.length) partes.push(bloque("Paso a paso", pintarPasos(crear("ol"), atajo.pasos)));

  (atajo.automatizaciones ?? []).forEach((auto, i, todas) => {
    const titulo = todas.length > 1 ? `Automatización ${i + 1} de ${todas.length}` : "Automatización";
    partes.push(bloque(titulo, crear("p", "ga-disparador", auto.disparador), pintarPasos(crear("ol"), auto.pasos)));
  });

  caja.replaceChildren(...partes);
  activarCopiar(caja);
  return caja;
}

/** Botones "Copiar" (una sola escucha por caja). */
export function activarCopiar(caja) {
  if (caja.dataset.copiarListo) return;
  caja.dataset.copiarListo = "1";
  caja.addEventListener("click", async (evento) => {
    const boton = evento.target.closest("[data-copiar-texto]");
    if (!boton) return;
    const ok = await copiarTexto(boton.dataset.copiarTexto);
    boton.textContent = ok ? "Copiado ✓" : "Mantén pulsado";
    boton.classList.toggle("copiado", ok);
    setTimeout(() => {
      boton.textContent = "Copiar";
      boton.classList.remove("copiado");
    }, 1600);
  });
}

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
