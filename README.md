# Goat · sistema personal

Asistente diario de Samuel: registrar en segundos, ganar el ocio y cumplir metas.
HTML + CSS + JavaScript (PWA) + Supabase (Postgres + Auth) + Atajos de iOS.

## Abrir en tu computador
1. Crea las tablas: pega todo `supabase/schema.sql` en Supabase › SQL Editor › Run (se puede repetir sin romper nada).
2. En VS Code, **Go Live** (Live Server ya está configurado para mostrar `web/`) o `npm run local` → http://localhost:3000. Entra con tu correo y contraseña.
3. Para la API de los Atajos y widgets (`/api/v1/...`), Vercel necesita la variable `SUPABASE_SECRET_KEY` (la pones tú en Vercel; nunca en un archivo).

Pruebas: `npm test` (base de datos en PGlite y API con un Supabase simulado; nunca toca tus datos). Simulador con datos de prueba: `npm run local` y abre http://localhost:3000/_pruebas/index.html.

`web/js/config.js` trae la URL de Supabase y la clave **publicable**, que es pública por diseño: los datos los protegen las reglas RLS de la base.
Para usar otro proyecto de Supabase: copia `.env.example` como `.env.local`, llénalo y corre `npm run config`. La clave secreta nunca va aquí.

## Publicar
Cada push a `main` lo publica Vercel (sirve `web/` con las cabeceras de `vercel.json`). Al publicar, `scripts/crear-config.mjs` revisa `web/js/config.js` y frena si encuentra una clave secreta.

## Carpetas
```
web/                 la página (lo único que se publica)
  index.html         inicio (Hoy)
  login.html         entrada
  finanzas.html rutina.html ejercicio.html sueno.html desbloqueo.html widgets.html conectar.html
  css/               estilos: base.css y comun.css (compartidos), uno por página
  js/paginas/        lo que carga Hoy y el login
  js/piezas/         hojas de registro, hoja inferior, chips y arranque de página
  js/logica/         reglas del día: puntos, racha, pendientes, formatos, cruces entre módulos
  js/<modulo>/       cada sección: logica.js (reglas), pagina.js, datos.js, atajos.js (guías), mini.js
  js/supabase/       sesión y base de datos
  js/vendor/         librería de Supabase
  scriptable/goat.js widget para la app Scriptable del iPhone
  img/ fuentes/      íconos y letras
api/v1.js            la API de Atajos y widgets (una sola función de Vercel)
  _lib/ _rutas/      piezas comunes y rutas de cada módulo
pruebas/             npm test y el simulador del navegador
supabase/schema.sql  toda la base de datos (crea tablas y reglas; se puede repetir)
supabase/borrar-datos.sql  borra todos los registros y deja la app en cero (no se puede deshacer)
scripts/             escribir y revisar web/js/config.js, servidor de prueba
vercel.json          seguridad y publicación en Vercel
```

La documentación (`docs/`) es personal: vive solo en el computador de Samuel y no se sube a este repositorio.
El contexto para las sesiones de Claude está en [CLAUDE.md](CLAUDE.md).
