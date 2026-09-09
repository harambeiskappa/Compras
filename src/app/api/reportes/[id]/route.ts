import { NextResponse } from "next/server";

import { urlFirmada } from "@/lib/almacenamiento";
import { usuarioActual, SinPermiso } from "@/lib/auth";
import { reporteParaVer } from "@/lib/reportes";

export const dynamic = "force-dynamic";

/**
 * Un reporte, con las fotos firmadas para poder mostrarlas.
 *
 * EL PERMISO SE COMPRUEBA ACÁ. Un comercial pidiendo por id el reporte de otro
 * rebota, aunque la pantalla nunca le ofrezca ese link: la URL se tipea.
 *
 * Las fotos se firman al momento y por diez minutos. En `Adjunto.url` está la
 * ruta dentro del bucket, no una URL pública: un remito es un documento
 * comercial y una URL pública lo deja abierto a quien tenga el link.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const yo = await usuarioActual();
  if (!yo) {
    return NextResponse.json({ error: "Hay que iniciar sesión." }, { status: 401 });
  }

  const { id } = await params;
  const numero = Number(id);

  let reporte;
  try {
    reporte = await reporteParaVer(numero, yo);
  } catch (e) {
    if (e instanceof SinPermiso) {
      // 404 y no 403: decirle «existe pero no es tuyo» a alguien que probó un
      // id al azar ya le confirma que ese reporte existe.
      return NextResponse.json({ error: "Ese reporte no existe." }, { status: 404 });
    }
    throw e;
  }
  if (!reporte) {
    return NextResponse.json({ error: "Ese reporte no existe." }, { status: 404 });
  }

  const adjuntos = await Promise.all(
    reporte.adjuntos.map(async (a) => ({
      id: a.id,
      numero: a.numero,
      nota: a.nota,
      url: await urlFirmada(a.url),
    }))
  );

  return NextResponse.json(
    {
      id: reporte.id,
      estado: reporte.estado,
      fecha: reporte.fecha ? reporte.fecha.toISOString().slice(0, 10) : null,
      consignatario: reporte.consignatarioTexto,
      plaza: reporte.plazaTexto,
      cabezas: reporte.cabezasAproximadas,
      camiones: reporte.cantidadCamiones,
      observaciones: reporte.observaciones,
      cargadoEn: reporte.cargadoEn.toISOString(),
      recibidoEn: reporte.recibidoEn.toISOString(),
      cargadoPor: reporte.creadoPorUsuario?.nombre ?? null,
      compras: reporte._count.compras,
      adjuntos,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
