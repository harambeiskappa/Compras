/**
 * Lo que vive en el dispositivo.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LOS CUATRO ESTADOS NO VIVEN EN EL MISMO LUGAR.                           │
 * │                                                                          │
 * │   borrador · esperando señal  →  el DISPOSITIVO (IndexedDB). El servidor │
 * │                                   no los conoce ni tiene por qué.        │
 * │   enviado (PENDIENTE) · procesado (PROCESADO)  →  `EstadoReporte`, en la │
 * │                                   base.                                  │
 * │                                                                          │
 * │ Un reporte esperando señal TODAVÍA NO EXISTE del lado del servidor.      │
 * │ Pedirle a la base que sepa de él sería pedirle que sepa algo que, por    │
 * │ definición, no le llegó.                                                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

export type EstadoLocal = "borrador" | "esperando" | "rechazado";

export type RemitoLocal = {
  /** Id local de la foto. Solo sirve para ordenarlas y borrarlas en pantalla. */
  id: string;
  /** El archivo. Va como Blob: por eso IndexedDB y no localStorage. */
  foto: Blob;
  /**
   * Opcional a propósito. Pedirle precisión a alguien parado en un remate hace
   * que invente un número o que directamente no saque la foto. La foto es lo
   * que no puede faltar; el número lo lee la oficina del papel.
   */
  numero: string | null;
  /** Donde marca la discrepancia: «el remito dice VQ, para mí es VA». */
  nota: string | null;
};

export type BorradorReporte = {
  /**
   * La clave de idempotencia. SE GENERA ACÁ, en el dispositivo, al crear el
   * borrador y antes de que haya red. Es lo único que impide que una conexión
   * que va y viene cree dos reportes iguales.
   */
  clave: string;
  /** Cuándo empezó a cargarlo. Es el `cargadoEn` que viaja al servidor. */
  cargadoEn: string;
  actualizadoEn: string;

  fecha: string | null;
  /**
   * EL TEXTO ES LA VERDAD. Sin señal, la entidad puede no existir todavía del
   * otro lado, así que el borrador guarda el nombre escrito y no un id. Si lo
   * eligió del catálogo cacheado se guardan los dos, pero manda el texto.
   */
  consignatarioTexto: string | null;
  consignatarioId: number | null;
  plazaTexto: string | null;
  cabezasAproximadas: number | null;
  cantidadCamiones: number | null;
  observaciones: string | null;
  remitos: RemitoLocal[];
};

export type EnCola = {
  clave: string;
  reporte: BorradorReporte;
  encoladoEn: string;
  intentos: number;
  /** Epoch ms. La espera crece con cada fallo: reintentar en bucle cerrado sin señal solo gasta batería. */
  proximoIntento: number;
  ultimoError: string | null;
};

/** Lo que la pantalla muestra de un reporte, venga del dispositivo o del servidor. */
export type ReporteEnPantalla = {
  origen: "dispositivo" | "servidor";
  clave: string | null;
  id: number | null;
  estado:
    | "borrador"
    | "esperando"
    /** El quinto: el servidor lo rechazó y NO se va a reintentar solo. */
    | "rechazado"
    | "PENDIENTE"
    | "PROCESADO"
    | "DESCARTADO";
  /** Por qué lo rechazó el servidor, o por qué la oficina lo descartó. */
  motivo?: string | null;
  fecha: string | null;
  consignatario: string | null;
  plaza: string | null;
  cabezas: number | null;
  remitos: number;
  cuando: string;
};
