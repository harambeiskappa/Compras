import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_SESION, leerSesion } from "@/lib/sesion";

/**
 * Se llama `proxy.ts` y no `middleware.ts`: desde Next 16 el middleware pasó a
 * llamarse Proxy. La funcionalidad es la misma.
 *
 * QUÉ HACE Y QUÉ NO. Verifica la firma y el vencimiento de la cookie, y nada
 * más. NO toca la base y NO decide permisos.
 *
 * Por qué: corre en cada request, incluidas las rutas que Next prefetchea, así
 * que una consulta acá se paga muchas veces. La propia doc de Next lo dice —
 * el proxy es para chequeos optimistas, no para autorización.
 *
 * SE QUEDA EN EDGE, sin declarar runtime Node. Con Web Crypto alcanza para
 * verificar un HMAC, y `sesion.ts` está escrito con eso justamente para que el
 * mismo código sirva en los dos runtimes. Pasarlo a Node solo agregaría
 * arranque en frío para hacer lo mismo.
 *
 * La autorización de verdad —el rol, el `activo`— vive en `src/lib/auth.ts` y
 * se comprueba adentro de cada server action. Que el proxy deje pasar una
 * cookie bien firmada no habilita nada por sí solo.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Público: el login, la salud y lo estático.
  const publico =
    pathname === "/ingresar" ||
    pathname === "/api/salud" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  const sesion = await leerSesion(request.cookies.get(COOKIE_SESION)?.value);

  if (publico) {
    // Con sesión válida, el login no tiene sentido. Va a la raíz y no a una
    // pantalla concreta: la cookie solo lleva el id, así que acá no se sabe el
    // rol, y es la raíz la que manda a cada uno a su puerta.
    if (pathname === "/ingresar" && sesion) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!sesion) {
    const destino = new URL("/ingresar", request.url);
    // Para volver a donde iba después de entrar. Solo la ruta, nunca una URL
    // completa: un `?volver=https://otrositio` sería un redirect abierto.
    destino.searchParams.set("volver", pathname);
    return NextResponse.redirect(destino);
  }

  return conRuta(request, pathname);
}

/**
 * Pasa la ruta al layout en un header.
 *
 * Un layout no tiene forma de saber qué ruta está renderizando, y el layout raíz
 * necesita saberlo para UNA cosa: no poner el nombre de la persona en el HTML de
 * las pantallas del comprador. Esas dos páginas las cachea el service worker
 * para que abran sin señal, y un HTML cacheado con datos de alguien adentro
 * sobrevive al logout. Ver `public/sw.js`.
 */
function conRuta(request: NextRequest, pathname: string) {
  const cabeceras = new Headers(request.headers);
  cabeceras.set("x-ruta", pathname);
  return NextResponse.next({ request: { headers: cabeceras } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
