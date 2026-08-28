"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { crearCompra } from "@/lib/acciones";
import { SelectorEntidad, type Elegida } from "@/componentes/SelectorEntidad";

type CampoOpcional = "vendedor" | "hotelero" | "persona" | "plaza";

/**
 * Alta en UNA SOLA HOJA.
 *
 * El botón de poner «s/d» existe SOLO en los opcionales. Fecha, consignatario y
 * empresa titular no lo tienen, y en su lugar va la línea que explica por qué:
 * son los tres datos con los que se reconoce una compra en la lista.
 */
export function FormularioAlta({ plazas }: { plazas: string[] }) {
  const router = useRouter();

  const [fecha, setFecha] = useState("");
  const [consignatario, setConsignatario] = useState<Elegida>(null);
  const [empresa, setEmpresa] = useState<Elegida>(null);
  const [vendedor, setVendedor] = useState<Elegida>(null);
  const [hotelero, setHotelero] = useState<Elegida>(null);
  const [persona, setPersona] = useState<Elegida>(null);
  const [plaza, setPlaza] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [sd, setSd] = useState<Record<CampoOpcional, boolean>>({
    vendedor: false,
    hotelero: false,
    persona: false,
    plaza: false,
  });
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  function ponerSd(c: CampoOpcional) {
    setSd((s) => ({ ...s, [c]: true }));
    if (c === "vendedor") setVendedor(null);
    if (c === "hotelero") setHotelero(null);
    if (c === "persona") setPersona(null);
    if (c === "plaza") setPlaza("");
  }
  function quitarSd(c: CampoOpcional) {
    setSd((s) => ({ ...s, [c]: false }));
  }

  const faltan = [!fecha, !consignatario, !empresa].filter(Boolean).length;

  async function guardar() {
    setGuardando(true);
    setErrores([]);
    const r = await crearCompra({
      fecha,
      consignatarioId: consignatario?.id ?? null,
      empresaTitularId: empresa?.id ?? null,
      vendedorId: vendedor?.id ?? null,
      hoteleroId: hotelero?.id ?? null,
      personaCompradoraId: persona?.id ?? null,
      plazaLugar: plaza,
      observaciones,
    });
    setGuardando(false);
    if (!r.ok) {
      setErrores(r.errores);
      return;
    }
    router.push(`/compras/${r.id}`);
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) 300px",
        gap: 52,
        alignItems: "start",
        marginTop: 26,
      }}
    >
      <div style={{ display: "grid", gap: 34 }}>
        {/* ---------- obligatorios ---------- */}
        <section style={{ display: "grid", gap: 20 }}>
          <div style={{ paddingBottom: 9, borderBottom: "1px solid var(--tinta)" }}>
            <div className="seccion">Lo que no puede faltar</div>
            <div
              style={{
                marginTop: 7,
                font: "400 14px/1.5 var(--font-plex-sans), sans-serif",
                color: "var(--tinta-suave)",
              }}
            >
              Tres datos. Con estos tres la compra existe y se puede guardar; todo
              lo demás se completa cuando se sepa.
            </div>
          </div>

          <Campo etiqueta="Fecha" obligatorio ancho={260}>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="campo"
              style={{ fontFamily: "var(--font-plex-mono), monospace", fontWeight: 500 }}
            />
          </Campo>

          <Campo
            etiqueta="Consignatario"
            obligatorio
            definicion="Quien remató o intermedió la venta. También existe en la compra directa, así que va siempre."
          >
            <SelectorEntidad
              rol="CONSIGNATARIO"
              valor={consignatario}
              onElegir={setConsignatario}
              placeholder="Elegir consignatario"
              nota="Ordenados por cuántas compras tienen. Alfabético enterraría al que concentra la mitad."
            />
          </Campo>

          <Campo
            etiqueta="Empresa titular"
            obligatorio
            definicion="Bajo cuál de nuestras empresas se registra la compra."
          >
            <SelectorEntidad
              rol="EMPRESA_COMPRADORA"
              valor={empresa}
              onElegir={setEmpresa}
              placeholder="Elegir una de nuestras empresas"
            />
          </Campo>
        </section>

        {/* ---------- los otros tres roles ---------- */}
        <section style={{ display: "grid", gap: 20 }}>
          <div style={{ paddingBottom: 9, borderBottom: "1px solid var(--tinta)" }}>
            <div className="seccion">Vendedor, hotelero y persona compradora</div>
            <div
              style={{
                marginTop: 7,
                font: "400 14px/1.5 var(--font-plex-sans), sans-serif",
                color: "var(--tinta-suave)",
              }}
            >
              Tres cosas distintas y ninguna obligatoria. Si no se sabe, va en s/d
              y se completa después.
            </div>
          </div>

          <Campo
            etiqueta="Vendedor / origen"
            definicion="De quién era la hacienda."
            color="var(--rol-vendedor)"
          >
            <ConSd
              activo={sd.vendedor}
              onPoner={() => ponerSd("vendedor")}
              onQuitar={() => quitarSd("vendedor")}
            >
              <SelectorEntidad
                rol="VENDEDOR"
                valor={vendedor}
                onElegir={(e) => {
                  setVendedor(e);
                  quitarSd("vendedor");
                }}
                placeholder="Buscar o crear"
                nota="Es el catálogo que más crece. Si el vendedor no está, se crea acá sin salir."
              />
            </ConSd>
          </Campo>

          <Campo
            etiqueta="Hotelero"
            definicion="De quién es la hacienda una vez en el feedlot. Puede ser de un tercero."
            color="var(--rol-hotelero)"
          >
            <ConSd
              activo={sd.hotelero}
              onPoner={() => ponerSd("hotelero")}
              onQuitar={() => quitarSd("hotelero")}
            >
              <SelectorEntidad
                rol="HOTELERO"
                valor={hotelero}
                onElegir={(e) => {
                  setHotelero(e);
                  quitarSd("hotelero");
                }}
                placeholder="Buscar o crear"
                nota="Acá aparecen todas, también las de terceros: su hacienda puede estar en nuestro feedlot."
              />
            </ConSd>
          </Campo>

          <Campo
            etiqueta="Persona compradora"
            definicion="Quién fue físicamente a comprar. No es la empresa."
            color="var(--rol-persona)"
          >
            <ConSd
              activo={sd.persona}
              onPoner={() => ponerSd("persona")}
              onQuitar={() => quitarSd("persona")}
            >
              <SelectorEntidad
                rol="PERSONA_COMPRADORA"
                valor={persona}
                onElegir={(e) => {
                  setPersona(e);
                  quitarSd("persona");
                }}
                placeholder="Buscar o crear"
              />
            </ConSd>
          </Campo>
        </section>

        {/* ---------- plaza y observaciones ---------- */}
        <section style={{ display: "grid", gap: 20 }}>
          <div style={{ paddingBottom: 9, borderBottom: "1px solid var(--tinta)" }}>
            <div className="seccion">Plaza y observaciones</div>
            <div
              style={{
                marginTop: 7,
                font: "400 13px/1.5 var(--font-plex-sans), sans-serif",
                color: "var(--tinta-suave)",
              }}
            >
              La comisión no está acá: se aplica por renglón y los renglones son
              del paso siguiente.
            </div>
          </div>

          <Campo etiqueta="Plaza o lugar" ancho={400}>
            <ConSd
              activo={sd.plaza}
              onPoner={() => ponerSd("plaza")}
              onQuitar={() => quitarSd("plaza")}
            >
              <>
                <input
                  list="plazas"
                  value={plaza}
                  onChange={(e) => setPlaza(e.target.value)}
                  placeholder="WASHINGTON, HUINCA RENANCO…"
                  className="campo"
                />
                <datalist id="plazas">
                  {plazas.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </>
            </ConSd>
          </Campo>

          <Campo etiqueta="Observaciones">
            <textarea
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Lo que no entra en ningún campo"
              className="campo"
              style={{ resize: "vertical", lineHeight: 1.5 }}
            />
          </Campo>
        </section>

        {errores.length > 0 && (
          <div
            style={{
              padding: 14,
              background: "var(--aviso-claro)",
              border: "1px solid var(--aviso-borde)",
              borderLeft: "4px solid var(--aviso)",
              borderRadius: 2,
            }}
          >
            <div
              className="rotulo"
              style={{ color: "var(--aviso)", letterSpacing: ".1em" }}
            >
              No se guardó
            </div>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {errores.map((e) => (
                <li
                  key={e}
                  style={{ font: "400 14px/1.5 var(--font-plex-sans), sans-serif" }}
                >
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            paddingTop: 22,
            borderTop: "2px solid var(--tinta)",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            style={{
              padding: "11px 20px",
              cursor: "pointer",
              font: "500 15px var(--font-plex-sans), sans-serif",
              color: "var(--papel)",
              background: faltan ? "#6d8f74" : "var(--verde)",
              border: "1px solid var(--verde-hondo)",
              borderRadius: 2,
            }}
          >
            {guardando ? "Guardando…" : "Guardar la compra"}
          </button>
          <div
            style={{
              font: "400 13px/1.45 var(--font-plex-sans), sans-serif",
              color: "var(--tinta-suave)",
              maxWidth: "26em",
            }}
          >
            {faltan
              ? `Faltan ${faltan} de los tres datos obligatorios.`
              : "Se puede guardar así: lo que falte queda en s/d y se completa cuando se sepa."}
          </div>
        </div>
      </div>

      {/* ---------- costado ---------- */}
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
          <div
            className="rotulo"
            style={{ fontSize: 11, letterSpacing: ".09em", color: "var(--tinta)" }}
          >
            Así va a aparecer en la lista
          </div>
          <div style={{ marginTop: 14, display: "grid", gap: 11 }}>
            <Vista rotulo="Fecha" valor={fecha ? aDdMmAaaa(fecha) : null} mono />
            <Vista rotulo="Consignatario" valor={consignatario?.nombre ?? null} />
            <Vista rotulo="Empresa titular" valor={empresa?.nombre ?? null} />
          </div>
          <div
            style={{
              marginTop: 15,
              paddingTop: 13,
              borderTop: "1px solid #e4dfd1",
              font: "400 13px/1.5 var(--font-plex-sans), sans-serif",
              color: "var(--tinta-suave)",
            }}
          >
            Son los tres datos con los que se reconoce una compra en la lista. Por
            eso son los tres obligatorios y no hay un cuarto.
          </div>
        </div>
        <div
          style={{
            padding: "14px 16px",
            background: "var(--papel-hondo)",
            border: "1px solid #d5cdb9",
            borderRadius: 2,
            font: "400 13px/1.55 var(--font-plex-sans), sans-serif",
            color: "var(--tinta-media)",
          }}
        >
          <span style={{ fontWeight: 500 }}>Nada se completa solo.</span> Si un dato
          no se sabe, va en s/d y se ve como s/d. Poner un 0 o dejarlo en blanco
          haría que dentro de un año nadie pueda distinguir «no se sabe» de «vale
          cero».
        </div>
      </aside>
    </div>
  );
}

function Campo({
  etiqueta,
  definicion,
  obligatorio,
  color,
  ancho,
  children,
}: {
  etiqueta: string;
  definicion?: string;
  obligatorio?: boolean;
  color?: string;
  ancho?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 7,
        maxWidth: ancho ?? 520,
        ...(color ? { borderLeft: `3px solid ${color}`, paddingLeft: 15 } : {}),
      }}
    >
      <label style={{ font: "500 14px/1.2 var(--font-plex-sans), sans-serif" }}>
        {etiqueta}
        {obligatorio && <span style={{ color: "var(--aviso)" }}> ·</span>}
      </label>
      {definicion && (
        <div
          style={{
            font: "400 13px/1.45 var(--font-plex-sans), sans-serif",
            color: "var(--tinta-suave)",
          }}
        >
          {definicion}
        </div>
      )}
      {children}
    </div>
  );
}

/** El botón de s/d al lado del campo. Solo se usa en los opcionales. */
function ConSd({
  activo,
  onPoner,
  onQuitar,
  children,
}: {
  activo: boolean;
  onPoner: () => void;
  onQuitar: () => void;
  children: React.ReactNode;
}) {
  if (activo) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="sd" style={{ padding: "9px 12px", fontSize: 13 }}>
          s/d
        </span>
        <button
          type="button"
          onClick={onQuitar}
          style={{
            background: "transparent",
            border: 0,
            padding: 0,
            cursor: "pointer",
            font: "400 13px var(--font-plex-sans), sans-serif",
            color: "var(--verde)",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Sé el dato, lo cargo
        </button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      <button
        type="button"
        onClick={onPoner}
        title="Marcar como sin dato"
        className="sd"
        style={{ flex: "none", padding: "0 13px", alignSelf: "stretch", cursor: "pointer" }}
      >
        s/d
      </button>
    </div>
  );
}

function Vista({
  rotulo,
  valor,
  mono,
}: {
  rotulo: string;
  valor: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="rotulo">{rotulo}</div>
      <div
        style={{
          marginTop: 4,
          font: mono
            ? "500 16px/1 var(--font-plex-mono), monospace"
            : "500 15px/1.3 var(--font-plex-sans), sans-serif",
          fontVariantNumeric: mono ? "tabular-nums" : undefined,
          color: valor ? "var(--tinta)" : "var(--tinta-fantasma)",
        }}
      >
        {valor ?? "s/d"}
      </div>
    </div>
  );
}

function aDdMmAaaa(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
