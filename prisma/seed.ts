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

type Rol =
  | "CONSIGNATARIO"
  | "EMPRESA_COMPRADORA"
  | "VENDEDOR"
  | "HOTELERO"
  | "PERSONA_COMPRADORA";

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
 * Los nombres del histórico, por el rol en el que aparecieron.
 *
 * El rol sale del CAMPO en el que estaba cada nombre, que es toda la evidencia
 * que hay: `liquidaciones_liquidacion.consignatario` fue consignatario,
 * `ingresos_tropa.proveedor` fue vendedor, `ingresos_tropa.hotelero` fue
 * hotelero.
 *
 * `ingresos_tropa.consignatario` queda deliberadamente afuera: guarda las
 * mismas entidades escritas distinto («Darwash» vs «DARWASH SA», «Talano Hnos»
 * vs «TALANO HERMANOS SRL»), valores que no son consignatarios en absoluto
 * («TRASLADO» 98 veces, «DESTETE») y empresas nuestras. Decidir qué texto es
 * qué entidad real no se adivina.
 */
function leerNombresDelHistorico(): { nombre: string; rol: Rol }[] {
  const db = new DatabaseSync(DB_HISTORICA, { readOnly: true });
  try {
    const leer = (sql: string, rol: Rol) =>
      (db.prepare(sql).all() as unknown as { nombre: string }[]).map((f) => ({
        nombre: f.nombre.trim(),
        rol,
      }));
    return [
      ...leer(
        `SELECT DISTINCT trim(consignatario) AS nombre FROM liquidaciones_liquidacion
         WHERE trim(coalesce(consignatario,'')) <> '' ORDER BY nombre`,
        "CONSIGNATARIO"
      ),
      ...leer(
        `SELECT DISTINCT trim(proveedor) AS nombre FROM ingresos_tropa
         WHERE trim(coalesce(proveedor,'')) <> '' ORDER BY nombre`,
        "VENDEDOR"
      ),
      ...leer(
        `SELECT DISTINCT trim(hotelero) AS nombre FROM ingresos_tropa
         WHERE trim(coalesce(hotelero,'')) <> '' ORDER BY nombre`,
        "HOTELERO"
      ),
    ];
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
  // ---------- 1. El padrón de entidades y sus roles ----------
  //
  // Una sola tabla. La identidad es `nombreNormalizado` con el unique ESTRICTO:
  // colapsa lo que difiere solo en mayúsculas o acentos, y NADA MÁS. «Darwash»
  // y «DARWASH SA» siguen siendo dos entidades — que sean la misma lo decide
  // una persona, no el seed.
  const candidatos: { nombre: string; rol: Rol }[] = [
    ...EMPRESAS.map((e) => ({ nombre: e.nombre, rol: "EMPRESA_COMPRADORA" as Rol })),
    ...leerNombresDelHistorico(),
  ];

  // Agrupar por nombre normalizado. Se conserva la primera variante cruda vista
  // como `nombre`; el resto queda registrado para poder reportar qué colapsó.
  type Grupo = { nombre: string; variantes: Set<string>; roles: Set<Rol> };
  const grupoPorNorm = new Map<string, Grupo>();
  for (const c of candidatos) {
    const norm = normalizarNombre(c.nombre);
    let g = grupoPorNorm.get(norm);
    if (!g) {
      g = { nombre: c.nombre, variantes: new Set(), roles: new Set() };
      grupoPorNorm.set(norm, g);
    }
    g.variantes.add(c.nombre);
    g.roles.add(c.rol);
  }

  const colapsos = [...grupoPorNorm.entries()]
    .filter(([, g]) => g.variantes.size > 1 || g.roles.size > 1)
    .map(([norm, g]) => ({
      norm,
      variantes: [...g.variantes].sort(),
      roles: [...g.roles].sort(),
    }));

  const esPropioDe = new Map(EMPRESAS.map((e) => [normalizarNombre(e.nombre), e.esPropio]));

  const enBase = new Map(
    (
      await prisma.entidad.findMany({
        select: { id: true, nombreNormalizado: true, esPropio: true },
      })
    ).map((e) => [e.nombreNormalizado, e])
  );

  let entidadesCreadas = 0;
  let entidadesYaEstaban = 0;
  let esPropioRellenado = 0;
  let esPropioPreservado = 0;
  let rolesCreados = 0;
  const idPorNorm = new Map<string, number>();

  for (const [norm, g] of grupoPorNorm) {
    const existente = enBase.get(norm);
    const propio = esPropioDe.get(norm) ?? null;
    let id: number;

    if (existente) {
      id = existente.id;
      entidadesYaEstaban++;
      // El nombre NO se toca nunca: puede haberse editado a mano. `esPropio`
      // sigue la misma regla que las canónicas: rellena si está en NULL, nunca
      // pisa un valor ya puesto.
      if (existente.esPropio === null && propio !== null) {
        await prisma.entidad.update({ where: { id }, data: { esPropio: propio } });
        esPropioRellenado++;
      } else if (existente.esPropio !== null) {
        esPropioPreservado++;
      }
    } else {
      const nueva = await prisma.entidad.create({
        data: { nombre: g.nombre, nombreNormalizado: norm, esPropio: propio },
      });
      id = nueva.id;
      entidadesCreadas++;
    }

    idPorNorm.set(norm, id);

    // Los roles son aditivos: se agrega el que falte y no se saca ninguno. Que
    // una entidad ya no aparezca en el histórico con cierto rol no significa
    // que no lo tenga.
    for (const rol of g.roles) {
      const r = await prisma.entidadRol.upsert({
        where: { entidadId_rol: { entidadId: id, rol } },
        create: { entidadId: id, rol },
        update: {},
        select: { creadoEn: true },
      });
      if (r) rolesCreados++;
    }
  }

  // ---------- 2. Los 11 prefijos de tropa ----------
  // Cuelgan de la entidad de la empresa. La identidad del prefijo es su código,
  // que lleva el unique.
  const prefijosEnBase = new Set(
    (await prisma.prefijoTropa.findMany({ select: { codigo: true } })).map((p) => p.codigo)
  );
  let prefijosCreados = 0;
  const conflictos: string[] = [];

  for (const def of EMPRESAS) {
    const entidadId = idPorNorm.get(normalizarNombre(def.nombre));
    if (entidadId === undefined) {
      conflictos.push(`${def.nombre}: no se resolvió su entidad, se saltean sus prefijos`);
      continue;
    }
    for (const codigo of def.prefijos) {
      if (prefijosEnBase.has(codigo)) continue;
      await prisma.prefijoTropa.create({ data: { codigo, entidadId } });
      prefijosEnBase.add(codigo);
      prefijosCreados++;
    }
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
  const entidadesFinal = await prisma.entidad.count();
  const prefijosFinal = await prisma.prefijoTropa.count();
  const rolesFinal = await prisma.entidadRol.count();
  const porRol = await prisma.entidadRol.groupBy({ by: ["rol"], _count: { rol: true } });

  console.log("=== padrón de entidades ===");
  console.log(`  nombres leídos    : ${candidatos.length}`);
  console.log(`  entidades únicas  : ${grupoPorNorm.size}`);
  console.log(`  en la base        : ${entidadesFinal}   (prefijos: ${prefijosFinal})`);
  console.log(`  creadas ahora     : ${entidadesCreadas}`);
  console.log(`  ya estaban        : ${entidadesYaEstaban}`);
  console.log(`  prefijos creados  : ${prefijosCreados}`);
  console.log(
    `  esPropio rellenado / preservado: ${esPropioRellenado} / ${esPropioPreservado}`
  );

  console.log("\n=== roles ===");
  console.log(`  declarados en total: ${rolesFinal}`);
  for (const r of [...porRol].sort((a, b) => b._count.rol - a._count.rol)) {
    console.log(`    ${r.rol.padEnd(20)} ${r._count.rol}`);
  }

  console.log(`\n=== colapsaron en una sola entidad: ${colapsos.length} ===`);
  console.log("  Solo por nombreNormalizado estricto. Nombres distintos que");
  console.log("  parezcan la misma entidad NO se unifican: lo decide una persona.");
  for (const c of colapsos) {
    console.log(`    ${c.norm}`);
    console.log(`       variantes: ${c.variantes.join("  |  ")}`);
    console.log(`       roles    : ${c.roles.join(", ")}`);
  }
  if (conflictos.length) {
    console.log(`\n  OJO: ${conflictos.length} conflicto(s), sin tocar:`);
    for (const c of conflictos) console.log(`    ${c}`);
  }

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
