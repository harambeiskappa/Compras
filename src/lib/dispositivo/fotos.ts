/**
 * Compresión de fotos EN EL CLIENTE, antes de subir.
 *
 * El plan free de Supabase tiene 1 GB y una foto de celular sin comprimir pesa
 * unos 3 MB: cuatro remitos por compra, ~120 compras al año, y el primer año
 * llena el bucket. Comprimida a lado largo 1600 px y JPEG 0.7, un remito queda
 * en el orden de los 200 KB y se lee perfecto — que es para lo que está: para
 * que alguien en la oficina copie un número escrito a mano.
 *
 * Y hay una segunda razón, que en el campo pesa más: subir 3 MB por una red de
 * feria es la diferencia entre que el reporte salga y que no salga.
 */

/** Lado largo, en píxeles. Un remito A5 fotografiado se lee de sobra con esto. */
const LADO_LARGO = 1600;
const CALIDAD = 0.7;

export type FotoComprimida = {
  blob: Blob;
  bytesOriginales: number;
  bytesFinales: number;
  ancho: number;
  alto: number;
};

/**
 * Comprime una imagen. Si algo falla —un formato que el navegador no decodifica,
 * un canvas bloqueado— DEVUELVE EL ORIGINAL en vez de tirar: perder la foto de
 * un remito para ahorrar bytes es un mal negocio, y el tope del servidor está
 * para atajar el caso raro.
 */
export async function comprimirFoto(archivo: File | Blob): Promise<FotoComprimida> {
  const bytesOriginales = archivo.size;
  const original: FotoComprimida = {
    blob: archivo,
    bytesOriginales,
    bytesFinales: bytesOriginales,
    ancho: 0,
    alto: 0,
  };

  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_LARGO / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.round(bitmap.width * escala);
    const alto = Math.round(bitmap.height * escala);

    const lienzo =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(ancho, alto)
        : Object.assign(document.createElement("canvas"), { width: ancho, height: alto });

    const ctx = lienzo.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) return original;
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close?.();

    const blob =
      lienzo instanceof OffscreenCanvas
        ? await lienzo.convertToBlob({ type: "image/jpeg", quality: CALIDAD })
        : await new Promise<Blob | null>((r) =>
            (lienzo as HTMLCanvasElement).toBlob(r, "image/jpeg", CALIDAD)
          );

    if (!blob) return original;

    // Si comprimir no achicó nada —ya venía chica, o es una captura de pantalla
    // que el JPEG empeora— se queda la original. Guardar la más grande de las
    // dos sería pagar el costo de comprimir para nada.
    if (blob.size >= bytesOriginales) return original;

    return { blob, bytesOriginales, bytesFinales: blob.size, ancho, alto };
  } catch {
    return original;
  }
}
