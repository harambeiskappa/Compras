"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { salir } from "@/lib/acciones-auth";
import type { UsuarioSesion } from "@/lib/auth";

/**
 * Barra fija. Muestra la ruta actual en monoespaciada, como el prototipo: es
 * una app de oficina y saber dónde se está parado vale más que el adorno.
 */
export function Encabezado({ usuario }: { usuario: UsuarioSesion | null }) {
  const ruta = usePathname();

  // Sin sesión no se muestra la barra: la única pantalla es el login.
  if (!usuario) return null;

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
        {/*
          El botón solo aparece para ADMINISTRATIVO. Esconderlo NO es el
          permiso: `crearCompra` exige el rol del lado del servidor. Esto es
          para no ofrecerle a un comercial algo que le va a ser rechazado.
        */}
        {usuario.rol === "ADMINISTRATIVO" && (
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
        )}
        <div style={{ width: 1, height: 20, background: "#3a352a" }} />
        <span
          style={{
            font: "400 12px/1 var(--font-plex-mono), monospace",
            color: "#8d8574",
          }}
          title={usuario.rol === "ADMINISTRATIVO" ? "Administrativo" : "Comercial"}
        >
          {usuario.nombre} · {usuario.rol === "ADMINISTRATIVO" ? "ADM" : "COM"}
        </span>
        <form action={salir}>
          <button
            type="submit"
            style={{
              background: "transparent",
              border: 0,
              padding: "6px 2px",
              cursor: "pointer",
              font: "400 13px var(--font-plex-sans), sans-serif",
              color: "#c8c0ad",
            }}
          >
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
