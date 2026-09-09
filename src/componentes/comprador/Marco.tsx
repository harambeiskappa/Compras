"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { suscribir, vaciar, type EstadoCola } from "@/lib/dispositivo/cola";

/**
 * El marco de las pantallas del comprador: aviso de cola arriba, dos pestañas
 * abajo.
 *
 * EL ESTADO DE LA COLA ES CONTENIDO, NO UN DETALLE DE IMPLEMENTACIÓN. Si el
 * comprador no puede distinguir «lo mandé» de «está esperando señal», va a
 * mandar de nuevo — o peor, va a creer que mandó algo que no salió. Por eso el
 * aviso está arriba en TODAS las pantallas y no solo en la lista: en
 * `/reportar` no habría dónde verlo.
 *
 * Las dos pestañas van abajo porque es donde llega el pulgar. La condición de
 * uso es un celular en la mano, a veces con una sola mano libre, en un remate.
 */
export function Marco({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AvisoCola />
      <main style={{ padding: "0 16px 96px", maxWidth: 560, margin: "0 auto" }}>
        {children}
      </main>
      <Pestanas />
    </>
  );
}

export function AvisoCola() {
  const [estado, setEstado] = useState<EstadoCola | null>(null);

  useEffect(() => suscribir(setEstado), []);

  if (!estado) return null;

  const sinRed = !estado.hayRed;
  const esperando = estado.esperando > 0;

  // Nada que decir: ni cola ni problema de red. Callarse es la respuesta
  // correcta — un cartel permanente de «todo bien» se vuelve invisible.
  if (!esperando && !sinRed && !estado.ultimoError) return null;

  if (estado.ultimoError && !esperando) {
    return (
      <Banda tono="aviso">
        <strong>No se pudo mandar.</strong> {estado.ultimoError}
      </Banda>
    );
  }

  if (esperando) {
    return (
      <Banda tono="espera">
        <Punto />
        <span>
          <strong>
            {estado.esperando === 1
              ? "Un reporte esperando señal."
              : `${estado.esperando} reportes esperando señal.`}
          </strong>{" "}
          {/* La razón va SIEMPRE. Es el estado normal en la feria, no un error:
              sin la explicación, ámbar se lee como que algo se rompió. */}
          Está guardado en el teléfono y sale solo en cuanto haya señal. Podés
          cerrar la app.
          {estado.enviando && " Mandando…"}
        </span>
        {estado.hayRed && !estado.enviando && (
          <button
            type="button"
            onClick={() => void vaciar()}
            style={{
              marginLeft: "auto",
              padding: "5px 10px",
              font: "500 12px var(--font-plex-sans), sans-serif",
              color: "var(--tinta-media)",
              background: "transparent",
              border: "1px solid var(--borde-firme)",
              borderRadius: 2,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Probar ahora
          </button>
        )}
      </Banda>
    );
  }

  return (
    <Banda tono="espera">
      <Punto />
      <span>Sin señal. Lo que cargues se guarda y sale solo cuando vuelva.</span>
    </Banda>
  );
}

function Banda({
  tono,
  children,
}: {
  tono: "espera" | "aviso";
  children: React.ReactNode;
}) {
  const espera = tono === "espera";
  return (
    <div
      role="status"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "flex-start",
        gap: 9,
        // ÁMBAR, NUNCA ROJO. Esperar señal en el campo es lo normal, y el rojo
        // le diría a alguien que algo se rompió justo cuando nada se rompió.
        padding: "10px 16px",
        background: espera ? "#fdf6e7" : "var(--aviso-claro)",
        borderBottom: `1px solid ${espera ? "#e6d4a8" : "var(--aviso-borde)"}`,
        font: "400 13px/1.45 var(--font-plex-sans), sans-serif",
        color: espera ? "#6b5518" : "var(--aviso-hondo)",
      }}
    >
      {children}
    </div>
  );
}

/** Late despacio. Un parpadeo rápido comunica urgencia, y acá no hay ninguna. */
function Punto() {
  return (
    <span
      aria-hidden
      style={{
        marginTop: 5,
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "#c98a12",
        flexShrink: 0,
        animation: "late 2.4s ease-in-out infinite",
      }}
    />
  );
}

function Pestanas() {
  const ruta = usePathname();
  const enLista = ruta.startsWith("/reportes");

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        background: "var(--papel-alto)",
        borderTop: "1px solid var(--borde-fuerte)",
        // El respiro de abajo es por la barra de gestos del teléfono: sin esto,
        // en un iPhone la pestaña queda debajo del indicador y no se toca.
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <Pestana href="/reportar" activa={!enLista} texto="Cargar" />
      <Pestana href="/reportes" activa={enLista} texto="Mis reportes" />
    </nav>
  );
}

function Pestana({
  href,
  activa,
  texto,
}: {
  href: string;
  activa: boolean;
  texto: string;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: "14px 8px",
        textAlign: "center",
        textDecoration: "none",
        font: `${activa ? 600 : 400} 15px var(--font-plex-sans), sans-serif`,
        color: activa ? "var(--verde)" : "var(--tinta-suave)",
        borderTop: `2px solid ${activa ? "var(--verde)" : "transparent"}`,
        marginTop: -1,
      }}
    >
      {texto}
    </Link>
  );
}
