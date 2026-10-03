// Pantalla de entrada (login.html): correo, contraseña y "Mantener sesión iniciada".

import { configFaltante, elegirRecordar, quiereRecordar, sesionActual, supabase } from "./sesion.js";
import { ajustarAlAncho, reducirMovimiento } from "./ui.js";

const FRASES = ["Registra.", "Gana tu ocio.", "Cumple.", "Repite."];

const formulario = document.getElementById("formulario");
const campoCorreo = document.getElementById("correo");
const campoClave = document.getElementById("contrasena");
const botonVer = document.getElementById("ver-clave");
const interruptor = document.getElementById("recordar");
const detalleRecordar = document.getElementById("recordar-detalle");
const botonEntrar = document.getElementById("entrar");
const textoEntrar = document.getElementById("entrar-texto");
const error = document.getElementById("error");

// "GOAT." llena el ancho, sin pasar de un tercio del alto de la pantalla.
ajustarAlAncho(document.getElementById("marca"), () => Math.min(window.innerHeight * 0.34, 420));
iniciarRotador(document.getElementById("rotador"));

// ── Mostrar u ocultar la contraseña ──────────────────────────────────────

botonVer.addEventListener("click", () => {
  const ver = campoClave.type === "password";
  campoClave.type = ver ? "text" : "password";
  botonVer.setAttribute("aria-pressed", String(ver));
  botonVer.setAttribute("aria-label", ver ? "Ocultar contraseña" : "Mostrar contraseña");
});

// ── Mantener sesión iniciada ─────────────────────────────────────────────

let recordar = quiereRecordar();
pintarInterruptor();

interruptor.addEventListener("click", () => {
  recordar = !recordar;
  pintarInterruptor();
});

function pintarInterruptor() {
  interruptor.setAttribute("aria-checked", String(recordar));
  detalleRecordar.textContent = recordar
    ? "No te pedirá la clave en este dispositivo."
    : "Se cierra al cerrar la pestaña o la app.";
}

// ── Entrar ───────────────────────────────────────────────────────────────
// El botón llega desactivado en el HTML: así nunca se envía el formulario antes de que este código esté listo.

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (botonEntrar.disabled) return;

  const correo = campoCorreo.value.trim().toLowerCase().slice(0, 254);
  const contrasena = campoClave.value;
  if (!correo || !contrasena) return mostrarError("Escribe tu correo y tu contraseña.");
  if (contrasena.length > 200) return mostrarError("Correo o contraseña incorrectos.");

  ponerEnviando(true);
  elegirRecordar(recordar);
  try {
    const { error: fallo } = await supabase.auth.signInWithPassword({ email: correo, password: contrasena });
    if (!fallo) {
      location.replace("index.html");
      return;
    }
    mostrarError(mensajeDeError(fallo));
    if (fallo.status === 400) {
      campoClave.value = "";
      campoClave.focus();
    }
  } catch {
    mostrarError("Sin conexión. Intenta otra vez.");
  }
  ponerEnviando(false);
});

if (configFaltante) {
  mostrarError("Falta el archivo js/config.js (mira docs/SETUP.md).");
} else if (await sesionActual()) {
  // Ya habías entrado en este dispositivo.
  location.replace("index.html");
} else {
  botonEntrar.disabled = false;
}

/** Mismo mensaje si el correo no existe o la clave está mal: así no se revela qué cuentas existen. */
function mensajeDeError(fallo) {
  if (fallo.status === 429) return "Demasiados intentos. Espera unos minutos.";
  if (fallo.code === "email_not_confirmed") return "Confirma tu correo antes de entrar.";
  if (fallo.name === "AuthRetryableFetchError" || !navigator.onLine) return "Sin conexión. Intenta otra vez.";
  return "Correo o contraseña incorrectos.";
}

function mostrarError(texto) {
  error.textContent = texto;
  error.hidden = false;
  error.classList.remove("sacudir");
  void error.offsetWidth; // Reinicia la sacudida en cada intento.
  error.classList.add("sacudir");
}

function ponerEnviando(enviando) {
  botonEntrar.disabled = enviando;
  botonEntrar.classList.toggle("enviando", enviando);
  botonEntrar.setAttribute("aria-busy", String(enviando));
  textoEntrar.textContent = enviando ? "Entrando…" : "Entrar";
}

/** Frase que cambia sola bajo la marca cada 2,2 s. */
function iniciarRotador(rotador) {
  let indice = 0;
  window.setInterval(() => {
    indice = (indice + 1) % FRASES.length;
    const nueva = document.createElement("span");
    nueva.textContent = FRASES[indice];
    if (reducirMovimiento()) {
      rotador.replaceChildren(nueva);
      return;
    }
    const vieja = rotador.lastElementChild;
    vieja.className = "sale";
    nueva.className = "entra";
    rotador.append(nueva);
    window.setTimeout(() => vieja.remove(), 600);
  }, 2200);
}
