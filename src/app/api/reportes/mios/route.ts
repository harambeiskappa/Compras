import { NextResponse } from "next/server";

import { usuarioActual } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Los reportes que mandó QUIEN PIDE.
 *
 * El filtro es del servidor y sale de la sesión: no hay parámetro de usuario
 * que un comercial pueda cambiar para ver los de otro. Un administrativo ve
 * todos, que es lo que significa «acceso completo».
 *
 * Existe como API y no como render del servidor porque `/reportes` tiene que
 * poder abrir sin señal: la cáscara la sirve el service worker y los datos
 * llegan por acá cuando hay red. Ver `public/sw.js`.
 */
export async function GET() {
  const yo = await usuarioActual();
  if (!yo) {
    return NextResponse.json({ error: "Hay que iniciar sesión." }, { status: 401 });
  }

  const reportes = await prisma.reporteCompra.findMany({
    where: yo.rol === "ADMINISTRATIVO" ? {} : { creadoPorUsuarioId: yo.id },
    orderBy: [{ cargadoEn: "desc" }, { id: "desc" }],
    take: 200,
    select: {
      id: true,
      estado: true,
      fecha: true,
      consignatarioTexto: true,
      plazaTexto: true,
      cabezasAproximadas: true,
      cargadoEn: true,
      recibidoEn: true,
      _count: { select: { adjuntos: true } },
    },
  });

  return NextResponse.json(
    {
      reportes: reportes.map((r) => ({
        id: r.id,
        estado: r.estado,
        fecha: r.fecha ? r.fecha.toISOString().slice(0, 10) : null,
        consignatario: r.consignatarioTexto,
        plaza: r.plazaTexto,
        cabezas: r.cabezasAproximadas,
        remitos: r._count.adjuntos,
        cargadoEn: r.cargadoEn.toISOString(),
        recibidoEn: r.recibidoEn.toISOString(),
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
