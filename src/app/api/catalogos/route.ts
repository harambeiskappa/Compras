import { NextResponse } from "next/server";

import { usuarioActual } from "@/lib/auth";
import { catalogoComprador } from "@/lib/catalogos";

export const dynamic = "force-dynamic";

/**
 * Lo que el comprador necesita elegir, para guardar en el teléfono.
 *
 * AUTENTICADO: son los nombres de con quién opera la casa, o sea información
 * del negocio. Que sean pocos KB no los hace públicos.
 *
 * NO SE CACHEA EN EL SERVICE WORKER como respuesta HTTP. El cache de esta
 * respuesta lo maneja la app en IndexedDB, con su `generadoEn` a la vista, y
 * dos caches del mismo dato se contradicen el día que uno se refresca y el otro
 * no. Ver `src/lib/dispositivo/catalogos.ts`.
 */
export async function GET() {
  const yo = await usuarioActual();
  if (!yo) {
    return NextResponse.json({ error: "Hay que iniciar sesión." }, { status: 401 });
  }

  const catalogo = await catalogoComprador();

  return NextResponse.json(catalogo, {
    headers: { "Cache-Control": "no-store" },
  });
}
