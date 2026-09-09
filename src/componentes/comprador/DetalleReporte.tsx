"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { corregirReporte } from "@/lib/acciones-reportes";

/**
 * Un reporte ya enviado: verlo, y corregirlo mientras la oficina no lo procesó.
 *
 * EDITABLE Y CONGELADO SE DISTINGUEN DE UN VISTAZO, con una banda arriba que
 * dice el estado y su explicación. Y congelado NO muestra campos deshabilitados
 * sino texto plano: un campo gris invita a tocarlo y no dice nada; el texto
 * plano se lee como lo que es, un registro cerrado.
 */

type Adjunto = { id: number; numero: string | null; nota: string | null; url: string | null };

type Reporte = {
  id: number;
  estado: "PENDIENTE" | "PROCESADO" | "DESCARTADO";
  fecha: string | null;
  consignatario: string | null;
  plaza: string | null;
  cabezas: number | null;
  camiones: number | null;
  observaciones: string | null;
  cargadoEn: string;
  recibidoEn: string;
  cargadoPor: string | null;
  compras: number;
  adjuntos: Adjunto[];
};

export function DetalleReporte({ id }: { id: number }) {
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [guardado, setGuardado] = useState(false);
  const [pendiente, arrancar] = useTransition();

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/reportes/${id}`, { cache: "no-store" });
        if (res.status === 401) {
          window.location.href = `/ingresar?volver=/reportes/${id}`;
          return;
        }
        if (!res.ok) {
          const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };
          if (vivo) setProblema(cuerpo.error ?? "No se pudo traer el reporte.");
          return;
        }
        if (vivo) setReporte((await res.json()) as Reporte);
      } catch {
        if (vivo) {
          setProblema(
            "Sin señal. Este reporte ya está en la oficina; para verlo hace falta conexión."
          );
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id]);

  if (problema) {
    return (
      <div style={{ paddingTop: 34 }}>
        <p
          style={{
            padding: "12px 14px",
            background: "var(--aviso-claro)",
            border: "1px solid var(--aviso-borde)",
            borderLeft: "4px solid var(--aviso)",
            borderRadius: 2,
            font: "400 15px/1.5 var(--font-plex-sans), sans-serif",
          }}
        >
          {problema}
        </p>
        <Link href="/reportes" style={{ font: "400 15px var(--font-plex-sans), sans-serif" }}>
          Volver a mis reportes
        </Link>
      </div>
    );
  }

  if (!reporte) {
    return <p style={{ padding: "40px 0", color: "var(--tinta-suave)" }}>Abriendo…</p>;
  }

  const editable = reporte.estado === "PENDIENTE";

  function guardar() {
    if (!reporte) return;
    setErrores([]);
    setGuardado(false);
    arrancar(async () => {
      const r = await corregirReporte(reporte.id, {
        fecha: reporte.fecha,
        consignatarioTexto: reporte.consignatario,
        plazaTexto: reporte.plaza,
        cabezasAproximadas: reporte.cabezas,
        cantidadCamiones: reporte.camiones,
        observaciones: reporte.observaciones,
        remitos: reporte.adjuntos.map((a) => ({
          id: a.id,
          numero: a.numero,
          nota: a.nota,
        })),
      });
      if (!r.ok) setErrores(r.errores);
      else setGuardado(true);
    });
  }

  function tocar(parche: Partial<Reporte>) {
    setReporte((p) => (p ? { ...p, ...parche } : p));
    setGuardado(false);
  }

  return (
    <div style={{ paddingTop: 18 }}>
      <Banda reporte={reporte} />

      <h1
        style={{
          margin: "18px 0 2px",
          font: "600 22px/1.2 var(--font-plex-sans), sans-serif",
        }}
      >
        {reporte.consignatario ?? "Sin consignatario"}
      </h1>
      <div
        style={{
          font: "400 13px var(--font-plex-mono), monospace",
          color: "var(--tinta-suave)",
        }}
      >
        {/* Las DOS fechas, y la diferencia es información: con carga sin señal,
            «cuándo lo cargó» y «cuándo llegó» pueden estar separados por horas. */}
        cargado {reporte.cargadoEn.slice(0, 16).replace("T", " ")} · recibido{" "}
        {reporte.recibidoEn.slice(0, 16).replace("T", " ")}
      </div>

      {editable ? (
        <>
          <Editable rotulo="Fecha">
            <input
              type="date"
              value={reporte.fecha ?? ""}
              onChange={(e) => tocar({ fecha: e.target.value || null })}
              className="campo"
              style={{ fontSize: 16 }}
            />
          </Editable>
          <Editable rotulo="Consignatario">
            <input
              value={reporte.consignatario ?? ""}
              onChange={(e) => tocar({ consignatario: e.target.value || null })}
              className="campo"
              style={{ fontSize: 16 }}
            />
          </Editable>
          <Editable rotulo="Plaza">
            <input
              value={reporte.plaza ?? ""}
              onChange={(e) => tocar({ plaza: e.target.value || null })}
              className="campo"
              style={{ fontSize: 16 }}
            />
          </Editable>
          <Editable rotulo="Cabezas aproximadas">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={reporte.cabezas ?? ""}
              onChange={(e) =>
                tocar({ cabezas: e.target.value === "" ? null : Number(e.target.value) })
              }
              className="campo"
              style={{ fontSize: 16 }}
            />
          </Editable>
          <Editable rotulo="Camiones">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={reporte.camiones ?? ""}
              onChange={(e) =>
                tocar({ camiones: e.target.value === "" ? null : Number(e.target.value) })
              }
              className="campo"
              style={{ fontSize: 16 }}
            />
          </Editable>
          <Editable rotulo="Observaciones">
            <textarea
              rows={3}
              value={reporte.observaciones ?? ""}
              onChange={(e) => tocar({ observaciones: e.target.value || null })}
              className="campo"
              style={{ fontSize: 16, resize: "vertical" }}
            />
          </Editable>
        </>
      ) : (
        <div style={{ marginTop: 22 }}>
          <Plano rotulo="Fecha" valor={reporte.fecha} />
          <Plano rotulo="Plaza" valor={reporte.plaza} />
          <Plano
            rotulo="Cabezas aproximadas"
            valor={reporte.cabezas === null ? null : String(reporte.cabezas)}
          />
          <Plano
            rotulo="Camiones"
            valor={reporte.camiones === null ? null : String(reporte.camiones)}
          />
          <Plano rotulo="Observaciones" valor={reporte.observaciones} />
        </div>
      )}

      <div style={{ marginTop: 30 }}>
        <div className="seccion" style={{ marginBottom: 10 }}>
          Remitos — {reporte.adjuntos.length}
        </div>
        {reporte.adjuntos.length === 0 && (
          <p
            style={{
              font: "400 14px var(--font-plex-sans), sans-serif",
              color: "var(--tinta-suave)",
            }}
          >
            Este reporte no trae fotos.
          </p>
        )}
        {reporte.adjuntos.map((a, i) => (
          <div
            key={a.id}
            style={{
              marginBottom: 12,
              background: "var(--papel-alto)",
              border: "1px solid var(--borde)",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            {a.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.url}
                alt={`Remito ${i + 1}`}
                style={{ width: "100%", display: "block" }}
              />
            ) : (
              <div
                style={{
                  padding: "22px 14px",
                  font: "400 13px var(--font-plex-sans), sans-serif",
                  color: "var(--tinta-suave)",
                }}
              >
                La foto no se pudo mostrar ahora. Sigue guardada.
              </div>
            )}
            <div style={{ padding: 12 }}>
              {editable ? (
                <>
                  <input
                    value={a.numero ?? ""}
                    onChange={(e) =>
                      tocar({
                        adjuntos: reporte.adjuntos.map((x) =>
                          x.id === a.id ? { ...x, numero: e.target.value || null } : x
                        ),
                      })
                    }
                    placeholder="número — si no, lo pone la oficina"
                    className="campo"
                    style={{ fontSize: 16, fontFamily: "var(--font-plex-mono), monospace" }}
                  />
                  <input
                    value={a.nota ?? ""}
                    onChange={(e) =>
                      tocar({
                        adjuntos: reporte.adjuntos.map((x) =>
                          x.id === a.id ? { ...x, nota: e.target.value || null } : x
                        ),
                      })
                    }
                    placeholder="nota de esta foto"
                    className="campo"
                    style={{ fontSize: 16, marginTop: 8 }}
                  />
                </>
              ) : (
                <>
                  <Plano rotulo="Número" valor={a.numero} />
                  <Plano rotulo="Nota" valor={a.nota} />
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {errores.length > 0 && (
        <div
          role="alert"
          style={{
            marginTop: 20,
            padding: "11px 13px",
            background: "var(--aviso-claro)",
            border: "1px solid var(--aviso-borde)",
            borderLeft: "4px solid var(--aviso)",
            borderRadius: 2,
            font: "400 14px/1.5 var(--font-plex-sans), sans-serif",
          }}
        >
          {errores.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}

      {guardado && (
        <div
          role="status"
          style={{
            marginTop: 20,
            padding: "11px 13px",
            background: "var(--verde-claro)",
            border: "1px solid var(--verde-borde)",
            borderLeft: "4px solid var(--verde)",
            borderRadius: 2,
            font: "400 14px/1.5 var(--font-plex-sans), sans-serif",
          }}
        >
          Corrección guardada.
        </div>
      )}

      {editable && (
        <button
          type="button"
          onClick={guardar}
          disabled={pendiente}
          style={{
            width: "100%",
            marginTop: 22,
            padding: "15px 20px",
            font: "600 16px var(--font-plex-sans), sans-serif",
            color: "var(--papel)",
            background: "var(--verde)",
            border: "1px solid var(--verde-hondo)",
            borderRadius: 3,
            cursor: pendiente ? "progress" : "pointer",
          }}
        >
          {pendiente ? "Guardando…" : "Guardar la corrección"}
        </button>
      )}

      <div style={{ marginTop: 18, textAlign: "center" }}>
        <Link href="/reportes" style={{ font: "400 15px var(--font-plex-sans), sans-serif" }}>
          Volver a mis reportes
        </Link>
      </div>
    </div>
  );
}

/** La banda de estado. Dice qué es y, cuando está congelado, POR QUÉ. */
function Banda({ reporte }: { reporte: Reporte }) {
  if (reporte.estado === "PENDIENTE") {
    return (
      <Caja color="var(--verde)" fondo="var(--verde-claro)" borde="var(--verde-borde)">
        <strong>Enviado, todavía sin procesar.</strong> Lo podés corregir hasta
        que la oficina lo tome.
      </Caja>
    );
  }
  if (reporte.estado === "PROCESADO") {
    return (
      <Caja color="var(--rol-empresa)" fondo="#e8eef2" borde="#cbdae3">
        <strong>Procesado — quedó congelado.</strong> La oficina ya armó
        {reporte.compras === 1 ? " una compra" : ` ${reporte.compras} compras`} con
        este reporte. Es lo que viste en la feria y así se guarda: si algo está
        mal, avisale a la oficina, que corrige la compra.
      </Caja>
    );
  }
  return (
    <Caja color="var(--aviso-hondo)" fondo="var(--aviso-claro)" borde="var(--aviso-borde)">
      <strong>Descartado por la oficina.</strong> Ya no se edita. Queda guardado
      como evidencia de lo que informaste.
    </Caja>
  );
}

function Caja({
  color,
  fondo,
  borde,
  children,
}: {
  color: string;
  fondo: string;
  borde: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "11px 13px",
        background: fondo,
        border: `1px solid ${borde}`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 2,
        font: "400 14px/1.5 var(--font-plex-sans), sans-serif",
        color: "var(--tinta-media)",
      }}
    >
      {children}
    </div>
  );
}

function Editable({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ marginBottom: 6, font: "500 14px var(--font-plex-sans), sans-serif" }}>
        {rotulo}
      </div>
      {children}
    </div>
  );
}

function Plano({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "6px 0" }}>
      <span
        style={{
          minWidth: 132,
          font: "400 13px var(--font-plex-sans), sans-serif",
          color: "var(--tinta-suave)",
        }}
      >
        {rotulo}
      </span>
      {valor ? (
        <span style={{ font: "400 15px var(--font-plex-sans), sans-serif" }}>{valor}</span>
      ) : (
        <span className="sd">s/d</span>
      )}
    </div>
  );
}
