# Goat · sistema personal

Asistente diario de Samuel: registrar en segundos, ganar el ocio y cumplir metas.
HTML + CSS + JavaScript (PWA) + Supabase (Postgres + Auth) + Atajos de iOS.

## Abrir en tu computador
1. Copia `.env.example` como `.env.local` y llena `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` (solo la clave publicable).
2. `npm run config` → crea `js/config.js` (no se sube a GitHub).
3. Crea las tablas: pega todo `supabase/schema.sql` en Supabase › SQL Editor › Run (se puede repetir sin romper nada).
4. En VS Code, clic derecho en `index.html` → **Open with Live Server** (o `npm run local` → http://localhost:3000) → entra con tu correo y contraseña.

## Qué hay en cada carpeta
- `index.html`, `login.html`: las dos páginas.
- `css/`: los estilos (`base.css` compartido, uno por página).
- `js/`: el JavaScript (sesión, datos, cálculo del día, pantallas).
- `supabase/schema.sql`: toda la base de datos.

La documentación (`docs/`) es personal: vive solo en el computador de Samuel y no se sube a este repositorio.
El contexto para las sesiones de Claude está en [CLAUDE.md](CLAUDE.md).
