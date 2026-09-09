import "server-only";

import type { EstadoReporte } from "@/generated/prisma/enums";
import { SinPermiso, type UsuarioSesion } from "@/lib/auth";
import { crearEntidadConRol } from "@/lib/entidades";
import { prisma } from "@/lib/prisma";
import { subirRemito } from "@/lib/almacenamiento";

/**
 * Recibir y leer reportes del comprador.
 *
 * LOS CUATRO ESTADOS NO VIVEN EN EL MISMO LUGAR, y confundirlos rompe el
 * offline. «Borrador» y «esperando señal» son del DISPOSITIVO —IndexedDB— y el
 * servidor no los conoce ni tiene por qué: un reporte esperando señal todavía
 * no le llegó. Acá solo existen PENDIENTE y PROCESADO, que son `EstadoReporte`.
 */

export type RemitoEntrante = {
  numero: string | null;
  nota: string | null;
};

export type ReporteEntrante = {
  /** Generada en el dispositivo con `crypto.randomUUID()`, antes de que haya red. */
  claveIdempotencia: string;
  /** Cuándo lo cargó el comprador. Lo sabe el dispositivo; el servidor pone `recibidoEn`. */
  cargadoEn: string;
  fecha: string | null;
  /** El texto es la verdad. El id es una comodidad, y solo si lo eligió del catálogo. */
  consignatarioTexto: string | null;
  consignatarioId: number | null;
  plazaTexto: string | null;
  cabezasAproximadas: number | null;
  cantidadCamiones: number | null;
  observaciones: string | null;
  remitos: RemitoEntrante[];
};

export type ResultadoRecepcion = {
  id: number;
  estado: EstadoReporte;
  /** `true` cuando la clave ya había llegado. No es un error: es la idempotencia funcionando. */
  yaExistia: boolean;
};

export class ReporteInvalido extends Error {}

/** «s/d» se guarda como NULL. Nunca cadena vacía, nunca 0. */
function oNulo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/**
 * Entero no negativo, o NULL.
 *
 * NO convierte lo que no entiende en 0: «no sé cuántas cabezas» y «cero
 * cabezas» son afirmaciones distintas, y meterlas en el mismo valor es el error
 * central que esta app existe para no repetir.
 */
function oEntero(v: unknown, campo: string): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < 0) {
    throw new ReporteInvalido(`El campo "${campo}" tiene que ser un número entero, o quedar en s/d.`);
  }
  return n;
}

function validar(datos: ReporteEntrante): {
  cargadoEn: Date;
  fecha: Date | null;
  cabezas: number | null;
  camiones: number | null;
} {
  const clave = oNulo(datos.claveIdempotencia);
  if (!clave || clave.length > 64) {
    throw new ReporteInvalido(
      "Falta la clave de idempotencia, o no tiene forma de clave. Es lo único " +
        "que impide que una conexión intermitente cree el reporte dos veces."
    );
  }

  const cargado = oNulo(datos.cargadoEn);
  if (!cargado || Number.isNaN(Date.parse(cargado))) {
    throw new ReporteInvalido("Falta `cargadoEn`, o no es una fecha válida.");
  }

  const fechaTexto = oNulo(datos.fecha);
  if (fechaTexto && Number.isNaN(Date.parse(fechaTexto))) {
    throw new ReporteInvalido(`La fecha "${fechaTexto}" no es una fecha válida.`);
  }

  return {
    cargadoEn: new Date(cargado),
    fecha: fechaTexto ? new Date(fechaTexto) : null,
    cabezas: oEntero(datos.cabezasAproximadas, "cabezas aproximadas"),
    camiones: oEntero(datos.cantidadCamiones, "cantidad de camiones"),
  };
}

/** Un reporte sin nada adentro es ruido: no se guarda. */
function tieneAlgo(datos: ReporteEntrante, fotos: number): boolean {
  return (
    fotos > 0 ||
    !!oNulo(datos.fecha) ||
    !!oNulo(datos.consignatarioTexto) ||
    !!oNulo(datos.plazaTexto) ||
    !!oNulo(datos.observaciones) ||
    datos.cabezasAproximadas !== null ||
    datos.cantidadCamiones !== null
  );
}

/**
 * Recibe un reporte. IDEMPOTENTE POR `claveIdempotencia`.
 *
 * Si la clave ya llegó, DEVUELVE EL REPORTE EXISTENTE. No crea otro y tampoco
 * tira error: un 409 haría que la cola reintente para siempre justo en el caso
 * que la clave existe para resolver.
 *
 * `creadoPorUsuarioId` sale de la SESIÓN, no del cliente: el cliente no decide
 * quién es. Y no se confunde con `personaCompradoraId`, que responde quién fue
 * físicamente a comprar y puede ser alguien sin cuenta.
 */
export async function recibirReporte(
  datos: ReporteEntrante,
  fotos: { bytes: ArrayBuffer; tipoMime: string }[],
  usuario: UsuarioSesion
): Promise<ResultadoRecepcion> {
  const { cargadoEn, fecha, cabezas, camiones } = validar(datos);

  // La idempotencia se mira ANTES de subir nada: un reenvío no tiene que pagar
  // otra vez la subida de cuatro fotos por una red que ya está mal.
  const yaEsta = await prisma.reporteCompra.findUnique({
    where: { claveIdempotencia: datos.claveIdempotencia },
    select: { id: true, estado: true },
  });
  if (yaEsta) return { ...yaEsta, yaExistia: true };

  if (!tieneAlgo(datos, fotos.length)) {
    throw new ReporteInvalido(
      "El reporte no trae ningún dato ni ninguna foto. Un reporte vacío no dice nada."
    );
  }

  // El consignatario se resuelve o se crea por `nombreNormalizado` ESTRICTO.
  // Si dos comerciales dieron de alta el mismo nombre cada uno por su lado, el
  // unique los junta solo. El texto se guarda igual, siempre: es la verdad del
  // reporte, y el id es la comodidad.
  const texto = oNulo(datos.consignatarioTexto);
  let consignatarioId: number | null = null;
  if (texto) {
    const r = await crearEntidadConRol(texto, "CONSIGNATARIO");
    consignatarioId = r.id;
  } else if (typeof datos.consignatarioId === "number") {
    const existe = await prisma.entidad.count({ where: { id: datos.consignatarioId } });
    if (existe) consignatarioId = datos.consignatarioId;
  }

  // Las fotos suben ANTES de crear las filas, y la fila del adjunto se escribe
  // solo si la subida salió bien: un `Adjunto` apuntando a un objeto que no
  // existe es peor que no tener el adjunto — la pantalla muestra un hueco y
  // nadie sabe si la foto se perdió o nunca se sacó.
  const rutas: { ruta: string; numero: string | null; nota: string | null }[] = [];
  for (let i = 0; i < fotos.length; i++) {
    const ruta = await subirRemito(
      datos.claveIdempotencia,
      i,
      fotos[i].bytes,
      fotos[i].tipoMime
    );
    const meta = datos.remitos?.[i] ?? { numero: null, nota: null };
    rutas.push({ ruta, numero: oNulo(meta.numero), nota: oNulo(meta.nota) });
  }

  try {
    const creado = await prisma.reporteCompra.create({
      data: {
        claveIdempotencia: datos.claveIdempotencia,
        cargadoEn,
        fecha,
        consignatarioTexto: texto,
        consignatarioId,
        plazaTexto: oNulo(datos.plazaTexto),
        cabezasAproximadas: cabezas,
        cantidadCamiones: camiones,
        observaciones: oNulo(datos.observaciones),
        creadoPorUsuarioId: usuario.id,
        // La cuenta puede apuntar a su entidad del padrón: eso PRECARGA quién
        // fue a comprar, no lo define. Son dos hechos distintos.
        personaCompradoraId: usuario.entidadId,
        adjuntos: {
          create: rutas.map((r) => ({
            tipo: "REMITO_FERIA" as const,
            url: r.ruta,
            numero: r.numero,
            nota: r.nota,
          })),
        },
      },
      select: { id: true, estado: true },
    });
    return { ...creado, yaExistia: false };
  } catch {
    // Dos envíos con la misma clave a la vez: el unique decide. El que pierde
    // devuelve el reporte del que ganó, que es la respuesta correcta.
    const carrera = await prisma.reporteCompra.findUnique({
      where: { claveIdempotencia: datos.claveIdempotencia },
      select: { id: true, estado: true },
    });
    if (carrera) return { ...carrera, yaExistia: true };
    throw new ReporteInvalido("No se pudo guardar el reporte.");
  }
}

/**
 * Un COMERCIAL ve SOLO sus propios reportes. Se comprueba acá, del lado del
 * servidor: pedir por id el reporte de otro tiene que rebotar aunque la
 * pantalla nunca ofrezca el link.
 */
export function puedeVer(
  usuario: UsuarioSesion,
  reporte: { creadoPorUsuarioId: number | null }
): boolean {
  if (usuario.rol === "ADMINISTRATIVO") return true;
  return reporte.creadoPorUsuarioId === usuario.id;
}

export async function reporteParaVer(id: number, usuario: UsuarioSesion) {
  if (!Number.isInteger(id)) return null;
  const reporte = await prisma.reporteCompra.findUnique({
    where: { id },
    select: {
      id: true,
      estado: true,
      fecha: true,
      consignatarioTexto: true,
      plazaTexto: true,
      cabezasAproximadas: true,
      cantidadCamiones: true,
      observaciones: true,
      cargadoEn: true,
      recibidoEn: true,
      creadoPorUsuarioId: true,
      creadoPorUsuario: { select: { nombre: true } },
      adjuntos: {
        orderBy: { id: "asc" },
        select: { id: true, url: true, numero: true, nota: true },
      },
      _count: { select: { compras: true } },
    },
  });
  if (!reporte) return null;
  if (!puedeVer(usuario, reporte)) {
    throw new SinPermiso("Ese reporte es de otra persona.");
  }
  return reporte;
}
