// Ejercicio (ejercicio.html): página en construcción. La llena el objetivo de .claude/objetivos/H-ejercicio.md.

import { iniciarPagina } from "../piezas/pagina.js";

const pagina = await iniciarPagina({ alReintentar: () => location.reload() });
pagina.mostrar("contenido");
