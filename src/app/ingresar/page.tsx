import { FormularioIngreso } from "@/componentes/FormularioIngreso";

export const dynamic = "force-dynamic";

export default async function PaginaIngresar({ searchParams }: PageProps<"/ingresar">) {
  const { volver } = await searchParams;
  const destino = typeof volver === "string" && volver.startsWith("/") ? volver : "/compras";

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "72px 28px" }}>
      <div className="rotulo" style={{ color: "var(--tinta-fantasma)" }}>
        Compras · Hacienda
      </div>
      <h1
        style={{
          margin: "14px 0 0",
          font: "600 28px/1.15 var(--font-plex-sans), sans-serif",
          letterSpacing: "-.015em",
        }}
      >
        Entrar
      </h1>
      <p
        style={{
          margin: "10px 0 0",
          font: "400 14px/1.6 var(--font-plex-sans), sans-serif",
          color: "var(--tinta-suave)",
        }}
      >
        Cada persona tiene su cuenta. El link que te pasan es un atajo a la
        pantalla, no la contraseña.
      </p>

      <FormularioIngreso volver={destino} />
    </main>
  );
}
