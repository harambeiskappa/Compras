import { revalidatePath } from "next/cache";

/**
 * `revalidatePath` fuera del contexto de request de Next tira un invariant.
 * Pasa cuando las server actions se llaman desde un script — que es como se
 * prueba que la validación y los permisos viven en el servidor y no en el
 * formulario. Ahí no hay caché que invalidar, así que ese caso puntual se
 * ignora; cualquier otro error se vuelve a tirar.
 *
 * Vive acá y no adentro de un archivo de acciones porque lo usan varios, y un
 * helper duplicado es dos helpers que en seis meses no hacen lo mismo.
 */
export function refrescar(ruta: string): void {
  try {
    revalidatePath(ruta);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("static generation store missing")) throw e;
  }
}
