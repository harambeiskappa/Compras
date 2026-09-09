"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import type { RolUsuario } from "@/generated/prisma/enums";
import { cambiarActivo, crearUsuario, resetearPassword } from "@/lib/acciones-usuarios";

export type FilaCuenta = {
  id: number;
  usuario: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  creadoEn: string;
  entidad: string | null;
  /** Compras + reportes que cargó. Es lo que se pierde si se borra la cuenta. */
  cargadas: number;
};

export type OpcionEntidad = {
  id: number;
  nombre: string;
  esPersonaCompradora: boolean;
};

const CAJA_AVISO: React.CSSProperties = {
  padding: "11px 13px",
  background: "var(--aviso-claro)",
  border: "1px solid var(--aviso-borde)",
  borderLeft: "4px solid var(--aviso)",
  borderRadius: 2,
  font: "400 14px/1.5 var(--font-plex-sans), sans-serif",
};

const ETIQUETA: React.CSSProperties = {
  font: "500 13px/1.2 var(--font-plex-sans), sans-serif",
};

export function AdminUsuarios({
  yoId,
  cuentas,
  opciones,
  largoMinimo,
}: {
  yoId: number;
  cuentas: FilaCuenta[];
  opciones: OpcionEntidad[];
  largoMinimo: number;
}) {
  const [errores, setErrores] = useState<string[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, arrancar] = useTransition();
  const [abriendoAlta, setAbriendoAlta] = useState(false);
  const [reseteando, setReseteando] = useState<number | null>(null);

  const activas = cuentas.filter((c) => c.activo).length;

  function alternar(fila: FilaCuenta) {
    setErrores([]);
    setAviso(null);
    arrancar(async () => {
      const r = await cambiarActivo(fila.id, !fila.activo);
      if (!r.ok) setErrores(r.errores);
      else {
        setAviso(
          `${fila.usuario} quedó ${fila.activo ? "desactivada" : "activa"}.`
        );
      }
    });
  }

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 28 }}>
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
          Usuarios
        </h1>
        {/* El agregado va con su cobertura al lado, como todo número de la app. */}
        <span
          style={{
            font: "400 13px/1 var(--font-plex-mono), monospace",
            color: "var(--tinta-suave)",
          }}
        >
          {cuentas.length} {cuentas.length === 1 ? "cuenta" : "cuentas"} — {activas}{" "}
          {activas === 1 ? "activa" : "activas"}
        </span>
        <div style={{ flex: 1 }} />
        <Link
          href="/mi-cuenta"
          style={{ font: "400 14px var(--font-plex-sans), sans-serif" }}
        >
          Cambiar mi contraseña
        </Link>
      </div>

      {errores.length > 0 && (
        <div role="alert" style={{ ...CAJA_AVISO, marginTop: 18 }}>
          {errores.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}

      {aviso && (
        <div
          role="status"
          style={{
            marginTop: 18,
            padding: "11px 13px",
            background: "var(--verde-claro)",
            border: "1px solid var(--verde-borde)",
            borderLeft: "4px solid var(--verde)",
            borderRadius: 2,
            font: "400 14px/1.5 var(--font-plex-sans), sans-serif",
          }}
        >
          {aviso}
        </div>
      )}

      <div style={{ marginTop: 26 }}>
        {cuentas.map((c) => (
          <div key={c.id}>
            <Fila
              fila={c}
              esMia={c.id === yoId}
              pendiente={pendiente}
              alternar={() => alternar(c)}
              resetear={() => {
                setReseteando(reseteando === c.id ? null : c.id);
                setAviso(null);
                setErrores([]);
              }}
              reseteando={reseteando === c.id}
            />
            {reseteando === c.id && (
              <FormularioReseteo
                fila={c}
                esMia={c.id === yoId}
                largoMinimo={largoMinimo}
                cerrar={() => setReseteando(null)}
                avisar={(t) => {
                  setAviso(t);
                  setErrores([]);
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid var(--borde)" }}>
        {abriendoAlta ? (
          <FormularioAlta
            opciones={opciones}
            largoMinimo={largoMinimo}
            cerrar={() => setAbriendoAlta(false)}
            avisar={(t) => {
              setAviso(t);
              setErrores([]);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setAbriendoAlta(true);
              setAviso(null);
              setErrores([]);
            }}
            style={{
              padding: "12px 22px",
              cursor: "pointer",
              font: "500 15px var(--font-plex-sans), sans-serif",
              color: "var(--papel)",
              background: "var(--verde)",
              border: "1px solid var(--verde-hondo)",
              borderRadius: 2,
            }}
          >
            Crear una cuenta
          </button>
        )}
      </div>

      <p
        style={{
          marginTop: 40,
          paddingTop: 20,
          borderTop: "1px solid var(--borde)",
          font: "400 14px/1.6 var(--font-plex-sans), sans-serif",
          color: "var(--tinta-suave)",
          maxWidth: "44em",
        }}
      >
        La contraseña inicial la fija quien crea la cuenta y se la pasa a la
        persona por fuera de la app — no hay correo configurado, y montar uno
        para esto sería agrandar el problema. Después, cada uno cambia la suya
        desde <Link href="/mi-cuenta">mi cuenta</Link>. Y si alguien la olvida,
        «Contraseña» le asigna una nueva: sin correo, es la única salida, y el
        caso pasa en el campo y no en teoría.
      </p>
      <p
        style={{
          marginTop: 14,
          font: "400 14px/1.6 var(--font-plex-sans), sans-serif",
          color: "var(--tinta-suave)",
          maxWidth: "44em",
        }}
      >
        Las cuentas no se borran, se desactivan. Una cuenta borrada se lleva
        puesta la atribución de todo lo que cargó, y «quién cargó esto» es
        justamente lo que las cuentas vinieron a contestar.
      </p>
    </main>
  );
}

function Fila({
  fila,
  esMia,
  pendiente,
  alternar,
  resetear,
  reseteando,
}: {
  fila: FilaCuenta;
  esMia: boolean;
  pendiente: boolean;
  alternar: () => void;
  resetear: () => void;
  reseteando: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 16px",
        marginBottom: 8,
        background: fila.activo ? "var(--papel-alto)" : "var(--papel-medio)",
        border: "1px solid var(--borde)",
        borderLeft: `3px solid ${
          fila.activo ? "var(--verde)" : "var(--borde-firme)"
        }`,
        borderRadius: 2,
        opacity: fila.activo ? 1 : 0.72,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span
            style={{
              font: "500 15px/1.2 var(--font-plex-mono), monospace",
            }}
          >
            {fila.usuario}
          </span>
          {esMia && (
            <span
              className="rotulo"
              style={{ color: "var(--verde)", letterSpacing: ".1em" }}
            >
              Vos
            </span>
          )}
        </div>
        <div
          style={{
            marginTop: 4,
            font: "400 14px/1.4 var(--font-plex-sans), sans-serif",
            color: "var(--tinta-media)",
          }}
        >
          {fila.nombre}
          {fila.entidad && (
            <span style={{ color: "var(--tinta-tenue)" }}> · {fila.entidad}</span>
          )}
        </div>
      </div>

      <div style={{ width: 130 }}>
        <span
          style={{
            font: "500 11px/1 var(--font-plex-mono), monospace",
            letterSpacing: ".08em",
            padding: "5px 8px",
            borderRadius: 2,
            color:
              fila.rol === "ADMINISTRATIVO" ? "var(--verde)" : "var(--rol-empresa)",
            background:
              fila.rol === "ADMINISTRATIVO" ? "var(--verde-claro)" : "#e8eef2",
            border: `1px solid ${
              fila.rol === "ADMINISTRATIVO" ? "var(--verde-borde)" : "#cbdae3"
            }`,
          }}
        >
          {fila.rol === "ADMINISTRATIVO" ? "ADMINISTRATIVO" : "COMERCIAL"}
        </span>
      </div>

      <div
        style={{
          width: 150,
          font: "400 12px/1.4 var(--font-plex-mono), monospace",
          color: "var(--tinta-tenue)",
        }}
      >
        <div>desde {fila.creadoEn}</div>
        <div>
          {fila.cargadas} {fila.cargadas === 1 ? "carga" : "cargas"}
        </div>
      </div>

      <button
        type="button"
        onClick={resetear}
        style={{
          padding: "8px 14px",
          cursor: "pointer",
          font: "500 13px var(--font-plex-sans), sans-serif",
          color: reseteando ? "var(--papel)" : "var(--tinta-media)",
          background: reseteando ? "var(--tinta-media)" : "transparent",
          border: "1px solid var(--borde-firme)",
          borderRadius: 2,
        }}
      >
        Contraseña
      </button>

      <button
        type="button"
        onClick={alternar}
        // Desactivarse a uno mismo es el clic que te deja afuera. El botón se
        // apaga acá por cortesía; la acción lo rechaza igual del lado del
        // servidor, que es donde vive el permiso.
        disabled={pendiente || (esMia && fila.activo)}
        title={
          esMia && fila.activo
            ? "Nadie puede desactivar su propia cuenta."
            : undefined
        }
        style={{
          padding: "8px 14px",
          cursor: pendiente || (esMia && fila.activo) ? "not-allowed" : "pointer",
          font: "500 13px var(--font-plex-sans), sans-serif",
          color: fila.activo ? "var(--aviso-hondo)" : "var(--verde)",
          background: "transparent",
          border: `1px solid ${
            fila.activo ? "var(--aviso-borde)" : "var(--verde-borde)"
          }`,
          borderRadius: 2,
          opacity: esMia && fila.activo ? 0.4 : 1,
        }}
      >
        {fila.activo ? "Desactivar" : "Reactivar"}
      </button>
    </div>
  );
}

/**
 * Asignar una contraseña nueva a otra cuenta.
 *
 * La contraseña se muestra EN TEXTO PLANO a propósito: el administrativo la
 * tiene que poder leer y copiar para pasársela a la persona por fuera de la
 * app. No hay correo configurado, y montar uno para esto sería agrandar el
 * problema — el que la elige es el que la comunica.
 */
function FormularioReseteo({
  fila,
  esMia,
  largoMinimo,
  cerrar,
  avisar,
}: {
  fila: FilaCuenta;
  esMia: boolean;
  largoMinimo: number;
  cerrar: () => void;
  avisar: (texto: string) => void;
}) {
  const [nueva, setNueva] = useState("");
  const [errores, setErrores] = useState<string[]>([]);
  const [pendiente, arrancar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErrores([]);
    arrancar(async () => {
      const r = await resetearPassword(fila.id, nueva);
      if (!r.ok) {
        setErrores(r.errores);
        return;
      }
      avisar(
        `Contraseña de ${fila.usuario} cambiada. Pasásela por fuera de la app — ` +
          "acá no vuelve a mostrarse."
      );
      cerrar();
    });
  }

  return (
    <form
      onSubmit={enviar}
      style={{
        margin: "-4px 0 12px",
        padding: "16px 18px",
        background: "var(--papel-medio)",
        border: "1px solid var(--borde)",
        borderLeft: "3px solid var(--tinta-media)",
        borderRadius: 2,
        display: "grid",
        gap: 14,
        maxWidth: 560,
      }}
    >
      <div style={ETIQUETA}>
        Contraseña nueva para <strong>{fila.usuario}</strong>
      </div>

      <input
        type="text"
        value={nueva}
        onChange={(e) => setNueva(e.target.value)}
        autoComplete="off"
        autoFocus
        placeholder={`mínimo ${largoMinimo} caracteres`}
        className="campo"
      />

      <div
        style={{
          font: "400 12px/1.5 var(--font-plex-sans), sans-serif",
          color: "var(--tinta-suave)",
        }}
      >
        {esMia
          ? "Es tu propia cuenta: tu sesión de acá sigue abierta, pero las que " +
            "tengas en otros dispositivos se cierran."
          : `Las sesiones que ${fila.usuario} tenga abiertas se cierran, incluso ` +
            "en otros dispositivos. Es el punto: si hay que cambiarle la " +
            "contraseña, dejarle vivas las sesiones viejas sería cambiar la " +
            "cerradura y regalar la copia de la llave."}
      </div>

      {errores.length > 0 && (
        <div role="alert" style={CAJA_AVISO}>
          {errores.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="submit"
          disabled={pendiente}
          style={{
            padding: "9px 16px",
            cursor: pendiente ? "progress" : "pointer",
            font: "500 14px var(--font-plex-sans), sans-serif",
            color: "var(--papel)",
            background: "var(--verde)",
            border: "1px solid var(--verde-hondo)",
            borderRadius: 2,
          }}
        >
          {pendiente ? "Cambiando…" : "Asignar la contraseña"}
        </button>
        <button
          type="button"
          onClick={cerrar}
          disabled={pendiente}
          style={{
            padding: "9px 14px",
            cursor: "pointer",
            font: "400 14px var(--font-plex-sans), sans-serif",
            color: "var(--tinta-suave)",
            background: "transparent",
            border: "1px solid var(--borde-fuerte)",
            borderRadius: 2,
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function FormularioAlta({
  opciones,
  largoMinimo,
  cerrar,
  avisar,
}: {
  opciones: OpcionEntidad[];
  largoMinimo: number;
  cerrar: () => void;
  avisar: (texto: string) => void;
}) {
  const [usuario, setUsuario] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<RolUsuario>("COMERCIAL");
  const [entidadId, setEntidadId] = useState("");
  const [password, setPassword] = useState("");
  const [errores, setErrores] = useState<string[]>([]);
  const [pendiente, arrancar] = useTransition();

  const conRol = opciones.filter((o) => o.esPersonaCompradora);
  const resto = opciones.filter((o) => !o.esPersonaCompradora);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErrores([]);
    arrancar(async () => {
      const r = await crearUsuario({
        usuario,
        nombre,
        rol,
        entidadId: entidadId === "" ? null : Number(entidadId),
        password,
      });
      if (!r.ok) {
        setErrores(r.errores);
        return;
      }
      avisar(`Cuenta "${usuario.trim().toLowerCase()}" creada.`);
      cerrar();
    });
  }

  return (
    <form onSubmit={enviar} style={{ maxWidth: 560, display: "grid", gap: 18 }}>
      <h2 className="seccion" style={{ margin: 0 }}>
        Crear una cuenta
      </h2>

      <div style={{ display: "grid", gap: 7 }}>
        <label htmlFor="u-usuario" style={ETIQUETA}>
          Usuario
        </label>
        <input
          id="u-usuario"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoCapitalize="none"
          autoComplete="off"
          placeholder="nacho"
          className="campo"
        />
        <div
          style={{
            font: "400 12px/1.4 var(--font-plex-sans), sans-serif",
            color: "var(--tinta-tenue)",
          }}
        >
          Se guarda en minúsculas y sin espacios alrededor, así que «Nacho» y
          «nacho» son la misma cuenta.
        </div>
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        <label htmlFor="u-nombre" style={ETIQUETA}>
          Nombre
        </label>
        <input
          id="u-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nacho Zemma"
          className="campo"
        />
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        <label htmlFor="u-rol" style={ETIQUETA}>
          Rol
        </label>
        <select
          id="u-rol"
          value={rol}
          onChange={(e) => setRol(e.target.value as RolUsuario)}
          className="campo"
        >
          <option value="COMERCIAL">
            COMERCIAL — crea el reporte de la feria, casi no edita
          </option>
          <option value="ADMINISTRATIVO">
            ADMINISTRATIVO — acceso completo, edita compras
          </option>
        </select>
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        <label htmlFor="u-entidad" style={ETIQUETA}>
          Entidad del padrón <span style={{ color: "var(--tinta-tenue)" }}>(opcional)</span>
        </label>
        <select
          id="u-entidad"
          value={entidadId}
          onChange={(e) => setEntidadId(e.target.value)}
          className="campo"
        >
          <option value="">— sin vincular —</option>
          {conRol.length > 0 && (
            <optgroup label="Ya son persona compradora">
              {conRol.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Resto del padrón">
            {resto.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </optgroup>
        </select>
        <div
          style={{
            font: "400 12px/1.4 var(--font-plex-sans), sans-serif",
            color: "var(--tinta-tenue)",
          }}
        >
          Sirve para una sola cosa: precargar la persona compradora en el
          reporte. No son el mismo dato — «quién fue físicamente a comprar»
          puede ser alguien sin cuenta.
        </div>
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        <label htmlFor="u-password" style={ETIQUETA}>
          Contraseña inicial
        </label>
        <input
          id="u-password"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
          className="campo"
        />
        <div
          style={{
            font: "400 12px/1.4 var(--font-plex-sans), sans-serif",
            color: "var(--tinta-tenue)",
          }}
        >
          Mínimo {largoMinimo} caracteres. Se muestra en texto plano a propósito:
          la tenés que poder copiar para pasársela a la persona.
        </div>
      </div>

      {errores.length > 0 && (
        <div role="alert" style={CAJA_AVISO}>
          {errores.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="submit"
          disabled={pendiente}
          style={{
            padding: "12px 22px",
            cursor: pendiente ? "progress" : "pointer",
            font: "500 15px var(--font-plex-sans), sans-serif",
            color: "var(--papel)",
            background: "var(--verde)",
            border: "1px solid var(--verde-hondo)",
            borderRadius: 2,
          }}
        >
          {pendiente ? "Creando…" : "Crear la cuenta"}
        </button>
        <button
          type="button"
          onClick={cerrar}
          disabled={pendiente}
          style={{
            padding: "12px 18px",
            cursor: "pointer",
            font: "400 15px var(--font-plex-sans), sans-serif",
            color: "var(--tinta-suave)",
            background: "transparent",
            border: "1px solid var(--borde-fuerte)",
            borderRadius: 2,
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
