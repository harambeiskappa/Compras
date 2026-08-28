import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { ListaCompras } from "@/componentes/ListaCompras";

export const dynamic = "force-dynamic";

export default async function PaginaCompras({ searchParams }: PageProps<"/compras">) {
  const { q } = await searchParams;
  const busqueda = typeof q === "string" ? q.trim() : "";

  const compras = await prisma.compra.findMany({
    orderBy: { fecha: "desc" },
    select: {
      id: true,
      fecha: true,
      plazaLugar: true,
      consignatario: { select: { nombre: true } },
      empresaTitular: { select: { nombre: true } },
      vendedor: { select: { nombre: true } },
    },
  });

  const total = compras.length;

  if (total === 0) return <Vacio />;

  const filas = compras
    .map((c) => ({
      id: c.id,
      fecha: c.fecha.toISOString().slice(0, 10),
      consignatario: c.consignatario.nombre,
      empresa: c.empresaTitular.nombre,
      // Los prefijos viven en otra tabla; acá alcanza el nombre.
      vendedor: c.vendedor?.nombre ?? null,
      plaza: c.plazaLugar,
    }))
    .filter((f) => {
      if (!busqueda) return true;
      const enTexto = [f.consignatario, f.empresa, f.vendedor, f.plaza]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return enTexto.includes(busqueda.toLowerCase());
    });

  return <ListaCompras filas={filas} total={total} busqueda={busqueda} />;
}

/**
 * El estado real del sistema hoy. No es una pantalla de error ni un placeholder:
 * es lo que hay hasta que alguien cargue la primera compra.
 */
function Vacio() {
  return (
    <main style={{ maxWidth: 1220, margin: "0 auto", padding: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          paddingBottom: 16,
          borderBottom: "2px solid var(--tinta)",
        }}
      >
        <h1 style={{ margin: 0, font: "600 26px/1.1 var(--font-plex-sans), sans-serif" }}>
          Compras
        </h1>
        <span
          style={{
            font: "400 13px/1 var(--font-plex-mono), monospace",
            color: "var(--tinta-suave)",
          }}
        >
          0 cargadas
        </span>
      </div>

      <div style={{ marginTop: 64, maxWidth: 620 }}>
        <div className="rotulo" style={{ color: "var(--tinta-fantasma)" }}>
          Todavía no hay ninguna
        </div>
        <h2
          style={{
            margin: "16px 0 0",
            font: "600 30px/1.2 var(--font-plex-sans), sans-serif",
            letterSpacing: "-.015em",
            maxWidth: "15em",
          }}
        >
          Acá van a aparecer las compras a medida que se carguen.
        </h2>
        <p
          style={{
            margin: "18px 0 0",
            font: "400 16px/1.6 var(--font-plex-sans), sans-serif",
            color: "var(--tinta-media)",
          }}
        >
          Una compra guarda cuándo y dónde se compró, quién consignó, cuál de
          nuestras empresas la registra y de quién era la hacienda. Las cabezas,
          los kilos y las jaulas se cargan después, en la compra propiamente dicha.
        </p>
        <div style={{ marginTop: 30 }}>
          <Link
            href="/compras/nueva"
            style={{
              display: "inline-block",
              padding: "12px 22px",
              font: "500 15px var(--font-plex-sans), sans-serif",
              color: "var(--papel)",
              background: "var(--verde)",
              border: "1px solid var(--verde-hondo)",
              borderRadius: 2,
              textDecoration: "none",
            }}
          >
            Registrar la primera compra
          </Link>
        </div>
        <div
          style={{
            marginTop: 56,
            paddingTop: 20,
            borderTop: "1px solid var(--borde)",
            font: "400 14px/1.6 var(--font-plex-sans), sans-serif",
            color: "var(--tinta-suave)",
            maxWidth: "44em",
          }}
        >
          Del año pasado hay compras en planillas de Excel. No se cargan solas ni
          se importan desde acá: entran cuando alguien las carga, o cuando se
          decida traerlas, que es otra conversación.
        </div>
      </div>
    </main>
  );
}
