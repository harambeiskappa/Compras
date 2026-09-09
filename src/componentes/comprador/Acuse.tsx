"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listarCola } from "@/lib/dispositivo/db";
import { suscribir } from "@/lib/dispositivo/cola";
import type { BorradorReporte } from "@/lib/dispositivo/tipos";

/**
 * El acuse de un envío que TODAVÍA NO OCURRIÓ.
 *
 * No se puede decir «enviado» si está en la cola —sería mentira, y una mentira
 * que se descubre cuando alguien busca el reporte y no está—. Tampoco se lo
 * puede dejar sin respuesta después de apretar el botón: el silencio es lo que
 * hace que la gente mande de nuevo.
 *
 * Por eso es una PANTALLA COMPLETA y no un cartelito: lo que hay que comunicar
 * —«podés apagar el teléfono o irte de la feria»— es la frase que permite
 * guardar el celular y seguir trabajando, y en un cartelito de tres segundos no
 * se lee.
 */
export function Acuse({
  reporte,
  alSeguir,
}: {
  reporte: BorradorReporte;
  alSeguir: () => void;
}) {
  const [llego, setLlego] = useState(false);

  useEffect(() => {
    let vivo = true;
    // «Llegó» no se supone: se comprueba mirando si la cola todavía lo tiene.
    // La cola solo saca una entrada cuando el servidor respondió que sí.
    const revisar = async () => {
      try {
        const cola = await listarCola();
        if (vivo && !cola.some((e) => e.clave === reporte.clave)) setLlego(true);
      } catch {
        /* sin IndexedDB no hay nada que revisar */
      }
    };
    void revisar();
    const cortar = suscribir(() => void revisar());
    return () => {
      vivo = false;
      cortar();
    };
  }, [reporte.clave]);

  return (
    <div style={{ paddingTop: 42 }}>
      <div
        aria-hidden
        style={{
          width: 46,
          height: 46,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: llego ? "var(--verde-claro)" : "#fdf6e7",
          border: `1px solid ${llego ? "var(--verde-borde)" : "#e6d4a8"}`,
          color: llego ? "var(--verde)" : "#8a6a12",
          font: "600 22px var(--font-plex-sans), sans-serif",
        }}
      >
        {llego ? "✓" : "·"}
      </div>

      <h1
        style={{
          margin: "18px 0 0",
          font: "600 26px/1.2 var(--font-plex-sans), sans-serif",
          letterSpacing: "-.015em",
        }}
      >
        {llego ? "Llegó a la oficina." : "Quedó guardado."}
      </h1>

      <p
        style={{
          margin: "12px 0 0",
          font: "400 16px/1.55 var(--font-plex-sans), sans-serif",
          color: "var(--tinta-media)",
        }}
      >
        {llego
          ? "La oficina ya lo tiene. Podés seguir con lo tuyo."
          : "Sale solo cuando haya señal. Podés apagar el teléfono o irte de la feria: no hace falta que dejes la app abierta."}
      </p>

      <div
        style={{
          marginTop: 26,
          padding: "14px 16px",
          background: "var(--papel-alto)",
          border: "1px solid var(--borde)",
          borderRadius: 3,
        }}
      >
        <div className="rotulo" style={{ marginBottom: 8 }}>
          Lo que mandaste
        </div>
        <Linea rotulo="Fecha" valor={reporte.fecha} />
        <Linea rotulo="Consignatario" valor={reporte.consignatarioTexto} />
        <Linea rotulo="Plaza" valor={reporte.plazaTexto} />
        <Linea
          rotulo="Cabezas"
          valor={reporte.cabezasAproximadas === null ? null : String(reporte.cabezasAproximadas)}
        />
        <Linea
          rotulo="Camiones"
          valor={reporte.cantidadCamiones === null ? null : String(reporte.cantidadCamiones)}
        />
        <Linea
          rotulo="Remitos"
          valor={
            reporte.remitos.length
              ? `${reporte.remitos.length} ${reporte.remitos.length === 1 ? "foto" : "fotos"}`
              : null
          }
        />
      </div>

      <button
        type="button"
        onClick={alSeguir}
        style={{
          width: "100%",
          marginTop: 24,
          padding: "16px 20px",
          font: "600 17px var(--font-plex-sans), sans-serif",
          color: "var(--papel)",
          background: "var(--verde)",
          border: "1px solid var(--verde-hondo)",
          borderRadius: 3,
          cursor: "pointer",
        }}
      >
        Cargar otro
      </button>

      <div style={{ marginTop: 16, textAlign: "center" }}>
        <Link
          href="/reportes"
          style={{ font: "400 15px var(--font-plex-sans), sans-serif" }}
        >
          Ver mis reportes
        </Link>
      </div>
    </div>
  );
}

function Linea({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "baseline",
        padding: "5px 0",
        font: "400 14px/1.4 var(--font-plex-sans), sans-serif",
      }}
    >
      <span style={{ color: "var(--tinta-suave)", minWidth: 108 }}>{rotulo}</span>
      {/* Sin dato es «s/d», con su sello. Nunca un renglón en blanco: un blanco
          se lee como que la pantalla se olvidó de algo. */}
      {valor ? <span>{valor}</span> : <span className="sd">s/d</span>}
    </div>
  );
}
