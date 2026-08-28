"use server";

import { revalidatePath } from "next/cache";

import type { RolEntidad } from "@/generated/prisma/enums";
import { exigir, SinPermiso } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizarNombre } from "@/lib/normalizar";
import {
  asegurarRol,
  crearEntidadConRol,
  buscarParecidos,
  entidadesParaSelector,
  type OpcionEntidad,
} from "@/lib/entidades";

/**
 * Las server actions son alcanzables por POST directo, no solo desde la
 * pantalla. Toda validación vive acá y no en el formulario: lo del cliente es
 * comodidad, esto es la regla.
 *
 * LOS PERMISOS TAMBIÉN. Esconder un botón no es un permiso — en este proyecto
 * ya se invocó una acción por POST directo contra producción para probar las
 * validaciones del módulo 1. Cada acción que escribe empieza con `exigir(...)`.
 *
 * COMERCIAL crea y ve sus propios reportes; no crea, no edita ni borra compras,
 * entidades ni establecimientos. Todo lo de este archivo es, por ahora, de
 * ADMINISTRATIVO.
 */

/** Convierte un `SinPermiso` en un resultado, en vez de dejarlo explotar. */
function sinPermiso(e: unknown): { ok: false; errores: string[] } | null {
  return e instanceof SinPermiso ? { ok: false, errores: [e.message] } : null;
}

export type DatosCompra = {
  fecha: string;
  consignatarioId: number | null;
  empresaTitularId: number | null;
  vendedorId: number | null;
  hoteleroId: number | null;
  personaCompradoraId: number | null;
  plazaLugar: string | null;
  observaciones: string | null;
};

export type Resultado = { ok: true; id: number } | { ok: false; errores: string[] };

const SIN_DATO_OBLIGATORIO =
  "Este dato no puede quedar en s/d: sin el la compra no se reconoce en la lista.";

/** «s/d» se guarda como NULL. Nunca cadena vacia, nunca 0. */
function oNulo(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

/**
 * `revalidatePath` fuera del contexto de request de Next tira un invariant.
 * Pasa cuando estas acciones se llaman desde un script — que es como se prueba
 * que la validación vive en el servidor y no en el formulario. Ahí no hay caché
 * que invalidar, así que ese caso puntual se ignora; cualquier otro error se
 * vuelve a tirar.
 */
function refrescar(ruta: string): void {
  try {
    revalidatePath(ruta);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("static generation store missing")) throw e;
  }
}

async function existe(id: number | null): Promise<boolean> {
  if (id === null || !Number.isInteger(id)) return false;
  return (await prisma.entidad.count({ where: { id } })) > 0;
}

export async function crearCompra(datos: DatosCompra): Promise<Resultado> {
  let usuario;
  try {
    usuario = await exigir("ADMINISTRATIVO");
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  const errores: string[] = [];

  // --- los tres obligatorios ---
  const fecha = oNulo(datos.fecha);
  if (!fecha) {
    errores.push("Falta la fecha de la compra.");
  } else if (Number.isNaN(Date.parse(fecha))) {
    errores.push(`La fecha "${fecha}" no es una fecha valida.`);
  }

  if (!(await existe(datos.consignatarioId))) {
    errores.push("Falta el consignatario, o el elegido no existe.");
  }

  if (!(await existe(datos.empresaTitularId))) {
    errores.push("Falta la empresa titular, o la elegida no existe.");
  } else {
    const emp = await prisma.entidad.findUnique({
      where: { id: datos.empresaTitularId! },
      select: { esPropio: true, nombre: true },
    });
    // Solo las nuestras pueden ser titulares: ofrecer una de terceros invita a
    // un error que despues nadie detecta.
    if (emp?.esPropio !== true) {
      errores.push(
        `"${emp?.nombre ?? "la entidad elegida"}" no es una empresa nuestra, ` +
          "asi que no puede ser la empresa titular."
      );
    }
  }

  // --- los opcionales: si vienen, tienen que existir ---
  const opcionales = [
    ["vendedor", datos.vendedorId],
    ["hotelero", datos.hoteleroId],
    ["persona compradora", datos.personaCompradoraId],
  ] as const;
  for (const [campo, id] of opcionales) {
    if (id !== null && !(await existe(id))) {
      errores.push(`El ${campo} elegido no existe.`);
    }
  }

  if (errores.length) return { ok: false, errores };

  // Elegir una entidad en un selector le declara ese rol: es informacion
  // nueva, no un error.
  await asegurarRol(datos.consignatarioId!, "CONSIGNATARIO");
  await asegurarRol(datos.empresaTitularId!, "EMPRESA_COMPRADORA");
  if (datos.vendedorId) await asegurarRol(datos.vendedorId, "VENDEDOR");
  if (datos.hoteleroId) await asegurarRol(datos.hoteleroId, "HOTELERO");
  if (datos.personaCompradoraId) {
    await asegurarRol(datos.personaCompradoraId, "PERSONA_COMPRADORA");
  }

  const compra = await prisma.compra.create({
    data: {
      fecha: new Date(fecha!),
      consignatarioId: datos.consignatarioId!,
      empresaTitularId: datos.empresaTitularId!,
      vendedorId: datos.vendedorId,
      hoteleroId: datos.hoteleroId,
      personaCompradoraId: datos.personaCompradoraId,
      plazaLugar: oNulo(datos.plazaLugar),
      observaciones: oNulo(datos.observaciones),
      // Quién cargó esto. Es lo que destraba el «Cargada el … · <persona>» del
      // detalle, que hasta ahora no se mostraba porque no había dato.
      creadoPorUsuarioId: usuario.id,
    },
    select: { id: true },
  });

  refrescar("/compras");
  return { ok: true, id: compra.id };
}

const CAMPOS_ENTIDAD = {
  consignatario: { columna: "consignatarioId", rol: "CONSIGNATARIO", opcional: false },
  empresaTitular: { columna: "empresaTitularId", rol: "EMPRESA_COMPRADORA", opcional: false },
  vendedor: { columna: "vendedorId", rol: "VENDEDOR", opcional: true },
  hotelero: { columna: "hoteleroId", rol: "HOTELERO", opcional: true },
  personaCompradora: {
    columna: "personaCompradoraId",
    rol: "PERSONA_COMPRADORA",
    opcional: true,
  },
} as const satisfies Record<
  string,
  { columna: string; rol: RolEntidad; opcional: boolean }
>;

export type CampoEntidad = keyof typeof CAMPOS_ENTIDAD;

/** Cambia un rol de una compra ya guardada. `null` = ponerlo en s/d. */
export async function guardarRol(
  compraId: number,
  campo: CampoEntidad,
  entidadId: number | null
): Promise<Resultado> {
  try {
    await exigir("ADMINISTRATIVO");
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  const def = CAMPOS_ENTIDAD[campo];
  if (!def) return { ok: false, errores: ["Campo desconocido."] };

  if (entidadId === null) {
    if (!def.opcional) return { ok: false, errores: [SIN_DATO_OBLIGATORIO] };
  } else {
    if (!(await existe(entidadId))) {
      return { ok: false, errores: ["La entidad elegida no existe."] };
    }
    if (def.rol === "EMPRESA_COMPRADORA") {
      const emp = await prisma.entidad.findUnique({
        where: { id: entidadId },
        select: { esPropio: true },
      });
      if (emp?.esPropio !== true) {
        return {
          ok: false,
          errores: ["Solo una empresa nuestra puede ser la empresa titular."],
        };
      }
    }
    await asegurarRol(entidadId, def.rol);
  }

  await prisma.compra.update({
    where: { id: compraId },
    data: { [def.columna]: entidadId },
  });
  refrescar(`/compras/${compraId}`);
  refrescar("/compras");
  return { ok: true, id: compraId };
}

/** Cambia un campo de texto o la fecha. `null` = s/d, y solo para opcionales. */
export async function guardarDato(
  compraId: number,
  campo: "fecha" | "plazaLugar" | "observaciones",
  valor: string | null
): Promise<Resultado> {
  try {
    await exigir("ADMINISTRATIVO");
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  const limpio = oNulo(valor);

  if (campo === "fecha") {
    if (!limpio) return { ok: false, errores: [SIN_DATO_OBLIGATORIO] };
    if (Number.isNaN(Date.parse(limpio))) {
      return { ok: false, errores: [`"${limpio}" no es una fecha valida.`] };
    }
    await prisma.compra.update({
      where: { id: compraId },
      data: { fecha: new Date(limpio) },
    });
  } else {
    await prisma.compra.update({ where: { id: compraId }, data: { [campo]: limpio } });
  }

  refrescar(`/compras/${compraId}`);
  refrescar("/compras");
  return { ok: true, id: compraId };
}

// ---------- lo que consume el combo ----------

export type EstadoCombo = {
  /** Entidades que ya juegan el rol pedido. */
  opciones: OpcionEntidad[];
  /** El resto del padron, separado a proposito. */
  otras: OpcionEntidad[];
  /** Casi-identicos por normalizacion LAXA. Solo para avisar. */
  parecidos: OpcionEntidad[];
  /** El texto tipeado ya existe tal cual (normalizacion estricta). */
  hayExacto: boolean;
  /** Este catalogo no admite crear al vuelo. */
  sePuedeCrear: boolean;
};

export async function buscarEntidades(
  rol: RolEntidad,
  busqueda: string
): Promise<EstadoCombo> {
  // Leer el padrón también exige sesión: es información del negocio.
  await exigir();

  const { delRol, otras } = await entidadesParaSelector(rol, busqueda);
  const q = busqueda.trim();
  const todas = [...delRol, ...otras];
  // Los parecidos NO salen de `todas`: esa lista ya pasó por el filtro
  // estricto, que es justo el que no encuentra al duplicado por puntuación.
  const parecidos = q.length > 1 ? await buscarParecidos(q) : [];
  const hayExacto =
    q.length > 0 && todas.some((o) => normalizarNombre(o.nombre) === normalizarNombre(q));

  return {
    opciones: delRol,
    otras,
    parecidos,
    hayExacto,
    sePuedeCrear: rol !== "EMPRESA_COMPRADORA",
  };
}

export type ResultadoCrear =
  | { ok: true; id: number; nombre: string; yaExistia: boolean }
  | { ok: false; errores: string[] };

export async function crearEntidad(
  nombre: string,
  rol: RolEntidad
): Promise<ResultadoCrear> {
  try {
    await exigir("ADMINISTRATIVO");
    const r = await crearEntidadConRol(nombre, rol);
    refrescar("/compras");
    return { ok: true, ...r };
  } catch (e) {
    return {
      ok: false,
      errores: [e instanceof Error ? e.message : "No se pudo crear."],
    };
  }
}
