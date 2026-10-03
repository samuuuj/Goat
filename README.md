# Goat · sistema personal

Asistente diario de Samuel: registrar en segundos, ganar el ocio y cumplir metas.
HTML + CSS + JavaScript (PWA) + Supabase (Postgres + Auth) + Atajos de iOS.

## Abrir en tu computador
1. Copia `.env.example` como `.env.local` y llena `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` (solo la clave publicable).
2. `npm run config` → crea `web/js/config.js` (no se sube a GitHub).
3. Crea las tablas: pega todo `supabase/schema.sql` en Supabase › SQL Editor › Run (se puede repetir sin romper nada).
4. En VS Code, **Go Live** (Live Server ya está configurado para mostrar `web/`) o `npm run local` → http://localhost:3000. Entra con tu correo y contraseña.

## Carpetas
```
web/                 la página (lo único que se publica)
  index.html         inicio
  login.html         entrada
  css/               estilos: base.css (compartido), hoy.css, login.css
  js/paginas/        lo que carga cada página (hoy.js, login.js)
  js/piezas/         hojas de registro y piezas de pantalla
  js/logica/         reglas del día: puntos, racha, pendientes, formatos
  js/supabase/       sesión y base de datos
  js/vendor/         librería de Supabase
  img/ fuentes/      íconos y letras
supabase/schema.sql  toda la base de datos
scripts/             crear web/js/config.js y servidor de prueba
vercel.json          seguridad y publicación en Vercel
```

La documentación (`docs/`) es personal: vive solo en el computador de Samuel y no se sube a este repositorio.
El contexto para las sesiones de Claude está en [CLAUDE.md](CLAUDE.md).
