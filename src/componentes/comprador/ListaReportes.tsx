"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { suscribir } from "@/lib/dispositivo/cola";
import { listarBorradores, listarCola } from "@/lib/dispositivo/db";
import type { ReporteEnPantalla } from "@/lib/dispositivo/tipos";

/**
 * Los reportes propios, mezclando las DOS fuentes.
 *
 * Los borradores y los que esperan señal salen del dispositivo; los enviados y
 * los procesados, del servidor. No es una complicación gratuita: un reporte
 * esperando señal TODAVÍA NO EXISTE del lado del servidor, así que si esta
 * lista mostrara solo lo que devuelve la API, lo cargado en la feria
 * desaparecería de la pantalla justo cuando la persona necesita ver que está.
 *
 * Y por eso la lista funciona sin red: lo del dispositivo se ve siempre.
 */
export function ListaReportes() {
  const [locales, setLocales] = useState<ReporteEnPantalla[]>([]);
  const [servidor, setServidor] = useState<ReporteEnPantalla[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinRed, setSinRed] = useState(false);

  const leerLocales = useCallback(async () => {
    try {
      const [borradores, cola] = await Promise.all([listarBorradores(), listarCola()]);
      const deBorradores: ReporteEnPantalla[] = borradores.map((b) => ({
        origen: "dispositivo",
        clave: b.clave,
        id: null,
        estado: "borrador",
        fecha: b.fecha,
        consignatario: b.consignatarioTexto,
        plaza: b.plazaTexto,
        cabezas: b.cabezasAproximadas,
        remitos: b.remitos.length,
        cuando: b.actualizadoEn,
      }));
      const deCola: ReporteEnPantalla[] = cola.map((e) => ({
        origen: "dispositivo",
        clave: e.clave,
        id: null,
        estado: "esperando",
        fecha: e.reporte.fecha,
        consignatario: e.reporte.consignatarioTexto,
        plaza: e.reporte.plazaTexto,
        cabezas: e.reporte.cabezasAproximadas,
        remitos: e.reporte.remitos.length,
        cuando: e.encoladoEn,
      }));
      setLocales([...deCola, ...deBorradores]);
    } catch {
      setLocales([]);
    }
  }, []);

  useEffect(() => {
    void leerLocales();
    // La cola avisa cuando algo sale: sin esto, un reporte que ya llegó
    // seguiría figurando como «esperando señal» hasta recargar.
    const cortar = suscribir(() => void leerLocales());
    return cortar;
  }, [leerLocales]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/reportes/mios", { cache: "no-store" });
        if (res.status === 401) {
          window.location.href = "/ingresar?volver=/reportes";
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const datos = (await res.json()) as {
          reportes: {
            id: number;
            estado: ReporteEnPantalla["estado"];
            fecha: string | null;
            consignatario: string | null;
            plaza: string | null;
            cabezas: number | null;
            remitos: number;
            cargadoEn: string;
          }[];
        };
        if (!vivo) return;
        setServidor(
          datos.reportes.map((r) => ({
            origen: "servidor",
            clave: null,
            id: r.id,
            estado: r.estado,
            fecha: r.fecha,
            consignatario: r.consignatario,
            plaza: r.plaza,
            cabezas: r.cabezas,
            remitos: r.remitos,
            cuando: r.cargadoEn,
          }))
        );
      } catch {
        // Sin red no es un error de la persona: los del dispositivo se ven
        // igual, y se dice que falta lo demás.
        if (vivo) setSinRed(true);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const todos = [...locales, ...servidor];

  return (
    <div style={{ paddingTop: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1
          style={{
            margin: 0,
            font: "600 24px/1.15 var(--font-plex-sans), sans-serif",
            letterSpacing: "-.015em",
          }}
        >
          Mis reportes
        </h1>
        {/* Todo agregado con su cobertura al lado. Acá la cobertura es de qué
            fuente salió cada cosa, que es justo lo que hay que poder distinguir. */}
        {!cargando && (
          <span
            style={{
              font: "400 12px var(--font-plex-mono), monospace",
              color: "var(--tinta-suave)",
            }}
          >
            {todos.length} — {locales.length} en el teléfono
          </span>
        )}
      </div>

      {sinRed && (
        <p
          style={{
            marginTop: 14,
            padding: "10px 12px",
            background: "#fdf6e7",
            border: "1px solid #e6d4a8",
            borderRadius: 2,
            font: "400 13px/1.5 var(--font-plex-sans), sans-serif",
            color: "#6b5518",
          }}
        >
          Sin señal: se ve lo que está en el teléfono. Los ya enviados aparecen
          cuando vuelva la conexión.
        </p>
      )}

      {cargando && todos.length === 0 && (
        <p style={{ marginTop: 26, color: "var(--tinta-suave)" }}>Buscando…</p>
      )}

      {!cargando && todos.length === 0 && <Vacio />}

      <div style={{ marginTop: 18 }}>
        {todos.map((r) => (
          <Fila key={r.clave ?? `s-${r.id}`} reporte={r} />
        ))}
      </div>
    </div>
  );
}

const SELLOS: Record<
  ReporteEnPantalla["estado"],
  { texto: string; color: string; fondo: string; borde: string }
> = {
  borrador: {
    texto: "Borrador",
    color: "var(--tinta-suave)",
    fondo: "var(--papel-hondo)",
    borde: "var(--borde-firme)",
  },
  // Ámbar, nunca rojo: esperar señal en la feria es lo normal.
  esperando: {
    texto: "Esperando señal",
    color: "#8a6a12",
    fondo: "#fdf6e7",
    borde: "#e6d4a8",
  },
  PENDIENTE: {
    texto: "Enviado",
    color: "var(--verde)",
    fondo: "var(--verde-claro)",
    borde: "var(--verde-borde)",
  },
  PROCESADO: {
    texto: "Procesado",
    color: "var(--rol-empresa)",
    fondo: "#e8eef2",
    borde: "#cbdae3",
  },
  DESCARTADO: {
    texto: "Descartado",
    color: "var(--aviso-hondo)",
    fondo: "var(--aviso-claro)",
    borde: "var(--aviso-borde)",
  },
};

function Fila({ reporte }: { reporte: ReporteEnPantalla }) {
  const sello = SELLOS[reporte.estado];
  const contenido = (
    <div
      style={{
        padding: "14px 15px",
        marginBottom: 9,
        background: "var(--papel-alto)",
        border: "1px solid var(--borde)",
        borderLeft: `3px solid ${sello.borde}`,
        borderRadius: 3,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            font: "500 11px/1 var(--font-plex-mono), monospace",
            letterSpacing: ".06em",
            padding: "4px 7px",
            borderRadius: 2,
            color: sello.color,
            background: sello.fondo,
            border: `1px solid ${sello.borde}`,
          }}
        >
          {sello.texto}
        </span>
        <span
          style={{
            marginLeft: "auto",
            font: "400 12px var(--font-plex-mono), monospace",
            color: "var(--tinta-tenue)",
          }}
        >
          {reporte.fecha ?? "s/d"}
        </span>
      </div>

      <div
        style={{
          marginTop: 8,
          font: "500 16px/1.3 var(--font-plex-sans), sans-serif",
          color: reporte.consignatario ? "var(--tinta)" : "var(--tinta-tenue)",
        }}
      >
        {reporte.consignatario ?? "Sin consignatario"}
      </div>

      <div
        style={{
          marginTop: 3,
          font: "400 13px/1.4 var(--font-plex-sans), sans-serif",
          color: "var(--tinta-suave)",
        }}
      >
        {/* Plaza y cantidad de remitos: dos ferias del mismo día del mismo
            consignatario pasan, y «sin fotos» avisa de un reporte flojo. */}
        {reporte.plaza ?? "plaza s/d"} ·{" "}
        {reporte.cabezas === null ? "cabezas s/d" : `${reporte.cabezas} cabezas`} ·{" "}
        {reporte.remitos === 0 ? "sin fotos" : `${reporte.remitos} remitos`}
      </div>
    </div>
  );

  // Un borrador o uno esperando señal no tienen id del servidor: no hay adónde
  // ir. El borrador se retoma desde «Cargar».
  if (reporte.origen === "dispositivo") {
    return reporte.estado === "borrador" ? (
      <Link href="/reportar" style={{ textDecoration: "none", color: "inherit" }}>
        {contenido}
      </Link>
    ) : (
      contenido
    );
  }

  return (
    <Link
      href={`/reportes/${reporte.id}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      {contenido}
    </Link>
  );
}

function Vacio() {
  return (
    <div style={{ marginTop: 40 }}>
      <div className="rotulo" style={{ color: "var(--tinta-fantasma)" }}>
        Todavía no mandaste ninguno
      </div>
      <h2
        style={{
          margin: "14px 0 0",
          font: "600 22px/1.25 var(--font-plex-sans), sans-serif",
        }}
      >
        Acá van a aparecer los reportes que cargues en la feria.
      </h2>
      <p
        style={{
          margin: "12px 0 22px",
          font: "400 15px/1.55 var(--font-plex-sans), sans-serif",
          color: "var(--tinta-media)",
        }}
      >
        Vas a poder ver cuáles están esperando señal y cuáles ya tomó la oficina.
      </p>
      <Link
        href="/reportar"
        style={{
          display: "inline-block",
          padding: "13px 22px",
          font: "500 16px var(--font-plex-sans), sans-serif",
          color: "var(--papel)",
          background: "var(--verde)",
          border: "1px solid var(--verde-hondo)",
          borderRadius: 3,
          textDecoration: "none",
        }}
      >
        Cargar el primero
      </Link>
    </div>
  );
}
