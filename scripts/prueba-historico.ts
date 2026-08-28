/**
 * Prueba contra el histórico — punto 8.1 del prompt de arranque.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ES SEGURO CORRERLA. NO ESCRIBE NADA.                                     │
 * │                                                                          │
 * │ Todo pasa dentro de UNA transacción que al terminar se aborta a          │
 * │ propósito, así que no queda ni una fila: ni las compras, ni las tropas,  │
 * │ ni las cargas, ni los lotes, ni los catálogos que crea para la prueba.   │
 * │ Lo único que cambia es que los contadores SERIAL avanzan, que no importa.│
 * │ La base histórica de WinCompras se abre en modo solo lectura.            │
 * │                                                                          │
 * │ Corrapla cada vez que se toque el esquema:  npx tsx scripts/prueba-      │
 * │ historico.ts                                                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Intenta representar las compras del último año de WinCompras en el modelo
 * nuevo y clasifica cada fracaso en una de tres:
 *   (a) falta un dato que el formulario nuevo va a exigir
 *   (b) el dato existe pero el modelo no lo puede representar  <- lo que importa
 *   (c) el origen es contradictorio
 *
 * CUÁNDO APRUEBA. Dos condiciones, y ninguna es un número:
 *   1. (b) es CERO.
 *   2. Todo fallo de (a) y (c) cae en un motivo ya catalogado.
 *
 * Los conteos se IMPRIMEN pero no deciden nada. La base de WinCompras es un
 * pipeline vivo que re-ingesta: el 28/08/2026 pasó de 1049 a 1051 filas y la
 * ventana de 120 a 121 compras sin que cambiara una línea de código. Un
 * criterio numérico habría marcado eso como falla, y una prueba que grita por
 * cada ingesta deja de mirarse en tres semanas.
 *
 * Al revés: un motivo NUEVO la hace fallar aunque los totales queden idénticos.
 * Esa es la señal que importa — que aparezca una razón que nadie miró.
 *
 * El informe de la última corrida está en docs/prueba-historico-modulos-1-2.md.
 *
 * CUÁNDO CORRERLA: después de cada cambio de esquema **y después de cada cambio
 * en prisma/seed.ts**. La prueba no es independiente del estado de los
 * catálogos: reusa las empresas, los consignatarios y los sinónimos ya
 * sembrados, y busca cada uno por su clave normalizada. Un cambio en el seed
 * —una empresa nueva, otra forma de normalizar, un prefijo que se mueve— puede
 * romperla o, peor, hacerla pasar midiendo otra cosa. Ya pasó una vez: cuando
 * el seed empezó a cargar las 8 empresas de verdad, este script todavía creaba
 * sus propios placeholders y chocaba contra el unique de prefijo_tropa.codigo.
 *
 * Se insertan con SQL parametrizado y no con el cliente tipado a propósito: así
 * quien rechaza es Postgres (NOT NULL, FK compuestas, CHECK, unique) y no la
 * validación de Prisma en memoria, que es justo lo que la prueba quiere evitar.
 *
 * Cada compra va dentro de un SAVEPOINT. Sin eso, la primera violación abortaría
 * la transacción entera y no se podría seguir midiendo las demás.
 *
 * Corre por la conexión DIRECTA (session mode): es una transacción larga, y el
 * pooler en transaction mode no es el lugar para eso.
 */
import { statSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { config as loadEnv } from "dotenv";

import { normalizarNombre, normalizarTexto } from "@/lib/normalizar";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const DB_HISTORICA =
  process.env.WINCOMPRAS_DB ??
  "c:/Users/zemma/Claude/Projects/WinCompras/backend/db.sqlite3";

const DESDE = process.env.PRUEBA_DESDE ?? "2025-08-24";


type Categoria = "a" | "b" | "c";

/**
 * CATÁLOGO DE MOTIVOS CONOCIDOS.
 *
 * La prueba aprueba si (b) es cero Y todo fallo cae en uno de estos. Un motivo
 * NUEVO la hace fallar aunque los totales no se muevan — que es el punto: lo
 * que importa no es cuántas quedan afuera, sino que no aparezca una razón que
 * nadie miró todavía.
 *
 * Agregar una entrada acá es una decisión: significa «esto ya lo miramos y
 * sabemos por qué pasa». No se agrega para que la prueba deje de molestar.
 */
const MOTIVOS_CONOCIDOS = {
  FALTA_EMPRESA_TITULAR: "el origen no tiene empresa titular y la columna es NOT NULL",
  FALTA_CONSIGNATARIO: "el origen no tiene consignatario y la columna es NOT NULL",
  FALTA_FECHA: "el origen no tiene fecha de compra y la columna es NOT NULL",
  LOTE_SIN_CATEGORIA: "algún lote del origen no tiene categoría",
  TROPA_SIN_EMPRESA: "alguna tropa del origen no tiene empresa compradora",
  TITULAR_FUERA_DE_SUS_TROPAS:
    "la empresa titular no figura entre las de sus tropas — legítimo, la empresa puede cambiar entre compra y liquidación",
  TROPAS_TEXTO_VS_CONCILIACION:
    "el texto y la conciliación no coinciden en cuántas tropas tiene la compra",
} as const;

type MotivoConocido = keyof typeof MOTIVOS_CONOCIDOS;

type Fallo = {
  compraId: number;
  categoria: Categoria;
  /** Vacío = motivo NO catalogado. Eso hace fallar la prueba. */
  motivos: MotivoConocido[];
  detalle: string;
};

type LiqRow = {
  id: number;
  fecha_compra: string | null;
  consignatario: string;
  comprador: string;
  observaciones: string;
  nro_tropa_texto: string;
  n_dte: string;
  transportistas: string;
};

type DetalleRow = {
  id: number;
  liquidacion_id: number;
  cantidad_cabezas: number | null;
  peso_origen: number | null;
  precio_kg: number | null;
  comision: number | null;
  categoria_codigo: string | null;
};

type TropaRow = {
  id: number;
  liquidacion_id: number;
  nro_tropa: string;
  fecha_ingreso: string | null;
  comprador_codigo: string | null;
  proveedor: string;
  hotelero: string;
};

type DteRow = {
  id: number;
  tropa_id: number;
  numero: string;
  chofer: string;
  patente: string;
  fecha_emision: string | null;
};

function leerHistorico() {
  const db = new DatabaseSync(DB_HISTORICA, { readOnly: true });
  try {
    const liquidaciones = db
      .prepare(
        `SELECT id, fecha_compra, consignatario, comprador,
                observaciones, nro_tropa_texto, n_dte, transportistas
         FROM liquidaciones_liquidacion
         WHERE fecha_compra >= ? ORDER BY id`
      )
      .all(DESDE) as unknown as LiqRow[];

    const detalles = db
      .prepare(
        `SELECT d.id, d.liquidacion_id, d.cantidad_cabezas, d.peso_origen,
                d.precio_kg, d.comision, c.codigo AS categoria_codigo
         FROM liquidaciones_detalleliquidacion d
         JOIN liquidaciones_liquidacion l ON l.id = d.liquidacion_id
         LEFT JOIN catalogos_categoria c ON c.id = d.categoria_id
         WHERE l.fecha_compra >= ? ORDER BY d.id`
      )
      .all(DESDE) as unknown as DetalleRow[];

    const tropas = db
      .prepare(
        `SELECT DISTINCT t.id, l.id AS liquidacion_id, t.nro_tropa, t.fecha_ingreso,
                cmp.codigo AS comprador_codigo, t.proveedor, t.hotelero
         FROM liquidaciones_liquidacion l
         JOIN conciliacion_conciliacion cc ON cc.liquidacion_id = l.id
         JOIN conciliacion_conciliacion_tropas ct ON ct.conciliacion_id = cc.id
         JOIN ingresos_tropa t ON t.id = ct.tropa_id
         LEFT JOIN catalogos_comprador cmp ON cmp.id = t.comprador_id
         WHERE l.fecha_compra >= ? ORDER BY t.id`
      )
      .all(DESDE) as unknown as TropaRow[];

    const dtes = db
      .prepare(
        `SELECT dt.id, dt.tropa_id, dt.numero, dt.chofer, dt.patente, dt.fecha_emision
         FROM ingresos_documentotransporte dt
         WHERE dt.tropa_id IN (
           SELECT DISTINCT ct.tropa_id
           FROM liquidaciones_liquidacion l
           JOIN conciliacion_conciliacion cc ON cc.liquidacion_id = l.id
           JOIN conciliacion_conciliacion_tropas ct ON ct.conciliacion_id = cc.id
           WHERE l.fecha_compra >= ?
         ) ORDER BY dt.id`
      )
      .all(DESDE) as unknown as DteRow[];

    const compradores = db
      .prepare(`SELECT codigo, propio FROM catalogos_comprador ORDER BY id`)
      .all() as unknown as { codigo: string; propio: number }[];

    const totalLiquidaciones = (
      db.prepare("SELECT count(*) AS n FROM liquidaciones_liquidacion").get() as unknown as { n: number }
    ).n;

    return { liquidaciones, detalles, tropas, dtes, compradores, totalLiquidaciones };
  } finally {
    db.close();
  }
}

const vacio = (s: string | null | undefined) => !s || s.trim() === "";

class Abortar extends Error {}

async function main() {
  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { SUPABASE_CA_CERT } = await import("@/lib/supabase-ca");

  const directa = process.env.POSTGRES_URL_NON_POOLING;
  if (!directa) throw new Error("Falta POSTGRES_URL_NON_POOLING");
  const url = new URL(directa);
  url.searchParams.delete("sslmode");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url.toString(),
      max: 1,
      ssl: { ca: SUPABASE_CA_CERT, rejectUnauthorized: true },
    }),
  });

  const h = leerHistorico();

  const detallesPorCompra = new Map<number, DetalleRow[]>();
  for (const d of h.detalles) {
    const lista = detallesPorCompra.get(d.liquidacion_id) ?? [];
    lista.push(d);
    detallesPorCompra.set(d.liquidacion_id, lista);
  }

  const tropasPorCompra = new Map<number, TropaRow[]>();
  for (const t of h.tropas) {
    const lista = tropasPorCompra.get(t.liquidacion_id) ?? [];
    lista.push(t);
    tropasPorCompra.set(t.liquidacion_id, lista);
  }

  const dtesPorTropa = new Map<number, DteRow[]>();
  for (const d of h.dtes) {
    const lista = dtesPorTropa.get(d.tropa_id) ?? [];
    lista.push(d);
    dtesPorTropa.set(d.tropa_id, lista);
  }

  const fallos: Fallo[] = [];
  const contradicciones: Fallo[] = [];
  let entraron = 0;
  let lotesInsertados = 0;
  let tropasInsertadas = 0;
  let cargasInsertadas = 0;

  try {
    await prisma.$transaction(
      async (tx) => {
        // ---------- catálogos ----------
        // El padrón de entidades YA ESTÁ SEMBRADO de verdad (prisma/seed.ts):
        // se reusa, no se recrea. Recrearlo chocaría contra el unique de
        // `entidad.nombreNormalizado` y contra el de `prefijo_tropa.codigo`, y
        // además la prueba es más fiel corriendo contra los mismos catálogos
        // que va a usar la app.
        //
        // Todos los roles resuelven contra la MISMA tabla; lo que distingue al
        // consignatario del vendedor es la columna de `compra` en la que va su
        // id, no de dónde salió.
        const entidadPorNorm = new Map<string, number>();
        for (const e of await tx.entidad.findMany({
          select: { id: true, nombreNormalizado: true },
        })) {
          entidadPorNorm.set(e.nombreNormalizado, e.id);
        }

        /** Devuelve el id de la entidad, creándola si el histórico trae un
         *  nombre que el seed no tenía. Los roles se declaran también. */
        const entidadDe = async (nombre: string, rol: string) => {
          const norm = normalizarNombre(nombre);
          let id = entidadPorNorm.get(norm);
          if (id === undefined) {
            const [row] = await tx.$queryRaw<{ id: number }[]>`
              INSERT INTO entidad (nombre, "nombreNormalizado", activo, "creadoEn", "actualizadoEn")
              VALUES (${nombre}, ${norm}, true, now(), now())
              ON CONFLICT ("nombreNormalizado") DO UPDATE SET nombre = entidad.nombre
              RETURNING id
            `;
            id = row.id;
            entidadPorNorm.set(norm, id);
          }
          await tx.$executeRawUnsafe(
            `INSERT INTO entidad_rol ("entidadId", rol, "creadoEn")
             VALUES ($1, $2::"RolEntidad", now())
             ON CONFLICT ("entidadId", rol) DO NOTHING`,
            id,
            rol
          );
          return id;
        };

        const empresaId = new Map<string, number>();
        for (const p of await tx.prefijoTropa.findMany({
          select: { codigo: true, entidadId: true },
        })) {
          empresaId.set(p.codigo, p.entidadId);
        }

        // Si algún prefijo del histórico todavía no estuviera sembrado, se crea
        // acá dentro con nombre placeholder: la razón social real no se inventa.
        for (const c of h.compradores) {
          if (empresaId.has(c.codigo)) continue;
          const id = await entidadDe(
            `(pendiente razón social) ${c.codigo}`,
            "EMPRESA_COMPRADORA"
          );
          await tx.$executeRaw`
            INSERT INTO prefijo_tropa (codigo, "entidadId") VALUES (${c.codigo}, ${id})
          `;
          empresaId.set(c.codigo, id);
        }

        const consignatarioId = new Map<string, number>();
        for (const nombre of new Set(
          h.liquidaciones.map((l) => l.consignatario.trim()).filter((s) => s !== "")
        )) {
          consignatarioId.set(nombre, await entidadDe(nombre, "CONSIGNATARIO"));
        }

        const vendedorId = new Map<string, number>();
        for (const nombre of new Set(
          h.tropas.map((t) => t.proveedor.trim()).filter((s) => s !== "")
        )) {
          vendedorId.set(nombre, await entidadDe(nombre, "VENDEDOR"));
        }

        const hoteleroId = new Map<string, number>();
        for (const nombre of new Set(
          h.tropas.map((t) => t.hotelero.trim()).filter((s) => s !== "")
        )) {
          hoteleroId.set(nombre, await entidadDe(nombre, "HOTELERO"));
        }


        // sinónimos ya sembrados de verdad
        const sinonimos = await tx.categoriaSinonimo.findMany({
          select: { id: true, textoNormalizado: true },
        });
        const sinonimoId = new Map(sinonimos.map((s) => [s.textoNormalizado, s.id]));

        // ---------- las compras ----------
        for (const liq of h.liquidaciones) {
          await tx.$executeRawUnsafe("SAVEPOINT compra");
          try {
            const cons = vacio(liq.consignatario)
              ? null
              : (consignatarioId.get(liq.consignatario.trim()) ?? null);
            const emp = vacio(liq.comprador)
              ? null
              : (empresaId.get(liq.comprador.trim()) ?? null);

            const tropasDeLaCompra = tropasPorCompra.get(liq.id) ?? [];
            const primera = tropasDeLaCompra[0];
            const vend = primera && !vacio(primera.proveedor)
              ? (vendedorId.get(primera.proveedor.trim()) ?? null)
              : null;
            const hot = primera && !vacio(primera.hotelero)
              ? (hoteleroId.get(primera.hotelero.trim()) ?? null)
              : null;

            const [compra] = await tx.$queryRaw<{ id: number }[]>`
              INSERT INTO compra (
                fecha, "consignatarioId", "empresaTitularId", "vendedorId",
                "hoteleroId", observaciones, "creadoEn", "actualizadoEn"
              ) VALUES (
                ${liq.fecha_compra}::date, ${cons}, ${emp}, ${vend},
                ${hot}, ${liq.observaciones}, now(), now()
              ) RETURNING id
            `;

            // tropas
            const idTropaNueva = new Map<number, number>();
            for (const t of tropasDeLaCompra) {
              const empT = t.comprador_codigo
                ? (empresaId.get(t.comprador_codigo) ?? null)
                : null;
              const [nueva] = await tx.$queryRaw<{ id: number }[]>`
                INSERT INTO tropa (
                  "compraId", "empresaCompradoraId", "nroTropa", fecha,
                  "creadoEn", "actualizadoEn"
                ) VALUES (
                  ${compra.id}, ${empT}, ${t.nro_tropa},
                  ${t.fecha_ingreso}::date, now(), now()
                ) RETURNING id
              `;
              idTropaNueva.set(t.id, nueva.id);
              tropasInsertadas++;

              for (const dte of dtesPorTropa.get(t.id) ?? []) {
                await tx.$executeRaw`
                  INSERT INTO carga (
                    "compraId", "tropaId", dte, transportista, patente,
                    "fechaSalida", "creadoEn", "actualizadoEn"
                  ) VALUES (
                    ${compra.id}, ${nueva.id}, ${dte.numero},
                    ${vacio(dte.chofer) ? null : dte.chofer},
                    ${vacio(dte.patente) ? null : dte.patente},
                    ${dte.fecha_emision}::date, now(), now()
                  )
                `;
                cargasInsertadas++;
              }
            }

            // lotes
            for (const d of detallesPorCompra.get(liq.id) ?? []) {
              const sid = d.categoria_codigo
                ? (sinonimoId.get(normalizarTexto(d.categoria_codigo)) ?? null)
                : null;
              await tx.$executeRaw`
                INSERT INTO lote (
                  "compraId", "tropaId", "categoriaSinonimoId", cabezas,
                  "kilosOrigen", precio, comision, "creadoEn", "actualizadoEn"
                ) VALUES (
                  ${compra.id}, NULL, ${sid}, ${d.cantidad_cabezas},
                  ${d.peso_origen}, ${d.precio_kg}, ${d.comision}, now(), now()
                )
              `;
              lotesInsertados++;
            }

            await tx.$executeRawUnsafe("RELEASE SAVEPOINT compra");
            entraron++;
          } catch (e) {
            await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT compra");
            fallos.push(clasificar(liq, e, detallesPorCompra, tropasPorCompra));
          }
        }

        // ---------- contradicciones del origen: categoría (c) ----------
        // No impiden la inserción, pero son fallos igual: hay algo que decidir.
        // Se catalogan como todo lo demás, así que una contradicción de un tipo
        // NUEVO hace fallar la prueba aunque los totales no se muevan.
        for (const liq of h.liquidaciones) {
          const tropas = tropasPorCompra.get(liq.id) ?? [];
          if (tropas.length === 0) continue;
          const empresasTropas = new Set(
            tropas.map((t) => t.comprador_codigo).filter(Boolean)
          );
          if (
            !vacio(liq.comprador) &&
            empresasTropas.size > 0 &&
            !empresasTropas.has(liq.comprador.trim())
          ) {
            contradicciones.push({
              compraId: liq.id,
              categoria: "c",
              motivos: ["TITULAR_FUERA_DE_SUS_TROPAS"],
              detalle:
                `titular ${liq.comprador.trim()} no está entre las empresas de ` +
                `sus tropas (${[...empresasTropas].join(", ")})`,
            });
          }
          const enTexto = liq.nro_tropa_texto
            .split(";")
            .map((s) => s.trim())
            .filter((s) => s !== "").length;
          if (enTexto > 0 && enTexto !== tropas.length) {
            contradicciones.push({
              compraId: liq.id,
              categoria: "c",
              motivos: ["TROPAS_TEXTO_VS_CONCILIACION"],
              detalle: `el texto menciona ${enTexto} tropa(s) y la conciliación linkea ${tropas.length}`,
            });
          }
        }

        throw new Abortar("fin de la prueba: se revierte todo a propósito");
      },
      { maxWait: 60_000, timeout: 900_000 }
    );
  } catch (e) {
    if (!(e instanceof Abortar)) throw e;
  } finally {
    await prisma.$disconnect();
  }

  const aprobada = reportar(h, fallos, contradicciones, {
    entraron,
    lotesInsertados,
    tropasInsertadas,
    cargasInsertadas,
  });

  // El código de salida es el veredicto: si no, correrla desde un script diría
  // que aprobó siempre.
  if (!aprobada) process.exitCode = 1;
}

/**
 * Código SQLSTATE que devolvió Postgres, sacado del mensaje de Prisma
 * («Raw query failed. Code: `23502`»). null si no se pudo leer.
 */
/** Primera línea con contenido del error: el mensaje de Prisma arranca con
 * saltos de línea y `split(...)[0]` devolvía vacío. */
function primeraLinea(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l !== "") ?? "sin mensaje"
  );
}

function codigoPg(e: unknown): string | null {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.match(/Code: `(\d+)`/);
  return m ? m[1] : null;
}

/**
 * 23502 = not_null_violation. Es el único error que explican los motivos de
 * falta de dato: si el origen no trae empresa titular, lo que tiene que romper
 * es el NOT NULL de esa columna y nada más.
 */
const NOT_NULL = "23502";

function clasificar(
  liq: LiqRow,
  e: unknown,
  detalles: Map<number, DetalleRow[]>,
  tropas: Map<number, TropaRow[]>
): Fallo {
  const msg = e instanceof Error ? e.message : String(e);
  const motivos: MotivoConocido[] = [];
  const partes: string[] = [];

  if (vacio(liq.comprador)) {
    motivos.push("FALTA_EMPRESA_TITULAR");
    partes.push("empresa titular");
  }
  if (vacio(liq.consignatario)) {
    motivos.push("FALTA_CONSIGNATARIO");
    partes.push("consignatario");
  }
  if (!liq.fecha_compra) {
    motivos.push("FALTA_FECHA");
    partes.push("fecha de compra");
  }
  const codigo = codigoPg(e);

  // El motivo tiene que EXPLICAR el error, no solo coexistir con él. Si la
  // compra no trae empresa titular pero Postgres rechazó por otra cosa —un
  // CHECK, una FK, un unique—, el diagnóstico sería falso y taparía justo lo
  // que la prueba busca. En ese caso se devuelve sin motivo catalogado.
  if (motivos.length && codigo === NOT_NULL) {
    return {
      compraId: liq.id,
      categoria: "a",
      motivos,
      detalle: `falta ${partes.join(" y ")} en el origen; la columna es NOT NULL`,
    };
  }
  if (motivos.length) {
    return {
      compraId: liq.id,
      categoria: "a",
      motivos: [],
      detalle:
        `el origen no trae ${partes.join(" y ")}, pero Postgres rechazó con ` +
        `${codigo ?? "un error no identificado"}, que no es un NOT NULL: ` +
        `el motivo no explica el fallo. ${primeraLinea(e)}`,
    };
  }

  const sinCategoria = (detalles.get(liq.id) ?? []).filter((d) => !d.categoria_codigo);
  if (sinCategoria.length && codigo === NOT_NULL) {
    return {
      compraId: liq.id,
      categoria: "a",
      motivos: ["LOTE_SIN_CATEGORIA"],
      detalle: `${sinCategoria.length} lote(s) sin categoría en el origen`,
    };
  }

  const tropasSinEmpresa = (tropas.get(liq.id) ?? []).filter((t) => !t.comprador_codigo);
  if (tropasSinEmpresa.length && codigo === NOT_NULL) {
    return {
      compraId: liq.id,
      categoria: "a",
      motivos: ["TROPA_SIN_EMPRESA"],
      detalle: `${tropasSinEmpresa.length} tropa(s) sin empresa compradora en el origen`,
    };
  }

  // Sin motivo catalogado: el dato está y el modelo lo rechazó igual. Es (b), y
  // (b) siempre hace fallar la prueba.
  return {
    compraId: liq.id,
    categoria: "b",
    motivos: [],
    detalle:
      `el dato existe pero el modelo lo rechazó (${codigo ?? "sin código"}): ` +
      `${primeraLinea(e)}`,
  };
}

function reportar(
  h: ReturnType<typeof leerHistorico>,
  fallos: Fallo[],
  contradicciones: Fallo[],
  totales: {
    entraron: number;
    lotesInsertados: number;
    tropasInsertadas: number;
    cargasInsertadas: number;
  }
): boolean {
  const st = statSync(DB_HISTORICA);
  console.log("=== base de origen ===");
  console.log(`  archivo   : ${DB_HISTORICA}`);
  console.log(`  modificada: ${st.mtime.toISOString()}`);
  console.log(`  tamaño    : ${st.size} bytes`);
  console.log(`  liquidaciones_liquidacion: ${h.totalLiquidaciones} filas en total`);
  console.log(
    "  (es un pipeline vivo: estos números se mueven solos, por eso no son criterio)"
  );

  console.log("\n=== conteos (informativos, NO son la condición) ===");
  console.log(`  compras en la ventana (>= ${DESDE}): ${h.liquidaciones.length}`);
  console.log(`  lotes en el origen                 : ${h.detalles.length}`);
  console.log(`  tropas linkeadas por conciliación  : ${h.tropas.length}`);
  console.log(`  DTE de esas tropas                 : ${h.dtes.length}`);
  console.log(`  entraron                           : ${totales.entraron}`);
  console.log(`  no entraron                        : ${fallos.length}`);
  console.log(
    `  filas escritas y revertidas        : ${totales.tropasInsertadas} tropas, ` +
      `${totales.cargasInsertadas} cargas, ${totales.lotesInsertados} lotes`
  );

  const todos = [...fallos, ...contradicciones];
  for (const cat of ["a", "b", "c"] as const) {
    const grupo = todos.filter((f) => f.categoria === cat);
    console.log(`\n=== categoría (${cat}) — ${grupo.length} ===`);
    for (const f of grupo) {
      const cod = f.motivos.length ? f.motivos.join("+") : "SIN CATALOGAR";
      console.log(`  ${f.compraId}  [${cod}]  ${f.detalle}`);
    }
  }

  // ---------- reparto por motivo ----------
  const porMotivo = new Map<string, number>();
  for (const f of todos) {
    for (const m of f.motivos) porMotivo.set(m, (porMotivo.get(m) ?? 0) + 1);
  }
  console.log("\n=== reparto por motivo ===");
  for (const [m, n] of [...porMotivo].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${m}`);
  }

  // ---------- veredicto ----------
  const casosB = todos.filter((f) => f.categoria === "b");
  const sinCatalogar = todos.filter((f) => f.motivos.length === 0 && f.categoria !== "b");

  console.log("\n" + "=".repeat(66));
  console.log("VEREDICTO");
  console.log("=".repeat(66));

  const okB = casosB.length === 0;
  const okMotivos = sinCatalogar.length === 0;

  console.log(
    `  1. (b) en cero — ninguna compra afuera por el modelo : ${okB ? "SÍ" : "NO"}`
  );
  if (!okB) {
    for (const f of casosB) console.log(`       ${f.compraId}: ${f.detalle}`);
  }
  console.log(
    `  2. todo fallo cae en un motivo ya conocido           : ${okMotivos ? "SÍ" : "NO"}`
  );
  if (!okMotivos) {
    for (const f of sinCatalogar) {
      console.log(`       ${f.compraId} (${f.categoria}): ${f.detalle}`);
    }
    console.log("     Un motivo nuevo no se agrega al catálogo para callar la prueba:");
    console.log("     primero se entiende qué pasa, y recién ahí se decide.");
  }

  const aprobada = okB && okMotivos;
  console.log(`\n  ${aprobada ? "APROBADA" : "NO APROBADA"}`);
  if (aprobada) {
    console.log(
      "  Los conteos pueden haber cambiado desde la última corrida: la base de\n" +
        "  origen se re-ingesta. Eso no es una falla — mirá el bloque de arriba."
    );
  }
  console.log("=".repeat(66));

  console.log("\n=== motivos del catálogo ===");
  for (const [k, v] of Object.entries(MOTIVOS_CONOCIDOS)) {
    console.log(`  ${k}`);
    console.log(`     ${v}`);
  }

  return aprobada;
}


main().catch((e) => {
  console.error(e);
  process.exit(1);
});
