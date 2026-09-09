import type { BorradorReporte, EnCola } from "./tipos";

/**
 * IndexedDB, NO `localStorage`.
 *
 * No es preferencia: `localStorage` guarda strings y tiene un techo de unos
 * 5 MB. Una sola foto de celular lo revienta, y las fotos son el contenido que
 * no se puede perder. IndexedDB guarda `Blob` directo y no tiene ese techo.
 *
 * También es síncrono: `localStorage` bloquea el hilo principal en cada
 * escritura, y acá se escribe mientras alguien tipea.
 *
 * Sin dependencias: son cuatro operaciones y no justifican traer `idb`.
 */

const NOMBRE = "compras-comprador";
const VERSION = 1;

export const TIENDA_BORRADORES = "borradores";
export const TIENDA_COLA = "cola";
export const TIENDA_CATALOGO = "catalogo";

let abierta: Promise<IDBDatabase> | null = null;

/** `false` en el servidor y en el service worker sin IndexedDB. */
export function hayIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function abrir(): Promise<IDBDatabase> {
  if (abierta) return abierta;
  abierta = new Promise((resolver, rechazar) => {
    const pedido = indexedDB.open(NOMBRE, VERSION);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      // Las tres claves son strings propias, no autoincrementales: la del
      // reporte es la clave de idempotencia, que ya identifica la fila y viaja
      // al servidor. Un id local aparte sería un segundo identificador del
      // mismo reporte.
      if (!db.objectStoreNames.contains(TIENDA_BORRADORES)) {
        db.createObjectStore(TIENDA_BORRADORES, { keyPath: "clave" });
      }
      if (!db.objectStoreNames.contains(TIENDA_COLA)) {
        db.createObjectStore(TIENDA_COLA, { keyPath: "clave" });
      }
      if (!db.objectStoreNames.contains(TIENDA_CATALOGO)) {
        db.createObjectStore(TIENDA_CATALOGO);
      }
    };
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rechazar(pedido.error);
    // Pasa cuando otra pestaña tiene abierta una versión vieja. No se cuelga en
    // silencio: se avisa, porque el síntoma sería «no guarda» sin más.
    pedido.onblocked = () =>
      rechazar(new Error("Hay otra pestaña de la app abierta con una versión anterior."));
  });
  return abierta;
}

function correr<T>(
  tienda: string,
  modo: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  return abrir().then(
    (db) =>
      new Promise<T>((resolver, rechazar) => {
        const tx = db.transaction(tienda, modo);
        const pedido = fn(tx.objectStore(tienda));
        pedido.onsuccess = () => resolver(pedido.result as T);
        pedido.onerror = () => rechazar(pedido.error);
        tx.onabort = () => rechazar(tx.error);
      })
  );
}

// ---------------------------------------------------------------- borradores

export function guardarBorrador(b: BorradorReporte): Promise<unknown> {
  return correr(TIENDA_BORRADORES, "readwrite", (s) => s.put(b));
}

export function leerBorrador(clave: string): Promise<BorradorReporte | undefined> {
  return correr(TIENDA_BORRADORES, "readonly", (s) => s.get(clave));
}

export function listarBorradores(): Promise<BorradorReporte[]> {
  return correr(TIENDA_BORRADORES, "readonly", (s) => s.getAll());
}

export function borrarBorrador(clave: string): Promise<unknown> {
  return correr(TIENDA_BORRADORES, "readwrite", (s) => s.delete(clave));
}

// ---------------------------------------------------------------------- cola

export function ponerEnCola(e: EnCola): Promise<unknown> {
  return correr(TIENDA_COLA, "readwrite", (s) => s.put(e));
}

export function listarCola(): Promise<EnCola[]> {
  return correr(TIENDA_COLA, "readonly", (s) => s.getAll());
}

export function sacarDeCola(clave: string): Promise<unknown> {
  return correr(TIENDA_COLA, "readwrite", (s) => s.delete(clave));
}

// ----------------------------------------------------------------- catálogo

export function guardarEnCatalogo(clave: string, valor: unknown): Promise<unknown> {
  return correr(TIENDA_CATALOGO, "readwrite", (s) => s.put(valor, clave));
}

export function leerDeCatalogo<T>(clave: string): Promise<T | undefined> {
  return correr(TIENDA_CATALOGO, "readonly", (s) => s.get(clave));
}
