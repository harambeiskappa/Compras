/**
 * La cookie de sesión: firmada, larga, y con lo mínimo adentro.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LA COOKIE ES IDENTIDAD; LA BASE ES AUTORIDAD.                            │
 * │                                                                          │
 * │ Adentro va el id del usuario y nada más. NO va el rol: la cookie dura 30 │
 * │ días, así que si un administrativo cambia un rol o desactiva una cuenta, │
 * │ una cookie vieja seguiría afirmando lo anterior. El rol y el `activo` se │
 * │ leen de la base en CADA acción — ver `auth.ts`.                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Usa Web Crypto (`globalThis.crypto.subtle`) y no `node:crypto` a propósito:
 * existe en los dos runtimes, así que el MISMO código firma en el server y
 * verifica en el proxy, que corre en Edge. Una segunda implementación para
 * Edge sería una segunda oportunidad de que las dos no coincidan.
 *
 * POR QUÉ 30 DÍAS, que es mucho: lo obliga el trabajo sin señal. Una sesión de
 * una hora deja al comprador afuera justo en el peor escenario — abrió el
 * formulario en el campo, sin señal, con los borradores adentro y sin forma de
 * renovar nada. Solo el primer login necesita conexión.
 */

export const COOKIE_SESION = "compras_sesion";

/** 30 días, en segundos. */
export const DURACION_SESION = 30 * 24 * 60 * 60;

export type Sesion = {
  /** Id del usuario. Es lo ÚNICO que la cookie afirma. */
  uid: number;
  /** Vencimiento, en segundos desde epoch. */
  exp: number;
  /**
   * Emisión, en segundos desde epoch. La usa `usuarioActual()` para descartar
   * la sesión anterior al último cambio de contraseña (`credencialesDesde`).
   *
   * VA EXPLÍCITA Y NO SE DERIVA DE `exp`. Derivarla como `exp − DURACION_SESION`
   * da el valor exacto, pero solo mientras esa constante no cambie: el día que
   * alguien la mueva, TODA cookie ya emitida cambia de fecha de emisión sin que
   * nadie la haya tocado. Alargarla las envejece y echaría a todos; acortarla
   * las rejuvenece, y una cookie robada sobreviviría al cambio de contraseña
   * que existe para matarla. Ese es el lado peligroso, y es silencioso.
   */
  iat: number;
};

/**
 * El secreto de firma. Va en una variable de entorno de Vercel, NUNCA en el
 * repo. Si falta, se corta acá y no se degrada a un valor por defecto: firmar
 * con un secreto conocido es lo mismo que no firmar.
 */
function secreto(): string {
  const s = process.env.SESION_SECRETO;
  if (!s || s.length < 32) {
    throw new Error(
      "Falta SESION_SECRETO, o tiene menos de 32 caracteres. Es el secreto que " +
        "firma las cookies de sesión: sin él la firma no vale nada. Se crea en " +
        "las variables de entorno de Vercel."
    );
  }
  return s;
}

function aBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(texto: string): Uint8Array {
  const b64 = texto.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function clave(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secreto()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Devuelve `<payload>.<firma>`, las dos partes en base64url. */
export async function firmarSesion(uid: number): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  const sesion: Sesion = {
    uid,
    exp: ahora + DURACION_SESION,
    iat: ahora,
  };
  const payload = aBase64Url(new TextEncoder().encode(JSON.stringify(sesion)));
  const firma = await crypto.subtle.sign(
    "HMAC",
    await clave(),
    new TextEncoder().encode(payload)
  );
  return `${payload}.${aBase64Url(new Uint8Array(firma))}`;
}

/**
 * Verifica firma y vencimiento. NO toca la base — a propósito: esto corre en
 * el proxy, en cada request, incluidas las rutas que Next prefetchea.
 *
 * Devuelve null ante cualquier problema, sin distinguir cuál: al que manda una
 * cookie falsa no se le explica en qué se equivocó.
 */
export async function leerSesion(cookie: string | undefined): Promise<Sesion | null> {
  if (!cookie) return null;
  const punto = cookie.lastIndexOf(".");
  if (punto <= 0) return null;

  const payload = cookie.slice(0, punto);
  const firma = cookie.slice(punto + 1);

  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await clave(),
      deBase64Url(firma) as unknown as ArrayBuffer,
      new TextEncoder().encode(payload)
    );
    if (!ok) return null;

    const crudo = JSON.parse(
      new TextDecoder().decode(deBase64Url(payload))
    ) as Partial<Sesion>;
    if (typeof crudo.uid !== "number" || typeof crudo.exp !== "number") return null;
    if (crudo.exp < Math.floor(Date.now() / 1000)) return null;

    // Las cookies firmadas antes de que `iat` existiera no lo traen. Para ésas
    // se deriva de `exp`, que es exactamente cómo se las firmó. No se las
    // invalida: echar a todo el mundo por agregar un campo sería un costo
    // gratuito, y encima el peor día para pedir un login es el del deploy.
    const iat =
      typeof crudo.iat === "number" ? crudo.iat : crudo.exp - DURACION_SESION;

    return { uid: crudo.uid, exp: crudo.exp, iat };
  } catch {
    return null;
  }
}
