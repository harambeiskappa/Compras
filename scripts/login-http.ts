/**
 * Cookies de sesión REALES para los scripts de verificación: se obtienen
 * entrando por el login, como entraría una persona.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ POR QUÉ NO SE FIRMAN LOCALMENTE, QUE ERA LO QUE SE HACÍA ANTES.          │
 * │                                                                          │
 * │ `SESION_SECRETO` está marcado SENSITIVE en Vercel: su valor no se puede  │
 * │ volver a leer, ni desde el dashboard ni con `vercel env pull`, que       │
 * │ escribe "[SENSITIVE]" como placeholder. El secreto de Development que    │
 * │ hay en `.env.local` es OTRO, así que una cookie firmada acá nunca validó │
 * │ contra producción: el proxy la rechazaba y devolvía 307 al login.        │
 * │                                                                          │
 * │ Ése es el motivo real de que de los siete puntos de auth «solo viniera   │
 * │ el 6»: los que necesitan sesión no podían correr contra producción, y    │
 * │ los que sí corrían lo hacían sobre redirects vacíos.                     │
 * │                                                                          │
 * │ Entrando por el login, el que firma es el servidor de verdad. El script  │
 * │ deja de depender del secreto, y de paso prueba el camino real.           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/** Extrae el id de una server action del bundle servido. */
export async function idDeAccion(
  base: string,
  ruta: string,
  nombre: string,
  cookie?: string
): Promise<string | null> {
  const html = await (
    await fetch(`${base}${ruta}`, {
      headers: cookie ? { Cookie: cookie } : {},
      redirect: "manual",
    })
  ).text();
  const chunks = [...html.matchAll(/\/_next\/static\/[^"']+\.js/g)].map((m) => m[0]);
  for (const c of [...new Set(chunks)]) {
    const js = await (await fetch(`${base}${c}`)).text();
    const m = js.match(new RegExp(`"([0-9a-f]{40,})"[^)]{0,160}${nombre}`));
    if (m) return m[1];
  }
  return null;
}

/**
 * Llama a una server action POR HTTP, como la llamaría cualquiera con curl.
 *
 * Es la única forma honesta de probar los permisos: llamarla en proceso saltea
 * el proxy, la sesión, la comprobación de rol y la serialización —justo lo que
 * se quiere probar— y además ata el script a detalles internos que cambian
 * solos. Eso fue lo que rompió `verificar-modulo-1.ts` sin que nadie se
 * enterara durante once días.
 */
export async function postAccion(
  base: string,
  ruta: string,
  accion: string,
  args: unknown[],
  cookie?: string
): Promise<Response> {
  return fetch(`${base}${ruta}`, {
    method: "POST",
    headers: {
      "Next-Action": accion,
      "Content-Type": "text/plain;charset=UTF-8",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(args),
    redirect: "manual",
  });
}

/**
 * Saca el valor que devolvió una server action del cuerpo RSC.
 *
 * El cuerpo viene en líneas `N:<json>`; una de ellas es el valor devuelto y las
 * otras son andamiaje del protocolo. Se prueban todas y se devuelve la primera
 * que cumpla el predicado, en vez de asumir una posición fija: la posición
 * cambia entre versiones de Next y el fallo sería silencioso.
 */
export function resultadoDeAccion<T>(
  cuerpo: string,
  cumple: (v: unknown) => boolean
): T | null {
  for (const linea of cuerpo.split("\n")) {
    const corte = linea.indexOf(":");
    if (corte <= 0) continue;
    try {
      const valor = JSON.parse(linea.slice(corte + 1)) as unknown;
      if (cumple(valor)) return valor as T;
    } catch {
      /* la línea no era JSON: es andamiaje */
    }
  }
  return null;
}

/** Atajo para las acciones que devuelven `{ ok: boolean, ... }`. */
export function resultadoOk<T extends { ok: boolean }>(cuerpo: string): T | null {
  return resultadoDeAccion<T>(
    cuerpo,
    (v) => typeof v === "object" && v !== null && "ok" in v
  );
}

export type SesionHttp = {
  /** `compras_sesion=<valor>`, listo para mandar como header Cookie. */
  cookie: string;
  /** El Set-Cookie crudo, para poder mirarle los atributos (Max-Age, HttpOnly…). */
  crudo: string;
};

function desescapar(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Entra con usuario y contraseña y devuelve la cookie que firmó el servidor.
 *
 * Envía el formulario COMO LO ENVIARÍA UN NAVEGADOR CON JAVASCRIPT APAGADO, y
 * los campos ocultos que hacen falta se leen del HTML servido en vez de
 * armarse a mano. `useActionState` no manda solo el id de la acción: manda
 * también el estado previo enlazado (`$ACTION_1:1`) y una clave (`$ACTION_KEY`),
 * y reconstruir ese formato a ojo se rompe con cada versión de Next. Copiando
 * lo que el servidor ya renderizó, el script no sabe ni necesita saber cuál es
 * el formato de este mes.
 */
export async function cookiePorLogin(
  base: string,
  usuario: string,
  password: string
): Promise<SesionHttp> {
  const html = await (await fetch(`${base}/ingresar`, { redirect: "manual" })).text();

  const cuerpo = new FormData();
  const ocultos = [...html.matchAll(/<input\b[^>]*type="hidden"[^>]*>/g)].map((m) => m[0]);
  for (const tag of ocultos) {
    const nombre = tag.match(/name="([^"]*)"/)?.[1];
    if (!nombre) continue;
    cuerpo.set(desescapar(nombre), desescapar(tag.match(/value="([^"]*)"/)?.[1] ?? ""));
  }
  if (![...cuerpo.keys()].some((k) => k.startsWith("$ACTION"))) {
    throw new Error(
      `No aparecieron los campos ocultos de la acción en ${base}/ingresar. ` +
        "Sin ellos el envío sin JavaScript no dispara la server action."
    );
  }

  cuerpo.set("usuario", usuario);
  cuerpo.set("password", password);

  const res = await fetch(`${base}/ingresar`, {
    method: "POST",
    body: cuerpo,
    redirect: "manual",
  });

  const puestas = res.headers.getSetCookie();
  const crudo = puestas.find((c) => c.startsWith("compras_sesion="));
  if (!crudo || crudo.startsWith("compras_sesion=;")) {
    throw new Error(
      `El login de "${usuario}" no devolvió cookie de sesión (HTTP ${res.status}). ` +
        `Set-Cookie: ${puestas.join(" | ") || "(ninguna)"}`
    );
  }

  return { cookie: crudo.split(";")[0], crudo };
}
