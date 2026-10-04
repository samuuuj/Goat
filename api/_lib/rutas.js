// Todas las rutas de /api/v1. Cada módulo llena solo su archivo en api/_rutas/.

import { unirRutas } from "./enrutador.js";
import central from "../_rutas/central.js";
import finanzas from "../_rutas/finanzas.js";
import sueno from "../_rutas/sueno.js";
import desbloqueo from "../_rutas/desbloqueo.js";
import rutina from "../_rutas/rutina.js";
import ejercicio from "../_rutas/ejercicio.js";
import notificaciones from "../_rutas/notificaciones.js";
import widget from "../_rutas/widget.js";
import conectar from "../_rutas/conectar.js";

export const RUTAS = unirRutas(central, finanzas, sueno, desbloqueo, rutina, ejercicio, notificaciones, widget, conectar);
