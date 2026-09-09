import type { Metadata } from "next";
import { cookies } from "next/headers";
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

  return (
    <html lang="es" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <Encabezado usuario={usuario} />
        {children}
        <div style={{ height: 70 }} />
      </body>
    </html>
  );
}
