"use client";

import { useState, useTransition } from "react";

import { cambiarMiPassword } from "@/lib/acciones-usuarios";

const ETIQUETA: React.CSSProperties = {
  font: "500 13px/1.2 var(--font-plex-sans), sans-serif",
};

/**
 * Igual que el login: el «guardando» sale del `pending` de la transición, no de
 * un `useState` que una excepción pueda dejar prendido para siempre.
 */
export function FormularioPassword({ largoMinimo }: { largoMinimo: number }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [errores, setErrores] = useState<string[]>([]);
  const [listo, setListo] = useState(false);
  const [pendiente, arrancar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErrores([]);
    setListo(false);
    arrancar(async () => {
      const r = await cambiarMiPassword(actual, nueva, repetida);
      if (!r.ok) {
        setErrores(r.errores);
        return;
      }
      setActual("");
      setNueva("");
      setRepetida("");
      setListo(true);
    });
  }

  return (
    <form onSubmit={enviar} style={{ marginTop: 20, display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gap: 7 }}>
        <label htmlFor="p-actual" style={ETIQUETA}>
          Contraseña actual
        </label>
        <input
          id="p-actual"
          type="password"
          autoComplete="current-password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          className="campo"
        />
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        <label htmlFor="p-nueva" style={ETIQUETA}>
          Contraseña nueva
        </label>
        <input
          id="p-nueva"
          type="password"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          className="campo"
        />
        <div
          style={{
            font: "400 12px/1.4 var(--font-plex-sans), sans-serif",
            color: "var(--tinta-tenue)",
          }}
        >
          Mínimo {largoMinimo} caracteres.
        </div>
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        <label htmlFor="p-repetida" style={ETIQUETA}>
          Repetir la nueva
        </label>
        <input
          id="p-repetida"
          type="password"
          autoComplete="new-password"
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
          className="campo"
        />
      </div>

      {errores.length > 0 && (
        <div
          role="alert"
          style={{
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

      {listo && (
        <div
          role="status"
          style={{
            padding: "11px 13px",
            background: "var(--verde-claro)",
            border: "1px solid var(--verde-borde)",
            borderLeft: "4px solid var(--verde)",
            borderRadius: 2,
            font: "400 14px/1.5 var(--font-plex-sans), sans-serif",
          }}
        >
          Contraseña cambiada. Las sesiones abiertas en otros dispositivos
          quedaron afuera; ésta sigue adentro.
        </div>
      )}

      <div>
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
          {pendiente ? "Cambiando…" : "Cambiar la contraseña"}
        </button>
      </div>

      <div
        style={{
          font: "400 13px/1.55 var(--font-plex-sans), sans-serif",
          color: "var(--tinta-suave)",
        }}
      >
        Cambiarla cierra las sesiones abiertas en otros dispositivos. Es a
        propósito: si la cambiás es porque querés echar a alguien, y la cookie
        dura 30 días.
      </div>
    </form>
  );
}
