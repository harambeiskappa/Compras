import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import "./globals.css";
import { Encabezado } from "@/componentes/Encabezado";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <Encabezado />
        {children}
        <div style={{ height: 70 }} />
      </body>
    </html>
  );
}
