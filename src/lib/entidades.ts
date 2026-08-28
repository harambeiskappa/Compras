/*
 * Módulo de servidor. NO lleva `import "server-only"` a propósito: ese paquete
 * revienta al importarse desde cualquier runtime que no sea el de React Server
 * Components, y eso deja afuera a scripts/verificar-modulo-1.ts, que existe
 * justamente para probar esta lógica sin pasar por el navegador.
 *
 * Lo que igual impide que esto termine en el bundle del cliente:
 *   - todo lo que lo consume es `acciones.ts`, que lleva "use server", o una
 *     página de servidor;
 *   - `@/lib/prisma` arrastra `@prisma/adapter-pg`, que es de Node y no compila
 *     para el browser.
 * Si algún día un componente con "use client" importa esto, el build falla.
 */
import type { RolEntidad } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { normalizarLaxo, normalizarNombre } from "@/lib/normalizar";

export type OpcionEntidad = {
  id: number;
  nombre: string;
  /** Texto chico a la derecha: cuántas compras, o «de terceros». */
  meta: string;
  /** true si la entidad todavía no tiene el rol que pide el selector. */
  rolNuevo: boolean;
};

export type ResultadoSelector = {
  /** Entidades que ya juegan este rol. Van primero. */
  delRol: OpcionEntidad[];
  /**
   * El resto del padrón que coincide con la búsqueda. Van DESPUÉS y separadas:
   * con 191 entidades en una sola tabla, mezclarlas haría que el selector de
   * hotelero liste los 173 vendedores y quede inservible.
   */
  otras: OpcionEntidad[];
};

/** Qué relación de `Compra` cuenta los usos de cada rol. */
const RELACION_DE_ROL = {
  CONSIGNATARIO: "comprasComoConsignatario",
  EMPRESA_COMPRADORA: "comprasComoTitular",
  VENDEDOR: "comprasComoVendedor",
  HOTELERO: "comprasComoHotelero",
  PERSONA_COMPRADORA: "comprasComoPersona",
} as const satisfies Record<RolEntidad, string>;

/**
 * Entidades para un selector.
 *
 * `EMPRESA_COMPRADORA` es el caso especial: muestra SOLO las de `esPropio =
 * true` y nunca «otras». Ofrecer una empresa de terceros como titular invita a
 * un error que después nadie detecta (§1.6), y por eso tampoco se puede crear
 * al vuelo: dar de alta una empresa nuestra es una decisión, no un descuido.
 */
export async function entidadesParaSelector(
  rol: RolEntidad,
  busqueda: string
): Promise<ResultadoSelector> {
  const q = busqueda.trim();
  const filtroTexto = q
    ? { nombreNormalizado: { contains: normalizarNombre(q) } }
    : {};

  const relacion = RELACION_DE_ROL[rol];

  const conRol = await prisma.entidad.findMany({
    where: {
      activo: true,
      roles: { some: { rol } },
      ...(rol === "EMPRESA_COMPRADORA" ? { esPropio: true } : {}),
      ...filtroTexto,
    },
    select: {
      id: true,
      nombre: true,
      esPropio: true,
      _count: { select: { [relacion]: true } } as never,
    },
    take: 60,
  });

  const aOpcion = (
    e: { id: number; nombre: string; esPropio: boolean | null; _count?: Record<string, number> },
    rolNuevo: boolean
  ): OpcionEntidad => {
    const usos = e._count ? Object.values(e._count)[0] : 0;
    // El hotelero es el único selector donde importa de quién es la entidad:
    // Tercio Bravo es hotelero y no es nuestro.
    const meta =
      rol === "HOTELERO" && e.esPropio === false
        ? "de terceros"
        : usos > 0
          ? `${usos} ${usos === 1 ? "compra" : "compras"}`
          : rolNuevo
            ? "otro rol"
            : "sin usar";
    return { id: e.id, nombre: e.nombre, meta, rolNuevo };
  };

  const delRol = conRol
    .map((e) => aOpcion(e, false))
    .sort((a, b) => {
      // Por frecuencia, no alfabético: alfabético entierra a Darwash, que
      // concentra la mitad de las compras.
      const na = Number(a.meta.split(" ")[0]) || 0;
      const nb = Number(b.meta.split(" ")[0]) || 0;
      return nb - na || a.nombre.localeCompare(b.nombre, "es");
    });

  if (rol === "EMPRESA_COMPRADORA") return { delRol, otras: [] };

  const yaListadas = new Set(delRol.map((e) => e.id));
  const resto = await prisma.entidad.findMany({
    where: {
      activo: true,
      id: { notIn: [...yaListadas] },
      roles: { none: { rol } },
      ...filtroTexto,
    },
    select: { id: true, nombre: true, esPropio: true },
    orderBy: { nombre: "asc" },
    take: q ? 40 : 0,
  });

  return { delRol, otras: resto.map((e) => aOpcion(e, true)) };
}

/**
 * Trae candidatos para la comparación LAXA.
 *
 * Hace falta una consulta aparte porque el filtro del selector busca por
 * `nombreNormalizado`, que es la forma ESTRICTA y conserva la puntuación: al
 * tipear «FERIA RODEO HUINCA S.R.L.» con punto final, un `contains` estricto
 * NO encuentra «FERIA RODEO HUINCA S.R.L» sin punto — justo el duplicado que
 * hay que avisar. El aviso no puede detectar lo que la consulta ya descartó.
 *
 * Se busca por la primera palabra de la forma laxa, que sobrevive a la
 * puntuación y a los sufijos societarios, y el filtrado fino se hace en memoria.
 * Barre todo el padrón a propósito: si alguien tipea en vendedor un nombre que
 * ya existe como hotelero, eso también hay que decirlo.
 */
async function candidatosParecidos(texto: string): Promise<OpcionEntidad[]> {
  const primeraPalabra = normalizarLaxo(texto).split(" ")[0];
  if (!primeraPalabra || primeraPalabra.length < 3) return [];
  const filas = await prisma.entidad.findMany({
    where: { activo: true, nombreNormalizado: { contains: primeraPalabra } },
    select: { id: true, nombre: true },
    take: 40,
  });
  return filas.map((f) => ({ id: f.id, nombre: f.nombre, meta: "", rolNuevo: false }));
}

/**
 * Parecidos a `texto`, buscando en todo el padrón con la normalización LAXA.
 *
 * Solo para avisar. Que dos textos sean la misma entidad lo decide una persona
 * — ver el comentario de `normalizarLaxo`.
 */
export async function buscarParecidos(texto: string): Promise<OpcionEntidad[]> {
  return detectarParecidos(texto, await candidatosParecidos(texto));
}

/**
 * Parecidos a `texto` dentro de un conjunto, con la normalización LAXA.
 *
 * Solo para avisar. Que dos textos sean la misma entidad lo decide una persona
 * — ver el comentario de `normalizarLaxo`.
 */
export function detectarParecidos(
  texto: string,
  candidatos: OpcionEntidad[]
): OpcionEntidad[] {
  const laxo = normalizarLaxo(texto);
  if (laxo.length < 2) return [];
  const estricto = normalizarNombre(texto);
  return candidatos.filter(
    (c) => normalizarNombre(c.nombre) !== estricto && normalizarLaxo(c.nombre) === laxo
  );
}

/**
 * Crea la entidad si no existe, y le declara el rol.
 *
 * Busca PRIMERO por nombre normalizado estricto: si ya existe, devuelve la
 * existente en vez de reventar contra el unique. Quien está cargando una compra
 * no tiene por qué ver un error de base porque tipeó «darwash» en minúscula.
 */
export async function crearEntidadConRol(
  nombreCrudo: string,
  rol: RolEntidad
): Promise<{ id: number; nombre: string; yaExistia: boolean }> {
  const nombre = nombreCrudo.trim();
  if (!nombre) throw new Error("El nombre no puede estar vacío.");
  if (rol === "EMPRESA_COMPRADORA") {
    // §1.8: las empresas no se crean al vuelo.
    throw new Error("Las empresas nuestras no se crean desde el formulario.");
  }

  const nombreNormalizado = normalizarNombre(nombre);
  const existente = await prisma.entidad.findUnique({
    where: { nombreNormalizado },
    select: { id: true, nombre: true },
  });

  if (existente) {
    await asegurarRol(existente.id, rol);
    return { ...existente, yaExistia: true };
  }

  const creada = await prisma.entidad.create({
    data: { nombre, nombreNormalizado, roles: { create: { rol } } },
    select: { id: true, nombre: true },
  });
  return { ...creada, yaExistia: false };
}

/**
 * Declara un rol para una entidad que ya existe.
 *
 * Elegir en el selector de hotelero una entidad que hasta ahora solo era
 * vendedor NO es un error: es información nueva. Se agrega el rol y listo.
 */
export async function asegurarRol(entidadId: number, rol: RolEntidad): Promise<void> {
  await prisma.entidadRol.upsert({
    where: { entidadId_rol: { entidadId, rol } },
    create: { entidadId, rol },
    update: {},
  });
}
