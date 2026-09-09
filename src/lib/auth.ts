import "server-only";

import { cookies } from "next/headers";

import type { RolUsuario } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { COOKIE_SESION, leerSesion } from "@/lib/sesion";

/**
 * La capa que decide quién es y qué puede.
 *
 * TODO permiso se comprueba acá, del lado del servidor. Esconder un botón no es
 * un permiso: una server action se puede invocar por POST directo, y en este
 * proyecto ya se hizo exactamente eso contra producción para probar las
 * validaciones del módulo 1. El proxy filtra rutas; esto decide.
 */

export type UsuarioSesion = {
  id: number;
  usuario: string;
  nombre: string;
  rol: RolUsuario;
  entidadId: number | null;
};

/**
 * Quién está pidiendo, leído de la BASE y no de la cookie.
 *
 * La cookie solo afirma el id. El rol y el `activo` salen de la base en cada
 * llamada: una cookie de 30 días seguiría diciendo el rol viejo si alguien lo
 * cambió ayer, y una cuenta desactivada tiene que quedar afuera hoy, no dentro
 * de un mes.
 *
 * Nunca selecciona `hashPassword`.
 */
export async function usuarioActual(): Promise<UsuarioSesion | null> {
  const cookie = (await cookies()).get(COOKIE_SESION)?.value;
  const sesion = await leerSesion(cookie);
  if (!sesion) return null;

  const u = await prisma.usuario.findUnique({
    where: { id: sesion.uid },
    select: {
      id: true,
      usuario: true,
      nombre: true,
      rol: true,
      activo: true,
      entidadId: true,
      credencialesDesde: true,
    },
  });
  if (!u || !u.activo) return null;

  // La sesión emitida ANTES del último cambio de contraseña queda afuera. Sin
  // esto, cambiar la contraseña no echaba a nadie: la cookie dura 30 días y
  // solo afirma el id, así que la sesión abierta en otro dispositivo seguía
  // viva un mes más — justo lo que uno quiere cortar cuando sospecha algo.
  //
  // Los dos lados se comparan en SEGUNDOS ENTEROS: `iat` ya viene floorado y
  // `credencialesDesde` tiene milisegundos. Sin el floor, la cookie emitida en
  // el mismo segundo del cambio se ve hasta 999 ms más vieja que el corte, y
  // echaría a la persona del dispositivo donde acaba de cambiar la contraseña.
  const corte = Math.floor(u.credencialesDesde.getTime() / 1000);
  if (sesion.iat < corte) return null;

  const { activo: _activo, credencialesDesde: _desde, ...limpio } = u;
  return limpio;
}

/** Error de permisos. Lo atrapa cada server action y lo devuelve como mensaje. */
export class SinPermiso extends Error {}

/**
 * Exige sesión y, si se le pasan roles, que el rol esté entre ellos.
 *
 * Tira `SinPermiso` en vez de devolver null para que olvidarse de comprobar el
 * resultado no deje pasar a nadie: el camino descuidado corta, no habilita.
 */
export async function exigir(...roles: RolUsuario[]): Promise<UsuarioSesion> {
  const u = await usuarioActual();
  if (!u) throw new SinPermiso("Hay que iniciar sesión.");
  if (roles.length && !roles.includes(u.rol)) {
    throw new SinPermiso(
      `Esta acción es para ${roles.join(" o ")}, y la cuenta es ${u.rol}.`
    );
  }
  return u;
}

/**
 * Envuelve una server action para que un `SinPermiso` salga como resultado y no
 * como una excepción sin manejar.
 */
export async function conPermiso<T>(
  fn: () => Promise<T>
): Promise<T | { ok: false; errores: string[] }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof SinPermiso) return { ok: false, errores: [e.message] };
    throw e;
  }
}
