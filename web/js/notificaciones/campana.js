// Campana de notificaciones de Hoy (#campana y #campana-contador en index.html).
// - Lee tus notificaciones y pone el contador (no leídas y no descartadas; desaparece en 0, rebota al cambiar).
// - Cada vez que Hoy pinta, emite "goat:resumen": aquí corren las reglas (reglas.js) y se guardan sin duplicar.
// - Al tocarla abre el centro de notificaciones (panel.js), que se arma por código y se monta en <body>.
// Si la tabla aún no existe o algo falla, la campana se queda quieta: nunca rompe la pantalla de inicio.

import { cargarNotificaciones, descartar, EVENTO_NUEVAS, guardarNotificacion, marcarLeidas } from "./datos.js";
import { generarNotificaciones, pendientesResueltas, sinDuplicar } from "./reglas.js";
import { contarNoLeidas, textoContador } from "./logica.js";

export function iniciarCampana(boton, contador) {
  if (!boton) return;

  let lista = []; // Todas las de los últimos 30 días (también leídas y descartadas).
  let disponible = true; // false si la tabla no existe todavía.
  let panel = null;
  let cola = Promise.resolve(); // Cambios en orden, uno detrás de otro.
  let ultimoResumen = null;

  /** Encola una tarea para que dos cambios no se pisen (p. ej. reglas mientras borras). */
  const enOrden = (tarea) => {
    cola = cola.then(tarea).catch((error) => console.warn("[notificaciones]", error?.message ?? error));
    return cola;
  };

  function pintarContador() {
    const n = contarNoLeidas(lista);
    const texto = textoContador(n);
    boton.setAttribute("aria-label", n > 0 ? `Notificaciones, ${n} sin leer` : "Notificaciones");
    if (!contador || contador.textContent === texto) return;
    contador.textContent = texto;
    contador.classList.remove("contador-rebota");
    void contador.offsetWidth; // Reinicia la animación.
    if (texto) contador.classList.add("contador-rebota");
  }

  async function recargar() {
    if (!disponible) return;
    try {
      lista = await cargarNotificaciones();
    } catch (error) {
      disponible = false; // Sin tabla (falta correr schema.sql) o sin conexión: la campana espera a la próxima carga.
      console.warn("[notificaciones] no se pudieron leer:", error?.message ?? error);
      return;
    }
    pintarContador();
    panel?.actualizar(lista);
  }

  /** Reglas del día: crea lo nuevo y da por leídos los pendientes que ya registraste. */
  async function aplicarReglas(resumen) {
    if (!disponible || !resumen) return;
    const ahora = new Date();
    const nuevas = sinDuplicar(generarNotificaciones(resumen, ahora), lista);
    const resueltas = pendientesResueltas(lista, resumen, ahora);
    if (nuevas.length === 0 && resueltas.length === 0) return;
    for (const aviso of nuevas) await guardarNotificacion(aviso);
    if (resueltas.length) await marcarLeidas(resueltas, ahora);
    await recargar();
  }

  // El panel se arma la primera vez que lo abres (no pesa en la carga de Hoy).
  async function abrirPanel() {
    if (!panel) {
      const { crearPanel } = await import("./panel.js");
      panel = crearPanel({
        boton,
        alTocar: (ids) => enOrden(async () => {
          await marcarLeidas(ids);
          marcarEnLista(ids, "leida_en");
        }),
        alBorrar: (ids) => enOrden(async () => {
          marcarEnLista(ids, "descartada_en");
          await descartar(ids);
        }),
        alCerrar: (vistas) => enOrden(async () => {
          // Lo que ya viste deja de contar en la campana (como al abrir el centro de notificaciones del iPhone).
          const sinLeer = vistas.filter((id) => lista.some((n) => n.id === id && !n.leida_en));
          if (sinLeer.length === 0) return;
          marcarEnLista(sinLeer, "leida_en");
          await marcarLeidas(sinLeer);
        }),
      });
    }
    panel.abrir(lista);
    enOrden(recargar); // Trae lo que hayan dejado los atajos mientras tanto.
  }

  /** Cambia la copia local al instante (el contador responde sin esperar a la base de datos). */
  function marcarEnLista(ids, campo) {
    const cuando = new Date().toISOString();
    const set = new Set(ids);
    lista = lista.map((n) => (set.has(n.id) && !n[campo] ? { ...n, [campo]: cuando } : n));
    pintarContador();
  }

  boton.addEventListener("click", () => {
    abrirPanel().catch((error) => console.error("[notificaciones] no se pudo abrir el panel", error));
  });

  // Hoy emite el resumen cada vez que pinta (al cargar, al registrar y cuando cambia la hora).
  document.addEventListener("goat:resumen", (evento) => {
    ultimoResumen = evento.detail;
    enOrden(() => aplicarReglas(ultimoResumen));
  });

  // Otro módulo avisó con notificarLocal().
  document.addEventListener(EVENTO_NUEVAS, () => enOrden(recargar));

  // Al volver a la app, trae lo que hayan dejado los atajos o la API.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    disponible = true;
    enOrden(recargar);
  });

  enOrden(recargar);
}
