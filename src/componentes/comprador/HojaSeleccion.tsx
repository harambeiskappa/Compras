"use client";

import { useMemo, useState } from "react";

import { normalizarLaxo, normalizarNombre } from "@/lib/normalizar";

/**
 * Hoja que sube desde abajo para elegir consignatario o plaza.
 *
 * Tres estados, los mismos del módulo 1: lo que hay, los casi-idénticos, y
 * crear el que falta. Con una corrección que salió de aquel módulo: **elegir un
 * existente le gana visualmente a crear uno nuevo mientras haya candidatos**.
 * Si alguien tipea el nombre con un punto de más y el botón de crear está
 * primero, crea el duplicado — y después es una persona la que tiene que
 * fusionarlos a mano.
 *
 * Sube desde abajo y no es un `<select>` porque hay que buscar entre 18 nombres
 * con una mano, y porque un desplegable nativo no puede ofrecer «crear éste».
 */

export type OpcionHoja = { nombre: string; detalle?: string };

export function HojaSeleccion({
  titulo,
  ayuda,
  opciones,
  valor,
  hayRed,
  puedeCrear,
  alElegir,
  alCerrar,
}: {
  titulo: string;
  ayuda: string;
  opciones: OpcionHoja[];
  valor: string | null;
  hayRed: boolean;
  /** La plaza es texto libre; el consignatario se crea explícitamente. */
  puedeCrear: boolean;
  alElegir: (nombre: string) => void;
  alCerrar: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");

  const q = busqueda.trim();
  const { filtradas, parecidas, hayExacto } = useMemo(() => {
    const estricto = normalizarNombre(q);
    const laxo = normalizarLaxo(q);

    const filtradas = q
      ? opciones.filter((o) => normalizarNombre(o.nombre).includes(estricto))
      : opciones;

    // Los parecidos NO salen de `filtradas`: esa lista ya pasó por el filtro
    // estricto, que es justo el que no encuentra al gemelo por puntuación. Es
    // el error que en el módulo 1 hizo que el aviso nunca apareciera.
    const parecidas =
      q.length > 1
        ? opciones.filter(
            (o) =>
              normalizarLaxo(o.nombre) === laxo &&
              !filtradas.some((f) => f.nombre === o.nombre)
          )
        : [];

    const hayExacto =
      q.length > 0 && opciones.some((o) => normalizarNombre(o.nombre) === estricto);

    return { filtradas, parecidas, hayExacto };
  }, [opciones, q]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        background: "rgb(23 21 15 / 0.34)",
      }}
      onClick={alCerrar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--papel)",
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          maxHeight: "86vh",
          display: "flex",
          flexDirection: "column",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--borde)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <h2 style={{ margin: 0, font: "600 17px var(--font-plex-sans), sans-serif" }}>
              {titulo}
            </h2>
            <button
              type="button"
              onClick={alCerrar}
              style={{
                marginLeft: "auto",
                padding: "6px 10px",
                background: "transparent",
                border: 0,
                font: "400 15px var(--font-plex-sans), sans-serif",
                color: "var(--tinta-suave)",
                cursor: "pointer",
              }}
            >
              Cerrar
            </button>
          </div>
          <p
            style={{
              margin: "4px 0 12px",
              font: "400 13px/1.45 var(--font-plex-sans), sans-serif",
              color: "var(--tinta-suave)",
            }}
          >
            {ayuda}
          </p>
          <input
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar o escribir"
            className="campo"
            style={{ fontSize: 16 }}
          />
        </div>

        <div style={{ overflowY: "auto", padding: "8px 0 12px" }}>
          {parecidas.length > 0 && (
            <div style={{ padding: "8px 16px" }}>
              <div className="rotulo" style={{ color: "#8a6a12" }}>
                Puede ser uno de éstos
              </div>
              {parecidas.map((o) => (
                <Fila key={o.nombre} opcion={o} elegido={false} alElegir={alElegir} />
              ))}
            </div>
          )}

          {filtradas.map((o) => (
            <Fila
              key={o.nombre}
              opcion={o}
              elegido={valor === o.nombre}
              alElegir={alElegir}
            />
          ))}

          {filtradas.length === 0 && parecidas.length === 0 && q === "" && (
            <p
              style={{
                padding: "14px 16px",
                margin: 0,
                font: "400 14px/1.5 var(--font-plex-sans), sans-serif",
                color: "var(--tinta-suave)",
              }}
            >
              Todavía no hay ninguno guardado en el teléfono. Escribí el nombre y
              seguí: se guarda tal como lo escribas.
            </p>
          )}

          {/* Crear va ÚLTIMO y con menos peso que la lista. Solo aparece cuando
              no hay coincidencia exacta: ofrecer «crear» junto a un nombre que
              ya existe es ofrecer un duplicado. */}
          {puedeCrear && q.length > 0 && !hayExacto && (
            <div style={{ padding: "10px 16px 0" }}>
              <button
                type="button"
                onClick={() => alElegir(q)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "13px 14px",
                  background: "var(--papel-alto)",
                  border: "1px dashed var(--borde-firme)",
                  borderRadius: 3,
                  font: "400 15px var(--font-plex-sans), sans-serif",
                  color: "var(--tinta-media)",
                  cursor: "pointer",
                }}
              >
                Usar «<strong>{q}</strong>», que no está en la lista
              </button>
            </div>
          )}

          {/* §1.10: sin señal la entidad no existe todavía del otro lado, así
              que lo que se guarda es el nombre. Decirlo saca la duda de si
              «se va a perder». */}
          {!hayRed && (
            <p
              style={{
                margin: "12px 16px 0",
                font: "400 12px/1.5 var(--font-plex-sans), sans-serif",
                color: "var(--tinta-suave)",
              }}
            >
              Sin señal: se guarda el nombre tal como lo escribiste, y la oficina
              lo reconoce al llegar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Fila({
  opcion,
  elegido,
  alElegir,
}: {
  opcion: OpcionHoja;
  elegido: boolean;
  alElegir: (n: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => alElegir(opcion.nombre)}
      style={{
        display: "flex",
        width: "100%",
        alignItems: "baseline",
        gap: 10,
        textAlign: "left",
        // 48 px de alto mínimo: es un dedo, no un mouse.
        padding: "13px 16px",
        background: elegido ? "var(--verde-claro)" : "transparent",
        border: 0,
        borderBottom: "1px solid var(--borde)",
        font: "400 16px var(--font-plex-sans), sans-serif",
        color: "var(--tinta)",
        cursor: "pointer",
      }}
    >
      <span style={{ fontWeight: elegido ? 600 : 400 }}>{opcion.nombre}</span>
      {opcion.detalle && (
        <span
          style={{
            marginLeft: "auto",
            font: "400 12px var(--font-plex-mono), monospace",
            color: "var(--tinta-tenue)",
          }}
        >
          {opcion.detalle}
        </span>
      )}
    </button>
  );
}
