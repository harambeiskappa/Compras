import Link from "next/link";

import { plazasParaSugerir } from "@/lib/catalogos";
import { FormularioAlta } from "@/componentes/FormularioAlta";

export const dynamic = "force-dynamic";

export default async function PaginaNueva() {
  // La plaza es texto libre, así que el datalist sugiere sin obligar. La lista
  // la arma `plazasParaSugerir`, que es la misma que alimenta el catálogo del
  // comprador: dos deduplicaciones del mismo dato divergen.
  const plazas = await plazasParaSugerir();

  return (
    <main style={{ maxWidth: 1220, margin: "0 auto", padding: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 18,
          paddingBottom: 16,
          borderBottom: "2px solid var(--tinta)",
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
          <h1
            style={{
              margin: "6px 0 0",
              font: "600 26px/1.1 var(--font-plex-sans), sans-serif",
            }}
          >
            Registrar una compra
          </h1>
        </div>
      </div>

      <FormularioAlta plazas={plazas} />
    </main>
  );
}
