"use client";

import { useEffect, useRef, useState } from "react";

import type { RolEntidad } from "@/generated/prisma/enums";
import { buscarEntidades, crearEntidad, type EstadoCombo } from "@/lib/acciones";
import type { OpcionEntidad } from "@/lib/entidades";

export type Elegida = { id: number; nombre: string } | null;

type Props = {
  rol: RolEntidad;
  valor: Elegida;
  onElegir: (e: Elegida) => void;
  placeholder: string;
  /** Nota que se muestra dentro del desplegable, arriba de la lista. */
  nota?: string;
  autoFocus?: boolean;
};

const VACIO: EstadoCombo = {
  opciones: [],
  otras: [],
  parecidos: [],
  hayExacto: false,
  sePuedeCrear: true,
};

export function SelectorEntidad({
  rol,
  valor,
  onElegir,
  placeholder,
  nota,
  autoFocus,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoCombo>(VACIO);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic afuera.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  // Buscar con un respiro, para no disparar una consulta por tecla.
  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    const t = setTimeout(() => {
      buscarEntidades(rol, busqueda).then((r) => {
        if (vivo) setEstado(r);
      });
    }, 140);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [abierto, busqueda, rol]);

  const q = busqueda.trim();

  // Los tres estados de creación, tal como los define el diseño.
  const puedeCrear = estado.sePuedeCrear && q.length > 1 && !estado.hayExacto && !creando;
  const hayParecido = estado.parecidos.length > 0;
  const hayCandidatos = estado.opciones.length > 0 || estado.otras.length > 0;
  const crearPrimario = puedeCrear && !hayParecido && !hayCandidatos;
  const crearSecundario = puedeCrear && (hayParecido || hayCandidatos);

  function elegir(o: OpcionEntidad) {
    onElegir({ id: o.id, nombre: o.nombre });
    setAbierto(false);
    setBusqueda("");
    setError(null);
  }

  async function confirmarCreacion() {
    setCreando(true);
    setError(null);
    const r = await crearEntidad(q, rol);
    setCreando(false);
    if (!r.ok) {
      setError(r.errores.join(" "));
      return;
    }
    onElegir({ id: r.id, nombre: r.nombre });
    setAbierto(false);
    setBusqueda("");
  }

  return (
    <div ref={caja} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => {
          setAbierto((a) => !a);
          setEstado(VACIO);
          setBusqueda("");
        }}
        className="campo"
        style={{
          textAlign: "left",
          cursor: "pointer",
          color: valor ? "var(--tinta)" : "var(--tinta-fantasma)",
        }}
      >
        {valor ? valor.nombre : placeholder}
      </button>

      {abierto && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 30,
            marginTop: 4,
            background: "var(--papel-alto)",
            border: "1px solid var(--borde-firme)",
            borderRadius: 2,
            boxShadow: "0 14px 30px rgb(23 21 15 / .14)",
          }}
        >
          <div style={{ padding: "9px 10px", borderBottom: "1px solid #e4dfd1" }}>
            <input
              autoFocus={autoFocus !== false}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={
                estado.sePuedeCrear ? "Escribir para buscar o crear" : "Escribir para buscar"
              }
              className="campo"
              style={{ padding: "8px 10px" }}
            />
            {nota && (
              <div
                style={{
                  marginTop: 8,
                  font: "400 12px/1.4 var(--font-plex-sans), sans-serif",
                  color: "var(--tinta-tenue)",
                }}
              >
                {nota}
              </div>
            )}
          </div>

          <div style={{ maxHeight: 250, overflow: "auto" }}>
            {estado.opciones.map((o) => (
              <Fila key={o.id} o={o} onClick={() => elegir(o)} />
            ))}

            {estado.otras.length > 0 && (
              <>
                {/*
                  La separación tiene que VERSE. Con 191 entidades en una sola
                  tabla, mezclar los 173 vendedores con los 11 hoteleros haría
                  este selector inservible.
                */}
                <div
                  style={{
                    padding: "8px 12px",
                    background: "var(--papel-medio)",
                    borderTop: "1px solid var(--borde)",
                    borderBottom: "1px solid var(--borde)",
                    font: "400 12px/1.4 var(--font-plex-sans), sans-serif",
                    color: "var(--tinta-tenue)",
                  }}
                >
                  Estas están en el padrón pero todavía no en este papel. Si elegís
                  una, se lo agrega.
                </div>
                {estado.otras.map((o) => (
                  <Fila key={o.id} o={o} onClick={() => elegir(o)} />
                ))}
              </>
            )}

            {!hayCandidatos && q.length > 0 && !crearPrimario && (
              <div
                style={{
                  padding: 12,
                  font: "400 13px/1.45 var(--font-plex-sans), sans-serif",
                  color: "var(--tinta-tenue)",
                }}
              >
                Ninguna coincide con «{q}».
              </div>
            )}
            {!hayCandidatos && q.length === 0 && (
              <div
                style={{
                  padding: 12,
                  font: "400 13px/1.45 var(--font-plex-sans), sans-serif",
                  color: "var(--tinta-tenue)",
                }}
              >
                Todavía no hay ninguna cargada con este papel.
              </div>
            )}
          </div>

          {/* Estado 1: hay un casi-idéntico. Va arriba y es lo más grande. */}
          {hayParecido && (
            <div
              style={{
                padding: 12,
                background: "var(--aviso-claro)",
                borderTop: "1px solid var(--aviso-borde)",
              }}
            >
              <div
                style={{
                  font: "500 13px/1.45 var(--font-plex-sans), sans-serif",
                  color: "var(--aviso-hondo)",
                }}
              >
                Ya hay uno que se escribe casi igual: cambia un punto o una
                abreviatura. Si es el mismo, elegí el que ya está.
              </div>
              <div style={{ marginTop: 9, display: "grid", gap: 6 }}>
                {estado.parecidos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => elegir(p)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      textAlign: "left",
                      padding: "9px 11px",
                      cursor: "pointer",
                      background: "var(--papel-alto)",
                      border: "1px solid var(--aviso)",
                      borderRadius: 2,
                      font: "500 14px var(--font-plex-sans), sans-serif",
                      color: "var(--tinta)",
                    }}
                  >
                    <span>{p.nombre}</span>
                    <span
                      style={{
                        font: "400 12px/1 var(--font-plex-mono), monospace",
                        color: "var(--aviso)",
                        flex: "none",
                      }}
                    >
                      ya en el catálogo
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Estado 3: no hay nada parecido. Crear es la acción principal. */}
          {crearPrimario && (
            <button
              type="button"
              onClick={confirmarCreacion}
              disabled={creando}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "11px 12px",
                cursor: "pointer",
                background: "var(--verde-claro)",
                border: 0,
                borderTop: "1px solid var(--verde-borde)",
                font: "500 14px var(--font-plex-sans), sans-serif",
                color: "var(--verde)",
              }}
            >
              ＋ No hay ninguno así. Crear «{q}» y elegirlo
            </button>
          )}

          {/* Estado 2: hay candidatos. Crear sigue a un clic, pero deja de gritar. */}
          {crearSecundario && (
            <div
              style={{
                padding: "9px 12px",
                background: "#faf7f0",
                borderTop: "1px solid #e4dfd1",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span
                style={{
                  font: "400 12px/1.4 var(--font-plex-sans), sans-serif",
                  color: "var(--tinta-tenue)",
                }}
              >
                {hayParecido
                  ? "Si el de arriba no es el mismo, es un nombre nuevo de verdad:"
                  : "Si ninguno de la lista es, es un nombre nuevo de verdad:"}
              </span>
              <button
                type="button"
                onClick={confirmarCreacion}
                disabled={creando}
                style={{
                  flex: "none",
                  padding: "5px 10px",
                  cursor: "pointer",
                  background: "transparent",
                  border: "1px solid var(--borde-fuerte)",
                  borderRadius: 2,
                  font: "400 12px var(--font-plex-sans), sans-serif",
                  color: "var(--tinta-suave)",
                }}
              >
                crear «{q}»
              </button>
            </div>
          )}

          {!estado.sePuedeCrear && (
            <div
              style={{
                padding: "11px 12px",
                background: "var(--papel-medio)",
                borderTop: "1px solid var(--borde)",
                font: "400 13px/1.45 var(--font-plex-sans), sans-serif",
                color: "var(--tinta-suave)",
              }}
            >
              Acá aparecen solo las nuestras, y no se pueden crear desde este paso:
              son nuestras empresas y darlas de alta es una decisión, no un descuido.
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "10px 12px",
                background: "var(--aviso-claro)",
                borderTop: "1px solid var(--aviso-borde)",
                font: "400 13px/1.4 var(--font-plex-sans), sans-serif",
                color: "var(--aviso-hondo)",
              }}
            >
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Fila({ o, onClick }: { o: OpcionEntidad; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        textAlign: "left",
        padding: "10px 12px",
        cursor: "pointer",
        background: "transparent",
        border: 0,
        borderBottom: "1px solid #f0ece1",
      }}
    >
      <span style={{ font: "400 14px/1.3 var(--font-plex-sans), sans-serif" }}>
        {o.nombre}
      </span>
      <span
        style={{
          font: "400 12px/1 var(--font-plex-mono), monospace",
          color: o.meta === "de terceros" ? "var(--rol-hotelero)" : "var(--tinta-fantasma)",
          flex: "none",
        }}
      >
        {o.meta}
      </span>
    </button>
  );
}
