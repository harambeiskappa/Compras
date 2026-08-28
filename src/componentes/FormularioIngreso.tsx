"use client";

import { useState } from "react";

import { ingresar } from "@/lib/acciones-auth";

export function FormularioIngreso({ volver }: { volver: string }) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setError(null);
    // Si sale bien, la acción redirige y esto no vuelve.
    const r = await ingresar(usuario, password, volver);
    setEntrando(false);
    if (r && !r.ok) setError(r.error);
  }

  return (
    <form onSubmit={enviar} style={{ marginTop: 30, display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gap: 7 }}>
        <label
          htmlFor="usuario"
          style={{ font: "500 14px/1.2 var(--font-plex-sans), sans-serif" }}
        >
          Usuario
        </label>
        <input
          id="usuario"
          name="usuario"
          autoComplete="username"
          autoCapitalize="none"
          autoFocus
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className="campo"
        />
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        <label
          htmlFor="password"
          style={{ font: "500 14px/1.2 var(--font-plex-sans), sans-serif" }}
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="campo"
        />
      </div>

      {error && (
        <div
          style={{
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
        type="submit"
        disabled={entrando}
        style={{
          padding: "12px 20px",
          cursor: "pointer",
          font: "500 15px var(--font-plex-sans), sans-serif",
          color: "var(--papel)",
          background: "var(--verde)",
          border: "1px solid var(--verde-hondo)",
          borderRadius: 2,
        }}
      >
        {entrando ? "Entrando…" : "Entrar"}
      </button>

      <div
        style={{
          font: "400 13px/1.55 var(--font-plex-sans), sans-serif",
          color: "var(--tinta-suave)",
        }}
      >
        La sesión dura 30 días. Es a propósito: en el campo, sin señal, no hay
        forma de volver a entrar — solo el primer ingreso necesita conexión.
      </div>
    </form>
  );
}
