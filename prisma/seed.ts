/**
 * Seed de catálogos: categorías, sinónimos, empresas y consignatarios.
 *
 * Fuentes:
 *   - categorías y sinónimos -> `catalogos_categoria` de WinCompras (258 filas)
 *   - empresas               -> escritas acá, ver EMPRESAS
 *   - consignatarios         -> `liquidaciones_liquidacion.consignatario`
 * La base histórica se abre en modo solo lectura: este script nunca le escribe.
 *
 * Disciplina común a todo el archivo: **rellena lo vacío, nunca pisa lo que ya
 * tiene valor.** El sistema nuevo es la fuente de verdad de acá en adelante, no
 * WinCompras, así que una corrección hecha a mano sobrevive a correr el seed de
 * nuevo. Todo es idempotente.
 *
 * Correrlo:  npx prisma db seed        (o: npx tsx prisma/seed.ts)
 * La ruta de la base se puede pisar con la variable WINCOMPRAS_DB.
 */
import { DatabaseSync } from "node:sqlite";

import { config as loadEnv } from "dotenv";

import { normalizarNombre, normalizarTexto } from "@/lib/normalizar";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const DB_HISTORICA =
  process.env.WINCOMPRAS_DB ??
  "c:/Users/zemma/Claude/Projects/WinCompras/backend/db.sqlite3";


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

/**
 * Las 8 empresas y sus 11 prefijos de tropa. Dos empresas tienen más de uno,
 * que es exactamente por lo que `PrefijoTropa` es una tabla aparte y no una
 * columna de `Empresa`.
 *
 * La identidad de una empresa acá es el **código de prefijo**, no el nombre:
 * `PrefijoTropa.codigo` es la única columna con unique, y el nombre puede
 * editarse a mano sin que el seed lo pise.
 *
 * TRB cierra la decisión #10: es de terceros (`esPropio = false`). No se
 * analizan sus compras, pero su hacienda puede entrar al feedlot o a campos
 * adyacentes y hay que contabilizar su stock. Su rol real es hotelero, no
 * empresa compradora — que es un rol distinto, no un matiz del mismo.
 */
const EMPRESAS: ReadonlyArray<{
  nombre: string;
  esPropio: boolean;
  prefijos: string[];
}> = [
  { nombre: "Pecuaria El Garabí", esPropio: true, prefijos: ["PEG", "PEC"] },
  { nombre: "Las Taperas del Oeste", esPropio: true, prefijos: ["TAP", "LTA", "LTP"] },
  { nombre: "Bulltrade", esPropio: true, prefijos: ["BUL"] },
  { nombre: "Darwash", esPropio: true, prefijos: ["DAR"] },
  { nombre: "Martín y Alonso", esPropio: true, prefijos: ["ALO"] },
  { nombre: "Unión Ganadera", esPropio: true, prefijos: ["UGM"] },
  { nombre: "El Saguaipe", esPropio: true, prefijos: ["SAG"] },
  { nombre: "Tercio Bravo", esPropio: false, prefijos: ["TRB"] },
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

/**
 * Consignatarios del histórico.
 *
 * Sale SOLO de `liquidaciones_liquidacion.consignatario`, que es el campo que
 * corresponde a `Compra.consignatarioId`. `ingresos_tropa.consignatario`
 * queda deliberadamente afuera: guarda las mismas entidades escritas distinto
 * («Darwash» vs «DARWASH SA», «Talano Hnos» vs «TALANO HERMANOS SRL»), más
 * valores que no son consignatarios en absoluto («TRASLADO», «DESTETE») y
 * empresas nuestras. Unificar las dos listas exige decidir qué texto
 * representa a qué entidad real, y eso no se adivina.
 */
function leerConsignatarios(): string[] {
  const db = new DatabaseSync(DB_HISTORICA, { readOnly: true });
  try {
    const filas = db
      .prepare(
        `SELECT DISTINCT trim(consignatario) AS nombre
         FROM liquidaciones_liquidacion
         WHERE trim(coalesce(consignatario,'')) <> ''
         ORDER BY nombre`
      )
      .all() as unknown as { nombre: string }[];
    return filas.map((f) => f.nombre);
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
  // ---------- 1. Las 8 empresas y sus 11 prefijos ----------
  const prefijosEnBase = await prisma.prefijoTropa.findMany({
    select: { codigo: true, empresaId: true },
  });
  const empresaPorPrefijo = new Map(
    prefijosEnBase.map((p) => [p.codigo, p.empresaId])
  );

  let empresasCreadas = 0;
  let empresasYaEstaban = 0;
  let prefijosCreados = 0;
  let esPropioRellenado = 0;
  let esPropioPreservado = 0;
  const conflictos: string[] = [];

  for (const def of EMPRESAS) {
    const ids = new Set(
      def.prefijos
        .map((p) => empresaPorPrefijo.get(p))
        .filter((x): x is number => x !== undefined)
    );

    if (ids.size > 1) {
      // Alguien separó los prefijos de una misma empresa. Podría ser
      // deliberado; unificarlos sería pisar esa decisión. Se reporta y se salta.
      conflictos.push(
        `${def.nombre}: sus prefijos (${def.prefijos.join(", ")}) apuntan a ` +
          `${ids.size} empresas distintas (ids ${[...ids].join(", ")}) — ` +
          `no se toca, resolvelo a mano`
      );
      continue;
    }

    let empresaId: number;

    if (ids.size === 1) {
      empresaId = [...ids][0];
      empresasYaEstaban++;
      // El nombre NO se toca nunca: puede haberse editado a mano.
      const actual = await prisma.empresa.findUniqueOrThrow({
        where: { id: empresaId },
        select: { esPropio: true },
      });
      if (actual.esPropio === null) {
        await prisma.empresa.update({
          where: { id: empresaId },
          data: { esPropio: def.esPropio },
        });
        esPropioRellenado++;
      } else {
        esPropioPreservado++;
      }
    } else {
      const nueva = await prisma.empresa.create({
        data: { nombre: def.nombre, esPropio: def.esPropio },
      });
      empresaId = nueva.id;
      empresasCreadas++;
    }

    for (const codigo of def.prefijos) {
      if (empresaPorPrefijo.has(codigo)) continue;
      await prisma.prefijoTropa.create({ data: { codigo, empresaId } });
      empresaPorPrefijo.set(codigo, empresaId);
      prefijosCreados++;
    }
  }

  // ---------- 2. Consignatarios del histórico ----------
  // La identidad es `nombreNormalizado`, que lleva el unique: el upsert es
  // idempotente por sí solo y dos textos que difieren solo en mayúsculas o
  // acentos entran como UNA fila. `nombre` guarda el texto tal como vino y no
  // se pisa en el update: puede haberse corregido a mano.
  const delHistorico = leerConsignatarios();
  const yaEstaban = new Set(
    (
      await prisma.consignatario.findMany({ select: { nombreNormalizado: true } })
    ).map((c) => c.nombreNormalizado)
  );
  let consignatariosCreados = 0;
  let consignatariosColapsados = 0;
  const vistos = new Set<string>();
  for (const nombre of delHistorico) {
    const norm = normalizarNombre(nombre);
    if (vistos.has(norm)) {
      consignatariosColapsados++;
      continue;
    }
    vistos.add(norm);
    if (yaEstaban.has(norm)) continue;
    await prisma.consignatario.upsert({
      where: { nombreNormalizado: norm },
      create: { nombre, nombreNormalizado: norm },
      update: {},
    });
    consignatariosCreados++;
  }

  // ---------- 3. Las 8 canónicas ----------
  for (const c of CANONICAS) {
    await prisma.categoria.upsert({
      where: { codigo: c.codigo },
      create: c,
      update: { descripcion: c.descripcion },
    });
  }

  const canonicas = await prisma.categoria.findMany();
  const idPorCodigo = new Map(canonicas.map((c) => [c.codigo, c.id]));

  // ---------- 4. Los sinónimos ----------
  const crudas = leerHistoricas();

  // Dedup por textoNormalizado. Se conserva la variante cruda de menor id (la
  // primera cargada) como `texto`; el resto se descarta pero se cuenta.
  const grupos = new Map<
    string,
    { texto: string; canonico: string; variantes: string[] }
  >();

  for (const fila of crudas) {
    const norm = normalizarTexto(fila.codigo);
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

  // ---------- 5. Reporte ----------
  const empresasFinal = await prisma.empresa.count();
  const prefijosFinal = await prisma.prefijoTropa.count();
  const consignatariosFinal = await prisma.consignatario.count();

  console.log("=== empresas ===");
  console.log(`  en la base        : ${empresasFinal}   (prefijos: ${prefijosFinal})`);
  console.log(`  creadas ahora     : ${empresasCreadas}`);
  console.log(`  ya estaban        : ${empresasYaEstaban}`);
  console.log(`  prefijos creados  : ${prefijosCreados}`);
  console.log(`  esPropio rellenado / preservado: ${esPropioRellenado} / ${esPropioPreservado}`);
  if (conflictos.length) {
    console.log(`\n  OJO: ${conflictos.length} conflicto(s) de prefijos, sin tocar:`);
    for (const c of conflictos) console.log(`    ${c}`);
  }

  console.log("\n=== consignatarios ===");
  console.log(`  en la base        : ${consignatariosFinal}`);
  console.log(`  en el histórico   : ${delHistorico.length}`);
  console.log(`  creados ahora     : ${consignatariosCreados}`);
  console.log(`  colapsados por normalizar: ${consignatariosColapsados}`);

  console.log("\n=== canónicas ===");
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
