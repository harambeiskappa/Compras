import Link from "next/link";

import { normalizarNombre } from "@/lib/normalizar";
import { prisma } from "@/lib/prisma";
import { FormularioAlta } from "@/componentes/FormularioAlta";
import { PLAZAS_SUGERIDAS } from "@/lib/plazas";

export const dynamic = "force-dynamic";

export default async function PaginaNueva() {
  // La plaza es texto libre, así que el datalist sugiere sin obligar. Se unen
  // las 12 sugerencias iniciales del histórico con lo que ya se haya tipeado en
  // compras reales: el día uno hay de dónde elegir, y después la lista se
  // corrige sola con el uso.
  const usadas = await prisma.compra.findMany({
    where: { plazaLugar: { not: null } },
    select: { plazaLugar: true },
    distinct: ["plazaLugar"],
    orderBy: { plazaLugar: "asc" },
    take: 60,
  });

  // Dedup sin distinguir mayúsculas ni acentos, para no ofrecer WASHINGTON y
  // Washington como dos sugerencias. Gana la forma ya usada en una compra: es
  // la que alguien escribió de verdad.
  const porClave = new Map<string, string>();
  for (const u of usadas) {
    if (u.plazaLugar) porClave.set(normalizarNombre(u.plazaLugar), u.plazaLugar);
  }
  for (const p of PLAZAS_SUGERIDAS) {
    const clave = normalizarNombre(p);
    if (!porClave.has(clave)) porClave.set(clave, p);
  }
  const plazas = [...porClave.values()].sort((a, b) => a.localeCompare(b, "es"));

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
