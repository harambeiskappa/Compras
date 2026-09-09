import { borrarBorrador, hayIndexedDB, listarCola, ponerEnCola, sacarDeCola } from "./db";
import type { BorradorReporte, EnCola } from "./tipos";

/**
 * La cola de envío.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ EL ENVÍO PASA POR ACÁ DESDE EL DÍA UNO, aunque con señal se vacíe al     │
 * │ instante. Colgar la cola después obligaría a reescribir el camino de     │
 * │ envío entero, y el camino de envío es lo que no se puede romper.         │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Reglas, cada una con su motivo:
 *
 * - **Uno por vez.** Dos envíos simultáneos por una red de feria se pisan y
 *   ninguno termina.
 * - **Espera creciente, no bucle cerrado.** Sin señal, reintentar cada segundo
 *   solo gasta batería, que en el campo es el recurso escaso.
 * - **Sobrevive a cerrar el navegador**, porque vive en IndexedDB. Es el caso
 *   real: el comprador manda, cierra todo y se va de la feria.
 * - **La clave de idempotencia viaja siempre**, así que un reintento sobre algo
 *   que ya llegó devuelve el mismo reporte en vez de crear otro.
 */

/** Esperas entre reintentos. La última se repite. */
const ESPERAS_MS = [2_000, 5_000, 15_000, 60_000, 300_000];

export type EstadoCola = {
  esperando: number;
  enviando: boolean;
  ultimoError: string | null;
  /** Lo que el navegador cree; se confirma recién cuando un envío sale bien. */
  hayRed: boolean;
};

type Escucha = (e: EstadoCola) => void;

const escuchas = new Set<Escucha>();
let enviando = false;
let ultimoError: string | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;

export function suscribir(fn: Escucha): () => void {
  escuchas.add(fn);
  void avisar();
  return () => escuchas.delete(fn);
}

async function avisar(): Promise<void> {
  if (!escuchas.size) return;
  const pendientes = hayIndexedDB() ? await listarCola().catch(() => []) : [];
  const estado: EstadoCola = {
    esperando: pendientes.length,
    enviando,
    ultimoError,
    hayRed: typeof navigator === "undefined" ? true : navigator.onLine,
  };
  for (const fn of escuchas) fn(estado);
}

/**
 * Mueve un borrador a la cola. Es lo que pasa al apretar «mandar».
 *
 * El borrador se borra en la misma operación: si quedara en las dos tiendas,
 * la pantalla lo mostraría dos veces y una edición posterior tocaría una copia
 * que ya no es la que se está enviando.
 */
export async function encolar(borrador: BorradorReporte): Promise<void> {
  await ponerEnCola({
    clave: borrador.clave,
    reporte: borrador,
    encoladoEn: new Date().toISOString(),
    intentos: 0,
    proximoIntento: 0,
    ultimoError: null,
  });
  await borrarBorrador(borrador.clave);
  await avisar();
  void vaciar();
}

function armarCuerpo(entrada: EnCola): FormData {
  const r = entrada.reporte;
  const cuerpo = new FormData();
  cuerpo.set(
    "datos",
    JSON.stringify({
      claveIdempotencia: r.clave,
      cargadoEn: r.cargadoEn,
      fecha: r.fecha,
      // El TEXTO es lo que manda. El id va solo como comodidad, y puede no
      // existir: sin señal el consignatario se escribió a mano.
      consignatarioTexto: r.consignatarioTexto,
      consignatarioId: r.consignatarioId,
      plazaTexto: r.plazaTexto,
      cabezasAproximadas: r.cabezasAproximadas,
      cantidadCamiones: r.cantidadCamiones,
      observaciones: r.observaciones,
      remitos: r.remitos.map((m) => ({ numero: m.numero, nota: m.nota })),
    })
  );
  r.remitos.forEach((m, i) => {
    const tipo = m.foto.type || "image/jpeg";
    const extension = tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "jpg";
    cuerpo.set(`foto_${i}`, m.foto, `remito-${i}.${extension}`);
  });
  return cuerpo;
}

/**
 * Intenta vaciar la cola. Uno por vez, y sale sola si no hay nada o si ya hay
 * un envío en curso.
 */
export async function vaciar(): Promise<void> {
  if (enviando || !hayIndexedDB()) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await avisar();
    return;
  }

  enviando = true;
  await avisar();

  try {
    const pendientes = (await listarCola()).sort((a, b) =>
      a.encoladoEn.localeCompare(b.encoladoEn)
    );
    const ahora = Date.now();

    for (const entrada of pendientes) {
      if (entrada.proximoIntento > ahora) continue;

      try {
        const res = await fetch("/api/reportes", {
          method: "POST",
          body: armarCuerpo(entrada),
        });

        if (res.ok) {
          // Llegó — o ya había llegado antes, que para la cola es lo mismo y es
          // exactamente el caso que la clave de idempotencia existe para
          // resolver. Sale de la cola en los dos casos.
          await sacarDeCola(entrada.clave);
          ultimoError = null;
          continue;
        }

        // 4xx: el servidor lo rechazó por lo que trae adentro. Reintentarlo no
        // lo va a arreglar nunca, así que se para y se muestra el motivo. Un
        // reintento eterno acá sería una cola que nunca se vacía y una persona
        // que nunca se entera de por qué.
        if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          const cuerpo = await res.json().catch(() => ({ error: "" }));
          await ponerEnCola({
            ...entrada,
            intentos: entrada.intentos + 1,
            proximoIntento: Number.MAX_SAFE_INTEGER,
            ultimoError:
              (cuerpo as { error?: string }).error ||
              `El servidor lo rechazó (HTTP ${res.status}).`,
          });
          ultimoError = (cuerpo as { error?: string }).error ?? null;
          continue;
        }

        throw new Error(`HTTP ${res.status}`);
      } catch (e) {
        // Sin señal o problema del servidor: se reintenta más tarde. NO es un
        // error de la persona y no se le muestra como tal.
        const intentos = entrada.intentos + 1;
        const espera = ESPERAS_MS[Math.min(intentos - 1, ESPERAS_MS.length - 1)];
        ultimoError = e instanceof Error ? e.message : "No se pudo enviar.";
        await ponerEnCola({
          ...entrada,
          intentos,
          proximoIntento: Date.now() + espera,
          ultimoError: null,
        });
        programar(espera);
        break; // uno por vez: si falló éste, la red está mal para todos
      }
    }
  } finally {
    enviando = false;
    await avisar();
  }
}

function programar(ms: number): void {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    temporizador = null;
    void vaciar();
  }, ms);
}

let arrancada = false;

/**
 * Engancha la cola a la vida de la app: al abrir, al volver la señal y al
 * volver a la pestaña.
 *
 * `visibilitychange` no es decorativo: en un celular la app pasa a segundo
 * plano cuando la persona saca una foto o atiende, y los timers ahí se
 * congelan. Sin esto, un reporte podría quedar esperando un reintento que el
 * sistema operativo ya no va a disparar.
 */
export function arrancarCola(): void {
  if (arrancada || typeof window === "undefined") return;
  arrancada = true;

  void vaciar();
  window.addEventListener("online", () => void vaciar());
  window.addEventListener("offline", () => void avisar());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void vaciar();
  });
}
