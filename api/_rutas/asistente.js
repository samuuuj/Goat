// Ruta del atajo "🐐 Goat" (D-063): POST /api/v1/asistente { flujo?, estado?, respuesta? }.
// Devuelve la siguiente pregunta o el final; el motor y los flujos están en api/_lib/asistente.js.

import { responder } from "../_lib/asistente.js";

export default {
  "POST asistente": async (ctx) => responder(ctx, ctx.cuerpo),
};
