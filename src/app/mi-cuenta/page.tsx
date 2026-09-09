import Link from "next/link";

import { FormularioPassword } from "@/componentes/FormularioPassword";
import { usuarioActual } from "@/lib/auth";
import { LARGO_MINIMO_PASSWORD } from "@/lib/password";

export const dynamic = "force-dynamic";

/**
 * Cambiar la propia contraseña. CUALQUIER ROL, y por eso vive fuera de
 * `/usuarios`, que es solo de administrativos: si el formulario estuviera
 * adentro de esa pantalla, un comercial no tendría manera de cambiar la suya.
 */
export default async function PaginaMiCuenta() {
  const yo = await usuarioActual();
  // Sin sesión no se llega: el proxy manda a /ingresar antes que esto.
  if (!yo) return null;

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "56px 28px" }}>
      <div className="rotulo" style={{ color: "var(--tinta-fantasma)" }}>
        Mi cuenta
      </div>
      <h1
        style={{
          margin: "14px 0 0",
          font: "600 26px/1.2 var(--font-plex-sans), sans-serif",
          letterSpacing: "-.015em",
        }}
      >
        {yo.nombre}
      </h1>
      <div
        style={{
          marginTop: 8,
          font: "400 13px/1.4 var(--font-plex-mono), monospace",
          color: "var(--tinta-suave)",
        }}
      >
        {yo.usuario} · {yo.rol}
      </div>

      <div
        style={{
          marginTop: 34,
          paddingTop: 26,
          borderTop: "1px solid var(--borde)",
        }}
      >
        <h2 className="seccion" style={{ margin: 0 }}>
          Cambiar la contraseña
        </h2>
        <FormularioPassword largoMinimo={LARGO_MINIMO_PASSWORD} />
      </div>

      {yo.rol === "ADMINISTRATIVO" && (
        <p
          style={{
            marginTop: 36,
            paddingTop: 20,
            borderTop: "1px solid var(--borde)",
            font: "400 14px/1.6 var(--font-plex-sans), sans-serif",
            color: "var(--tinta-suave)",
          }}
        >
          Las cuentas de los demás se administran en{" "}
          <Link href="/usuarios">usuarios</Link>.
        </p>
      )}
    </main>
  );
}
