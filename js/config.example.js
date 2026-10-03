// Plantilla de js/config.js (ese archivo NO se sube a GitHub: está en .gitignore).
// 1. Copia este archivo como js/config.js
// 2. Pon tus datos de Supabase › Project Settings › API Keys.
// Solo la clave "publishable" (empieza por sb_publishable_). NUNCA la "secret" ni la "service_role".
// En Vercel no hace falta: scripts/construir.mjs crea js/config.js con las variables de entorno.

export const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_...";
