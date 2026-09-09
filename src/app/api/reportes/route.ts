import { NextResponse } from "next/server";

import { usuarioActual } from "@/lib/auth";
import { recibirReporte, ReporteInvalido, type ReporteEntrante } from "@/lib/reportes";

export const dynamic = "force-dynamic";

/** Con fotos ya comprimidas, cuatro remitos no llegan a 1 MB. Esto es el techo duro. */
const TOPE_BYTES = 8 * 1024 * 1024;
const TIPOS = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Recibe un reporte completo —datos y fotos— EN UNA SOLA REQUEST.
 *
 * Es una sola a propósito. Si los datos fueran una request y cada foto otra, la
 * cola tendría que llevar el estado de un envío a medias y decidir qué
 * reintentar; sin señal, «a medias» es el caso normal. Con una sola, el
 * reintento es la misma request otra vez, y la clave de idempotencia se encarga.
 *
 * Es un route handler y no una server action porque manda archivos binarios
 * desde una cola que corre fuera de React: acá el que envía es el service
 * worker de la app, no un formulario.
 */
export async function POST(request: Request) {
  const yo = await usuarioActual();
  if (!yo) {
    return NextResponse.json({ error: "Hay que iniciar sesión." }, { status: 401 });
  }

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ error: "El cuerpo no es un formulario." }, { status: 400 });
  }

  const crudo = formulario.get("datos");
  if (typeof crudo !== "string") {
    return NextResponse.json({ error: "Falta el campo `datos`." }, { status: 400 });
  }

  let datos: ReporteEntrante;
  try {
    datos = JSON.parse(crudo) as ReporteEntrante;
  } catch {
    return NextResponse.json({ error: "`datos` no es JSON válido." }, { status: 400 });
  }

  // Las fotos vienen como foto_0, foto_1, … El índice importa: es lo que las
  // aparea con su número de remito y su nota, y lo que hace determinística la
  // ruta en Storage para que un reintento pise el mismo objeto.
  const fotos: { bytes: ArrayBuffer; tipoMime: string }[] = [];
  let total = 0;
  for (let i = 0; ; i++) {
    const archivo = formulario.get(`foto_${i}`);
    if (!archivo) break;
    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: `foto_${i} no es un archivo.` }, { status: 400 });
    }
    if (!TIPOS.has(archivo.type)) {
      return NextResponse.json(
        { error: `foto_${i} es ${archivo.type || "de tipo desconocido"}, y solo entran imágenes.` },
        { status: 400 }
      );
    }
    total += archivo.size;
    if (total > TOPE_BYTES) {
      return NextResponse.json(
        {
          error:
            "Las fotos superan el tope. Tendrían que llegar comprimidas desde el " +
            "teléfono: sin comprimir, el primer mes de uso llena el bucket.",
        },
        { status: 413 }
      );
    }
    fotos.push({ bytes: await archivo.arrayBuffer(), tipoMime: archivo.type });
  }

  try {
    const r = await recibirReporte(datos, fotos, yo);
    // 200 también cuando ya existía: NO es un 409. Un 409 haría que la cola
    // reintente para siempre justo en el caso que la clave existe para resolver.
    return NextResponse.json(r, { status: 200 });
  } catch (e) {
    if (e instanceof ReporteInvalido) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    // Un 500 la cola SÍ lo reintenta, y está bien: es un problema de este lado.
    console.error("Falló al recibir un reporte:", e);
    return NextResponse.json(
      { error: "No se pudo guardar el reporte. Se reintenta." },
      { status: 500 }
    );
  }
}
