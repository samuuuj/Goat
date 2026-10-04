// Ejemplo de encuesta de rutina para las pruebas (pruebas/rutina-*.test.mjs).

import { ENCUESTA_BASE, generarPlantilla } from "../../web/js/rutina/logica.js";

/** Lo que pidió Samuel: 6:00 → caminar 45 → desayuno → trabajo 50/10 → almuerzo → ejercicio → cena → caminar → estudiar. */
export const ENCUESTA_SAMUEL = {
  ...ENCUESTA_BASE,
  despertar: { habil: "06:00", finDeSemana: "07:00" },
  clasesPresenciales: [{ materia: "Cálculo", dias: [2, 3], inicio: "09:00", fin: "12:00", lugar: "Bloque 5" }],
  clasesVirtuales: [{ materia: "Inglés", dias: [1, 4], inicio: "14:00", fin: "16:00", enlace: "https://meet.google.com/abc-defg-hij" }],
  trabajosUni: [{ dias: [2, 5], inicio: "14:00", fin: "16:00" }],
};

/** La plantilla con ids, como vendría de la base de datos. */
export function plantillaSamuel(usuario = null) {
  return generarPlantilla(ENCUESTA_SAMUEL).map((b, i) => ({
    ...b,
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    activo: true,
    ...(usuario ? { user_id: usuario } : {}),
  }));
}
