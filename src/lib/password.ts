import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Hash de contraseñas con `scrypt`.
 *
 * Es de `node:crypto`, así que no agrega una dependencia. Tiene costo
 * configurable —el punto de una función de derivación es ser lenta a
 * propósito— y salt aleatorio por usuario, que es lo que impide que dos
 * personas con la misma contraseña tengan el mismo hash y que una tabla
 * precomputada sirva de algo.
 *
 * ESTE MÓDULO ES DE SERVIDOR. El hash nunca se selecciona hacia un componente
 * cliente ni viaja en una prop; `usuarioActual()` de `auth.ts` devuelve un
 * objeto que no lo incluye.
 */

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

const LARGO_SALT = 16;
const LARGO_CLAVE = 64;

/**
 * El mínimo de caracteres. UN SOLO criterio, en UN SOLO lugar: lo usan el seed,
 * la creación de cuentas desde `/usuarios` y el cambio de la propia contraseña.
 * Si el número vive en tres archivos, en seis meses son tres números.
 */
export const LARGO_MINIMO_PASSWORD = 12;

/** Devuelve el problema en castellano, o `null` si la contraseña pasa. */
export function validarPassword(password: string): string | null {
  if (password.length < LARGO_MINIMO_PASSWORD) {
    return `La contraseña tiene que tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`;
  }
  return null;
}

/** `scrypt$<salt en hex>$<derivada en hex>`. El salt viaja con el hash. */
export async function hashearPassword(password: string): Promise<string> {
  const salt = randomBytes(LARGO_SALT);
  const derivada = await scryptAsync(password, salt, LARGO_CLAVE);
  return `scrypt$${salt.toString("hex")}$${derivada.toString("hex")}`;
}

/**
 * Comparación en TIEMPO CONSTANTE con `timingSafeEqual`.
 *
 * Un `===` sobre el hash corta en el primer byte distinto, y esa diferencia de
 * microsegundos, medida muchas veces, deja adivinar el hash byte por byte.
 */
export async function verificarPassword(
  password: string,
  guardado: string
): Promise<boolean> {
  const partes = guardado.split("$");
  if (partes.length !== 3 || partes[0] !== "scrypt") return false;

  const salt = Buffer.from(partes[1], "hex");
  const esperado = Buffer.from(partes[2], "hex");
  if (salt.length !== LARGO_SALT || esperado.length !== LARGO_CLAVE) return false;

  const derivada = await scryptAsync(password, salt, LARGO_CLAVE);
  // timingSafeEqual tira si los largos difieren; ya están comprobados arriba.
  return timingSafeEqual(derivada, esperado);
}
