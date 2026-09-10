"use server";

import type { ModalidadComision, ModalidadPrecio } from "@/generated/prisma/enums";
import { exigir, SinPermiso } from "@/lib/auth";
import { resolverCategoria } from "@/lib/categorias";
import { prisma } from "@/lib/prisma";
import { refrescar } from "@/lib/refrescar";
import { kilosTotales } from "@/lib/totales";

/**
 * Tropas, cargas y renglones: lo que la oficina arma con los papeles delante.
 *
 * TODO ES DE ADMINISTRATIVO, comprobado adentro de cada acción. Un comercial
 * que haga el POST a mano rebota.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ACÁ NO HAY —NI PUEDE HABER— UNA ACCIÓN QUE EDITE EL REPORTE.             │
 * │                                                                          │
 * │ El reporte es evidencia: se mira al costado mientras se arma la compra y │
 * │ no se toca. No alcanza con no poner el botón; la acción no debe existir  │
 * │ del lado del servidor, porque una acción que existe se puede invocar por │
 * │ POST directo — en este proyecto ya se hizo exactamente eso.              │
 * │                                                                          │
 * │ Lo único que la oficina puede cambiarle a un reporte es su ESTADO, y eso │
 * │ vive en `acciones-bandeja.ts`, separado a propósito.                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

export type ResultadoCompra = { ok: true; id?: number } | { ok: false; errores: string[] };

function sinPermiso(e: unknown): ResultadoCompra | null {
  return e instanceof SinPermiso ? { ok: false, errores: [e.message] } : null;
}

async function exigirOficina() {
  return exigir("ADMINISTRATIVO");
}

/** «s/d» se guarda como NULL. Nunca cadena vacía, nunca 0. */
function oNulo(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

/**
 * Número o NULL. NO convierte lo que no entiende en 0.
 *
 * Y acepta el 0 como valor legítimo: hay renglones con comisión cero, y cero
 * es un valor — s/d es otra cosa. Confundirlos es el error fundacional.
 */
function oNumero(v: number | null | undefined, campo: string, errores: string[]): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || Number.isNaN(v) || v < 0) {
    errores.push(`"${campo}" tiene que ser un número, o quedar en s/d.`);
    return null;
  }
  return v;
}

// ------------------------------------------------------------------ tropas

export async function crearTropa(
  compraId: number,
  empresaCompradoraId: number,
  nroTropa: string | null,
  fecha: string | null
): Promise<ResultadoCompra> {
  try {
    await exigirOficina();
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  const errores: string[] = [];
  const compra = await prisma.compra.findUnique({
    where: { id: compraId },
    select: { id: true },
  });
  if (!compra) errores.push("Esa compra no existe.");

  const empresa = await prisma.entidad.findUnique({
    where: { id: empresaCompradoraId },
    select: { esPropio: true, nombre: true },
  });
  if (!empresa) errores.push("La empresa compradora elegida no existe.");
  else if (empresa.esPropio !== true) {
    errores.push(
      `"${empresa.nombre}" no es una empresa nuestra, así que no puede quedarse con las cabezas.`
    );
  }

  const nro = oNulo(nroTropa);
  const f = oNulo(fecha);
  if (f && Number.isNaN(Date.parse(f))) errores.push(`La fecha "${f}" no es válida.`);
  if (errores.length) return { ok: false, errores };

  try {
    const t = await prisma.tropa.create({
      data: {
        compraId,
        empresaCompradoraId,
        nroTropa: nro,
        fecha: f ? new Date(f) : null,
      },
      select: { id: true },
    });
    refrescar(`/compras/${compraId}`);
    return { ok: true, id: t.id };
  } catch {
    // `nroTropa` es unique en toda la base: el número de tropa lo asigna el
    // organismo, no nosotros, y repetido significa que alguien se equivocó de
    // compra o lo tipeó mal.
    return {
      ok: false,
      errores: [`El número de tropa "${nro}" ya está usado en otra compra.`],
    };
  }
}

export async function borrarTropa(id: number): Promise<ResultadoCompra> {
  try {
    await exigirOficina();
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  const tropa = await prisma.tropa.findUnique({
    where: { id },
    select: { compraId: true, _count: { select: { lotes: true, cargas: true } } },
  });
  if (!tropa) return { ok: false, errores: ["Esa tropa no existe."] };
  if (tropa._count.lotes || tropa._count.cargas) {
    return {
      ok: false,
      errores: [
        "Esa tropa tiene renglones o camiones colgando. Sacáselos primero: " +
          "borrarla en cascada se llevaría datos que nadie pidió borrar.",
      ],
    };
  }
  await prisma.tropa.delete({ where: { id } });
  refrescar(`/compras/${tropa.compraId}`);
  return { ok: true };
}

// ------------------------------------------------------------------ cargas

export type DatosCarga = {
  tropaId: number | null;
  dte: string | null;
  transportista: string | null;
  patente: string | null;
  fechaSalida: string | null;
  cabezas: number | null;
};

export async function crearCarga(
  compraId: number,
  datos: DatosCarga
): Promise<ResultadoCompra> {
  try {
    await exigirOficina();
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  const errores: string[] = [];
  const compra = await prisma.compra.findUnique({ where: { id: compraId }, select: { id: true } });
  if (!compra) errores.push("Esa compra no existe.");

  if (datos.tropaId !== null) {
    const t = await prisma.tropa.count({ where: { id: datos.tropaId, compraId } });
    if (!t) errores.push("Esa tropa no es de esta compra.");
  }
  const cabezas = oNumero(datos.cabezas, "cabezas del camión", errores);
  const fecha = oNulo(datos.fechaSalida);
  if (fecha && Number.isNaN(Date.parse(fecha))) errores.push(`La fecha "${fecha}" no es válida.`);
  if (errores.length) return { ok: false, errores };

  const c = await prisma.carga.create({
    data: {
      compraId,
      tropaId: datos.tropaId,
      dte: oNulo(datos.dte),
      transportista: oNulo(datos.transportista),
      patente: oNulo(datos.patente),
      fechaSalida: fecha ? new Date(fecha) : null,
      cabezas,
    },
    select: { id: true },
  });
  refrescar(`/compras/${compraId}`);
  return { ok: true, id: c.id };
}

export async function borrarCarga(id: number): Promise<ResultadoCompra> {
  try {
    await exigirOficina();
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }
  const carga = await prisma.carga.findUnique({ where: { id }, select: { compraId: true } });
  if (!carga) return { ok: false, errores: ["Ese camión no existe."] };
  await prisma.carga.delete({ where: { id } });
  refrescar(`/compras/${carga.compraId}`);
  return { ok: true };
}

// --------------------------------------------------------------- renglones

export type DatosLote = {
  /** Texto libre. Se resuelve contra el diccionario; si no matchea, se guarda igual. */
  categoriaTexto: string;
  cabezas: number | null;
  /** POR CABEZA. El total se calcula y se guarda; el hecho es el total. */
  kilosPorCabeza: number | null;
  precio: number | null;
  modalidadPrecio: ModalidadPrecio | null;
  comision: number | null;
  comisionModalidad: ModalidadComision | null;
  establecimientoId: number | null;
  tropaId: number | null;
};

/**
 * UN RENGLÓN NUEVO NACE EN «s/d». Nada se hereda en silencio: un valor
 * heredado es un dato que nadie escribió. Lo único obligatorio es el par
 * categoría + cabezas, que es lo que hace que un lote tenga razón de ser.
 */
export async function crearLote(
  compraId: number,
  datos: DatosLote
): Promise<ResultadoCompra> {
  try {
    await exigirOficina();
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  const compra = await prisma.compra.findUnique({ where: { id: compraId }, select: { id: true } });
  if (!compra) return { ok: false, errores: ["Esa compra no existe."] };

  const preparado = await prepararLote(compraId, datos);
  if ("errores" in preparado) return { ok: false, errores: preparado.errores };

  const l = await prisma.lote.create({
    data: { compraId, ...preparado.data },
    select: { id: true },
  });
  refrescar(`/compras/${compraId}`);
  return { ok: true, id: l.id };
}

export async function guardarLote(id: number, datos: DatosLote): Promise<ResultadoCompra> {
  try {
    await exigirOficina();
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  const lote = await prisma.lote.findUnique({ where: { id }, select: { compraId: true } });
  if (!lote) return { ok: false, errores: ["Ese renglón no existe."] };

  const preparado = await prepararLote(lote.compraId, datos);
  if ("errores" in preparado) return { ok: false, errores: preparado.errores };

  await prisma.lote.update({ where: { id }, data: preparado.data });
  refrescar(`/compras/${lote.compraId}`);
  return { ok: true, id };
}

export async function borrarLote(id: number): Promise<ResultadoCompra> {
  try {
    await exigirOficina();
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }
  const lote = await prisma.lote.findUnique({ where: { id }, select: { compraId: true } });
  if (!lote) return { ok: false, errores: ["Ese renglón no existe."] };
  await prisma.lote.delete({ where: { id } });
  refrescar(`/compras/${lote.compraId}`);
  return { ok: true };
}

type CamposLote = {
  categoriaSinonimoId: number;
  cabezas: number;
  kilosOrigen: number | null;
  precio: number | null;
  modalidadPrecio: ModalidadPrecio | null;
  comision: number | null;
  comisionModalidad: ModalidadComision | null;
  establecimientoId: number | null;
  tropaId: number | null;
};

async function prepararLote(
  compraId: number,
  datos: DatosLote
): Promise<{ data: CamposLote } | { errores: string[] }> {
  const errores: string[] = [];

  const texto = oNulo(datos.categoriaTexto);
  if (!texto) errores.push("Falta la categoría.");

  const cabezas = oNumero(datos.cabezas, "cabezas", errores);
  if (cabezas === null) errores.push("Faltan las cabezas: es lo único que un renglón no puede no tener.");
  else if (!Number.isInteger(cabezas) || cabezas <= 0) {
    errores.push("Las cabezas tienen que ser un entero mayor que cero.");
  }

  const porCabeza = oNumero(datos.kilosPorCabeza, "kilos por cabeza", errores);
  const precio = oNumero(datos.precio, "precio", errores);
  const comision = oNumero(datos.comision, "comisión", errores);

  if (datos.establecimientoId !== null) {
    const e = await prisma.establecimiento.count({ where: { id: datos.establecimientoId } });
    if (!e) errores.push("El establecimiento elegido no existe.");
  }
  if (datos.tropaId !== null) {
    const t = await prisma.tropa.count({ where: { id: datos.tropaId, compraId } });
    if (!t) errores.push("Esa tropa no es de esta compra.");
  }
  // El precio sin modalidad es un número que no significa nada, y la modalidad
  // sin precio tampoco. Van juntos o no van.
  if ((precio === null) !== (datos.modalidadPrecio === null)) {
    errores.push("El precio y su modalidad van juntos: uno sin el otro no dice nada.");
  }
  if ((comision === null) !== (datos.comisionModalidad === null)) {
    errores.push("La comisión y su modalidad van juntas.");
  }

  if (errores.length) return { errores };

  const categoria = await resolverCategoria(texto!);

  return {
    data: {
      categoriaSinonimoId: categoria.sinonimoId,
      cabezas: cabezas!,
      // El formulario pide POR CABEZA y acá se guarda el TOTAL, que es el
      // hecho. La multiplicación es exacta en centésimos: ver `kilosTotales`.
      kilosOrigen: porCabeza === null ? null : kilosTotales(porCabeza, cabezas!),
      precio,
      modalidadPrecio: datos.modalidadPrecio,
      comision,
      comisionModalidad: datos.comisionModalidad,
      establecimientoId: datos.establecimientoId,
      tropaId: datos.tropaId,
    },
  };
}

// ------------------------------------------------------- los dos gestos

/**
 * «La misma comisión para todos» y «todo al mismo establecimiento».
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ SON GESTOS DE CARGA, NO DATOS DE CABECERA.                              │
 * │                                                                          │
 * │ Escriben el valor EN CADA RENGLÓN y no guardan nada arriba. No existe    │
 * │ —ni debe existir— una columna de comisión ni de establecimiento en       │
 * │ `Compra`: sería el mismo total almacenado que le criticamos al esquema   │
 * │ viejo, y divergiría apenas alguien cambie una línea y no la cabecera.    │
 * │                                                                          │
 * │ Medido: el destino de cabecera está cargado en 0 de 1047 liquidaciones   │
 * │ del sistema viejo. El dato siempre vivió en el renglón.                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export async function aplicarComisionATodos(
  compraId: number,
  comision: number | null,
  modalidad: ModalidadComision | null
): Promise<ResultadoCompra> {
  try {
    await exigirOficina();
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  const errores: string[] = [];
  const valor = oNumero(comision, "comisión", errores);
  if ((valor === null) !== (modalidad === null)) {
    errores.push("La comisión y su modalidad van juntas.");
  }
  if (errores.length) return { ok: false, errores };

  const r = await prisma.lote.updateMany({
    where: { compraId },
    data: { comision: valor, comisionModalidad: modalidad },
  });
  refrescar(`/compras/${compraId}`);
  return { ok: true, id: r.count };
}

export async function aplicarEstablecimientoATodos(
  compraId: number,
  establecimientoId: number | null
): Promise<ResultadoCompra> {
  try {
    await exigirOficina();
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  if (establecimientoId !== null) {
    const e = await prisma.establecimiento.count({ where: { id: establecimientoId } });
    if (!e) return { ok: false, errores: ["El establecimiento elegido no existe."] };
  }

  const r = await prisma.lote.updateMany({
    where: { compraId },
    data: { establecimientoId },
  });
  refrescar(`/compras/${compraId}`);
  return { ok: true, id: r.count };
}
