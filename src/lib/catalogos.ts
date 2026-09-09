import "server-only";

import { normalizarNombre } from "@/lib/normalizar";
import { PLAZAS_SUGERIDAS } from "@/lib/plazas";
import { prisma } from "@/lib/prisma";

/**
 * Lo único que el comprador necesita elegir, y NADA MÁS.
 *
 * Van los 18 consignatarios y las plazas. NO van los 192 vendedores ni los
 * hoteleros: el comprador no los toca y son el grueso del padrón. Esto se
 * guarda en el teléfono para que la pantalla funcione sin señal, así que cada
 * fila de más es peso que alguien carga en el campo sin usarla nunca.
 */
export type CatalogoComprador = {
  /** Cuándo se generó, para saber si lo cacheado está viejo. */
  generadoEn: string;
  consignatarios: OpcionConsignatario[];
  plazas: string[];
};

export type OpcionConsignatario = {
  id: number;
  nombre: string;
  /** En cuántas compras aparece. Es lo que ordena la lista. */
  usos: number;
};

/**
 * Las plazas que se ofrecen como sugerencia: las 12 del histórico unidas a las
 * ya tipeadas en compras reales.
 *
 * Vive acá y no repetido en cada pantalla — lo usan el alta del módulo 1 y el
 * catálogo del comprador, y dos copias de esta deduplicación divergen.
 *
 * Dedup sin distinguir mayúsculas ni acentos, para no ofrecer WASHINGTON y
 * Washington como dos cosas. GANA LA FORMA YA USADA EN UNA COMPRA: es la que
 * alguien escribió de verdad, así que la lista se corrige sola con el uso en
 * vez de quedar clavada al código.
 */
export async function plazasParaSugerir(): Promise<string[]> {
  const usadas = await prisma.compra.findMany({
    where: { plazaLugar: { not: null } },
    select: { plazaLugar: true },
    distinct: ["plazaLugar"],
    orderBy: { plazaLugar: "asc" },
    take: 60,
  });

  const porClave = new Map<string, string>();
  for (const u of usadas) {
    if (u.plazaLugar) porClave.set(normalizarNombre(u.plazaLugar), u.plazaLugar);
  }
  for (const p of PLAZAS_SUGERIDAS) {
    const clave = normalizarNombre(p);
    if (!porClave.has(clave)) porClave.set(clave, p);
  }
  return [...porClave.values()].sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Los consignatarios, ORDENADOS POR USO Y NO ALFABÉTICAMENTE.
 *
 * Darwash es la mitad de las compras del último año y un orden alfabético lo
 * entierra entre nombres que aparecen una vez. Es la segunda vez que aparece
 * esta misma regla en el proyecto —la primera fue con los establecimientos, que
 * El Haras concentra— y no va a ser la última.
 *
 * Empate por uso, desempate por nombre, para que el orden sea estable entre dos
 * llamadas: una lista que se reordena sola entre refrescos es una lista donde
 * nadie encuentra nada dos veces seguidas.
 */
export async function consignatariosParaComprador(): Promise<OpcionConsignatario[]> {
  const entidades = await prisma.entidad.findMany({
    where: { roles: { some: { rol: "CONSIGNATARIO" } } },
    select: { id: true, nombre: true },
  });

  const usos = await prisma.compra.groupBy({
    by: ["consignatarioId"],
    _count: { _all: true },
  });
  const porId = new Map(usos.map((u) => [u.consignatarioId, u._count._all]));

  return entidades
    .map((e) => ({ id: e.id, nombre: e.nombre, usos: porId.get(e.id) ?? 0 }))
    .sort((a, b) => b.usos - a.usos || a.nombre.localeCompare(b.nombre, "es"));
}

export async function catalogoComprador(): Promise<CatalogoComprador> {
  const [consignatarios, plazas] = await Promise.all([
    consignatariosParaComprador(),
    plazasParaSugerir(),
  ]);
  return { generadoEn: new Date().toISOString(), consignatarios, plazas };
}
