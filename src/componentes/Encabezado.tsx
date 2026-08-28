"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Barra fija. Muestra la ruta actual en monoespaciada, como el prototipo: es
 * una app de oficina y saber dónde se está parado vale más que el adorno.
 */
export function Encabezado() {
  const ruta = usePathname();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "var(--tinta)",
        color: "#f2eee4",
        borderBottom: "1px solid #000",
      }}
    >
      <div
        style={{
          maxWidth: 1220,
          margin: "0 auto",
          padding: "0 28px",
          height: 52,
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <Link
          href="/compras"
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 9,
            color: "#f2eee4",
            textDecoration: "none",
          }}
        >
          <span
            style={{
              font: "600 14px/1 var(--font-plex-mono), monospace",
              letterSpacing: ".14em",
            }}
          >
            COMPRAS
          </span>
          <span
            style={{
              font: "400 11px/1 var(--font-plex-mono), monospace",
              color: "#8d8574",
            }}
          >
            HACIENDA
          </span>
        </Link>
        <div style={{ width: 1, height: 20, background: "#3a352a" }} />
        <div
          style={{
            font: "400 13px/1 var(--font-plex-mono), monospace",
            color: "#c8c0ad",
          }}
        >
          {ruta}
        </div>
        <div style={{ flex: 1 }} />
        <Link
          href="/compras"
          style={{
            font: "500 13px var(--font-plex-sans), sans-serif",
            color: "#c8c0ad",
            textDecoration: "none",
          }}
        >
          Compras
        </Link>
        <Link
          href="/compras/nueva"
          style={{
            padding: "7px 14px",
            font: "500 13px var(--font-plex-sans), sans-serif",
            color: "var(--tinta)",
            background: "#e5dfd0",
            border: "1px solid #e5dfd0",
            borderRadius: 2,
            textDecoration: "none",
          }}
        >
          Registrar una compra
        </Link>
      </div>
    </header>
  );
}
