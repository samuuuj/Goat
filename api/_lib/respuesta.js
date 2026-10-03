// Formato único de respuesta de /api/v1 (D-052). `mensaje` se muestra tal cual en el iPhone:
// emoji + pocas palabras, nunca montos (D-020).

/** Éxito: { ok: true, mensaje, datos }. */
export function ok(mensaje, datos = {}, estado = 200) {
  return { estado, cuerpo: { ok: true, mensaje, datos } };
}

/** Error: { ok: false, mensaje, codigo }. */
export function error(codigo, mensaje, estado = 400) {
  return { estado, cuerpo: { ok: false, mensaje, codigo } };
}

/** Error que un handler puede lanzar para cortar y responder (lo atrapa el enrutador). */
export class ErrorApi extends Error {
  constructor(codigo, mensaje, estado = 400) {
    super(mensaje);
    this.codigo = codigo;
    this.estado = estado;
  }
}
