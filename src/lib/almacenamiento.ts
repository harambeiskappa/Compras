import "server-only";

/**
 * Supabase Storage para las fotos de remitos.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LA CLAVE DE SERVICIO NO SALE DEL SERVIDOR, NUNCA.                        │
 * │                                                                          │
 * │ La subida pasa por nuestro servidor y no del navegador a Storage. Subir  │
 * │ directo obligaría a poner una clave de Supabase en el cliente, y una vez │
 * │ en el bundle está en el teléfono de cualquiera. Con fotos ya comprimidas │
 * │ (~200 KB) el costo de pasar por el servidor es despreciable.             │
 * │                                                                          │
 * │ Este módulo es `server-only`: importarlo desde un componente cliente     │
 * │ rompe el build, que es exactamente lo que se quiere que pase.            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Se habla con la API REST de Storage por `fetch`, sin `@supabase/supabase-js`:
 * son tres llamadas —subir, firmar, crear el bucket— y no justifican una
 * dependencia más en un proyecto que pinnea versiones a mano.
 */

export const BUCKET_REMITOS = "remitos";

/** Cuánto vale una URL firmada. Corta a propósito: es para mostrar, no para compartir. */
const SEGUNDOS_FIRMA = 60 * 10;

function base(): string {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Falta SUPABASE_URL. En local se trae con `vercel env pull`; en Vercel la " +
        "inyecta la integración de Supabase."
    );
  }
  return url.replace(/\/$/, "");
}

/**
 * La clave de servicio. Se corta acá si falta y no se degrada a la anon key:
 * la anon key no puede escribir en un bucket privado, así que la subida
 * fallaría igual, pero más tarde y con un error que no dice esto.
 *
 * Acepta los dos nombres porque Supabase renombró `SERVICE_ROLE_KEY` a
 * `SECRET_KEY` y la integración de Vercel inyecta ambos según cuándo se
 * conectó el proyecto.
 */
function claveServicio(): string {
  const k = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) {
    throw new Error(
      "Falta SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY). Sin la clave de " +
        "servicio no se puede escribir en un bucket privado."
    );
  }
  return k;
}

function cabeceras(): Record<string, string> {
  const k = claveServicio();
  return { Authorization: `Bearer ${k}`, apikey: k };
}

/**
 * Crea el bucket si no existe. PRIVADO, y esa es la decisión que importa: un
 * remito es un documento comercial, y un bucket público lo deja abierto a
 * cualquiera que tenga —o adivine— el link.
 *
 * Es idempotente: si ya está, no hace nada. Se llama desde el script de
 * preparación, no en cada subida.
 */
export async function asegurarBucket(): Promise<"creado" | "ya estaba"> {
  const existe = await fetch(`${base()}/storage/v1/bucket/${BUCKET_REMITOS}`, {
    headers: cabeceras(),
  });
  if (existe.ok) return "ya estaba";

  const res = await fetch(`${base()}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...cabeceras(), "Content-Type": "application/json" },
    body: JSON.stringify({
      id: BUCKET_REMITOS,
      name: BUCKET_REMITOS,
      public: false,
      file_size_limit: 5 * 1024 * 1024,
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
    }),
  });
  if (!res.ok) {
    throw new Error(`No se pudo crear el bucket: HTTP ${res.status} ${await res.text()}`);
  }
  return "creado";
}

/**
 * Sube una foto y devuelve LA RUTA DENTRO DEL BUCKET, no una URL.
 *
 * En `Adjunto.url` se guarda esta ruta a propósito: el bucket es privado y la
 * URL se firma al momento de mostrarla. Guardar una URL pública dejaría un
 * documento comercial abierto a quien tenga el link, y guardar una firmada
 * sería peor —vence, y quedaría una fila apuntando a una dirección muerta—.
 */
export async function subirRemito(
  claveIdempotencia: string,
  indice: number,
  bytes: ArrayBuffer,
  tipoMime: string
): Promise<string> {
  const extension = tipoMime === "image/png" ? "png" : tipoMime === "image/webp" ? "webp" : "jpg";

  // LA RUTA ES DETERMINÍSTICA —clave del reporte + índice de la foto— y sube
  // con upsert. No es un detalle: las fotos se suben ANTES de crear el reporte,
  // así que un intento que falla a mitad y se reintenta volvería a subirlas.
  // Con una ruta aleatoria, cada reintento dejaría copias huérfanas ocupando el
  // GB del plan free; con ésta, el reintento pisa exactamente el mismo objeto.
  //
  // Y no depende del id del reporte a propósito: cuando esto corre, el reporte
  // todavía no existe.
  const ruta = `${claveIdempotencia}/${indice}.${extension}`;

  const res = await fetch(`${base()}/storage/v1/object/${BUCKET_REMITOS}/${ruta}`, {
    method: "POST",
    headers: { ...cabeceras(), "Content-Type": tipoMime, "x-upsert": "true" },
    body: bytes,
  });
  if (!res.ok) {
    throw new Error(`No se pudo subir la foto: HTTP ${res.status} ${await res.text()}`);
  }
  return ruta;
}

/**
 * Firma una ruta para poder mostrarla. Devuelve `null` en vez de tirar: una
 * foto que no se puede mostrar no tiene por qué voltear la pantalla entera del
 * reporte, que es lo demás que el comprador vino a ver.
 */
export async function urlFirmada(ruta: string): Promise<string | null> {
  try {
    const res = await fetch(`${base()}/storage/v1/object/sign/${BUCKET_REMITOS}/${ruta}`, {
      method: "POST",
      headers: { ...cabeceras(), "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: SEGUNDOS_FIRMA }),
    });
    if (!res.ok) return null;
    const { signedURL } = (await res.json()) as { signedURL?: string };
    return signedURL ? `${base()}/storage/v1${signedURL}` : null;
  } catch {
    return null;
  }
}
