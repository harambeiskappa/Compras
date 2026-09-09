import Link from "next/link";

import { AdminUsuarios } from "@/componentes/AdminUsuarios";
import { usuarioActual } from "@/lib/auth";
import { LARGO_MINIMO_PASSWORD } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Administración de cuentas. Solo ADMINISTRATIVO.
 *
 * Esconder la pantalla NO es el permiso: cada acción de `acciones-usuarios.ts`
 * comprueba el rol del lado del servidor. Esto es para no ofrecerle a un
 * comercial una pantalla que le va a rebotar entera.
 */
export default async function PaginaUsuarios() {
  const yo = await usuarioActual();
  // Sin sesión no se llega: el proxy manda a /ingresar antes que esto.
  if (!yo) return null;
  if (yo.rol !== "ADMINISTRATIVO") return <NoTeCorresponde />;

  const cuentas = await prisma.usuario.findMany({
    orderBy: [{ activo: "desc" }, { usuario: "asc" }],
    // Sin `hashPassword`. Lo que no se selecciona no se puede filtrar por error.
    select: {
      id: true,
      usuario: true,
      nombre: true,
      rol: true,
      activo: true,
      creadoEn: true,
      entidad: { select: { nombre: true } },
      _count: { select: { comprasCreadas: true, reportesCreados: true } },
    },
  });

  // Para el selector de entidad del alta. Las que ya son persona compradora
  // primero: es el uso para el que existe el campo.
  const entidades = await prisma.entidad.findMany({
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      roles: { where: { rol: "PERSONA_COMPRADORA" }, select: { rol: true } },
    },
  });

  const opciones = entidades.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    esPersonaCompradora: e.roles.length > 0,
  }));

  return (
    <AdminUsuarios
      yoId={yo.id}
      cuentas={cuentas.map((c) => ({
        id: c.id,
        usuario: c.usuario,
        nombre: c.nombre,
        rol: c.rol,
        activo: c.activo,
        creadoEn: c.creadoEn.toISOString().slice(0, 10),
        entidad: c.entidad?.nombre ?? null,
        cargadas: c._count.comprasCreadas + c._count.reportesCreados,
      }))}
      opciones={opciones}
      largoMinimo={LARGO_MINIMO_PASSWORD}
    />
  );
}

function NoTeCorresponde() {
  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: "72px 28px" }}>
      <div className="rotulo" style={{ color: "var(--tinta-fantasma)" }}>
        No te corresponde
      </div>
      <h1
        style={{
          margin: "14px 0 0",
          font: "600 26px/1.2 var(--font-plex-sans), sans-serif",
          letterSpacing: "-.015em",
        }}
      >
        Las cuentas las administra un administrativo.
      </h1>
      <p
        style={{
          margin: "16px 0 0",
          font: "400 15px/1.6 var(--font-plex-sans), sans-serif",
          color: "var(--tinta-media)",
        }}
      >
        Tu propia contraseña sí la podés cambiar vos, en{" "}
        <Link href="/mi-cuenta">mi cuenta</Link>.
      </p>
    </main>
  );
}
