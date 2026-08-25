/**
 * Seed de categorías y sinónimos.
 *
 * Alcance: SOLO `Categoria` y `CategoriaSinonimo`. Las empresas quedan afuera
 * porque necesitan un dato que no está en la base histórica.
 *
 * Fuente: la base de WinCompras (`backend/db.sqlite3`), tabla
 * `catalogos_categoria` — 258 filas con `codigo`, `descripcion` y `canonico`.
 * Se abre en modo solo lectura: este script nunca escribe en la histórica.
 *
 * Correrlo:  npx prisma db seed        (o: npx tsx prisma/seed.ts)
 * La ruta de la base se puede pisar con la variable WINCOMPRAS_DB.
 */
import { DatabaseSync } from "node:sqlite";

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const DB_HISTORICA =
  process.env.WINCOMPRAS_DB ??
  "c:/Users/zemma/Claude/Projects/WinCompras/backend/db.sqlite3";

/**
 * Normalización canónica del texto de un sinónimo: trim + minúsculas.
 *
 * `toLowerCase()` de JS pliega Unicode, a diferencia de `lower()` de SQLite que
 * solo pliega ASCII. No es un detalle: en los datos, «vaca preñada» y
 * «VACA PREÑADA» colapsan en una sola fila acá y NO colapsarían con la
 * semántica de SQLite. Si algún día se compara contra un conteo sacado con SQL,
 * la diferencia es esa.
 *
 * Cualquier lugar que busque un sinónimo tiene que normalizar con esta misma
 * función antes de consultar, o no va a encontrar la fila.
 */
export function normalizar(texto: string): string {
  return texto.trim().toLowerCase();
}

/** Las 8 canónicas. MEJ no está: no es canónica, los datos ya la mapean a TO. */
const CANONICAS: ReadonlyArray<{ codigo: string; descripcion: string }> = [
  { codigo: "NV", descripcion: "novillo" },
  { codigo: "NT", descripcion: "novillito" },
  { codigo: "VQ", descripcion: "vaquillona" },
  { codigo: "VA", descripcion: "vaca" },
  { codigo: "TO", descripcion: "toro" },
  { codigo: "TM", descripcion: "ternero" },
  { codigo: "TH", descripcion: "ternera" },
  { codigo: "T", descripcion: "ternero/a mixto" },
];

type FilaHistorica = {
  id: number;
  codigo: string;
  canonico: string;
};

function leerHistoricas(): FilaHistorica[] {
  const db = new DatabaseSync(DB_HISTORICA, { readOnly: true });
  try {
    return db
      .prepare("SELECT id, codigo, canonico FROM catalogos_categoria ORDER BY id")
      .all() as FilaHistorica[];
  } finally {
    db.close();
  }
}

async function main() {
  // Import dinámico a propósito, y no estático arriba: `src/lib/prisma.ts`
  // valida POSTGRES_PRISMA_URL al evaluarse, y los imports estáticos corren
  // ANTES del cuerpo del módulo — o sea, antes de que loadEnv() cargue nada.
  const { prisma } = await import("@/lib/prisma");

  try {
    await sembrar(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

type Cliente = Awaited<typeof import("@/lib/prisma")>["prisma"];

async function sembrar(prisma: Cliente) {
  // ---------- 1. Las 8 canónicas ----------
  for (const c of CANONICAS) {
    await prisma.categoria.upsert({
      where: { codigo: c.codigo },
      create: c,
      update: { descripcion: c.descripcion },
    });
  }

  const canonicas = await prisma.categoria.findMany();
  const idPorCodigo = new Map(canonicas.map((c) => [c.codigo, c.id]));

  // ---------- 2. Los sinónimos ----------
  const crudas = leerHistoricas();

  // Dedup por textoNormalizado. Se conserva la variante cruda de menor id (la
  // primera cargada) como `texto`; el resto se descarta pero se cuenta.
  const grupos = new Map<
    string,
    { texto: string; canonico: string; variantes: string[] }
  >();

  for (const fila of crudas) {
    const norm = normalizar(fila.codigo);
    const canonico = fila.canonico.trim();
    const grupo = grupos.get(norm);

    if (!grupo) {
      grupos.set(norm, {
        texto: fila.codigo,
        canonico,
        variantes: [fila.codigo],
      });
      continue;
    }

    grupo.variantes.push(fila.codigo);
    // Si el grupo todavía no tenía canónica y esta fila sí, se adopta. No hay
    // conflictos en los datos (verificado: ningún texto normalizado apunta a
    // dos canónicas distintas), pero si algún día aparece uno, gana la primera
    // y queda registrado abajo.
    if (!grupo.canonico && canonico) grupo.canonico = canonico;
    else if (grupo.canonico && canonico && grupo.canonico !== canonico) {
      throw new Error(
        `Conflicto de mapeo en "${norm}": ${grupo.canonico} vs ${canonico}. ` +
          `Resolvelo a mano en la fuente antes de seguir — no se adivina.`
      );
    }
  }

  // Estado actual en la base, en UNA consulta en vez de 217. Hace falta para
  // decidir si el seed puede escribir la canónica de cada fila (ver abajo).
  const yaEnBase = new Map(
    (
      await prisma.categoriaSinonimo.findMany({
        select: { textoNormalizado: true, categoriaCanonicaId: true },
      })
    ).map((s) => [s.textoNormalizado, s.categoriaCanonicaId])
  );

  const idACodigo = new Map(canonicas.map((c) => [c.id, c.codigo]));

  const pendientes: string[] = [];
  const divergencias: string[] = [];
  let mapeados = 0;
  let rellenadas = 0;
  let preservadas = 0;

  for (const [norm, grupo] of grupos) {
    const categoriaCanonicaId = grupo.canonico
      ? (idPorCodigo.get(grupo.canonico) ?? null)
      : null;

    if (grupo.canonico && categoriaCanonicaId === null) {
      throw new Error(
        `"${norm}" apunta a la canónica "${grupo.canonico}", que no existe. ` +
          `¿Falta agregarla a CANONICAS?`
      );
    }

    if (categoriaCanonicaId === null) pendientes.push(norm);
    else mapeados++;

    // REGLA DE ESCRITURA: el seed rellena una canónica vacía, pero NUNCA
    // cambia una que ya tiene valor.
    //
    // El sistema nuevo es la fuente de verdad de acá en adelante, no
    // WinCompras. Si una persona corrigió a mano el mapeo de un sinónimo — sea
    // uno de los 18 pendientes o uno de los 199 que vinieron mapeados — volver
    // a correr el seed no se lo puede revertir con el dato viejo.
    const existe = yaEnBase.has(norm);
    const canonicaActual = yaEnBase.get(norm) ?? null;
    const puedeEscribir = canonicaActual === null && categoriaCanonicaId !== null;

    if (existe && canonicaActual !== null) {
      preservadas++;
      if (categoriaCanonicaId !== null && categoriaCanonicaId !== canonicaActual) {
        divergencias.push(
          `${norm}: la base dice ${idACodigo.get(canonicaActual)}, ` +
            `WinCompras dice ${grupo.canonico} — gana la base`
        );
      }
    } else if (puedeEscribir) {
      rellenadas++;
    }

    await prisma.categoriaSinonimo.upsert({
      where: { textoNormalizado: norm },
      create: { texto: grupo.texto, textoNormalizado: norm, categoriaCanonicaId },
      update: puedeEscribir
        ? { texto: grupo.texto, categoriaCanonicaId }
        : { texto: grupo.texto },
    });
  }

  // ---------- 3. Reporte ----------
  console.log("=== canónicas ===");
  console.log(`  en la base        : ${canonicas.length}`);

  console.log("\n=== sinónimos ===");
  console.log(`  filas leídas      : ${crudas.length}`);
  console.log(`  únicos (entraron) : ${grupos.size}`);
  console.log(`  colapsados        : ${crudas.length - grupos.size}`);
  console.log(`  mapeados          : ${mapeados}`);
  console.log(`  pendientes de mapeo: ${pendientes.length}`);

  console.log("\n=== escrituras de canónica ===");
  console.log(`  rellenadas (estaban vacías): ${rellenadas}`);
  console.log(`  preservadas (ya tenían valor, no se tocaron): ${preservadas}`);
  if (divergencias.length) {
    console.log(
      `\n  OJO: ${divergencias.length} donde la base y WinCompras no coinciden.`
    );
    console.log("  Gana la base: el sistema nuevo es la fuente de verdad.");
    for (const d of divergencias) console.log(`    ${d}`);
  }

  console.log("\n=== pendientes de mapeo (categoriaCanonicaId NULL) ===");
  console.log("  No se adivinan: son ambigüedades reales, las resuelve una persona.");
  for (const p of pendientes.sort()) console.log(`    ${p}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
