"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/normalizar";
import { verificarPassword } from "@/lib/password";
import { COOKIE_SESION, DURACION_SESION, firmarSesion } from "@/lib/sesion";

/**
 * Un único mensaje para «no existe», «está desactivada» y «la contraseña está
 * mal». Distinguirlos le diría a cualquiera qué usuarios existen.
 */
const CREDENCIALES_MAL = "Usuario o contraseña incorrectos.";

/**
 * Lo que se muestra cuando revienta algo que no es culpa de quien entra.
 *
 * SIN DETALLE INTERNO. El detalle va al log del servidor: el mensaje de una
 * excepción puede nombrar una variable de entorno o una tabla, y la pantalla de
 * login es la única que ve alguien que todavía no se autenticó.
 */
const FALLO_INESPERADO =
  "No se pudo entrar por un problema del servidor. Probá de nuevo; si sigue, avisá.";

/**
 * El estado del formulario. Devuelve el usuario tipeado para poder recargarlo:
 * `<form action>` resetea los campos no controlados al terminar la acción, y
 * volver a escribir el usuario después de cada intento fallido es una molestia
 * gratuita. La contraseña NO vuelve.
 *
 * El valor inicial NO vive acá: un archivo `"use server"` solo puede exportar
 * funciones async, y exportar el objeto rompe la carga del módulo entero en
 * runtime —sin que `tsc` ni el build digan una palabra—. Está en el componente.
 */
export type EstadoIngreso = { error: string | null; usuario: string };

/**
 * Acción de `useActionState`, por eso la firma `(estadoPrevio, FormData)`.
 *
 * TODO lo que puede fallar está adentro del try, y el `redirect()` queda
 * AFUERA: `redirect` funciona tirando una excepción que Next tiene que ver
 * pasar, así que atraparla la rompería. Dejándola afuera no hace falta
 * distinguirla de un error de verdad.
 */
export async function ingresar(
  _previo: EstadoIngreso,
  datos: FormData
): Promise<EstadoIngreso> {
  const tipeado = String(datos.get("usuario") ?? "");
  let destino = "/compras";

  try {
    // Misma normalización que al crear la cuenta: trim + minúsculas. No se
    // inventa una tercera — es `normalizarTexto`, la de los sinónimos.
    const usuario = normalizarTexto(tipeado);
    const password = String(datos.get("password") ?? "");
    if (!usuario || !password) {
      return { error: CREDENCIALES_MAL, usuario: tipeado };
    }

    const u = await prisma.usuario.findUnique({
      where: { usuario },
      select: { id: true, hashPassword: true, activo: true },
    });

    // Se verifica igual aunque el usuario no exista, contra un hash de descarte:
    // si se cortara antes, la respuesta volvería mucho más rápido y eso solo ya
    // dice qué usuarios existen.
    const hash =
      u?.hashPassword ??
      "scrypt$00000000000000000000000000000000$" + "0".repeat(128);
    const coincide = await verificarPassword(password, hash);

    if (!u || !u.activo || !coincide) {
      return { error: CREDENCIALES_MAL, usuario: tipeado };
    }

    (await cookies()).set(COOKIE_SESION, await firmarSesion(u.id), {
      httpOnly: true, // que no la lea el JavaScript de la página
      secure: process.env.NODE_ENV === "production", // en local no hay HTTPS
      sameSite: "lax",
      path: "/",
      maxAge: DURACION_SESION,
    });

    // Solo rutas internas: un `volver` con URL completa sería un redirect abierto.
    const volver = String(datos.get("volver") ?? "");
    if (volver.startsWith("/") && !volver.startsWith("//")) destino = volver;
  } catch (e) {
    // Así se vio el bug que motivó todo esto: faltaba SESION_SECRETO en
    // Production y `firmarSesion` tiraba la excepción escrita a propósito para
    // no degradarse a un secreto por defecto. La excepción no llegaba a la
    // pantalla y el botón quedaba clavado en «Entrando…» sin decir nada.
    console.error("Falló el ingreso:", e);
    return { error: FALLO_INESPERADO, usuario: tipeado };
  }

  redirect(destino);
}

export async function salir(): Promise<void> {
  (await cookies()).delete(COOKIE_SESION);
  redirect("/ingresar");
}
