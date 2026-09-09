import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { redirect } from "next/navigation";

import "./globals.css";
import { Encabezado } from "@/componentes/Encabezado";
import { usuarioActual } from "@/lib/auth";
import { COOKIE_SESION } from "@/lib/sesion";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Compras · Hacienda",
  description: "Registro de la compra de hacienda",
};

/**
 * Sin esto, un celular renderiza la página a 980 px y la achica: los campos
 * quedan del tamaño de una uña. La condición de uso del módulo 2 es un teléfono
 * en la mano, en un remate, a veces con una sola mano libre.
 *
 * `maximumScale` NO se limita: impedir el zoom le saca la lupa a quien la
 * necesita para leer un número de remito al sol.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f3ec",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // La sesión se lee acá una sola vez y baja al encabezado. `usuarioActual`
  // consulta la base: el rol, el `activo` y el corte por cambio de contraseña
  // no salen de la cookie.
  const usuario = await usuarioActual();

  // Cookie que pasa la firma pero ya no vale: contraseña cambiada desde otro
  // dispositivo, o cuenta desactivada. El proxy la deja pasar porque corre en
  // Edge y no toca la base, así que sin esto la persona vería las pantallas
  // —sin encabezado— hasta que la cookie venciera, dentro de 30 días. Las
  // acciones ya la rechazaban; esto la echa de la vista también.
  //
  // Solo cuando HAY cookie: sin cookie, el proxy ya mandó al login lo que había
  // que mandar, y las públicas tienen que poder renderizar.
  if (!usuario && (await cookies()).has(COOKIE_SESION)) redirect("/api/salir");

  // Las pantallas del comprador NO llevan el encabezado, y no es una decisión
  // de estilo: el service worker cachea su HTML para que abran sin señal, y el
  // encabezado pondría ahí adentro el nombre de la persona. Un HTML con datos
  // de alguien guardado en el disco del navegador sobrevive al logout.
  //
  // La comprobación de sesión de arriba se hace igual: lo que se saca es el
  // dato de la pantalla, no la guarda.
  const ruta = (await headers()).get("x-ruta") ?? "";
  const esComprador = ruta === "/reportar" || ruta.startsWith("/reportes");

  return (
    <html lang="es" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <Encabezado usuario={esComprador ? null : usuario} />
        {children}
        <div style={{ height: 70 }} />
      </body>
    </html>
  );
}
