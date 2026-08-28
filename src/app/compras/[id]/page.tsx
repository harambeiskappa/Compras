import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { DetalleCompra } from "@/componentes/DetalleCompra";

export const dynamic = "force-dynamic";

export default async function PaginaDetalle({ params }: PageProps<"/compras/[id]">) {
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero)) notFound();

  const c = await prisma.compra.findUnique({
    where: { id: numero },
    select: {
      id: true,
      fecha: true,
      plazaLugar: true,
      observaciones: true,
      creadoEn: true,
      actualizadoEn: true,
      consignatario: { select: { id: true, nombre: true } },
      empresaTitular: { select: { id: true, nombre: true } },
      vendedor: { select: { id: true, nombre: true } },
      hotelero: { select: { id: true, nombre: true } },
      personaCompradora: { select: { id: true, nombre: true } },
    },
  });

  if (!c) notFound();

  const compra = {
    id: c.id,
    fecha: c.fecha.toISOString().slice(0, 10),
    consignatario: c.consignatario,
    empresaTitular: c.empresaTitular,
    vendedor: c.vendedor,
    hotelero: c.hotelero,
    personaCompradora: c.personaCompradora,
    plazaLugar: c.plazaLugar,
    observaciones: c.observaciones,
    creadoEn: c.creadoEn.toISOString(),
    actualizadoEn: c.actualizadoEn.toISOString(),
  };

  const [a, m, d] = compra.fecha.split("-");

  return (
    <main style={{ maxWidth: 1220, margin: "0 auto", padding: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 18,
          paddingBottom: 16,
          borderBottom: "2px solid var(--tinta)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <Link
            href="/compras"
            style={{
              font: "400 13px var(--font-plex-mono), monospace",
              color: "var(--tinta-suave)",
              textDecoration: "none",
            }}
          >
            ← Compras
          </Link>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "baseline",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <h1
              style={{
                margin: 0,
                font: "600 26px/1.1 var(--font-plex-mono), monospace",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {d}/{m}/{a}
            </h1>
            <div
              style={{
                font: "400 22px/1.2 var(--font-plex-sans), sans-serif",
                color: "var(--tinta-media)",
              }}
            >
              {compra.consignatario.nombre} · {compra.empresaTitular.nombre}
            </div>
            <span
              style={{
                font: "400 13px/1 var(--font-plex-mono), monospace",
                color: "var(--tinta-fantasma)",
              }}
            >
              #{compra.id}
            </span>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            font: "400 13px/1.45 var(--font-plex-sans), sans-serif",
            color: "var(--tinta-suave)",
            textAlign: "right",
            maxWidth: "20em",
          }}
        >
          Se ve y se edita acá mismo: se toca el dato y se cambia. No hay otra
          pantalla.
        </div>
      </div>

      {/*
        Acá iría el aviso de empresa titular fuera de sus tropas. No se muestra
        ninguno porque no puede haberlos: el aviso compara contra las tropas de
        la compra, y las tropas son del módulo 2. La plomería está en el server
        (guardarRol valida la titular); el cartel llega cuando haya con qué
        compararlo.
      */}

      <DetalleCompra compra={compra} />
    </main>
  );
}
