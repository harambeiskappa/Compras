import type { RolUsuario } from "@/generated/prisma/enums";

/**
 * A qué pantalla entra cada rol.
 *
 * El comercial abre la app para CARGAR, no para mirar: viene de una feria con
 * fotos que sacar, y el 90 % de las veces eso es todo lo que va a hacer.
 * Mandarlo a la lista de compras de la oficina le agrega dos toques para llegar
 * a lo único que hace, y una pantalla que no es suya.
 *
 * Vive en su propio módulo porque lo usan dos lugares —el login y la raíz— y
 * `acciones-auth.ts` es `"use server"`: ahí no se puede exportar una función que
 * no sea una server action. Y porque la misma regla escrita dos veces se
 * contradice el día que se agregue un rol.
 */
export function pantallaInicial(rol: RolUsuario): string {
  return rol === "COMERCIAL" ? "/reportar" : "/compras";
}
