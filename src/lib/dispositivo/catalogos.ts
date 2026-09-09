import type { CatalogoComprador } from "@/lib/catalogos";

import { guardarEnCatalogo, hayIndexedDB, leerDeCatalogo } from "./db";

/**
 * El catálogo, cacheado en el dispositivo.
 *
 * Son 18 consignatarios y una docena de plazas: unos pocos KB. Se guarda para
 * que el selector funcione sin señal, que es el caso para el que existe todo
 * esto — no para ahorrar una request.
 *
 * SE CACHEA ACÁ Y NO EN EL SERVICE WORKER. Dos caches del mismo dato se
 * contradicen el día que uno se refresca y el otro no; y acá, además, el
 * `generadoEn` queda a la vista para poder decirle a la persona qué tan viejo
 * es lo que está mirando.
 */

const CLAVE = "comprador";

export type CatalogoCacheado = CatalogoComprador & {
  /** Cuándo se trajo a este dispositivo. Distinto de `generadoEn`, que es del servidor. */
  traidoEn: string;
};

/** Vacío, para cuando todavía no se trajo nada. No inventa opciones. */
export const CATALOGO_VACIO: CatalogoCacheado = {
  generadoEn: "",
  traidoEn: "",
  consignatarios: [],
  plazas: [],
};

export async function catalogoGuardado(): Promise<CatalogoCacheado | null> {
  if (!hayIndexedDB()) return null;
  try {
    return (await leerDeCatalogo<CatalogoCacheado>(CLAVE)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Trae el catálogo del servidor y lo guarda. Devuelve `null` si no hay señal —
 * NO tira: quedarse sin catálogo nuevo es lo normal en el campo, y lo que
 * corresponde es seguir con el que ya está guardado.
 */
export async function refrescarCatalogo(): Promise<CatalogoCacheado | null> {
  try {
    const res = await fetch("/api/catalogos", { cache: "no-store" });
    if (!res.ok) return null;
    const datos = (await res.json()) as CatalogoComprador;
    const cacheado: CatalogoCacheado = { ...datos, traidoEn: new Date().toISOString() };
    if (hayIndexedDB()) await guardarEnCatalogo(CLAVE, cacheado);
    return cacheado;
  } catch {
    return null;
  }
}

/**
 * Lo guardado primero, y el refresco después y en segundo plano.
 *
 * El orden importa: la pantalla tiene que poder abrir y mostrar el selector sin
 * esperar a una red que puede no estar. Si el refresco llega, avisa por el
 * callback y la pantalla se actualiza sola.
 */
export async function catalogoParaUsar(
  alRefrescar?: (c: CatalogoCacheado) => void
): Promise<CatalogoCacheado> {
  const guardado = await catalogoGuardado();
  const promesa = refrescarCatalogo().then((nuevo) => {
    if (nuevo && alRefrescar) alRefrescar(nuevo);
    return nuevo;
  });
  if (guardado) return guardado;
  return (await promesa) ?? CATALOGO_VACIO;
}
