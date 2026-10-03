// Conectar (conectar.html): página en construcción. La llena el objetivo de .claude/objetivos/B-conectar.md.

import { iniciarPagina } from "../piezas/pagina.js";

const pagina = await iniciarPagina({ alReintentar: () => location.reload() });
pagina.mostrar("contenido");
