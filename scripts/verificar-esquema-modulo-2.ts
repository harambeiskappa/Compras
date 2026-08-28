/**
 * Verificación del esquema del módulo 2, contra la base de verdad.
 *
 * ES SEGURO CORRERLA. Cada prueba que escribe va dentro de una transacción que
 * se aborta, así que no queda ninguna fila. Lo único que cambia es que los
 * contadores SERIAL avanzan, que no importa.
 *
 * Ejercita las constraints en vez de leer el DDL: una restricción que no se
 * probó rechazando algo es una suposición.
 *
 * Correr:  npx tsx scripts/verificar-esquema-modulo-2.ts
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

// Ver la nota en scripts/verificar-modulo-1.ts: la guarda `server-only` se
// neutraliza solo para este script, no para la app.
const requiere = createRequire(import.meta.url);
const cargador = requiere("node:module") as {
  _resolveFilename: (pedido: string, ...resto: unknown[]) => string;
};
const resolverOriginal = cargador._resolveFilename;
cargador._resolveFilename = function (pedido: string, ...resto: unknown[]) {
  if (pedido === "server-only") return requiere.resolve("./sin-guarda.cjs");
  return resolverOriginal.call(this, pedido, ...resto);
};

const { Client } = requiere(
  "c:/Users/zemma/Documents/Claude/Projects/Compras/Compras/node_modules/pg"
) as typeof import("pg");

let ok = 0;
let mal = 0;

function chequear(nombre: string, condicion: boolean, detalle: string) {
  if (condicion) {
    ok++;
    console.log(`  OK    ${nombre}`);
    if (detalle) console.log(`        ${detalle}`);
  } else {
    mal++;
    console.log(`  FALLA ${nombre}`);
    console.log(`        ${detalle}`);
  }
}

const CA = process.env.SUPABASE_CA ?? "C:/Users/zemma/Downloads/prod-ca-2021.crt";

async function main() {
  const url = new URL(process.env.POSTGRES_URL_NON_POOLING!);
  url.searchParams.delete("sslmode");
  const c = new Client({
    connectionString: url.toString(),
    ssl: { ca: readFileSync(CA, "utf8"), rejectUnauthorized: true },
  });
  await c.connect();

  /** Corre `sql` dentro de un savepoint y lo revierte. Devuelve el SQLSTATE. */
  async function intentar(sql: string, params: unknown[] = []): Promise<string | null> {
    await c.query("BEGIN");
    try {
      await c.query(sql, params);
      await c.query("ROLLBACK");
      return null; // pasó
    } catch (e) {
      await c.query("ROLLBACK");
      return (e as { code?: string }).code ?? "sin-codigo";
    }
  }

  try {
    // ------------------------------------------------------------ RLS
    console.log("\n=== RLS en las tablas nuevas ===");
    const rls = await c.query(
      `SELECT c.relname t, c.relrowsecurity rls FROM pg_class c
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname`
    );
    const sinRls = rls.rows.filter((r) => !r.rls).map((r) => r.t);
    chequear(
      "todas las tablas tienen RLS",
      sinRls.length === 0,
      sinRls.length ? `SIN RLS: ${sinRls.join(", ")}` : `${rls.rows.length} tablas, todas con RLS`
    );

    // ------------------------------------------------------ idempotencia
    console.log("\n=== clave de idempotencia ===");
    const clave = "prueba-" + Date.now();
    const insertar = (k: string) =>
      `INSERT INTO reporte_compra ("claveIdempotencia","cargadoEn","actualizadoEn")
       VALUES ('${k}', now(), now())`;

    const unaVez = await intentar(insertar(clave));
    chequear("un reporte con clave nueva entra", unaVez === null, unaVez ?? "entró");

    const dosVeces = await intentar(insertar(clave) + "; " + insertar(clave));
    chequear(
      "la MISMA clave dos veces es rechazada",
      dosVeces === "23505",
      dosVeces === "23505" ? "unique_violation, como debe" : `devolvió ${dosVeces}`
    );

    const sinClave = await intentar(
      `INSERT INTO reporte_compra ("claveIdempotencia","cargadoEn","actualizadoEn")
       VALUES (NULL, now(), now())`
    );
    chequear(
      "un reporte SIN clave es rechazado",
      sinClave === "23502",
      sinClave === "23502" ? "not_null_violation, como debe" : `devolvió ${sinClave}`
    );

    // ---------------------------------------------------- reporte minimo
    console.log("\n=== el reporte admite venir casi vacío ===");
    const minimo = await intentar(
      `INSERT INTO reporte_compra ("claveIdempotencia","cargadoEn","actualizadoEn")
       VALUES ('${clave}-min', now(), now())`
    );
    chequear(
      "solo con clave y cargadoEn: entra",
      minimo === null,
      "el comprador puede mandar solo fotos"
    );

    const nulos = await c.query(
      `SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_name='reporte_compra' AND is_nullable='NO' ORDER BY ordinal_position`
    );
    // Se comprueba el CONJUNTO exacto, no la cantidad: lo que importa es que no
    // aparezca un NOT NULL nuevo sin justificación, y un conteo no lo dice.
    //   id, creadoEn, actualizadoEn -> plomería
    //   claveIdempotencia           -> sin ella no se puede desduplicar
    //   cargadoEn                   -> el dispositivo siempre lo sabe
    //   recibidoEn, estado          -> los pone el servidor, con default
    const ESPERADOS = [
      "id",
      "claveIdempotencia",
      "cargadoEn",
      "recibidoEn",
      "estado",
      "creadoEn",
      "actualizadoEn",
    ].sort();
    const obtenidos = nulos.rows.map((r) => r.column_name as string).sort();
    const deMas = obtenidos.filter((c) => !ESPERADOS.includes(c));
    chequear(
      "los NOT NULL del reporte son exactamente los justificados",
      deMas.length === 0 && obtenidos.length === ESPERADOS.length,
      deMas.length ? `SIN JUSTIFICAR: ${deMas.join(", ")}` : obtenidos.join(", ")
    );

    // ------------------------------------------------- adjunto: un padre
    console.log("\n=== adjunto: exactamente un padre ===");
    const adj = (cols: string, vals: string) =>
      `INSERT INTO adjunto (${cols},"tipo","url") VALUES (${vals},'REMITO_FERIA','x')`;

    const sinPadre = await intentar(adj('"compraId"', "NULL"));
    chequear(
      "sin ningún padre es rechazado",
      sinPadre === "23514",
      sinPadre === "23514" ? "check_violation, como debe" : `devolvió ${sinPadre}`
    );

    const dosPadres = await intentar(
      `INSERT INTO reporte_compra ("claveIdempotencia","cargadoEn","actualizadoEn")
         VALUES ('${clave}-2p', now(), now());
       INSERT INTO entidad (nombre,"nombreNormalizado","actualizadoEn")
         VALUES ('X','${clave}-e', now());
       INSERT INTO compra (fecha,"consignatarioId","empresaTitularId","actualizadoEn")
         SELECT '2026-01-01', e.id, e.id, now() FROM entidad e WHERE e."nombreNormalizado"='${clave}-e';
       INSERT INTO adjunto ("compraId","reporteId","tipo","url")
         SELECT c.id, r.id, 'REMITO_FERIA', 'x'
         FROM compra c, reporte_compra r
         WHERE r."claveIdempotencia"='${clave}-2p' ORDER BY c.id DESC LIMIT 1`
    );
    chequear(
      "con LOS DOS padres es rechazado",
      dosPadres === "23514",
      dosPadres === "23514" ? "check_violation, como debe" : `devolvió ${dosPadres}`
    );

    const unPadre = await intentar(
      `INSERT INTO reporte_compra ("claveIdempotencia","cargadoEn","actualizadoEn")
         VALUES ('${clave}-1p', now(), now());
       INSERT INTO adjunto ("reporteId","tipo","url","nota")
         SELECT r.id, 'REMITO_FERIA', 'x', 'el remito dice VQ, para mi es VA'
         FROM reporte_compra r WHERE r."claveIdempotencia"='${clave}-1p'`
    );
    chequear(
      "colgado SOLO del reporte: entra, con su nota",
      unPadre === null,
      "es el camino del comprador"
    );

    // ------------------------------------------------ lote: origen categoria
    console.log("\n=== lote: origen de la categoría ===");
    const col = await c.query(
      `SELECT is_nullable, column_default, udt_name FROM information_schema.columns
       WHERE table_name='lote' AND column_name='origenCategoria'`
    );
    chequear(
      "existe, es nullable y SIN default",
      col.rows.length === 1 &&
        col.rows[0].is_nullable === "YES" &&
        col.rows[0].column_default === null,
      col.rows.length
        ? `tipo=${col.rows[0].udt_name} nullable=${col.rows[0].is_nullable} default=${col.rows[0].column_default}`
        : "NO EXISTE"
    );
    const vals = await c.query(
      `SELECT e.enumlabel v FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
       WHERE t.typname='OrigenCategoria' ORDER BY e.enumsortorder`
    );
    chequear(
      "el enum tiene los dos valores",
      vals.rows.length === 2,
      vals.rows.map((r) => r.v).join(", ")
    );

    // ------------------------------------------- §8.3 ningun DEFAULT 0
    console.log("\n=== §8.3: ningún DEFAULT 0 en cantidad/peso/precio/monto ===");
    const defs = await c.query(
      `SELECT table_name, column_name, column_default FROM information_schema.columns
       WHERE table_schema='public' AND column_default IS NOT NULL
         AND (data_type IN ('integer','numeric','real','double precision','bigint'))
       ORDER BY table_name, column_name`
    );
    // `_prisma_migrations` es bookkeeping de Prisma, no una tabla del dominio:
    // su `applied_steps_count` arranca en 0 legítimamente. La regla habla de
    // cantidad, peso, precio y monto de la hacienda.
    const sospechosos = defs.rows.filter(
      (r) =>
        !String(r.column_default).startsWith("nextval") &&
        r.table_name !== "_prisma_migrations"
    );
    chequear(
      "ninguna columna numérica tiene default fuera de las secuencias",
      sospechosos.length === 0,
      sospechosos.length
        ? sospechosos.map((r) => `${r.table_name}.${r.column_name}=${r.column_default}`).join(", ")
        : `revisadas ${defs.rows.length}, todas nextval de SERIAL`
    );

    // ------------------------------------------------------ estado final
    console.log("\n=== no quedó nada escrito ===");
    for (const t of ["reporte_compra", "adjunto", "compra", "lote"]) {
      const n = (await c.query(`SELECT count(*)::int n FROM "${t}"`)).rows[0].n;
      chequear(`${t} sigue en 0 filas`, n === 0, `${n} filas`);
    }
  } finally {
    await c.end();
  }

  console.log("\n" + "=".repeat(64));
  console.log(`  ${ok} en verde, ${mal} en rojo`);
  console.log("=".repeat(64));
  if (mal > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
