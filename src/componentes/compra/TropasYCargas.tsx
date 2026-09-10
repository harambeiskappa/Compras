"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  borrarCarga,
  borrarTropa,
  crearCarga,
  crearTropa,
} from "@/lib/acciones-compra";

/**
 * Tropas y camiones.
 *
 * La TROPA dice a qué empresa nuestra le quedan las cabezas; la CARGA es un
 * camión, con su DTE. Son dos hechos distintos y por eso son dos listas: una
 * tropa puede salir en varios camiones, y un camión puede cargarse antes de
 * saber a qué tropa va —por eso la tropa del camión es opcional—.
 */

export type TropaEnPantalla = {
  id: number;
  empresa: string;
  nroTropa: string | null;
  fecha: string | null;
  lotes: number;
  cargas: number;
};

export type CargaEnPantalla = {
  id: number;
  tropaId: number | null;
  dte: string | null;
  transportista: string | null;
  patente: string | null;
  fechaSalida: string | null;
  cabezas: number | null;
};

export function TropasYCargas({
  compraId,
  tropas,
  cargas,
  empresas,
}: {
  compraId: number;
  tropas: TropaEnPantalla[];
  cargas: CargaEnPantalla[];
  empresas: { id: number; nombre: string }[];
}) {
  const [errores, setErrores] = useState<string[]>([]);

  return (
    <section style={{ marginTop: 40 }}>
      {errores.length > 0 && (
        <div
          role="alert"
          style={{
            marginBottom: 14,
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

      <div style={{ display: "grid", gap: 28, gridTemplateColumns: "1fr 1fr" }}>
        <Tropas compraId={compraId} tropas={tropas} empresas={empresas} avisar={setErrores} />
        <Cargas compraId={compraId} cargas={cargas} tropas={tropas} avisar={setErrores} />
      </div>
    </section>
  );
}

function Tropas({
  compraId,
  tropas,
  empresas,
  avisar,
}: {
  compraId: number;
  tropas: TropaEnPantalla[];
  empresas: { id: number; nombre: string }[];
  avisar: (e: string[]) => void;
}) {
  const router = useRouter();
  const [abriendo, setAbriendo] = useState(false);
  const [empresaId, setEmpresaId] = useState(String(empresas[0]?.id ?? ""));
  const [nro, setNro] = useState("");
  const [fecha, setFecha] = useState("");
  const [pendiente, arrancar] = useTransition();

  function agregar() {
    avisar([]);
    arrancar(async () => {
      const r = await crearTropa(compraId, Number(empresaId), nro || null, fecha || null);
      if (!r.ok) avisar(r.errores);
      else {
        setAbriendo(false);
        setNro("");
        setFecha("");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <h2 className="seccion" style={{ margin: 0 }}>
        Tropas — {tropas.length}
      </h2>
      <div style={ayuda}>
        A qué empresa nuestra le quedan las cabezas. Lo normal es una sola.
      </div>

      {tropas.map((t) => (
        <div key={t.id} style={fila}>
          <span style={{ font: "500 14px var(--font-plex-sans), sans-serif" }}>{t.empresa}</span>
          <span style={{ font: "400 12px var(--font-plex-mono), monospace", color: "var(--tinta-suave)" }}>
            {t.nroTropa ? `nº ${t.nroTropa}` : "nº s/d"} · {t.fecha ?? "fecha s/d"}
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ font: "400 12px var(--font-plex-mono), monospace", color: "var(--tinta-tenue)" }}>
            {t.lotes} renglón(es) · {t.cargas} camión(es)
          </span>
          <button
            type="button"
            onClick={() => {
              avisar([]);
              arrancar(async () => {
                const r = await borrarTropa(t.id);
                if (!r.ok) avisar(r.errores);
                else router.refresh();
              });
            }}
            disabled={pendiente}
            style={{ ...botonTexto, color: "var(--aviso-hondo)" }}
          >
            Borrar
          </button>
        </div>
      ))}

      {abriendo ? (
        <div style={caja}>
          <div style={{ display: "grid", gap: 10 }}>
            <select
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
              className="campo"
            >
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
            <input
              value={nro}
              onChange={(e) => setNro(e.target.value)}
              placeholder="número de tropa (s/d si no está)"
              className="campo"
            />
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="campo"
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={agregar} disabled={pendiente} style={botonPrincipal}>
                {pendiente ? "Agregando…" : "Agregar"}
              </button>
              <button type="button" onClick={() => setAbriendo(false)} style={botonSecundario}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAbriendo(true)} style={{ ...botonSecundario, marginTop: 10 }}>
          ＋ Agregar tropa
        </button>
      )}
    </div>
  );
}

function Cargas({
  compraId,
  cargas,
  tropas,
  avisar,
}: {
  compraId: number;
  cargas: CargaEnPantalla[];
  tropas: TropaEnPantalla[];
  avisar: (e: string[]) => void;
}) {
  const router = useRouter();
  const [abriendo, setAbriendo] = useState(false);
  const [dte, setDte] = useState("");
  const [transportista, setTransportista] = useState("");
  const [patente, setPatente] = useState("");
  const [cabezas, setCabezas] = useState("");
  const [tropaId, setTropaId] = useState("");
  const [pendiente, arrancar] = useTransition();

  function agregar() {
    avisar([]);
    arrancar(async () => {
      const r = await crearCarga(compraId, {
        tropaId: tropaId === "" ? null : Number(tropaId),
        dte: dte || null,
        transportista: transportista || null,
        patente: patente || null,
        fechaSalida: null,
        cabezas: cabezas.trim() === "" ? null : Number(cabezas),
      });
      if (!r.ok) avisar(r.errores);
      else {
        setAbriendo(false);
        setDte("");
        setTransportista("");
        setPatente("");
        setCabezas("");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <h2 className="seccion" style={{ margin: 0 }}>
        Camiones — {cargas.length}
      </h2>
      <div style={ayuda}>
        Cada camión con su DTE. La tropa puede no saberse todavía, y eso es s/d.
      </div>

      {cargas.map((c) => (
        <div key={c.id} style={fila}>
          <span style={{ font: "500 14px var(--font-plex-mono), monospace" }}>
            {c.dte ?? "DTE s/d"}
          </span>
          <span style={{ font: "400 12px var(--font-plex-sans), sans-serif", color: "var(--tinta-suave)" }}>
            {c.transportista ?? "transportista s/d"}
            {c.patente ? ` · ${c.patente}` : ""}
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ font: "400 12px var(--font-plex-mono), monospace", color: "var(--tinta-tenue)" }}>
            {c.cabezas === null ? "cabezas s/d" : `${c.cabezas} cab.`}
          </span>
          <button
            type="button"
            onClick={() => {
              avisar([]);
              arrancar(async () => {
                const r = await borrarCarga(c.id);
                if (!r.ok) avisar(r.errores);
                else router.refresh();
              });
            }}
            disabled={pendiente}
            style={{ ...botonTexto, color: "var(--aviso-hondo)" }}
          >
            Borrar
          </button>
        </div>
      ))}

      {abriendo ? (
        <div style={caja}>
          <div style={{ display: "grid", gap: 10 }}>
            <input value={dte} onChange={(e) => setDte(e.target.value)} placeholder="DTE" className="campo" />
            <input
              value={transportista}
              onChange={(e) => setTransportista(e.target.value)}
              placeholder="transportista"
              className="campo"
            />
            <input
              value={patente}
              onChange={(e) => setPatente(e.target.value)}
              placeholder="patente"
              className="campo"
            />
            <input
              value={cabezas}
              onChange={(e) => setCabezas(e.target.value)}
              inputMode="numeric"
              placeholder="cabezas que declara el DTE (s/d si no está)"
              className="campo"
            />
            {tropas.length > 0 && (
              <select value={tropaId} onChange={(e) => setTropaId(e.target.value)} className="campo">
                <option value="">tropa s/d</option>
                {tropas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.empresa} {t.nroTropa ? `· ${t.nroTropa}` : ""}
                  </option>
                ))}
              </select>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={agregar} disabled={pendiente} style={botonPrincipal}>
                {pendiente ? "Agregando…" : "Agregar"}
              </button>
              <button type="button" onClick={() => setAbriendo(false)} style={botonSecundario}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAbriendo(true)} style={{ ...botonSecundario, marginTop: 10 }}>
          ＋ Agregar camión
        </button>
      )}
    </div>
  );
}

const ayuda: React.CSSProperties = {
  margin: "4px 0 12px",
  font: "400 13px/1.5 var(--font-plex-sans), sans-serif",
  color: "var(--tinta-suave)",
};

const fila: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  padding: "10px 12px",
  marginBottom: 7,
  background: "var(--papel-alto)",
  border: "1px solid var(--borde)",
  borderRadius: 2,
};

const caja: React.CSSProperties = {
  marginTop: 10,
  padding: 12,
  background: "var(--papel-medio)",
  border: "1px solid var(--borde)",
  borderRadius: 2,
};

const botonPrincipal: React.CSSProperties = {
  padding: "9px 16px",
  font: "500 14px var(--font-plex-sans), sans-serif",
  color: "var(--papel)",
  background: "var(--verde)",
  border: "1px solid var(--verde-hondo)",
  borderRadius: 2,
  cursor: "pointer",
};

const botonSecundario: React.CSSProperties = {
  padding: "9px 15px",
  font: "500 14px var(--font-plex-sans), sans-serif",
  color: "var(--tinta-media)",
  background: "transparent",
  border: "1px solid var(--borde-firme)",
  borderRadius: 2,
  cursor: "pointer",
};

const botonTexto: React.CSSProperties = {
  padding: "4px 6px",
  font: "400 13px var(--font-plex-sans), sans-serif",
  color: "var(--tinta-suave)",
  background: "transparent",
  border: 0,
  cursor: "pointer",
};
