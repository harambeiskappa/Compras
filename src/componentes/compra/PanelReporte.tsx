"use client";

import { useState } from "react";

/**
 * Lo que mandó el comprador, AL COSTADO mientras se arma la compra.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ES EVIDENCIA: SE MIRA, NO SE TOCA.                                       │
 * │                                                                          │
 * │ No hay ni un control que lo edite, y no es solo que falte el botón: no   │
 * │ existe la acción del lado del servidor. Si el remito dice VQ y él        │
 * │ escribió VA, las dos afirmaciones se conservan — esa diferencia es lo    │
 * │ que a los seis meses permite contestar «¿cuántas veces el comprador vio  │
 * │ algo distinto del papel?».                                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * En papel ámbar contra el blanco de la carga: el color separa «lo que llegó»
 * de «lo que estoy escribiendo» sin que haga falta leer un rótulo.
 */

export type ReporteAlCostado = {
  id: number;
  fecha: string | null;
  consignatario: string | null;
  plaza: string | null;
  cabezas: number | null;
  camiones: number | null;
  observaciones: string | null;
  cargadoEn: string;
  recibidoEn: string;
  cuenta: string | null;
  personaCompradora: string | null;
  adjuntos: { id: number; numero: string | null; nota: string | null; url: string | null }[];
};

export function PanelReporte({ reporte }: { reporte: ReporteAlCostado }) {
  const [abierta, setAbierta] = useState<number | null>(null);

  return (
    <aside
      style={{
        background: "#fdf8ec",
        border: "1px solid #e6d9b8",
        borderRadius: 3,
        padding: "16px 18px",
        alignSelf: "start",
        position: "sticky",
        top: 68,
      }}
    >
      <div className="rotulo" style={{ color: "#8a6a12" }}>
        Lo que mandó el comprador
      </div>
      <div
        style={{
          marginTop: 6,
          font: "400 12px/1.5 var(--font-plex-sans), sans-serif",
          color: "#6b5518",
        }}
      >
        Es evidencia: se mira, no se toca. Queda como él la mandó aunque la
        compra termine diciendo otra cosa.
      </div>

      <div style={{ marginTop: 14 }}>
        <Linea rotulo="Fecha" valor={reporte.fecha} />
        <Linea rotulo="Consignatario" valor={reporte.consignatario} />
        <Linea rotulo="Plaza" valor={reporte.plaza} />
        <Linea
          rotulo="Cabezas aprox."
          valor={reporte.cabezas === null ? null : String(reporte.cabezas)}
        />
        <Linea
          rotulo="Camiones"
          valor={reporte.camiones === null ? null : String(reporte.camiones)}
        />
      </div>

      {reporte.observaciones && (
        <p
          style={{
            margin: "12px 0 0",
            padding: "10px 12px",
            background: "#fbf2df",
            border: "1px solid #e6d9b8",
            borderRadius: 2,
            font: "400 13px/1.5 var(--font-plex-sans), sans-serif",
            color: "#5d4d22",
          }}
        >
          «{reporte.observaciones}»
        </p>
      )}

      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid #e6d9b8",
          font: "400 11px/1.5 var(--font-plex-mono), monospace",
          color: "#8a7a52",
        }}
      >
        {/* LA CUENTA COMO CUENTA. Afirmar la persona a partir de la cuenta
            miente el día que dos la compartan; quién fue físicamente es otro
            campo y puede ser alguien sin cuenta. */}
        cuenta {reporte.cuenta ?? "s/d"}
        {reporte.personaCompradora && ` · fue ${reporte.personaCompradora}`}
        <br />
        cargado {reporte.cargadoEn.slice(0, 16).replace("T", " ")} · recibido{" "}
        {reporte.recibidoEn.slice(0, 16).replace("T", " ")}
      </div>

      {reporte.adjuntos.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="rotulo" style={{ color: "#8a6a12", marginBottom: 8 }}>
            Remitos — {reporte.adjuntos.length}
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {reporte.adjuntos.map((a, i) => (
              <div key={a.id}>
                {a.url ? (
                  // Se agrandan a pantalla completa: el número de remito se lee
                  // de acá para copiarlo al renglón, y ese es el gesto real.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.url}
                    alt={`Remito ${i + 1}`}
                    onClick={() => setAbierta(i)}
                    style={{
                      width: "100%",
                      display: "block",
                      borderRadius: 2,
                      border: "1px solid #e6d9b8",
                      cursor: "zoom-in",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      padding: "18px 12px",
                      background: "#fbf2df",
                      border: "1px solid #e6d9b8",
                      borderRadius: 2,
                      font: "400 12px var(--font-plex-sans), sans-serif",
                      color: "#6b5518",
                    }}
                  >
                    La foto no se pudo mostrar ahora. Sigue guardada.
                  </div>
                )}
                <div
                  style={{
                    marginTop: 4,
                    font: "400 12px var(--font-plex-mono), monospace",
                    color: "#6b5518",
                  }}
                >
                  {a.numero ? `nº ${a.numero}` : "número s/d"}
                </div>
                {a.nota && (
                  <div
                    style={{
                      font: "400 12px/1.45 var(--font-plex-sans), sans-serif",
                      color: "#6b5518",
                    }}
                  >
                    «{a.nota}»
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {abierta !== null && reporte.adjuntos[abierta]?.url && (
        <Lupa
          adjuntos={reporte.adjuntos}
          indice={abierta}
          ir={(n) => setAbierta(n)}
          cerrar={() => setAbierta(null)}
        />
      )}
    </aside>
  );
}

function Linea({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "baseline",
        padding: "3px 0",
        font: "400 13px/1.45 var(--font-plex-sans), sans-serif",
        color: "#5d4d22",
      }}
    >
      <span style={{ minWidth: 96, color: "#8a7a52" }}>{rotulo}</span>
      {valor ? <span>{valor}</span> : <span className="sd">s/d</span>}
    </div>
  );
}

function Lupa({
  adjuntos,
  indice,
  ir,
  cerrar,
}: {
  adjuntos: ReporteAlCostado["adjuntos"];
  indice: number;
  ir: (n: number) => void;
  cerrar: () => void;
}) {
  const a = adjuntos[indice];
  return (
    <div
      onClick={cerrar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgb(23 21 15 / 0.88)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={a.url ?? ""}
        alt={`Remito ${indice + 1}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "100%", maxHeight: "82vh", objectFit: "contain" }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          marginTop: 14,
          display: "flex",
          gap: 16,
          alignItems: "center",
          color: "#e5dfd0",
          font: "400 14px var(--font-plex-sans), sans-serif",
        }}
      >
        <button
          type="button"
          onClick={() => ir((indice - 1 + adjuntos.length) % adjuntos.length)}
          style={botonLupa}
        >
          ← Anterior
        </button>
        <span style={{ font: "500 15px var(--font-plex-mono), monospace" }}>
          {a.numero ? `nº ${a.numero}` : "número s/d"}
        </span>
        <button
          type="button"
          onClick={() => ir((indice + 1) % adjuntos.length)}
          style={botonLupa}
        >
          Siguiente →
        </button>
        <button type="button" onClick={cerrar} style={botonLupa}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

const botonLupa: React.CSSProperties = {
  padding: "7px 12px",
  font: "400 14px var(--font-plex-sans), sans-serif",
  color: "#e5dfd0",
  background: "transparent",
  border: "1px solid #55503f",
  borderRadius: 2,
  cursor: "pointer",
};
