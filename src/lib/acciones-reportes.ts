"use server";

import { exigir, SinPermiso } from "@/lib/auth";
import { crearEntidadConRol } from "@/lib/entidades";
import { prisma } from "@/lib/prisma";
import { refrescar } from "@/lib/refrescar";
import { puedeVer } from "@/lib/reportes";

/**
 * Corregir un reporte YA ENVIADO.
 *
 * Solo mientras la oficina no lo haya procesado. Un reporte PROCESADO está
 * congelado y el rechazo VIENE CON EL MOTIVO, no con un botón apagado: quien
 * entiende la razón puede hablar con la oficina; quien solo ve un botón gris
 * vuelve a intentarlo mañana.
 */

export type ResultadoReporte = { ok: true } | { ok: false; errores: string[] };

function sinPermiso(e: unknown): ResultadoReporte | null {
  return e instanceof SinPermiso ? { ok: false, errores: [e.message] } : null;
}

export type CorreccionReporte = {
  fecha: string | null;
  consignatarioTexto: string | null;
  plazaTexto: string | null;
  cabezasAproximadas: number | null;
  cantidadCamiones: number | null;
  observaciones: string | null;
  /** Por adjunto ya subido: su número de remito y su nota. Las fotos no se tocan acá. */
  remitos: { id: number; numero: string | null; nota: string | null }[];
};

const CONGELADO =
  "La oficina ya armó la compra con este reporte, así que quedó congelado. Es " +
  "lo que viste en la feria y así se guarda. Si algo está mal, avisale a la " +
  "oficina: ellos corrigen la compra, no el reporte.";

const DESCARTADO =
  "Este reporte fue descartado por la oficina, así que ya no se edita.";

function oNulo(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

function oEntero(v: number | null, campo: string, errores: string[]): number | null {
  if (v === null || v === undefined) return null;
  if (!Number.isInteger(v) || v < 0) {
    errores.push(`"${campo}" tiene que ser un número entero, o quedar en s/d.`);
    return null;
  }
  return v;
}

export async function corregirReporte(
  id: number,
  datos: CorreccionReporte
): Promise<ResultadoReporte> {
  let yo;
  try {
    yo = await exigir();
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  if (!Number.isInteger(id)) return { ok: false, errores: ["Reporte inválido."] };

  const reporte = await prisma.reporteCompra.findUnique({
    where: { id },
    select: {
      id: true,
      estado: true,
      creadoPorUsuarioId: true,
      adjuntos: { select: { id: true } },
    },
  });
  if (!reporte) return { ok: false, errores: ["Ese reporte no existe."] };

  // ┌────────────────────────────────────────────────────────────────────────┐
  // │ SOLO EL AUTOR CORRIGE SU REPORTE. NI SIQUIERA UN ADMINISTRATIVO.       │
  // │                                                                        │
  // │ Acá había un agujero: se usaba `puedeVer`, que le da acceso a un       │
  // │ administrativo — correcto para LEER, porque la oficina tiene que ver   │
  // │ el reporte en la bandeja, pero no para ESCRIBIR. Con esa comprobación, │
  // │ la oficina podía editar la evidencia por POST directo.                 │
  // │                                                                        │
  // │ El reporte es evidencia: guarda lo que el comprador escribió, no una   │
  // │ interpretación. Si la oficina pudiera corregirlo, la diferencia entre  │
  // │ lo que dice el remito y lo que vio el comprador —que es justo lo que   │
  // │ interesa conservar— se podría hacer desaparecer sin dejar rastro.      │
  // │                                                                        │
  // │ Lo único que la oficina le puede cambiar es el ESTADO, en              │
  // │ `acciones-bandeja.ts`, y eso queda registrado con quién y cuándo.      │
  // └────────────────────────────────────────────────────────────────────────┘
  //
  // El permiso, antes que el estado: a alguien que no puede ver el reporte no
  // se le cuenta en qué estado está.
  if (!puedeVer(yo, reporte)) {
    return { ok: false, errores: ["Ese reporte es de otra persona."] };
  }
  if (reporte.creadoPorUsuarioId !== yo.id) {
    return {
      ok: false,
      errores: [
        "Este reporte lo mandó otra cuenta y es evidencia: solo quien lo cargó " +
          "puede corregirlo, y solo mientras esté pendiente.",
      ],
    };
  }

  if (reporte.estado === "PROCESADO") return { ok: false, errores: [CONGELADO] };
  if (reporte.estado === "DESCARTADO") return { ok: false, errores: [DESCARTADO] };

  const errores: string[] = [];
  const fecha = oNulo(datos.fecha);
  if (fecha && Number.isNaN(Date.parse(fecha))) {
    errores.push(`La fecha "${fecha}" no es una fecha válida.`);
  }
  const cabezas = oEntero(datos.cabezasAproximadas, "cabezas aproximadas", errores);
  const camiones = oEntero(datos.cantidadCamiones, "cantidad de camiones", errores);

  // Los adjuntos que se dicen corregir tienen que ser de ESTE reporte. Sin esto,
  // un id ajeno en la lista editaría la nota de un remito de otra compra.
  const propios = new Set(reporte.adjuntos.map((a) => a.id));
  const remitos = (datos.remitos ?? []).filter((r) => propios.has(r.id));
  if ((datos.remitos ?? []).length !== remitos.length) {
    errores.push("Alguno de los remitos no pertenece a este reporte.");
  }

  if (errores.length) return { ok: false, errores };

  const texto = oNulo(datos.consignatarioTexto);
  let consignatarioId: number | null = null;
  if (texto) {
    // Igual que al recibir: se resuelve o se crea por el normalizado estricto.
    consignatarioId = (await crearEntidadConRol(texto, "CONSIGNATARIO")).id;
  }

  await prisma.$transaction([
    prisma.reporteCompra.update({
      where: { id },
      data: {
        fecha: fecha ? new Date(fecha) : null,
        consignatarioTexto: texto,
        consignatarioId,
        plazaTexto: oNulo(datos.plazaTexto),
        cabezasAproximadas: cabezas,
        cantidadCamiones: camiones,
        observaciones: oNulo(datos.observaciones),
      },
    }),
    ...remitos.map((r) =>
      prisma.adjunto.update({
        where: { id: r.id },
        data: { numero: oNulo(r.numero), nota: oNulo(r.nota) },
      })
    ),
  ]);

  refrescar(`/reportes/${id}`);
  refrescar("/reportes");
  return { ok: true };
}
