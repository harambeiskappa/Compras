"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/normalizar";
import { verificarPassword } from "@/lib/password";
import { COOKIE_SESION, DURACION_SESION, firmarSesion } from "@/lib/sesion";

export type ResultadoIngreso = { ok: true } | { ok: false; error: string };

/**
 * Un único mensaje para «no existe», «está desactivada» y «la contraseña está
 * mal». Distinguirlos le diría a cualquiera qué usuarios existen.
 */
const CREDENCIALES_MAL = "Usuario o contraseña incorrectos.";

export async function ingresar(
  usuarioCrudo: string,
  password: string,
  volver: string
): Promise<ResultadoIngreso> {
  // Misma normalización que al crear la cuenta: trim + minúsculas. No se
  // inventa una tercera — es `normalizarTexto`, la de los sinónimos.
  const usuario = normalizarTexto(usuarioCrudo);
  if (!usuario || !password) return { ok: false, error: CREDENCIALES_MAL };

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

  if (!u || !u.activo || !coincide) return { ok: false, error: CREDENCIALES_MAL };

  (await cookies()).set(COOKIE_SESION, await firmarSesion(u.id), {
    httpOnly: true, // que no la lea el JavaScript de la página
    secure: process.env.NODE_ENV === "production", // en local no hay HTTPS
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SESION,
  });

  // Solo rutas internas: un `volver` con URL completa sería un redirect abierto.
  const destino = volver.startsWith("/") && !volver.startsWith("//") ? volver : "/compras";
  redirect(destino);
}

export async function salir(): Promise<void> {
  (await cookies()).delete(COOKIE_SESION);
  redirect("/ingresar");
}
