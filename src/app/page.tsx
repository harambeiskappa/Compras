import { redirect } from "next/navigation";

import { usuarioActual } from "@/lib/auth";
import { pantallaInicial } from "@/lib/rutas";

export const dynamic = "force-dynamic";

/**
 * Cada rol entra por su puerta.
 *
 * El comercial abre la app para cargar, no para mirar: el 90 % de las veces
 * viene de una feria con fotos que sacar. Mandarlo a la lista de compras de la
 * oficina sería hacerle tocar dos veces para llegar a lo único que hace.
 *
 * La oficina, al revés, entra a buscar o cargar una compra. Un tablero no
 * tendría qué mostrar todavía.
 */
export default async function Raiz() {
  const usuario = await usuarioActual();
  redirect(usuario ? pantallaInicial(usuario.rol) : "/compras");
}
