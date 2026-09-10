"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { EstadoReporte, MotivoDescarte } from "@/generated/prisma/enums";
import {
  crearCompraDesdeReporte,
  descartarReporte,
  marcarProcesado,
  revertirProcesado,
} from "@/lib/acciones-bandeja";

export type FilaBandeja = {
  id: number;
  estado: EstadoReporte;
  fecha: string | null;
  consignatario: string | null;
  plaza: string | null;
  cabezas: number | null;
  camiones: number | null;
  remitos: number;
  observaciones: string | null;
  recibidoEn: string;
  cargadoEn: string;
  cuenta: string | null;
  personaCompradora: string | null;
  motivoDescarte: MotivoDescarte | null;
  estadoCambiadoPor: string | null;
  estadoCambiadoEn: string | null;
  compras: { id: number; fecha: string }[];
};

export type OpcionEntidad = { id: number; nombre: string };

const MOTIVOS: { valor: MotivoDescarte; texto: string; ayuda: string }[] = [
  { valor: "DUPLICADO", texto: "Duplicado", ayuda: "ya llegó el mismo reporte antes" },
  { valor: "ERROR", texto: "Error", ayuda: "se mandó por equivocación" },
  { valor: "NO_SE_HIZO", texto: "La compra no se hizo", ayuda: "la operación se cayó" },
];

const TEXTO_MOTIVO: Record<MotivoDescarte, string> = {
  DUPLICADO: "duplicado",
  ERROR: "error",
  NO_SE_HIZO: "la compra no se hizo",
};

export function Bandeja({
  pendientes,
  recientes,
  empresas,
  consignatarios,
}: {
  pendientes: FilaBandeja[];
  recientes: FilaBandeja[];
  empresas: OpcionEntidad[];
  consignatarios: OpcionEntidad[];
}) {
  const [errores, setErrores] = useState<string[]>([]);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          paddingBottom: 16,
          borderBottom: "2px solid var(--tinta)",
        }}
      >
        <h1 style={{ margin: 0, font: "600 26px/1.1 var(--font-plex-sans), sans-serif" }}>
          Bandeja
        </h1>
        <span
          style={{
            font: "400 13px/1 var(--font-plex-mono), monospace",
            color: "var(--tinta-suave)",
          }}
        >
          {pendientes.length} {pendientes.length === 1 ? "pendiente" : "pendientes"}
        </span>
        <div style={{ flex: 1 }} />
        <Link
          href="/compras/nueva"
          style={{
            padding: "9px 16px",
            font: "500 14px var(--font-plex-sans), sans-serif",
            color: "var(--papel)",
            background: "var(--verde)",
            border: "1px solid var(--verde-hondo)",
            borderRadius: 2,
            textDecoration: "none",
          }}
        >
          Registrar una compra sin reporte
        </Link>
      </div>

      {errores.length > 0 && (
        <div
          role="alert"
          style={{
            marginTop: 18,
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

      {pendientes.length === 0 ? (
        <Vacia />
      ) : (
        <div style={{ marginTop: 22 }}>
          {pendientes.map((r) => (
            <Tarjeta
              key={r.id}
              reporte={r}
              empresas={empresas}
              consignatarios={consignatarios}
              avisar={setErrores}
            />
          ))}
        </div>
      )}

      {recientes.length > 0 && (
        <div style={{ marginTop: 46 }}>
          <h2 className="seccion" style={{ margin: 0 }}>
            Cerrados esta semana
          </h2>
          <div style={{ marginTop: 12 }}>
            {recientes.map((r) => (
              <Cerrado key={r.id} reporte={r} avisar={setErrores} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * La bandeja vacía NO es una pantalla de error ni un placeholder: es como está
 * la mayor parte del tiempo, y lo dice. Más de la mitad de las compras no
 * tienen reporte, así que un cartel de «no hay nada» a secas se leería como que
 * algo dejó de funcionar.
 */
function Vacia() {
  return (
    <div style={{ marginTop: 50, maxWidth: 640 }}>
      <div className="rotulo" style={{ color: "var(--tinta-fantasma)" }}>
        No hay reportes esperando
      </div>
      <h2
        style={{
          margin: "16px 0 0",
          font: "600 28px/1.22 var(--font-plex-sans), sans-serif",
          letterSpacing: "-.015em",
          maxWidth: "16em",
        }}
      >
        Vacía es como está la mayor parte del tiempo.
      </h2>
      <p
        style={{
          margin: "18px 0 0",
          font: "400 16px/1.6 var(--font-plex-sans), sans-serif",
          color: "var(--tinta-media)",
        }}
      >
        En más de la mitad de las compras no hay reporte: en la feria de Darwash
        —la mitad de todo— los remitos llegan acá directamente y nadie manda nada
        desde el celular. Que la bandeja esté vacía no significa que falte algo.
      </p>
      <p
        style={{
          margin: "14px 0 26px",
          font: "400 15px/1.6 var(--font-plex-sans), sans-serif",
          color: "var(--tinta-suave)",
        }}
      >
        El camino de siempre sigue siendo el principal en volumen.
      </p>
      <Link
        href="/compras/nueva"
        style={{
          display: "inline-block",
          padding: "13px 22px",
          font: "500 16px var(--font-plex-sans), sans-serif",
          color: "var(--papel)",
          background: "var(--verde)",
          border: "1px solid var(--verde-hondo)",
          borderRadius: 2,
          textDecoration: "none",
        }}
      >
        Registrar una compra
      </Link>
    </div>
  );
}

function Tarjeta({
  reporte,
  empresas,
  consignatarios,
  avisar,
}: {
  reporte: FilaBandeja;
  empresas: OpcionEntidad[];
  consignatarios: OpcionEntidad[];
  avisar: (e: string[]) => void;
}) {
  const router = useRouter();
  const [pendiente, arrancar] = useTransition();
  const [abriendo, setAbriendo] = useState(false);
  const [confirmando, setConfirmando] = useState<"procesar" | "descartar" | null>(null);
  const [motivo, setMotivo] = useState<MotivoDescarte | "">("");
  const [empresaId, setEmpresaId] = useState<string>(String(empresas[0]?.id ?? ""));
  const [consignatarioId, setConsignatarioId] = useState<string>("");

  // El consignatario del reporte es texto libre. Si coincide con uno del
  // padrón se preselecciona; si no, la oficina elige. No se adivina.
  const sugerido =
    consignatarios.find(
      (c) => c.nombre.toLowerCase() === (reporte.consignatario ?? "").trim().toLowerCase()
    ) ?? null;

  function armar() {
    avisar([]);
    const empresa = Number(empresaId);
    const consig = Number(consignatarioId || sugerido?.id || 0);
    if (!empresa || !consig) {
      avisar(["Hace falta la empresa titular y el consignatario para poder crear la compra."]);
      return;
    }
    arrancar(async () => {
      const r = await crearCompraDesdeReporte(reporte.id, empresa, consig);
      if (!r.ok) {
        avisar(r.errores);
        return;
      }
      router.push(`/compras/${r.id}`);
    });
  }

  function procesar() {
    avisar([]);
    arrancar(async () => {
      const r = await marcarProcesado(reporte.id);
      if (!r.ok) avisar(r.errores);
      else {
        setConfirmando(null);
        router.refresh();
      }
    });
  }

  function descartar() {
    avisar([]);
    if (!motivo) {
      avisar(["Hay que decir por qué se descarta: del otro lado el comprador va a leerlo."]);
      return;
    }
    arrancar(async () => {
      const r = await descartarReporte(reporte.id, motivo);
      if (!r.ok) avisar(r.errores);
      else {
        setConfirmando(null);
        router.refresh();
      }
    });
  }

  return (
    <div
      style={{
        marginBottom: 14,
        background: "var(--papel-alto)",
        border: "1px solid var(--borde)",
        borderLeft: "3px solid var(--verde)",
        borderRadius: 3,
        padding: "16px 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
        <span
          style={{
            font: "500 16px var(--font-plex-mono), monospace",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {reporte.fecha ?? "s/d"}
        </span>
        <span style={{ font: "500 17px var(--font-plex-sans), sans-serif" }}>
          {reporte.consignatario ?? "sin consignatario"}
        </span>
        <span
          style={{
            font: "400 14px var(--font-plex-sans), sans-serif",
            color: "var(--tinta-suave)",
          }}
        >
          {reporte.plaza ?? "plaza s/d"}
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            font: "400 12px var(--font-plex-mono), monospace",
            color: "var(--tinta-tenue)",
          }}
        >
          {/* LA CUENTA COMO CUENTA. No dice «lo mandó Fulano»: dice de qué
              cuenta llegó, que es lo único que siempre es cierto. */}
          cuenta {reporte.cuenta ?? "s/d"}
          {reporte.personaCompradora && ` · fue ${reporte.personaCompradora}`}
        </span>
      </div>

      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 22,
          flexWrap: "wrap",
          font: "400 14px var(--font-plex-sans), sans-serif",
          color: "var(--tinta-media)",
        }}
      >
        <Dato rotulo="cabezas aprox." valor={reporte.cabezas} />
        <Dato rotulo="camiones" valor={reporte.camiones} />
        <Dato rotulo="remitos" valor={reporte.remitos} />
      </div>

      {reporte.observaciones && (
        // La nota a la vista: con ella se decide sin abrir el reporte.
        <p
          style={{
            margin: "12px 0 0",
            padding: "10px 12px",
            background: "#fdf8ec",
            border: "1px solid #e6d9b8",
            borderRadius: 2,
            font: "400 14px/1.5 var(--font-plex-sans), sans-serif",
            color: "#5d4d22",
          }}
        >
          «{reporte.observaciones}»
        </p>
      )}

      {reporte.compras.length > 0 && (
        <div
          style={{
            marginTop: 12,
            font: "400 13px var(--font-plex-sans), sans-serif",
            color: "var(--tinta-suave)",
          }}
        >
          {/* Un reporte puede dar VARIAS compras, y por eso «armar otra» sigue
              disponible después de la primera. */}
          Ya salieron{" "}
          {reporte.compras.map((c, i) => (
            <span key={c.id}>
              {i > 0 && " · "}
              <Link href={`/compras/${c.id}`}>#{c.id}</Link>
            </span>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Boton onClick={() => setAbriendo(!abriendo)} principal>
          {reporte.compras.length ? "Armar otra compra" : "Armar la compra"}
        </Boton>
        <Boton onClick={() => setConfirmando(confirmando === "procesar" ? null : "procesar")}>
          Marcar procesado
        </Boton>
        <Boton onClick={() => setConfirmando(confirmando === "descartar" ? null : "descartar")}>
          Descartar
        </Boton>
        <Link
          href={`/reportes/${reporte.id}`}
          style={{
            padding: "9px 14px",
            font: "400 14px var(--font-plex-sans), sans-serif",
            color: "var(--tinta-suave)",
          }}
        >
          Ver el reporte
        </Link>
      </div>

      {abriendo && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            background: "var(--papel-medio)",
            border: "1px solid var(--borde)",
            borderRadius: 2,
          }}
        >
          <div
            style={{
              font: "400 13px/1.5 var(--font-plex-sans), sans-serif",
              color: "var(--tinta-suave)",
              marginBottom: 10,
            }}
          >
            El reporte no dice bajo qué empresa se registra la compra — eso es de
            la oficina. Y el consignatario que escribió el comprador es texto: se
            confirma contra el padrón, no se adivina.
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Campo rotulo="Empresa titular">
              <select
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}
                className="campo"
                style={{ minWidth: 200 }}
              >
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Consignatario">
              <select
                value={consignatarioId || String(sugerido?.id ?? "")}
                onChange={(e) => setConsignatarioId(e.target.value)}
                className="campo"
                style={{ minWidth: 220 }}
              >
                <option value="">— elegir —</option>
                {consignatarios.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Boton onClick={armar} principal disabled={pendiente}>
              {pendiente ? "Creando…" : "Crear y cargar los renglones"}
            </Boton>
          </div>
        </div>
      )}

      {confirmando === "procesar" && (
        <Confirmacion
          tono="aviso"
          titulo="Marcar procesado congela el reporte del otro lado"
          disabled={pendiente}
          onConfirmar={procesar}
          onCancelar={() => setConfirmando(null)}
          textoConfirmar="Sí, marcarlo procesado"
        >
          La cuenta <strong>{reporte.cuenta ?? "s/d"}</strong> va a dejar de poder
          corregirlo: los campos se le vuelven texto plano y la pantalla le dice
          que la oficina ya armó la compra. Es reversible, pero para entonces él
          ya vio el cartel.
        </Confirmacion>
      )}

      {confirmando === "descartar" && (
        <Confirmacion
          tono="aviso"
          titulo="¿Por qué se descarta?"
          disabled={pendiente}
          onConfirmar={descartar}
          onCancelar={() => setConfirmando(null)}
          textoConfirmar="Descartar"
        >
          <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
            {MOTIVOS.map((m) => (
              <label key={m.valor} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <input
                  type="radio"
                  name={`motivo-${reporte.id}`}
                  checked={motivo === m.valor}
                  onChange={() => setMotivo(m.valor)}
                />
                <span>
                  {m.texto}{" "}
                  <span style={{ color: "var(--tinta-tenue)" }}>— {m.ayuda}</span>
                </span>
              </label>
            ))}
          </div>
          <p style={{ margin: "10px 0 0" }}>
            El reporte <strong>sigue existiendo</strong>: alguien fue a una feria,
            sacó fotos y escribió lo que vio. El comprador va a ver el motivo.
          </p>
        </Confirmacion>
      )}
    </div>
  );
}

function Cerrado({
  reporte,
  avisar,
}: {
  reporte: FilaBandeja;
  avisar: (e: string[]) => void;
}) {
  const router = useRouter();
  const [pendiente, arrancar] = useTransition();

  function revertir() {
    avisar([]);
    arrancar(async () => {
      const r = await revertirProcesado(reporte.id);
      if (!r.ok) avisar(r.errores);
      else router.refresh();
    });
  }

  const descartado = reporte.estado === "DESCARTADO";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
        padding: "11px 14px",
        marginBottom: 7,
        background: "var(--papel-medio)",
        border: "1px solid var(--borde)",
        borderRadius: 2,
        font: "400 14px var(--font-plex-sans), sans-serif",
      }}
    >
      <span
        style={{
          font: "500 11px/1 var(--font-plex-mono), monospace",
          letterSpacing: ".06em",
          padding: "4px 7px",
          borderRadius: 2,
          color: descartado ? "var(--aviso-hondo)" : "var(--rol-empresa)",
          background: descartado ? "var(--aviso-claro)" : "#e8eef2",
          border: `1px solid ${descartado ? "var(--aviso-borde)" : "#cbdae3"}`,
        }}
      >
        {descartado ? "DESCARTADO" : "PROCESADO"}
      </span>
      <span style={{ font: "400 13px var(--font-plex-mono), monospace" }}>
        {reporte.fecha ?? "s/d"}
      </span>
      <span>{reporte.consignatario ?? "sin consignatario"}</span>
      {descartado && reporte.motivoDescarte && (
        <span style={{ color: "var(--tinta-suave)" }}>
          — {TEXTO_MOTIVO[reporte.motivoDescarte]}
        </span>
      )}
      {reporte.compras.length > 0 && (
        <span style={{ color: "var(--tinta-suave)" }}>
          →{" "}
          {reporte.compras.map((c, i) => (
            <span key={c.id}>
              {i > 0 && " · "}
              <Link href={`/compras/${c.id}`}>#{c.id}</Link>
            </span>
          ))}
        </span>
      )}
      <div style={{ flex: 1 }} />
      <span
        style={{
          font: "400 12px var(--font-plex-mono), monospace",
          color: "var(--tinta-tenue)",
        }}
      >
        {/* Quién lo cerró y cuándo. `actualizadoEn` no serviría: se mueve con
            cualquier cambio. */}
        {reporte.estadoCambiadoPor ?? "s/d"} ·{" "}
        {reporte.estadoCambiadoEn?.slice(0, 10) ?? "s/d"}
      </span>
      <Boton onClick={revertir} disabled={pendiente}>
        {pendiente ? "…" : "Volver a pendiente"}
      </Boton>
    </div>
  );
}

// ------------------------------------------------------------------ piezas

function Dato({ rotulo, valor }: { rotulo: string; valor: number | null }) {
  return (
    <span>
      <span style={{ color: "var(--tinta-tenue)" }}>{rotulo} </span>
      {valor === null ? <span className="sd">s/d</span> : <strong>{valor}</strong>}
    </span>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          marginBottom: 5,
          font: "500 12px var(--font-plex-sans), sans-serif",
          color: "var(--tinta-suave)",
        }}
      >
        {rotulo}
      </div>
      {children}
    </div>
  );
}

function Boton({
  onClick,
  children,
  principal,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  principal?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "9px 15px",
        font: "500 14px var(--font-plex-sans), sans-serif",
        color: principal ? "var(--papel)" : "var(--tinta-media)",
        background: principal ? "var(--verde)" : "transparent",
        border: `1px solid ${principal ? "var(--verde-hondo)" : "var(--borde-firme)"}`,
        borderRadius: 2,
        cursor: disabled ? "progress" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Confirmacion({
  titulo,
  children,
  onConfirmar,
  onCancelar,
  textoConfirmar,
  disabled,
}: {
  tono: "aviso";
  titulo: string;
  children: React.ReactNode;
  onConfirmar: () => void;
  onCancelar: () => void;
  textoConfirmar: string;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: "13px 15px",
        background: "var(--aviso-claro)",
        border: "1px solid var(--aviso-borde)",
        borderLeft: "4px solid var(--aviso)",
        borderRadius: 2,
        font: "400 14px/1.55 var(--font-plex-sans), sans-serif",
      }}
    >
      <div style={{ font: "600 15px var(--font-plex-sans), sans-serif", marginBottom: 6 }}>
        {titulo}
      </div>
      {children}
      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={onConfirmar}
          disabled={disabled}
          style={{
            padding: "9px 15px",
            font: "500 14px var(--font-plex-sans), sans-serif",
            color: "var(--papel)",
            background: "var(--aviso-hondo)",
            border: "1px solid var(--aviso-hondo)",
            borderRadius: 2,
            cursor: disabled ? "progress" : "pointer",
          }}
        >
          {textoConfirmar}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={disabled}
          style={{
            padding: "9px 15px",
            font: "400 14px var(--font-plex-sans), sans-serif",
            color: "var(--tinta-suave)",
            background: "transparent",
            border: "1px solid var(--borde-fuerte)",
            borderRadius: 2,
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
