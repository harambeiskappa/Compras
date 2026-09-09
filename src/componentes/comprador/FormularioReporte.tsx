"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  catalogoParaUsar,
  CATALOGO_VACIO,
  type CatalogoCacheado,
} from "@/lib/dispositivo/catalogos";
import { encolar } from "@/lib/dispositivo/cola";
import { borrarBorrador, guardarBorrador, listarBorradores } from "@/lib/dispositivo/db";
import { comprimirFoto } from "@/lib/dispositivo/fotos";
import type { BorradorReporte, RemitoLocal } from "@/lib/dispositivo/tipos";

import { Acuse } from "./Acuse";
import { HojaSeleccion } from "./HojaSeleccion";
import { Primera } from "./Primera";

/**
 * El reporte, EN UNA SOLA HOJA.
 *
 * Por pasos se descartó: en una pantalla de celular con ocho campos, los pasos
 * esconden lo que falta y obligan a volver atrás para corregir. En una sola
 * hoja se ve todo y se completa en el orden que venga la información, que en un
 * remate no es el orden del formulario.
 *
 * SE GUARDA APENAS SE ESCRIBE, no al salir ni al apretar un botón. Si el
 * teléfono se muere en la feria, lo escrito hasta ese momento tiene que estar.
 */

function hoy(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function nuevoBorrador(): BorradorReporte {
  const ahora = new Date().toISOString();
  return {
    // LA CLAVE NACE ACÁ, antes de que haya red. Es lo único que impide que una
    // conexión que va y viene cree dos reportes iguales.
    clave: crypto.randomUUID(),
    cargadoEn: ahora,
    actualizadoEn: ahora,
    fecha: hoy(),
    consignatarioTexto: null,
    consignatarioId: null,
    plazaTexto: null,
    cabezasAproximadas: null,
    cantidadCamiones: null,
    observaciones: null,
    remitos: [],
  };
}

export function FormularioReporte() {
  const [borrador, setBorrador] = useState<BorradorReporte | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoCacheado>(CATALOGO_VACIO);
  const [hoja, setHoja] = useState<"consignatario" | "plaza" | null>(null);
  const [enviado, setEnviado] = useState<BorradorReporte | null>(null);
  const [hayRed, setHayRed] = useState(true);
  const [comprimiendo, setComprimiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verIntro, setVerIntro] = useState(false);

  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendiente = useRef<BorradorReporte | null>(null);

  // --- arranque: retomar el borrador que haya, o empezar uno ---
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const borradores = await listarBorradores();
        const ultimo = borradores.sort((a, b) =>
          b.actualizadoEn.localeCompare(a.actualizadoEn)
        )[0];
        if (!vivo) return;
        setBorrador(ultimo ?? nuevoBorrador());
        // La primera vez no hay nada cargado y tampoco nada mandado: ahí se
        // explica qué es un reporte, en tres pasos.
        setVerIntro(!ultimo && localStorage.getItem("comprador-intro") !== "vista");
      } catch {
        if (vivo) setBorrador(nuevoBorrador());
      }
      const c = await catalogoParaUsar((nuevo) => vivo && setCatalogo(nuevo));
      if (vivo) setCatalogo(c);
    })();

    const red = () => setHayRed(navigator.onLine);
    red();
    window.addEventListener("online", red);
    window.addEventListener("offline", red);
    return () => {
      vivo = false;
      window.removeEventListener("online", red);
      window.removeEventListener("offline", red);
    };
  }, []);

  // --- guardado ---
  const guardar = useCallback((b: BorradorReporte) => {
    pendiente.current = b;
    if (temporizador.current) clearTimeout(temporizador.current);
    // 400 ms: lo bastante corto para que un teléfono que se muere pierda una
    // palabra y no un reporte, y lo bastante largo para no escribir en disco
    // en cada tecla.
    temporizador.current = setTimeout(() => {
      if (pendiente.current) void guardarBorrador(pendiente.current);
      pendiente.current = null;
    }, 400);
  }, []);

  // Si la app se va a segundo plano —una foto, una llamada— se escribe ya. Los
  // timers en un celular en background se congelan.
  useEffect(() => {
    const volcar = () => {
      if (pendiente.current) {
        void guardarBorrador(pendiente.current);
        pendiente.current = null;
      }
    };
    document.addEventListener("visibilitychange", volcar);
    window.addEventListener("pagehide", volcar);
    return () => {
      document.removeEventListener("visibilitychange", volcar);
      window.removeEventListener("pagehide", volcar);
    };
  }, []);

  const cambiar = useCallback(
    (parche: Partial<BorradorReporte>) => {
      setBorrador((previo) => {
        if (!previo) return previo;
        const nuevo = { ...previo, ...parche, actualizadoEn: new Date().toISOString() };
        guardar(nuevo);
        return nuevo;
      });
    },
    [guardar]
  );

  // Las fotos se guardan YA, sin esperar el debounce: es lo único que no se
  // puede volver a escribir si el teléfono se apaga.
  const cambiarRemitos = useCallback((remitos: RemitoLocal[]) => {
    setBorrador((previo) => {
      if (!previo) return previo;
      const nuevo = { ...previo, remitos, actualizadoEn: new Date().toISOString() };
      void guardarBorrador(nuevo);
      return nuevo;
    });
  }, []);

  async function agregarFotos(archivos: FileList | null) {
    if (!archivos?.length || !borrador) return;
    setComprimiendo(true);
    setError(null);
    try {
      const nuevos: RemitoLocal[] = [];
      for (const archivo of Array.from(archivos)) {
        const { blob } = await comprimirFoto(archivo);
        nuevos.push({ id: crypto.randomUUID(), foto: blob, numero: null, nota: null });
      }
      cambiarRemitos([...borrador.remitos, ...nuevos]);
    } catch {
      setError("No se pudo agregar la foto. Probá de nuevo.");
    } finally {
      setComprimiendo(false);
    }
  }

  async function mandar() {
    if (!borrador) return;
    setError(null);
    // Ningún botón puede quedar muerto por una excepción que nadie muestra. Acá
    // es donde más importa: sin señal, que el envío no salga es lo NORMAL.
    try {
      await encolar(borrador);
      setEnviado(borrador);
      setBorrador(nuevoBorrador());
    } catch (e) {
      console.error("No se pudo encolar el reporte:", e);
      setError(
        "No se pudo poner en la cola de envío. Lo cargado sigue guardado en el teléfono."
      );
    }
  }

  if (enviado) {
    return (
      <Acuse
        reporte={enviado}
        alSeguir={() => {
          setEnviado(null);
          setError(null);
        }}
      />
    );
  }

  if (!borrador) {
    return (
      <p style={{ padding: "40px 0", color: "var(--tinta-suave)" }}>Abriendo…</p>
    );
  }

  if (verIntro) {
    return (
      <Primera
        alEmpezar={() => {
          localStorage.setItem("comprador-intro", "vista");
          setVerIntro(false);
        }}
      />
    );
  }

  const vacio =
    !borrador.consignatarioTexto &&
    !borrador.plazaTexto &&
    borrador.cabezasAproximadas === null &&
    borrador.cantidadCamiones === null &&
    !borrador.observaciones &&
    borrador.remitos.length === 0;

  return (
    <div style={{ paddingTop: 18 }}>
      <h1
        style={{
          margin: "0 0 4px",
          font: "600 24px/1.15 var(--font-plex-sans), sans-serif",
          letterSpacing: "-.015em",
        }}
      >
        Reporte de la feria
      </h1>
      <p
        style={{
          margin: "0 0 22px",
          font: "400 14px/1.5 var(--font-plex-sans), sans-serif",
          color: "var(--tinta-suave)",
        }}
      >
        Lo grueso y las fotos de los remitos. Las categorías, los kilos y los
        precios los carga la oficina con el papel delante.
      </p>

      {/* ---------------- fecha ---------------- */}
      <Campo rotulo="Fecha de la compra">
        <input
          type="date"
          value={borrador.fecha ?? ""}
          onChange={(e) => cambiar({ fecha: e.target.value || null })}
          className="campo"
          style={{ fontSize: 16 }}
        />
        <Pie>Viene con la de hoy. Si la feria fue ayer, se cambia.</Pie>
      </Campo>

      {/* ---------------- consignatario ---------------- */}
      <Campo rotulo="Consignatario">
        <Elegido
          valor={borrador.consignatarioTexto}
          vacio="Elegir o escribir"
          alAbrir={() => setHoja("consignatario")}
        />
        {/* NUNCA «Feria»: el consignatario existe también en la compra directa,
            y con ese rótulo quien compra directo lo deja vacío. Son las 14
            compras sin consignatario del histórico. */}
        <Pie>
          Quien remata o intermedia. También en la compra directa hay
          consignatario.
        </Pie>
      </Campo>

      {/* ---------------- plaza ---------------- */}
      <Campo rotulo="Plaza">
        <Elegido
          valor={borrador.plazaTexto}
          vacio="Elegir o escribir"
          alAbrir={() => setHoja("plaza")}
        />
        <Pie>El lugar donde se compró.</Pie>
      </Campo>

      {/* ---------------- cabezas ---------------- */}
      <Campo rotulo="Cabezas aproximadas">
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={borrador.cabezasAproximadas ?? ""}
            onChange={(e) =>
              cambiar({
                cabezasAproximadas: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            placeholder="80"
            className="campo"
            style={{ fontSize: 16, flex: 1 }}
          />
          {/* «s/d» tiene que ser MÁS FÁCIL que inventar un número. Si poner un
              número aproximado es más cómodo que decir «no sé», alguien va a
              inventarlo, y después nadie distingue el inventado del contado. */}
          <BotonSd
            activo={borrador.cabezasAproximadas === null}
            alTocar={() => cambiar({ cabezasAproximadas: null })}
          />
        </div>
        <Pie>Aproximadas está bien. La cuenta fina sale del remito.</Pie>
      </Campo>

      {/* ---------------- camiones ---------------- */}
      <Campo rotulo="Camiones">
        <Camiones
          valor={borrador.cantidadCamiones}
          alCambiar={(v) => cambiar({ cantidadCamiones: v })}
        />
        <Pie>Cuatro de cada cinco compras salen en uno solo.</Pie>
      </Campo>

      {/* ---------------- remitos ---------------- */}
      <div style={{ marginTop: 30 }}>
        <div className="seccion" style={{ marginBottom: 4 }}>
          Remitos
        </div>
        <Pie>
          La foto es lo que no puede faltar. El número, si lo tenés a mano.
        </Pie>

        {borrador.remitos.map((r, i) => (
          <Remito
            key={r.id}
            remito={r}
            indice={i}
            alCambiar={(parche) =>
              cambiarRemitos(
                borrador.remitos.map((x) => (x.id === r.id ? { ...x, ...parche } : x))
              )
            }
            alBorrar={() =>
              cambiarRemitos(borrador.remitos.filter((x) => x.id !== r.id))
            }
          />
        ))}

        <label
          style={{
            display: "block",
            marginTop: 12,
            padding: "16px 14px",
            textAlign: "center",
            background: "var(--papel-alto)",
            border: "1px dashed var(--borde-firme)",
            borderRadius: 3,
            font: "500 15px var(--font-plex-sans), sans-serif",
            color: "var(--verde)",
            cursor: "pointer",
          }}
        >
          {comprimiendo ? "Preparando la foto…" : "＋ Sacar o elegir una foto"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            disabled={comprimiendo}
            onChange={(e) => {
              void agregarFotos(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {/* ---------------- observaciones ---------------- */}
      <Campo rotulo="Observaciones">
        <textarea
          rows={3}
          value={borrador.observaciones ?? ""}
          onChange={(e) => cambiar({ observaciones: e.target.value || null })}
          placeholder="Lo que no entra en ningún campo"
          className="campo"
          style={{ fontSize: 16, resize: "vertical" }}
        />
        <Pie>
          Acá va lo que viste distinto del papel: «el remito dice VQ, para mí es
          VA». Esa diferencia es la que interesa guardar.
        </Pie>
      </Campo>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 20,
            padding: "11px 13px",
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

      <button
        type="button"
        onClick={() => void mandar()}
        disabled={vacio}
        style={{
          width: "100%",
          marginTop: 26,
          padding: "16px 20px",
          font: "600 17px var(--font-plex-sans), sans-serif",
          color: "var(--papel)",
          background: vacio ? "var(--borde-firme)" : "var(--verde)",
          border: `1px solid ${vacio ? "var(--borde-firme)" : "var(--verde-hondo)"}`,
          borderRadius: 3,
          cursor: vacio ? "not-allowed" : "pointer",
        }}
      >
        Mandar el reporte
      </button>
      {vacio && (
        <Pie>Todavía no hay nada que mandar: cargá algo o sacá una foto.</Pie>
      )}
      {!vacio && !hayRed && (
        <Pie>
          Sin señal ahora mismo: queda guardado y sale solo en cuanto vuelva.
        </Pie>
      )}

      <button
        type="button"
        onClick={() => {
          if (!confirm("¿Descartar lo cargado? No se puede deshacer.")) return;
          void borrarBorrador(borrador.clave);
          setBorrador(nuevoBorrador());
        }}
        style={{
          width: "100%",
          marginTop: 14,
          padding: "12px",
          background: "transparent",
          border: 0,
          font: "400 14px var(--font-plex-sans), sans-serif",
          color: "var(--tinta-tenue)",
          cursor: "pointer",
        }}
      >
        Descartar este borrador
      </button>

      {hoja === "consignatario" && (
        <HojaSeleccion
          titulo="Consignatario"
          ayuda="Quien remata o intermedia. También en la compra directa hay uno."
          opciones={catalogo.consignatarios.map((c) => ({
            nombre: c.nombre,
            detalle: c.usos > 0 ? `${c.usos}` : undefined,
          }))}
          valor={borrador.consignatarioTexto}
          hayRed={hayRed}
          puedeCrear
          alElegir={(nombre) => {
            const conocido = catalogo.consignatarios.find((c) => c.nombre === nombre);
            // El texto SIEMPRE. El id solo si salió del catálogo, y como
            // comodidad: sin señal la entidad puede no existir del otro lado.
            cambiar({ consignatarioTexto: nombre, consignatarioId: conocido?.id ?? null });
            setHoja(null);
          }}
          alCerrar={() => setHoja(null)}
        />
      )}

      {hoja === "plaza" && (
        <HojaSeleccion
          titulo="Plaza"
          ayuda="El lugar donde se compró. Si es una nueva, escribila."
          opciones={catalogo.plazas.map((p) => ({ nombre: p }))}
          valor={borrador.plazaTexto}
          hayRed={hayRed}
          puedeCrear
          alElegir={(nombre) => {
            cambiar({ plazaTexto: nombre });
            setHoja(null);
          }}
          alCerrar={() => setHoja(null)}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ piezas

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          marginBottom: 7,
          font: "500 14px/1.2 var(--font-plex-sans), sans-serif",
        }}
      >
        {rotulo}
      </div>
      {children}
    </div>
  );
}

function Pie({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 6,
        font: "400 12px/1.5 var(--font-plex-sans), sans-serif",
        color: "var(--tinta-tenue)",
      }}
    >
      {children}
    </div>
  );
}

function Elegido({
  valor,
  vacio,
  alAbrir,
}: {
  valor: string | null;
  vacio: string;
  alAbrir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={alAbrir}
      className="campo"
      style={{
        fontSize: 16,
        textAlign: "left",
        cursor: "pointer",
        color: valor ? "var(--tinta)" : "var(--tinta-fantasma)",
        minHeight: 46,
      }}
    >
      {valor ?? vacio}
    </button>
  );
}

function BotonSd({ activo, alTocar }: { activo: boolean; alTocar: () => void }) {
  return (
    <button
      type="button"
      onClick={alTocar}
      className="sd"
      aria-pressed={activo}
      style={{
        cursor: "pointer",
        padding: "0 14px",
        opacity: activo ? 1 : 0.55,
        borderStyle: activo ? "solid" : "dashed",
      }}
    >
      s/d
    </button>
  );
}

/**
 * Camiones con teclas: una mano, sin teclado.
 *
 * El rango llega a «6+» aunque el máximo observado sea 4 — mediana 1, p90 2.
 * **El 4 es un piso y no un techo**: la captura de DTE del sistema viejo es
 * floja (hay compras de 859 cabezas con un solo DTE registrado, que no cierra
 * con ningún camión real), así que camiones de verdad puede haber más.
 *
 * «6+» NO guarda 6. Abre un campo para tipear el número exacto: guardar 6
 * cuando fueron nueve es inventar el dato, que es lo que esta app existe para
 * no repetir.
 */
function Camiones({
  valor,
  alCambiar,
}: {
  valor: number | null;
  alCambiar: (v: number | null) => void;
}) {
  const [tipeando, setTipeando] = useState(false);
  const teclas = [1, 2, 3, 4, 5];
  const enTeclas = valor !== null && teclas.includes(valor);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {teclas.map((n) => (
          <Tecla
            key={n}
            activa={valor === n}
            alTocar={() => {
              alCambiar(n);
              setTipeando(false);
            }}
          >
            {n}
          </Tecla>
        ))}
        <Tecla
          activa={(valor !== null && !enTeclas) || tipeando}
          alTocar={() => setTipeando(true)}
        >
          6+
        </Tecla>
        <Tecla
          activa={valor === null && !tipeando}
          alTocar={() => {
            alCambiar(null);
            setTipeando(false);
          }}
          rayada
        >
          s/d
        </Tecla>
      </div>

      {(tipeando || (valor !== null && !enTeclas)) && (
        <input
          type="number"
          inputMode="numeric"
          min={6}
          autoFocus={tipeando}
          value={valor !== null && !enTeclas ? valor : ""}
          onChange={(e) => alCambiar(e.target.value === "" ? null : Number(e.target.value))}
          placeholder="cuántos"
          className="campo"
          style={{ fontSize: 16, marginTop: 8 }}
        />
      )}
    </div>
  );
}

function Tecla({
  activa,
  rayada,
  alTocar,
  children,
}: {
  activa: boolean;
  rayada?: boolean;
  alTocar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={alTocar}
      aria-pressed={activa}
      className={rayada && activa ? "sd" : undefined}
      style={{
        minWidth: 52,
        minHeight: 46,
        padding: "0 12px",
        font: "500 16px var(--font-plex-sans), sans-serif",
        color: activa && !rayada ? "var(--papel)" : "var(--tinta-media)",
        background: activa && !rayada ? "var(--verde)" : "var(--papel-alto)",
        border: `1px solid ${activa && !rayada ? "var(--verde-hondo)" : "var(--borde-fuerte)"}`,
        borderRadius: 3,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/** Un remito: la foto arriba, y debajo su número y su nota. */
function Remito({
  remito,
  indice,
  alCambiar,
  alBorrar,
}: {
  remito: RemitoLocal;
  indice: number;
  alCambiar: (p: Partial<RemitoLocal>) => void;
  alBorrar: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(remito.foto);
    setUrl(u);
    // Sin esto, cada re-render filtra una URL de objeto y el navegador retiene
    // el Blob entero en memoria. Con cuatro fotos de un remate, se nota.
    return () => URL.revokeObjectURL(u);
  }, [remito.foto]);

  return (
    <div
      style={{
        marginTop: 12,
        background: "var(--papel-alto)",
        border: "1px solid var(--borde)",
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`Remito ${indice + 1}`}
          style={{ width: "100%", display: "block", maxHeight: 260, objectFit: "cover" }}
        />
      )}
      <div style={{ padding: 12 }}>
        {/* Hundido y sin rótulo propio: no tiene que parecer obligatorio. */}
        <input
          value={remito.numero ?? ""}
          onChange={(e) => alCambiar({ numero: e.target.value || null })}
          placeholder="número — si no, lo pone la oficina"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "9px 11px",
            fontSize: 16,
            fontFamily: "var(--font-plex-mono), monospace",
            color: "var(--tinta)",
            background: "var(--papel-hondo)",
            border: "1px solid transparent",
            borderRadius: 2,
            outline: "none",
          }}
        />
        <input
          value={remito.nota ?? ""}
          onChange={(e) => alCambiar({ nota: e.target.value || null })}
          placeholder="nota de esta foto"
          className="campo"
          style={{ fontSize: 16, marginTop: 8 }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 8,
            font: "400 12px/1.4 var(--font-plex-sans), sans-serif",
            color: "var(--tinta-tenue)",
          }}
        >
          {!remito.numero && <span>Sin número va a quedar en s/d y lo lee la oficina del papel.</span>}
          <button
            type="button"
            onClick={alBorrar}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: 0,
              padding: "4px 2px",
              font: "400 13px var(--font-plex-sans), sans-serif",
              color: "var(--aviso-hondo)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Sacar
          </button>
        </div>
      </div>
    </div>
  );
}
