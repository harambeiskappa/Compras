"use client";

import { useActionState } from "react";

import { ingresar, type EstadoIngreso } from "@/lib/acciones-auth";

/**
 * Vive acá y no en `acciones-auth.ts` porque ése es un archivo `"use server"`:
 * solo puede exportar funciones async. Exportar este objeto desde ahí compila y
 * buildea sin una sola queja, y recién revienta en runtime — rompiendo la carga
 * del módulo entero, o sea TODAS las acciones, no solo ésta.
 */
const INICIAL: EstadoIngreso = { error: null, usuario: "" };

/**
 * El botón NO puede quedar muerto.
 *
 * La versión anterior tenía `setEntrando(false)` después del `await` y sin
 * `try/finally`: cualquier excepción de la acción —la de SESION_SECRETO
 * faltante en Production, un corte de red, lo que sea— dejaba el botón
 * deshabilitado para siempre y sin decir nada. Media hora mirando una pantalla
 * que no tenía forma de contar qué le pasaba.
 *
 * Por eso el «entrando» sale del `pending` de `useActionState` y no de un
 * `useState` propio: React lo baja solo cuando la acción termina, salga bien o
 * mal, y no hay ninguna rama del código que pueda olvidarse de apagarlo. La
 * acción, además, atrapa lo inesperado y lo devuelve como mensaje genérico.
 *
 * VALE PARA TODO EL MÓDULO 2: ningún botón puede quedar muerto por una
 * excepción que nadie muestra. Va a importar mucho más cuando el envío pase por
 * la cola offline y falle por falta de señal, que ahí es el caso normal.
 *
 * Y va con `<form action={...}>` en vez de un `onSubmit`: la acción redirige, y
 * `redirect()` quiere correr dentro de una transición, que es lo que este hook
 * hace por su cuenta.
 */
export function FormularioIngreso({ volver }: { volver: string }) {
  const [estado, accion, entrando] = useActionState(ingresar, INICIAL);

  return (
    <form action={accion} style={{ marginTop: 30, display: "grid", gap: 18 }}>
      <input type="hidden" name="volver" value={volver} />

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
          // Vuelve tipeado tal cual: `<form action>` resetea los campos al
          // terminar, y reescribir el usuario tras cada intento es gratis de
          // evitar. La contraseña no vuelve, a propósito.
          defaultValue={estado.usuario}
          disabled={entrando}
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
          disabled={entrando}
          className="campo"
        />
      </div>

      {estado.error && (
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
          {estado.error}
        </div>
      )}

      <button
        type="submit"
        disabled={entrando}
        style={{
          padding: "12px 20px",
          cursor: entrando ? "progress" : "pointer",
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
