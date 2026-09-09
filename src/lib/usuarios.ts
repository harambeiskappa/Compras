import type { Prisma } from "@/generated/prisma/client";

/**
 * Las guardas de la baja de cuentas, fuera del archivo de acciones.
 *
 * VIVEN ACÁ PARA PODER PROBARLAS. `acciones-usuarios.ts` es `"use server"`:
 * todo lo que exporta queda expuesto como server action por HTTP, así que un
 * helper no puede vivir ahí. Y probar esta guarda desde afuera exige armar un
 * estado —«queda un solo administrativo activo»— que contra la base compartida
 * solo se puede montar dentro de una transacción que después se revierte.
 */

/**
 * Cuántos ADMINISTRATIVO activos quedarían si se desactivara `id`.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ OJO: HOY ESTA GUARDA NO PUEDE DISPARARSE DESDE `cambiarActivo`, Y NO ES  │
 * │ UN DESCUIDO.                                                             │
 * │                                                                          │
 * │ Quien llama a la acción pasó por `exigir("ADMINISTRATIVO")`, así que es  │
 * │ un administrativo ACTIVO. Si desactiva a otro, él mismo entra en esta    │
 * │ cuenta y el resultado nunca es 0. Y si se desactiva a sí mismo, la regla │
 * │ de «nadie puede desactivar su propia cuenta» corta antes.                │
 * │                                                                          │
 * │ Se deja igual porque es el invariante de verdad —no puede quedar cero    │
 * │ administrativo activo— y la otra regla es una comodidad de pantalla que  │
 * │ alguien podría sacar mañana. El día que aparezca cambiar el rol de una   │
 * │ cuenta, esta guarda pasa a ser el único freno: bajar de rol al último    │
 * │ administrativo deja la app sin nadie que pueda repararla desde adentro.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export async function otrosAdminsActivos(
  tx: Prisma.TransactionClient,
  id: number
): Promise<number> {
  return tx.usuario.count({
    where: { rol: "ADMINISTRATIVO", activo: true, id: { not: id } },
  });
}
