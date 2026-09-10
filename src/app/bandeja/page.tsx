import Link from "next/link";

import { Bandeja } from "@/componentes/bandeja/Bandeja";
import { usuarioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Los reportes que esperan ser procesados. Solo ADMINISTRATIVO.
 *
 * LA BANDEJA VACÍA ES EL ESTADO NORMAL, no una falla. Más de la mitad de las
 * compras no tienen reporte: en la feria de Darwash —el 50 % de las compras—
 * la oficina accede a los remitos directamente y nadie manda nada. Por eso el
 * estado vacío explica el camino real en vez de disculparse.
 */
export default async function PaginaBandeja() {
  const yo = await usuarioActual();
  if (!yo) return null;
  if (yo.rol !== "ADMINISTRATIVO") return <NoTeCorresponde />;

  const seleccion = {
    id: true,
    estado: true,
    fecha: true,
    consignatarioTexto: true,
    plazaTexto: true,
    cabezasAproximadas: true,
    cantidadCamiones: true,
    observaciones: true,
    cargadoEn: true,
    recibidoEn: true,
    motivoDescarte: true,
    estadoCambiadoEn: true,
    creadoPorUsuario: { select: { usuario: true, nombre: true } },
    estadoCambiadoPorUsuario: { select: { usuario: true } },
    personaCompradora: { select: { nombre: true } },
    _count: { select: { adjuntos: true } },
    compras: { select: { id: true, fecha: true }, orderBy: { id: "asc" as const } },
  };

  const pendientes = await prisma.reporteCompra.findMany({
    where: { estado: "PENDIENTE" },
    orderBy: [{ recibidoEn: "desc" }],
    select: seleccion,
  });

  // Los cerrados hace poco: es lo que contesta «¿esto ya lo procesó alguien?»
  // sin obligar a buscar. Una semana es el horizonte en el que alguien todavía
  // se acuerda de haberlo hecho.
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recientes = await prisma.reporteCompra.findMany({
    where: { estado: { in: ["PROCESADO", "DESCARTADO"] }, estadoCambiadoEn: { gte: desde } },
    orderBy: [{ estadoCambiadoEn: "desc" }],
    take: 20,
    select: seleccion,
  });

  const empresas = await prisma.entidad.findMany({
    where: { esPropio: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });
  const consignatarios = await prisma.entidad.findMany({
    where: { roles: { some: { rol: "CONSIGNATARIO" } } },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });

  const aFila = (r: (typeof pendientes)[number]) => ({
    id: r.id,
    estado: r.estado,
    fecha: r.fecha ? r.fecha.toISOString().slice(0, 10) : null,
    consignatario: r.consignatarioTexto,
    plaza: r.plazaTexto,
    cabezas: r.cabezasAproximadas,
    camiones: r.cantidadCamiones,
    remitos: r._count.adjuntos,
    observaciones: r.observaciones,
    recibidoEn: r.recibidoEn.toISOString(),
    cargadoEn: r.cargadoEn.toISOString(),
    // LA CUENTA COMO CUENTA. `creadoPorUsuario` dice qué cuenta lo mandó, y eso
    // siempre es cierto; afirmar la persona a partir de la cuenta miente el día
    // que dos la compartan. La persona que fue a comprar es otro campo.
    cuenta: r.creadoPorUsuario?.usuario ?? null,
    personaCompradora: r.personaCompradora?.nombre ?? null,
    motivoDescarte: r.motivoDescarte,
    estadoCambiadoPor: r.estadoCambiadoPorUsuario?.usuario ?? null,
    estadoCambiadoEn: r.estadoCambiadoEn?.toISOString() ?? null,
    compras: r.compras.map((c) => ({ id: c.id, fecha: c.fecha.toISOString().slice(0, 10) })),
  });

  return (
    <Bandeja
      pendientes={pendientes.map(aFila)}
      recientes={recientes.map(aFila)}
      empresas={empresas}
      consignatarios={consignatarios}
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
        La bandeja la trabaja la oficina.
      </h1>
      <p
        style={{
          margin: "16px 0 0",
          font: "400 15px/1.6 var(--font-plex-sans), sans-serif",
          color: "var(--tinta-media)",
        }}
      >
        Tus reportes los ves en <Link href="/reportes">mis reportes</Link>.
      </p>
    </main>
  );
}
