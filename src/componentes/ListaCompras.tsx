"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type FilaCompra = {
  id: number;
  fecha: string;
  consignatario: string;
  empresa: string;
  vendedor: string | null;
  plaza: string | null;
};

/*
 * EL ID ES UN IDENTIFICADOR, NO UN CONTADOR.
 *
 * Sale de una secuencia de Postgres, y una secuencia entrega números aunque el
 * INSERT después falle: un rechazo de validación, una constraint que salta o
 * una transacción abortada consumen su número igual. Van a aparecer huecos, y
 * no son un error ni un dato perdido.
 *
 * Leer «#47» como «llevamos 47 compras» es sacar un número inventado — y el
 * diseño lo muestra grande, así que la confusión es fácil. Para contar compras
 * se cuentan las filas, que es lo que hace el «N cargadas» del encabezado.
 */
const COLUMNAS = "112px 1.35fr 1.25fr 1.4fr 1fr 84px";

export function ListaCompras({
  filas,
  total,
  busqueda,
}: {
  filas: FilaCompra[];
  total: number;
  busqueda: string;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(busqueda);

  function buscar(v: string) {
    setTexto(v);
    router.replace(v.trim() ? `/compras?q=${encodeURIComponent(v.trim())}` : "/compras");
  }

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
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <h1 style={{ margin: 0, font: "600 26px/1.1 var(--font-plex-sans), sans-serif" }}>
            Compras
          </h1>
          <span
            style={{
              font: "400 13px/1 var(--font-plex-mono), monospace",
              color: "var(--tinta-suave)",
            }}
          >
            {filas.length === total
              ? `${total} ${total === 1 ? "cargada" : "cargadas"}`
              : `${filas.length} de ${total}`}
          </span>
        </div>
        <div style={{ flex: 1 }} />
        {/*
          No hay contador de avisos porque no hay avisos: el único que existe
          compara la empresa titular contra las de sus tropas, y las tropas son
          del módulo 2. Inventar un cartel en cero sería mentir.
        */}
        <input
          value={texto}
          onChange={(e) => buscar(e.target.value)}
          placeholder="Buscar consignatario, empresa, origen o plaza"
          className="campo"
          style={{ width: 330 }}
        />
      </div>

      <div
        style={{
          marginTop: 10,
          font: "400 13px/1.5 var(--font-plex-sans), sans-serif",
          color: "var(--tinta-tenue)",
        }}
      >
        Cabezas y kilos son de la compra, no de este paso: todavía no existen, así
        que no hay columna esperándolos.
      </div>

      <div style={{ marginTop: 22 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: COLUMNAS,
            gap: 16,
            padding: "0 12px 9px",
            borderBottom: "1px solid var(--tinta)",
          }}
        >
          {["Fecha", "Consignatario", "Empresa titular", "Vendedor / origen", "Plaza"].map(
            (t) => (
              <div
                key={t}
                style={{
                  font: "600 11px/1 var(--font-plex-mono), monospace",
                  letterSpacing: ".09em",
                  textTransform: "uppercase",
                }}
              >
                {t}
              </div>
            )
          )}
          <div />
        </div>

        {filas.map((f) => (
          <Link
            key={f.id}
            href={`/compras/${f.id}`}
            style={{
              display: "grid",
              gridTemplateColumns: COLUMNAS,
              gap: 16,
              alignItems: "center",
              padding: "13px 12px",
              borderBottom: "1px solid #e4dfd1",
              background: "var(--papel-alto)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                font: "500 14px/1 var(--font-plex-mono), monospace",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {aDdMmAaaa(f.fecha)}
            </div>
            <div style={{ font: "500 14px/1.3 var(--font-plex-sans), sans-serif" }}>
              {f.consignatario}
            </div>
            <div
              style={{
                font: "400 14px/1.3 var(--font-plex-sans), sans-serif",
                color: "var(--tinta-media)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {f.empresa}
            </div>
            <div style={{ minWidth: 0 }}>
              {f.vendedor ? (
                <span
                  style={{
                    font: "400 14px/1.3 var(--font-plex-sans), sans-serif",
                    color: "var(--tinta-media)",
                  }}
                >
                  {f.vendedor}
                </span>
              ) : (
                <span className="sd">s/d</span>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              {f.plaza ? (
                <span
                  style={{
                    font: "400 14px/1.3 var(--font-plex-sans), sans-serif",
                    color: "var(--tinta-media)",
                  }}
                >
                  {f.plaza}
                </span>
              ) : (
                <span className="sd">s/d</span>
              )}
            </div>
            <div
              style={{
                textAlign: "right",
                font: "400 12px/1 var(--font-plex-mono), monospace",
                color: "var(--tinta-fantasma)",
              }}
            >
              #{f.id}
            </div>
          </Link>
        ))}
      </div>

      {filas.length === 0 && (
        <div
          style={{
            marginTop: 40,
            padding: 22,
            background: "var(--papel-alto)",
            border: "1px dashed var(--borde-fuerte)",
            borderRadius: 2,
            maxWidth: 560,
          }}
        >
          <div style={{ font: "500 15px/1.4 var(--font-plex-sans), sans-serif" }}>
            Ninguna compra coincide con «{busqueda}».
          </div>
          <div
            style={{
              marginTop: 6,
              font: "400 14px/1.5 var(--font-plex-sans), sans-serif",
              color: "var(--tinta-suave)",
            }}
          >
            Se busca en consignatario, empresa titular, vendedor/origen y plaza.
            Las que tienen ese dato en s/d no pueden coincidir.
          </div>
        </div>
      )}
    </main>
  );
}

function aDdMmAaaa(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
