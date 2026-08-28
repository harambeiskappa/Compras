"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { RolEntidad } from "@/generated/prisma/enums";
import { guardarDato, guardarRol, type CampoEntidad } from "@/lib/acciones";
import { SelectorEntidad, type Elegida } from "@/componentes/SelectorEntidad";

export type CompraDetalle = {
  id: number;
  fecha: string;
  consignatario: { id: number; nombre: string };
  empresaTitular: { id: number; nombre: string };
  vendedor: { id: number; nombre: string } | null;
  hotelero: { id: number; nombre: string } | null;
  personaCompradora: { id: number; nombre: string } | null;
  plazaLugar: string | null;
  observaciones: string | null;
  creadoEn: string;
  actualizadoEn: string;
};

type DefRol = {
  campo: CampoEntidad;
  rol: RolEntidad;
  rotulo: string;
  definicion: string;
  color: string;
  opcional: boolean;
  valor: Elegida;
};

const OPCIONALES = ["vendedor", "hotelero", "personaCompradora", "plazaLugar", "observaciones"];

export function DetalleCompra({ compra }: { compra: CompraDetalle }) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roles: DefRol[] = [
    {
      campo: "consignatario",
      rol: "CONSIGNATARIO",
      rotulo: "Consignatario",
      definicion: "Quien remató o intermedió la venta. También en la compra directa.",
      color: "var(--rol-consignatario)",
      opcional: false,
      valor: compra.consignatario,
    },
    {
      campo: "empresaTitular",
      rol: "EMPRESA_COMPRADORA",
      rotulo: "Empresa titular",
      definicion: "Bajo cuál de nuestras empresas se registra la compra.",
      color: "var(--rol-empresa)",
      opcional: false,
      valor: compra.empresaTitular,
    },
    {
      campo: "vendedor",
      rol: "VENDEDOR",
      rotulo: "Vendedor / origen",
      definicion: "De quién era la hacienda.",
      color: "var(--rol-vendedor)",
      opcional: true,
      valor: compra.vendedor,
    },
    {
      campo: "hotelero",
      rol: "HOTELERO",
      rotulo: "Hotelero",
      definicion: "De quién es la hacienda una vez en el feedlot. Puede ser un tercero.",
      color: "var(--rol-hotelero)",
      opcional: true,
      valor: compra.hotelero,
    },
    {
      campo: "personaCompradora",
      rol: "PERSONA_COMPRADORA",
      rotulo: "Persona compradora",
      definicion: "Quién fue físicamente a comprar. No es la empresa.",
      color: "var(--rol-persona)",
      opcional: true,
      valor: compra.personaCompradora,
    },
  ];

  const faltan = OPCIONALES.filter((k) => {
    if (k === "plazaLugar") return !compra.plazaLugar;
    if (k === "observaciones") return !compra.observaciones;
    return !compra[k as "vendedor" | "hotelero" | "personaCompradora"];
  }).length;

  async function cambiarRol(campo: CampoEntidad, entidadId: number | null) {
    setError(null);
    const r = await guardarRol(compra.id, campo, entidadId);
    if (!r.ok) {
      setError(r.errores.join(" "));
      return;
    }
    setEditando(null);
    router.refresh();
  }

  async function cambiarDato(
    campo: "fecha" | "plazaLugar" | "observaciones",
    valor: string | null
  ) {
    setError(null);
    const r = await guardarDato(compra.id, campo, valor);
    if (!r.ok) {
      setError(r.errores.join(" "));
      return;
    }
    setEditando(null);
    router.refresh();
  }

  return (
    <>
      {error && (
        <div
          style={{
            marginTop: 18,
            padding: "12px 15px",
            background: "var(--aviso-claro)",
            border: "1px solid var(--aviso-borde)",
            borderLeft: "4px solid var(--aviso)",
            borderRadius: 2,
            font: "400 14px/1.5 var(--font-plex-sans), sans-serif",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          marginTop: 32,
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 300px",
          gap: 52,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 34 }}>
          <section>
            <div
              style={{
                paddingBottom: 9,
                borderBottom: "1px solid var(--tinta)",
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 14,
              }}
            >
              <div className="seccion">Cada rol, su lugar</div>
              <div
                style={{
                  font: "400 13px/1.4 var(--font-plex-sans), sans-serif",
                  color: "var(--tinta-tenue)",
                }}
              >
                Cinco papeles distintos. Ninguno se puede leer en el lugar de otro.
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(268px,1fr))",
                gap: 14,
              }}
            >
              {roles.map((r) => (
                <div
                  key={r.campo}
                  style={{
                    padding: "15px 16px 16px",
                    background: "var(--papel-alto)",
                    border: "1px solid var(--borde)",
                    borderTop: `3px solid ${r.color}`,
                    borderRadius: 2,
                    display: "grid",
                    gap: 9,
                    alignContent: "start",
                  }}
                >
                  <div
                    className="rotulo"
                    style={{ color: r.color, letterSpacing: ".12em" }}
                  >
                    {r.rotulo}
                  </div>
                  <div
                    style={{
                      font: "400 12px/1.45 var(--font-plex-sans), sans-serif",
                      color: "var(--tinta-tenue)",
                      minHeight: "2.9em",
                    }}
                  >
                    {r.definicion}
                  </div>

                  {editando === r.campo ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <SelectorEntidad
                        rol={r.rol}
                        valor={r.valor}
                        onElegir={(e) => cambiarRol(r.campo, e?.id ?? null)}
                        placeholder="Elegir"
                      />
                      <div
                        style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}
                      >
                        <button
                          type="button"
                          onClick={() => setEditando(null)}
                          style={botonSecundario}
                        >
                          Cancelar
                        </button>
                        {/*
                          El botón de s/d SOLO existe donde opcional === true.
                          En los obligatorios va la línea que explica por qué no.
                        */}
                        {r.opcional ? (
                          <button
                            type="button"
                            onClick={() => cambiarRol(r.campo, null)}
                            className="sd"
                            style={{ cursor: "pointer", padding: "7px 10px" }}
                          >
                            s/d
                          </button>
                        ) : (
                          <span
                            style={{
                              font: "400 12px/1.35 var(--font-plex-sans), sans-serif",
                              color: "var(--tinta-tenue)",
                            }}
                          >
                            <span style={{ color: "var(--aviso)", fontWeight: 600 }}>·</span>{" "}
                            Este dato no puede quedar en s/d: sin él la compra no se
                            reconoce en la lista.
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditando(r.campo)}
                      style={botonValor}
                    >
                      {r.valor ? (
                        <span
                          style={{ font: "500 16px/1.35 var(--font-plex-sans), sans-serif" }}
                        >
                          {r.valor.nombre}
                        </span>
                      ) : (
                        <span className="sd">s/d</span>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="seccion" style={{ paddingBottom: 9, borderBottom: "1px solid var(--tinta)" }}>
              Cuándo, dónde y qué se anotó
            </div>

            <FilaDato
              rotulo="Fecha de la compra"
              valor={compra.fecha ? aLargo(compra.fecha) : null}
              crudo={compra.fecha}
              tipo="date"
              opcional={false}
              editando={editando === "fecha"}
              onEditar={() => setEditando("fecha")}
              onCancelar={() => setEditando(null)}
              onGuardar={(v) => cambiarDato("fecha", v)}
            />
            <FilaDato
              rotulo="Plaza o lugar"
              valor={compra.plazaLugar}
              crudo={compra.plazaLugar ?? ""}
              tipo="text"
              opcional
              editando={editando === "plazaLugar"}
              onEditar={() => setEditando("plazaLugar")}
              onCancelar={() => setEditando(null)}
              onGuardar={(v) => cambiarDato("plazaLugar", v)}
            />
            <FilaDato
              rotulo="Observaciones"
              valor={compra.observaciones}
              crudo={compra.observaciones ?? ""}
              tipo="text"
              opcional
              editando={editando === "observaciones"}
              onEditar={() => setEditando("observaciones")}
              onCancelar={() => setEditando(null)}
              onGuardar={(v) => cambiarDato("observaciones", v)}
            />
          </section>
        </div>

        <aside style={{ display: "grid", gap: 16, position: "sticky", top: 80 }}>
          <div
            style={{
              padding: "16px 17px",
              background: "var(--papel-alto)",
              border: "1px solid var(--borde)",
              borderTop: "3px solid var(--tinta)",
              borderRadius: 2,
            }}
          >
            <div className="rotulo" style={{ fontSize: 11, color: "var(--tinta)" }}>
              Lo que falta de esta compra
            </div>
            <div
              style={{ marginTop: 12, font: "500 15px/1.4 var(--font-plex-sans), sans-serif" }}
            >
              {faltan === 0
                ? "Está completa: los 5 datos opcionales tienen valor."
                : `${faltan} de los 5 datos opcionales están en s/d.`}
            </div>
            <div
              style={{
                marginTop: 8,
                font: "400 13px/1.55 var(--font-plex-sans), sans-serif",
                color: "var(--tinta-suave)",
              }}
            >
              Está contado sobre los 5 datos opcionales de esta pantalla. No es un
              error ni una tarea pendiente: es lo que se sabe hasta ahora.
            </div>
          </div>

          <div
            style={{
              padding: "16px 17px",
              background: "var(--papel-hondo)",
              border: "1px solid #d5cdb9",
              borderRadius: 2,
            }}
          >
            <div className="rotulo" style={{ fontSize: 11, color: "var(--tinta-media)" }}>
              Cabezas, kilos y jaulas
            </div>
            <div
              style={{
                marginTop: 10,
                font: "400 13px/1.55 var(--font-plex-sans), sans-serif",
                color: "var(--tinta-media)",
              }}
            >
              Todavía no existen para esta compra: se cargan en el paso siguiente,
              que se diseña aparte. No hay un total en 0 ni un espacio esperándolos,
              porque no habría nada que sumar.
            </div>
          </div>

          {/*
            Sin «· oficina»: hay creadoEn y actualizadoEn pero ninguna atribución
            de usuario. Poner una fija sería inventar el dato.
          */}
          <div
            style={{
              padding: "14px 16px",
              font: "400 12px/1.6 var(--font-plex-mono), monospace",
              color: "var(--tinta-tenue)",
              border: "1px dashed var(--borde-fuerte)",
              borderRadius: 2,
            }}
          >
            Cargada el {aLargo(compra.creadoEn)}
            <br />
            Último cambio: {aLargo(compra.actualizadoEn)}
          </div>
        </aside>
      </div>
    </>
  );
}

function FilaDato({
  rotulo,
  valor,
  crudo,
  tipo,
  opcional,
  editando,
  onEditar,
  onCancelar,
  onGuardar,
}: {
  rotulo: string;
  valor: string | null;
  crudo: string;
  tipo: "date" | "text";
  opcional: boolean;
  editando: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onGuardar: (v: string | null) => void;
}) {
  const [borrador, setBorrador] = useState(crudo);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "250px minmax(0,1fr)",
        gap: 24,
        padding: "15px 0",
        borderBottom: "1px solid #e4dfd1",
      }}
    >
      <div
        style={{
          font: "500 13px/1.4 var(--font-plex-sans), sans-serif",
          color: "var(--tinta-media)",
        }}
      >
        {rotulo}
      </div>
      <div>
        {editando ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type={tipo}
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              className="campo"
              style={{ width: 300, borderColor: "var(--verde)" }}
            />
            <button type="button" onClick={() => onGuardar(borrador)} style={botonPrimario}>
              Guardar
            </button>
            <button type="button" onClick={onCancelar} style={botonSecundario}>
              Cancelar
            </button>
            {opcional ? (
              <button
                type="button"
                onClick={() => onGuardar(null)}
                className="sd"
                style={{ cursor: "pointer", padding: "7px 10px" }}
              >
                s/d
              </button>
            ) : (
              <span
                style={{
                  font: "400 12px/1.35 var(--font-plex-sans), sans-serif",
                  color: "var(--tinta-tenue)",
                }}
              >
                <span style={{ color: "var(--aviso)", fontWeight: 600 }}>·</span> Este dato
                no puede quedar en s/d: sin él la compra no se reconoce en la lista.
              </span>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setBorrador(crudo);
              onEditar();
            }}
            style={botonValor}
          >
            {valor ? (
              <span style={{ font: "400 16px/1.4 var(--font-plex-sans), sans-serif" }}>
                {valor}
              </span>
            ) : (
              <span className="sd">s/d</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

const botonValor: React.CSSProperties = {
  textAlign: "left",
  background: "transparent",
  border: 0,
  borderBottom: "1px dotted var(--borde-fuerte)",
  padding: "2px 0 5px",
  cursor: "pointer",
};

const botonPrimario: React.CSSProperties = {
  padding: "7px 12px",
  cursor: "pointer",
  font: "500 13px var(--font-plex-sans), sans-serif",
  color: "var(--papel)",
  background: "var(--verde)",
  border: "1px solid var(--verde-hondo)",
  borderRadius: 2,
};

const botonSecundario: React.CSSProperties = {
  padding: "7px 10px",
  cursor: "pointer",
  font: "400 13px var(--font-plex-sans), sans-serif",
  color: "var(--tinta-suave)",
  background: "transparent",
  border: "1px solid var(--borde-fuerte)",
  borderRadius: 2,
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function aLargo(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d} ${MESES[Number(m) - 1]} ${a}`;
}
