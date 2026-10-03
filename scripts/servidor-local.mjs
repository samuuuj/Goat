// Servidor de prueba en http://localhost:3000 con las mismas cabeceras de seguridad que Vercel (vercel.json).
// Alternativa a Live Server:  npm run local
// Solo entrega la carpeta web/ (nunca .env.local, docs/ ni .git) y solo escucha en este computador.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(RAIZ, "web");
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

function responder(res, estado, texto) {
  res.writeHead(estado, { ...CABECERAS, "Content-Type": "text/plain; charset=utf-8" });
  res.end(texto);
}

const servidor = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") return responder(res, 405, "Método no permitido");

  let ruta;
  try {
    ruta = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    return responder(res, 400, "Ruta inválida");
  }
  if (ruta === "/") ruta = "/index.html";

  // Nada de "..", archivos ocultos, barras invertidas ni unidades (C:): solo lo que está dentro de web/.
  const partes = ruta.split("/").filter(Boolean);
  if (partes.some((p) => p.startsWith(".") || /[\\:\0]/.test(p))) return responder(res, 404, "No encontrado");
  const archivo = normalize(join(WEB, ...partes));
  if (!archivo.startsWith(WEB + sep)) return responder(res, 404, "No encontrado");

  try {
    if (!(await stat(archivo)).isFile()) return responder(res, 404, "No encontrado");
    const contenido = await readFile(archivo);
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
