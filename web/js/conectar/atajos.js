// Los atajos base («⚙️ Goat» y «🧪 Goat · Probar»). Todas las guías viven en web/js/conectar/guias.js (D-063).

import { ATAJOS as GUIAS } from "./guias.js";

export const ATAJOS = GUIAS.filter((a) => a.grupo === "base");
