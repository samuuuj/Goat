// Servidor de prueba en http://localhost:3000 con las mismas cabeceras de seguridad que Vercel (vercel.json).
// Alternativa a Live Server:  npm run local
// Solo entrega la carpeta web/ (nunca .env.local, docs/ ni .git) y solo escucha en este computador.
// También atiende /api/v1/* con la misma función que Vercel (sin SUPABASE_SECRET_KEY en el entorno responde 503).

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { atender } from "../api/_lib/enrutador.js";
import { RUTAS } from "../api/_lib/rutas.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(RAIZ, "web");
// Simulador con datos de prueba: http://localhost:3000/_pruebas/index.html (ver pruebas/navegador/simulador.js).
const PRUEBAS = join(RAIZ, "pruebas", "navegador");
const PUERTO = Number(process.env.PORT) || 3000;

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

// Las cabeceras de vercel.json, menos las que solo tienen sentido con HTTPS.
const vercel = JSON.parse(await readFile(join(RAIZ, "vercel.json"), "utf8"));
const CABECERAS = Object.fromEntries(vercel.headers.find((h) => h.source === "/(.*)").headers.map((h) => [h.key, h.value]));
delete CABECERAS["Strict-Transport-Security"];
CABECERAS["Content-Security-Policy"] = CABECERAS["Content-Security-Policy"].replace(/;\s*upgrade-insecure-requests/, "");

/** /api/v1/<ruta>: lee el cuerpo JSON y responde como la función de Vercel (api/v1.js). */
async function responderApi(req, res, url) {
  let texto = "";
  for await (const parte of req) {
    texto += parte;
    if (texto.length > 100_000) return responder(res, 413, "Demasiado grande");
  }
  let cuerpo = {};
  try {
    cuerpo = texto ? JSON.parse(texto) : {};
  } catch {
    cuerpo = {};
  }
  const query = Object.fromEntries(url.searchParams);
  const respuesta = await atender(
    { metodo: req.method, ruta: url.pathname.replace(/^\/api\/v1\/?/, ""), query, cuerpo, encabezados: req.headers },
    { rutas: RUTAS, entorno: process.env },
  );
  res.writeHead(respuesta.estado, { ...CABECERAS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(respuesta.cuerpo));
}

function responder(res, estado, texto) {
  res.writeHead(estado, { ...CABECERAS, "Content-Type": "text/plain; charset=utf-8" });
  res.end(texto);
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/v1")) return responderApi(req, res, url);
  if (req.method !== "GET" && req.method !== "HEAD") return responder(res, 405, "Método no permitido");

  let ruta;
  try {
    ruta = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    return responder(res, 400, "Ruta inválida");
  }
  if (ruta === "/") ruta = "/index.html";

  // Nada de "..", archivos ocultos, barras invertidas ni unidades (C:): solo lo que está dentro de web/.
  let partes = ruta.split("/").filter(Boolean);
  if (partes.some((p) => p.startsWith(".") || /[\\:\0]/.test(p))) return responder(res, 404, "No encontrado");

  // /_pruebas/…: las mismas páginas, pero con el simulador inyectado antes de sus scripts.
  let simular = false;
  let raiz = WEB;
  if (partes[0] === "_pruebas") {
    partes = partes.slice(1);
    if (partes.length === 0) partes = ["index.html"];
    if (partes.length === 1 && /^(simulador|datos(-[a-z]+)?)\.js$/.test(partes[0])) raiz = PRUEBAS;
    else simular = extname(partes.at(-1)) === ".html";
  }
  const archivo = normalize(join(raiz, ...partes));
  if (!archivo.startsWith(raiz + sep)) return responder(res, 404, "No encontrado");

  try {
    if (!(await stat(archivo)).isFile()) return responder(res, 404, "No encontrado");
    let contenido = await readFile(archivo);
    if (simular) {
      const html = contenido.toString("utf8");
      const donde = html.indexOf("<script");
      const etiqueta = `<script type="module" src="simulador.js"></script>\n    `;
      contenido = Buffer.from(donde === -1 ? html : html.slice(0, donde) + etiqueta + html.slice(donde), "utf8");
    }
    res.writeHead(200, {
      ...CABECERAS,
      "Content-Type": TIPOS[extname(archivo)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(req.method === "HEAD" ? undefined : contenido);
  } catch {
    responder(res, 404, "No encontrado");
  }
});

servidor.listen(PUERTO, "127.0.0.1", () => {
  console.log(`Goat en http://localhost:${PUERTO}  (Ctrl+C para detener)`);
});
