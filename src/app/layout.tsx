import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import "./globals.css";
import { Encabezado } from "@/componentes/Encabezado";
import { usuarioActual } from "@/lib/auth";

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
  // consulta la base: el rol y el `activo` no salen de la cookie.
  const usuario = await usuarioActual();

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
