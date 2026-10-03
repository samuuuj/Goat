// ¿Quién llama? Dos formas (D-052):
//  - Atajos y Scriptable: "Authorization: Bearer <token>". En api_tokens solo está el hash SHA-256 del token.
//  - La web (con sesión): "Authorization: Bearer <JWT de Supabase>", verificado con /auth/v1/user.

import { createHash, randomBytes } from "node:crypto";
import { administrador } from "./supabase.js";

const FORMATO_TOKEN = /^[A-Za-z0-9_-]{32,64}$/;
const FORMATO_JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export const hashToken = (token) => createHash("sha256").update(token, "utf8").digest("hex");

/** Token nuevo: 32 bytes aleatorios en base64url (43 caracteres). */
export const tokenNuevo = () => randomBytes(32).toString("base64url");

/** Lo que viene después de "Bearer " (o null). */
export function leerBearer(encabezados = {}) {
  const valor = encabezados.authorization ?? encabezados.Authorization ?? "";
  const encontrado = /^Bearer\s+(\S+)$/i.exec(String(valor).trim());
  return encontrado ? encontrado[1] : null;
}

export const pareceJwt = (texto) => FORMATO_JWT.test(texto ?? "");

/**
 * Token de atajo → { id: userId, tokenId } o null si no existe o está revocado.
 * Anota `ultimo_uso` como máximo una vez por minuto (el asistente Conectar lo usa para "Probar conexión").
 */
export async function usuarioDeToken(config, token, { ahora = new Date(), fetch: f = fetch } = {}) {
  if (!FORMATO_TOKEN.test(token ?? "")) return null;
  const admin = administrador(config, { fetch: f });
  const fila = await admin.buscarToken(hashToken(token));
  if (!fila || fila.revocado) return null;
  const ultimo = fila.ultimo_uso ? Date.parse(fila.ultimo_uso) : 0;
  if (ahora.getTime() - ultimo > 60_000) {
    await admin.marcarUso(fila.id, ahora).catch(() => {});
  }
  return { id: fila.user_id, tokenId: fila.id };
}

/** JWT de la sesión web → { id: userId } o null. */
export async function usuarioDeSesion(config, jwt, { fetch: f = fetch } = {}) {
  if (!pareceJwt(jwt)) return null;
  const respuesta = await f(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.publicable, Authorization: `Bearer ${jwt}` },
  });
  if (!respuesta.ok) return null;
  const usuario = await respuesta.json().catch(() => null);
  return usuario?.id ? { id: usuario.id } : null;
}
