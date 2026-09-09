import { NextResponse } from "next/server";

import { COOKIE_SESION } from "@/lib/sesion";

export const dynamic = "force-dynamic";

/**
 * Borra la cookie y manda al login.
 *
 * Existe para UN caso: la cookie que pasa la firma pero ya no vale —la
 * contraseña se cambió desde otro dispositivo, o la cuenta se desactivó—. El
 * proxy no puede detectarlo (corre en Edge y no toca la base, a propósito), así
 * que quien lo detecta es el layout, que ya consulta `usuarioActual()`.
 *
 * Y tiene que ser una ruta, no un `redirect("/ingresar")` desde el layout: sin
 * borrar la cookie, el proxy ve una firma válida en `/ingresar` y rebota a
 * `/compras`, que rebota de vuelta. Un bucle. Acá la cookie se borra primero.
 */
export async function GET(request: Request) {
  const respuesta = NextResponse.redirect(new URL("/ingresar", request.url));
  respuesta.cookies.delete(COOKIE_SESION);
  return respuesta;
}
