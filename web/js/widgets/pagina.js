// Widgets (widgets.html): página en construcción. La llena el objetivo de .claude/objetivos/E-widgets.md.

import { iniciarPagina } from "../piezas/pagina.js";

const pagina = await iniciarPagina({ alReintentar: () => location.reload() });
pagina.mostrar("contenido");
