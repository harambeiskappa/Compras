"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import type { ModalidadComision, ModalidadPrecio } from "@/generated/prisma/enums";
import {
  aplicarComisionATodos,
  aplicarEstablecimientoATodos,
  borrarLote,
  crearLote,
  guardarLote,
  type DatosLote,
} from "@/lib/acciones-compra";
import { conCobertura, kilosPorCabeza, totalesDeCompra } from "@/lib/totales";

/**
 * Los renglones de una compra.
 *
 * TARJETAS APILADAS, NO FILAS DE TABLA: ocho campos no entran en una fila
 * legible, y la mediana es 2 renglones con un p90 de 6 — no es una planilla de
 * cien líneas.
 */

export type RenglonEnPantalla = {
  id: number;
  categoriaTexto: string;
  categoriaCodigo: string | null;
  categoriaDescripcion: string | null;
  cabezas: number;
  kilosOrigen: number | null;
  precio: number | null;
  modalidadPrecio: ModalidadPrecio | null;
  comision: number | null;
  comisionModalidad: ModalidadComision | null;
  establecimientoId: number | null;
  tropaId: number | null;
};

export type OpcionSimple = { id: number; nombre: string };

type Borrador = {
  categoriaTexto: string;
  cabezas: string;
  kilosPorCabeza: string;
  precio: string;
  modalidadPrecio: ModalidadPrecio | "";
  comision: string;
  comisionModalidad: ModalidadComision | "";
  establecimientoId: string;
  tropaId: string;
};

/** El texto vacío es s/d. Nunca 0: son afirmaciones distintas. */
function aNumero(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function deRenglon(r: RenglonEnPantalla): Borrador {
  const porCabeza = r.kilosOrigen === null ? null : kilosPorCabeza(r.kilosOrigen, r.cabezas);
  return {
    categoriaTexto: r.categoriaTexto,
    cabezas: String(r.cabezas),
    kilosPorCabeza: porCabeza === null ? "" : String(porCabeza),
    precio: r.precio === null ? "" : String(r.precio),
    modalidadPrecio: r.modalidadPrecio ?? "",
    comision: r.comision === null ? "" : String(r.comision),
    comisionModalidad: r.comisionModalidad ?? "",
    establecimientoId: r.establecimientoId === null ? "" : String(r.establecimientoId),
    tropaId: r.tropaId === null ? "" : String(r.tropaId),
  };
}

/** UN RENGLÓN NUEVO NACE EN «s/d». Nada se hereda en silencio. */
const EN_BLANCO: Borrador = {
  categoriaTexto: "",
  cabezas: "",
  kilosPorCabeza: "",
  precio: "",
  modalidadPrecio: "",
  comision: "",
  comisionModalidad: "",
  establecimientoId: "",
  tropaId: "",
};

function aDatos(b: Borrador): DatosLote {
  return {
    categoriaTexto: b.categoriaTexto,
    cabezas: aNumero(b.cabezas),
    kilosPorCabeza: aNumero(b.kilosPorCabeza),
    precio: aNumero(b.precio),
    modalidadPrecio: b.modalidadPrecio === "" ? null : b.modalidadPrecio,
    comision: aNumero(b.comision),
    comisionModalidad: b.comisionModalidad === "" ? null : b.comisionModalidad,
    establecimientoId: b.establecimientoId === "" ? null : Number(b.establecimientoId),
    tropaId: b.tropaId === "" ? null : Number(b.tropaId),
  };
}

export function Renglones({
  compraId,
  renglones,
  establecimientos,
  tropas,
  sinonimos,
  cabezasDelReporte,
}: {
  compraId: number;
  renglones: RenglonEnPantalla[];
  establecimientos: OpcionSimple[];
  tropas: { id: number; etiqueta: string }[];
  sinonimos: { texto: string; codigo: string | null }[];
  /** Lo que el comprador contó. La diferencia NO es un error. */
  cabezasDelReporte: number | null;
}) {
  const router = useRouter();
  const [errores, setErrores] = useState<string[]>([]);
  const [nuevo, setNuevo] = useState<Borrador | null>(null);
  const [pendiente, arrancar] = useTransition();

  const totales = useMemo(
    () =>
      totalesDeCompra(
        renglones.map((r) => ({
          cabezas: r.cabezas,
          kilosOrigen: r.kilosOrigen,
          precio: r.precio,
          modalidadPrecio: r.modalidadPrecio,
          comision: r.comision,
          comisionModalidad: r.comisionModalidad,
        }))
      ),
    [renglones]
  );

  function agregar(base: Borrador) {
    setErrores([]);
    setNuevo(base);
  }

  function guardarNuevo() {
    if (!nuevo) return;
    setErrores([]);
    arrancar(async () => {
      const r = await crearLote(compraId, aDatos(nuevo));
      if (!r.ok) setErrores(r.errores);
      else {
        setNuevo(null);
        router.refresh();
      }
    });
  }

  const sumaCabezas = totales.cabezas.valor ?? 0;

  return (
    <section style={{ marginTop: 40 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
        <h2 className="seccion" style={{ margin: 0 }}>
          Renglones
        </h2>
        <span
          style={{
            font: "400 13px var(--font-plex-mono), monospace",
            color: "var(--tinta-suave)",
          }}
        >
          {renglones.length}
        </span>
      </div>

      <Totales totales={totales} />

      {cabezasDelReporte !== null && renglones.length > 0 && (
        // LA DIFERENCIA NO ES UN ERROR y no se resalta como tal: el comprador
        // contó a ojo en un remate y los renglones salen del papel. Se dice
        // cuánto contó cada uno y se aclara que no hay que igualarlos.
        <p
          style={{
            margin: "12px 0 0",
            font: "400 13px/1.5 var(--font-plex-sans), sans-serif",
            color: "var(--tinta-suave)",
          }}
        >
          El comprador contó <strong>{cabezasDelReporte}</strong> cabezas y los
          renglones suman <strong>{sumaCabezas}</strong>
          {cabezasDelReporte !== sumaCabezas && (
            <>
              {" "}
              — una diferencia de {Math.abs(cabezasDelReporte - sumaCabezas)}. No hay
              que igualarlos: él contó a ojo en la feria y esto sale del remito.
            </>
          )}
          .
        </p>
      )}

      <Gestos
        compraId={compraId}
        establecimientos={establecimientos}
        hayRenglones={renglones.length > 0}
        avisar={setErrores}
      />

      {errores.length > 0 && (
        <div
          role="alert"
          style={{
            marginTop: 16,
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

      <div style={{ marginTop: 18 }}>
        {renglones.map((r, i) => (
          <Tarjeta
            key={r.id}
            indice={i + 1}
            renglon={r}
            establecimientos={establecimientos}
            tropas={tropas}
            sinonimos={sinonimos}
            avisar={setErrores}
            duplicar={() => agregar({ ...deRenglon(r), cabezas: "" })}
          />
        ))}
      </div>

      {nuevo ? (
        <Editor
          titulo="Renglón nuevo"
          borrador={nuevo}
          setBorrador={setNuevo as (b: Borrador) => void}
          establecimientos={establecimientos}
          tropas={tropas}
          sinonimos={sinonimos}
          pendiente={pendiente}
          onGuardar={guardarNuevo}
          onCancelar={() => setNuevo(null)}
        />
      ) : (
        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => agregar(EN_BLANCO)}
            style={botonPrincipal}
          >
            ＋ Renglón en blanco
          </button>
          {renglones.length > 0 && (
            <button
              type="button"
              // Lo que cambia entre renglones son las cabezas; el resto se
              // repite. Copia todo MENOS las cabezas, que quedan en s/d — y
              // así el valor copiado es uno que alguien está mirando, no uno
              // heredado en silencio.
              onClick={() => agregar({ ...deRenglon(renglones[renglones.length - 1]), cabezas: "" })}
              style={botonSecundario}
            >
              ＋ Otro igual al último, sin las cabezas
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Totales({ totales }: { totales: ReturnType<typeof totalesDeCompra> }) {
  return (
    <div
      style={{
        marginTop: 14,
        display: "flex",
        gap: 26,
        flexWrap: "wrap",
        padding: "14px 16px",
        background: "var(--papel-medio)",
        border: "1px solid var(--borde)",
        borderRadius: 3,
      }}
    >
      {/* NINGUNO SE GUARDA: los cinco salen de los renglones cada vez que se
          miran. Y cada uno con su cobertura al lado, no al pie: un promedio
          sobre la mitad de los casos no es el mismo número que uno sobre todos. */}
      <Total rotulo="Cabezas" texto={conCobertura(totales.cabezas)} />
      <Total rotulo="Kilos de origen" texto={conCobertura(totales.kilos, " kg")} />
      <Total rotulo="Kilos por cabeza" texto={conCobertura(totales.kilosPorCabeza, " kg")} />
      <Total rotulo="Importe" texto={conCobertura(totales.importe)} />
      <Total
        rotulo="Comisión"
        texto={
          totales.porcentajeUniforme !== null
            ? `${conCobertura(totales.comision)} · ${totales.porcentajeUniforme} % en todos`
            : conCobertura(totales.comision)
        }
      />
    </div>
  );
}

function Total({ rotulo, texto }: { rotulo: string; texto: string }) {
  return (
    <div>
      <div className="rotulo" style={{ color: "var(--tinta-tenue)" }}>
        {rotulo}
      </div>
      <div
        style={{
          marginTop: 3,
          font: "400 14px/1.35 var(--font-plex-sans), sans-serif",
          maxWidth: "16em",
        }}
      >
        {texto}
      </div>
    </div>
  );
}

/**
 * «La misma comisión para todos» y «todo al mismo establecimiento».
 *
 * La caja dice explícitamente que NO guarda una cabecera: escribe el número en
 * cada línea y después cada una se cambia sola. Sin esa frase, el gesto se lee
 * como un campo de la compra — y ese es exactamente el error del esquema viejo.
 */
function Gestos({
  compraId,
  establecimientos,
  hayRenglones,
  avisar,
}: {
  compraId: number;
  establecimientos: OpcionSimple[];
  hayRenglones: boolean;
  avisar: (e: string[]) => void;
}) {
  const router = useRouter();
  const [comision, setComision] = useState("");
  const [modalidad, setModalidad] = useState<ModalidadComision>("PORCENTAJE");
  const [establecimiento, setEstablecimiento] = useState("");
  const [pendiente, arrancar] = useTransition();
  const [aplicado, setAplicado] = useState<string | null>(null);

  if (!hayRenglones) return null;

  function aplicarComision() {
    avisar([]);
    const valor = aNumero(comision);
    if (valor === null) {
      avisar(["Escribí la comisión que se aplica a todos los renglones."]);
      return;
    }
    arrancar(async () => {
      const r = await aplicarComisionATodos(compraId, valor, modalidad);
      if (!r.ok) avisar(r.errores);
      else {
        setAplicado(`Escrita en ${r.id} renglón(es)`);
        router.refresh();
      }
    });
  }

  function aplicarEstablecimiento() {
    avisar([]);
    if (!establecimiento) {
      avisar(["Elegí el establecimiento que se aplica a todos los renglones."]);
      return;
    }
    arrancar(async () => {
      const r = await aplicarEstablecimientoATodos(compraId, Number(establecimiento));
      if (!r.ok) avisar(r.errores);
      else {
        setAplicado(`Escrito en ${r.id} renglón(es)`);
        router.refresh();
      }
    });
  }

  return (
    <div
      style={{
        marginTop: 18,
        padding: "14px 16px",
        background: "var(--papel-alto)",
        border: "1px dashed var(--borde-firme)",
        borderRadius: 3,
      }}
    >
      <div style={{ font: "500 14px var(--font-plex-sans), sans-serif" }}>
        Rellenar todos los renglones de una vez
      </div>
      <div
        style={{
          marginTop: 4,
          marginBottom: 12,
          font: "400 13px/1.5 var(--font-plex-sans), sans-serif",
          color: "var(--tinta-suave)",
          maxWidth: "48em",
        }}
      >
        Esto <strong>no guarda un dato de cabecera</strong>: escribe el valor en
        cada línea, y después cada una se cambia sola. La comisión y el
        establecimiento viven en el renglón — el establecimiento es mixto en 5 de
        cada 7 compras que lo tienen cargado.
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div>
            <div style={rotuloCampo}>Misma comisión</div>
            <input
              value={comision}
              onChange={(e) => setComision(e.target.value)}
              placeholder="2"
              className="campo"
              style={{ width: 90 }}
            />
          </div>
          <select
            value={modalidad}
            onChange={(e) => setModalidad(e.target.value as ModalidadComision)}
            className="campo"
            style={{ width: 130 }}
          >
            <option value="PORCENTAJE">%</option>
            <option value="MONTO">$ por renglón</option>
          </select>
          <button
            type="button"
            onClick={aplicarComision}
            disabled={pendiente}
            style={botonSecundario}
          >
            Escribir en todos
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div>
            <div style={rotuloCampo}>Mismo establecimiento</div>
            <select
              value={establecimiento}
              onChange={(e) => setEstablecimiento(e.target.value)}
              className="campo"
              style={{ minWidth: 180 }}
            >
              <option value="">— elegir —</option>
              {establecimientos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={aplicarEstablecimiento}
            disabled={pendiente}
            style={botonSecundario}
          >
            Escribir en todos
          </button>
        </div>
      </div>

      {aplicado && (
        <div
          role="status"
          style={{
            marginTop: 10,
            font: "500 13px var(--font-plex-sans), sans-serif",
            color: "var(--verde)",
          }}
        >
          {aplicado} — ahora cada uno se puede cambiar por separado.
        </div>
      )}
    </div>
  );
}

function Tarjeta({
  indice,
  renglon,
  establecimientos,
  tropas,
  sinonimos,
  avisar,
  duplicar,
}: {
  indice: number;
  renglon: RenglonEnPantalla;
  establecimientos: OpcionSimple[];
  tropas: { id: number; etiqueta: string }[];
  sinonimos: { texto: string; codigo: string | null }[];
  avisar: (e: string[]) => void;
  duplicar: () => void;
}) {
  const router = useRouter();
  const [borrador, setBorrador] = useState<Borrador>(() => deRenglon(renglon));
  const [pendiente, arrancar] = useTransition();
  const sucio = JSON.stringify(borrador) !== JSON.stringify(deRenglon(renglon));

  function guardar() {
    avisar([]);
    arrancar(async () => {
      const r = await guardarLote(renglon.id, aDatos(borrador));
      if (!r.ok) avisar(r.errores);
      else router.refresh();
    });
  }

  function borrar() {
    avisar([]);
    if (!confirm(`¿Borrar el renglón ${indice}? No se puede deshacer.`)) return;
    arrancar(async () => {
      const r = await borrarLote(renglon.id);
      if (!r.ok) avisar(r.errores);
      else router.refresh();
    });
  }

  return (
    <Editor
      titulo={`Renglón ${indice}`}
      borrador={borrador}
      setBorrador={setBorrador}
      establecimientos={establecimientos}
      tropas={tropas}
      sinonimos={sinonimos}
      pendiente={pendiente}
      sucio={sucio}
      codigoGuardado={renglon.categoriaCodigo}
      descripcionGuardada={renglon.categoriaDescripcion}
      onGuardar={guardar}
      onBorrar={borrar}
      onDuplicar={duplicar}
    />
  );
}

function Editor({
  titulo,
  borrador,
  setBorrador,
  establecimientos,
  tropas,
  sinonimos,
  pendiente,
  sucio,
  codigoGuardado,
  descripcionGuardada,
  onGuardar,
  onCancelar,
  onBorrar,
  onDuplicar,
}: {
  titulo: string;
  borrador: Borrador;
  setBorrador: (b: Borrador) => void;
  establecimientos: OpcionSimple[];
  tropas: { id: number; etiqueta: string }[];
  sinonimos: { texto: string; codigo: string | null }[];
  pendiente: boolean;
  sucio?: boolean;
  codigoGuardado?: string | null;
  descripcionGuardada?: string | null;
  onGuardar: () => void;
  onCancelar?: () => void;
  onBorrar?: () => void;
  onDuplicar?: () => void;
}) {
  const set = (parche: Partial<Borrador>) => setBorrador({ ...borrador, ...parche });

  const cabezas = aNumero(borrador.cabezas);
  const porCabeza = aNumero(borrador.kilosPorCabeza);
  const totalKilos =
    cabezas !== null && porCabeza !== null
      ? (Math.round(porCabeza * 100) * cabezas) / 100
      : null;

  // El texto tipeado se resuelve contra lo que ya se conoce, solo para mostrar
  // la canónica mientras se escribe. La resolución de verdad la hace el
  // servidor: acá es una cortesía, no la regla.
  const conocido = sinonimos.find(
    (s) => s.texto.trim().toLowerCase() === borrador.categoriaTexto.trim().toLowerCase()
  );
  const codigo = conocido ? conocido.codigo : codigoGuardado ?? null;
  const sinResolver = borrador.categoriaTexto.trim() !== "" && !codigo;

  return (
    <div
      style={{
        marginBottom: 12,
        padding: "15px 17px",
        background: "var(--papel-alto)",
        border: "1px solid var(--borde)",
        borderLeft: sucio ? "3px solid var(--aviso)" : "3px solid var(--borde-firme)",
        borderRadius: 3,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span className="rotulo">{titulo}</span>
        {sucio && (
          <span style={{ font: "400 12px var(--font-plex-sans), sans-serif", color: "var(--aviso-hondo)" }}>
            sin guardar
          </span>
        )}
        <div style={{ flex: 1 }} />
        {onDuplicar && (
          <button type="button" onClick={onDuplicar} style={botonTexto}>
            Duplicar
          </button>
        )}
        {onBorrar && (
          <button type="button" onClick={onBorrar} style={{ ...botonTexto, color: "var(--aviso-hondo)" }}>
            Borrar
          </button>
        )}
      </div>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 14,
        }}
      >
        <div>
          <div style={rotuloCampo}>Categoría</div>
          <input
            value={borrador.categoriaTexto}
            onChange={(e) => set({ categoriaTexto: e.target.value })}
            list="sinonimos-categoria"
            placeholder="vaca"
            className="campo"
          />
          {/* Si se reconoce, aparece la canónica. Si no, el sello SIN RESOLVER
              y la frase que explica qué pasa — y NO frena la carga. */}
          {codigo && (
            <div
              style={{
                marginTop: 4,
                font: "500 12px var(--font-plex-mono), monospace",
                color: "var(--verde)",
              }}
            >
              {codigo}
              {descripcionGuardada && !conocido ? ` · ${descripcionGuardada}` : ""}
            </div>
          )}
          {sinResolver && (
            <div style={{ marginTop: 5 }}>
              <span className="sd" style={{ letterSpacing: ".08em" }}>
                SIN RESOLVER
              </span>
              <div
                style={{
                  marginTop: 3,
                  font: "400 11px/1.4 var(--font-plex-sans), sans-serif",
                  color: "var(--tinta-tenue)",
                }}
              >
                Se guarda tal cual; lo resuelve una persona.
              </div>
            </div>
          )}
        </div>

        <div>
          <div style={rotuloCampo}>Cabezas</div>
          <input
            value={borrador.cabezas}
            onChange={(e) => set({ cabezas: e.target.value })}
            inputMode="numeric"
            placeholder="80"
            className="campo"
          />
        </div>

        <div>
          <div style={rotuloCampo}>Kilos por cabeza</div>
          <input
            value={borrador.kilosPorCabeza}
            onChange={(e) => set({ kilosPorCabeza: e.target.value })}
            inputMode="decimal"
            placeholder="s/d"
            className="campo"
          />
          {/* SE PIDE POR CABEZA Y EL TOTAL SE MUESTRA DERIVADO: la casa escribe
              por cabeza (91 % de cobertura) y el total nunca (0 %). Lo que se
              guarda es el total, porque el total es el hecho. */}
          <div
            style={{
              marginTop: 4,
              font: "400 12px var(--font-plex-mono), monospace",
              color: "var(--tinta-tenue)",
            }}
          >
            {totalKilos === null ? "total s/d" : `total ${totalKilos} kg`}
          </div>
        </div>

        <div>
          <div style={rotuloCampo}>Precio</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={borrador.precio}
              onChange={(e) => set({ precio: e.target.value })}
              inputMode="decimal"
              placeholder="s/d"
              className="campo"
            />
            <select
              value={borrador.modalidadPrecio}
              onChange={(e) => set({ modalidadPrecio: e.target.value as ModalidadPrecio | "" })}
              className="campo"
              style={{ width: 95 }}
            >
              <option value="">—</option>
              <option value="KG">por kg</option>
              <option value="CABEZA">por cab.</option>
              <option value="BULTO">bulto</option>
            </select>
          </div>
        </div>

        <div>
          <div style={rotuloCampo}>Comisión</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={borrador.comision}
              onChange={(e) => set({ comision: e.target.value })}
              inputMode="decimal"
              placeholder="s/d"
              className="campo"
            />
            <select
              value={borrador.comisionModalidad}
              onChange={(e) =>
                set({ comisionModalidad: e.target.value as ModalidadComision | "" })
              }
              className="campo"
              style={{ width: 95 }}
            >
              <option value="">—</option>
              <option value="PORCENTAJE">%</option>
              <option value="MONTO">$</option>
            </select>
          </div>
          {/* Cero es un valor, s/d es otra cosa. Hay renglones legítimos con
              comisión cero, y el formulario no puede empujar a poner 0. */}
          {borrador.comision.trim() === "" && (
            <div
              style={{
                marginTop: 4,
                font: "400 11px var(--font-plex-sans), sans-serif",
                color: "var(--tinta-tenue)",
              }}
            >
              Vacío es s/d, no cero.
            </div>
          )}
        </div>

        <div>
          <div style={rotuloCampo}>Establecimiento</div>
          <select
            value={borrador.establecimientoId}
            onChange={(e) => set({ establecimientoId: e.target.value })}
            className="campo"
          >
            <option value="">s/d</option>
            {establecimientos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </div>

        {tropas.length > 0 && (
          <div>
            <div style={rotuloCampo}>Tropa</div>
            <select
              value={borrador.tropaId}
              onChange={(e) => set({ tropaId: e.target.value })}
              className="campo"
            >
              <option value="">s/d</option>
              {tropas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <datalist id="sinonimos-categoria">
        {sinonimos.map((s) => (
          <option key={s.texto} value={s.texto}>
            {s.codigo ?? "sin resolver"}
          </option>
        ))}
      </datalist>

      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={onGuardar}
          disabled={pendiente || (sucio === false && !onCancelar)}
          style={{
            ...botonPrincipal,
            opacity: pendiente || (sucio === false && !onCancelar) ? 0.5 : 1,
          }}
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} disabled={pendiente} style={botonSecundario}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

const rotuloCampo: React.CSSProperties = {
  marginBottom: 5,
  font: "500 12px var(--font-plex-sans), sans-serif",
  color: "var(--tinta-suave)",
};

const botonPrincipal: React.CSSProperties = {
  padding: "10px 18px",
  font: "500 14px var(--font-plex-sans), sans-serif",
  color: "var(--papel)",
  background: "var(--verde)",
  border: "1px solid var(--verde-hondo)",
  borderRadius: 2,
  cursor: "pointer",
};

const botonSecundario: React.CSSProperties = {
  padding: "10px 16px",
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
