// Finanzas (finanzas.html): página en construcción. La llena el objetivo de .claude/objetivos/A-finanzas.md.

import { iniciarPagina } from "../piezas/pagina.js";

const pagina = await iniciarPagina({ alReintentar: () => location.reload() });
pagina.mostrar("contenido");
