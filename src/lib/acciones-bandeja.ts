"use server";

import type { MotivoDescarte } from "@/generated/prisma/enums";
import { exigir, SinPermiso } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refrescar } from "@/lib/refrescar";

/**
 * Lo único que la oficina puede cambiarle a un reporte: SU ESTADO.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ NO HAY ACCIÓN QUE EDITE EL CONTENIDO DE UN REPORTE, Y ES A PROPÓSITO.    │
 * │                                                                          │
 * │ El reporte es evidencia: guarda lo que el comprador escribió, no una     │
 * │ interpretación. Si el remito dice VQ y él escribió VA, las dos           │
 * │ afirmaciones se conservan — esa diferencia es lo que a los seis meses    │
 * │ permite contestar «¿cuántas veces vio algo distinto del papel?».         │
 * │                                                                          │
 * │ Por eso este archivo está separado de `acciones-compra.ts` y por eso no  │
 * │ exporta ningún `editarReporte`. No alcanza con no poner el botón: una    │
 * │ acción que existe se puede invocar por POST directo.                     │
 * │                                                                          │
 * │ (La corrección del PROPIO reporte por parte del comprador, mientras esté │
 * │ PENDIENTE, vive en `acciones-reportes.ts` y comprueba que sea suyo.)     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Las tres acciones registran QUIÉN y CUÁNDO en `estadoCambiadoPor` /
 * `estadoCambiadoEn`. `actualizadoEn` no alcanza: se mueve con cualquier
 * cambio, así que no puede contestar quién congeló esto.
 */

export type ResultadoBandeja = { ok: true; id?: number } | { ok: false; errores: string[] };

function sinPermiso(e: unknown): ResultadoBandeja | null {
  return e instanceof SinPermiso ? { ok: false, errores: [e.message] } : null;
}

/**
 * Marcar procesado CONGELA la pantalla del comprador.
 *
 * No es una acción administrativa: es una que le saca algo a otra persona. La
 * confirmación que la precede nombra al comprador y dice qué pierde — eso vive
 * en la pantalla, pero el registro de quién apretó vive acá.
 */
export async function marcarProcesado(reporteId: number): Promise<ResultadoBandeja> {
  let yo;
  try {
    yo = await exigir("ADMINISTRATIVO");
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  const reporte = await prisma.reporteCompra.findUnique({
    where: { id: reporteId },
    select: { estado: true },
  });
  if (!reporte) return { ok: false, errores: ["Ese reporte no existe."] };
  if (reporte.estado === "DESCARTADO") {
    return {
      ok: false,
      errores: ["Ese reporte está descartado. Volvelo a pendiente antes de procesarlo."],
    };
  }

  await prisma.reporteCompra.update({
    where: { id: reporteId },
    data: {
      estado: "PROCESADO",
      motivoDescarte: null,
      estadoCambiadoPorUsuarioId: yo.id,
      estadoCambiadoEn: new Date(),
    },
  });
  refrescar("/bandeja");
  refrescar(`/reportes/${reporteId}`);
  return { ok: true };
}

/**
 * Volver atrás. La reversión TAMBIÉN queda registrada: es la que le devuelve
 * al comprador algo que se le había sacado, y si no se anota, a los seis meses
 * nadie sabe si el reporte estuvo congelado o nunca lo estuvo.
 */
export async function revertirProcesado(reporteId: number): Promise<ResultadoBandeja> {
  let yo;
  try {
    yo = await exigir("ADMINISTRATIVO");
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  const reporte = await prisma.reporteCompra.findUnique({
    where: { id: reporteId },
    select: { estado: true },
  });
  if (!reporte) return { ok: false, errores: ["Ese reporte no existe."] };

  await prisma.reporteCompra.update({
    where: { id: reporteId },
    data: {
      estado: "PENDIENTE",
      motivoDescarte: null,
      estadoCambiadoPorUsuarioId: yo.id,
      estadoCambiadoEn: new Date(),
    },
  });
  refrescar("/bandeja");
  refrescar(`/reportes/${reporteId}`);
  return { ok: true };
}

/**
 * Descartar. EL MOTIVO ES OBLIGATORIO y el reporte SIGUE EXISTIENDO.
 *
 * Sigue existiendo porque es evidencia: alguien fue a una feria, sacó fotos y
 * escribió lo que vio. Que la compra no se haya hecho no borra que eso pasó.
 * Y el motivo es obligatorio porque la pantalla del comprador promete que va a
 * ver que se descartó Y POR QUÉ — sin el porqué, del otro lado queda alguien
 * que no sabe si hizo algo mal.
 */
export async function descartarReporte(
  reporteId: number,
  motivo: MotivoDescarte
): Promise<ResultadoBandeja> {
  let yo;
  try {
    yo = await exigir("ADMINISTRATIVO");
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  const validos: MotivoDescarte[] = ["DUPLICADO", "ERROR", "NO_SE_HIZO"];
  if (!validos.includes(motivo)) {
    return { ok: false, errores: ["Hay que decir por qué se descarta."] };
  }

  const reporte = await prisma.reporteCompra.findUnique({
    where: { id: reporteId },
    select: { _count: { select: { compras: true } } },
  });
  if (!reporte) return { ok: false, errores: ["Ese reporte no existe."] };
  if (reporte._count.compras > 0) {
    return {
      ok: false,
      errores: [
        "De este reporte ya salieron compras, así que no se descarta: descartarlo " +
          "diría que no se usó, y sí se usó.",
      ],
    };
  }

  await prisma.reporteCompra.update({
    where: { id: reporteId },
    data: {
      estado: "DESCARTADO",
      motivoDescarte: motivo,
      estadoCambiadoPorUsuarioId: yo.id,
      estadoCambiadoEn: new Date(),
    },
  });
  refrescar("/bandeja");
  refrescar(`/reportes/${reporteId}`);
  return { ok: true };
}

/**
 * Arma una compra a partir de un reporte, y las deja vinculadas.
 *
 * UN REPORTE PUEDE DAR CERO, UNA O VARIAS COMPRAS; una compra sale de a lo
 * sumo un reporte. Por eso la FK vive del lado de `Compra` y esta acción se
 * puede llamar de nuevo sobre el mismo reporte: forzar 1-a-1 obligaría a
 * cargar dos veces el mismo papel.
 *
 * NO copia el reporte ni lo consume: le presta los datos que la compra necesita
 * para existir, y el reporte sigue intacto al costado.
 */
export async function crearCompraDesdeReporte(
  reporteId: number,
  empresaTitularId: number,
  consignatarioId: number
): Promise<ResultadoBandeja> {
  let yo;
  try {
    yo = await exigir("ADMINISTRATIVO");
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  const errores: string[] = [];
  const reporte = await prisma.reporteCompra.findUnique({
    where: { id: reporteId },
    select: { id: true, fecha: true, plazaTexto: true, personaCompradoraId: true },
  });
  if (!reporte) errores.push("Ese reporte no existe.");

  const titular = await prisma.entidad.findUnique({
    where: { id: empresaTitularId },
    select: { esPropio: true, nombre: true },
  });
  if (!titular) errores.push("La empresa titular elegida no existe.");
  else if (titular.esPropio !== true) {
    errores.push(`"${titular.nombre}" no es una empresa nuestra, así que no puede ser la titular.`);
  }

  const consignatario = await prisma.entidad.count({ where: { id: consignatarioId } });
  if (!consignatario) errores.push("El consignatario elegido no existe.");

  if (errores.length) return { ok: false, errores };

  const compra = await prisma.compra.create({
    data: {
      // `Compra.fecha` es NOT NULL y la del reporte puede ser s/d: en ese caso
      // se usa la de hoy, que es cuándo la oficina la está registrando. No es
      // inventar la fecha de la feria — es registrar la de la carga, y queda
      // a la vista para corregirla.
      fecha: reporte!.fecha ?? new Date(),
      consignatarioId,
      empresaTitularId,
      personaCompradoraId: reporte!.personaCompradoraId,
      plazaLugar: reporte!.plazaTexto,
      reporteId: reporte!.id,
      creadoPorUsuarioId: yo.id,
    },
    select: { id: true },
  });

  refrescar("/bandeja");
  refrescar("/compras");
  return { ok: true, id: compra.id };
}
