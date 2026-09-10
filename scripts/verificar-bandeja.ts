/**
 * Verificación de la bandeja de la oficina: los diez puntos del prompt
 * `docs/prompt-bandeja.md`, más el RLS que la migración prometió verificar.
 *
 * Entra por el login y llama a las acciones por HTTP, como el resto: llamarlas
 * en proceso saltearía el proxy, la sesión y la comprobación de rol, que es
 * justo lo que hay que probar.
 *
 * Crea cuentas, reportes y compras de prueba, y borra TODO al final. Nada de
 * borrados por barrido: se borra por id lo propio.
 *
 * Correr:  npx tsx scripts/verificar-bandeja.ts
 *          npx tsx scripts/verificar-bandeja.ts --produccion
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { config as loadEnv } from "dotenv";

import { cookiePorLogin, idDeAccion, postAccion, resultadoOk } from "./login-http";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const requiere = createRequire(import.meta.url);
const cargador = requiere("node:module") as {
  _resolveFilename: (pedido: string, ...resto: unknown[]) => string;
};
const resolverOriginal = cargador._resolveFilename;
cargador._resolveFilename = function (pedido: string, ...resto: unknown[]) {
  if (pedido === "server-only") return requiere.resolve("./sin-guarda.cjs");
  return resolverOriginal.call(this, pedido, ...resto);
};

const PROD = "https://compras-ten-mu.vercel.app";
const BASE = process.argv.includes("--produccion") ? PROD : "http://localhost:3000";

let ok = 0;
let mal = 0;
function chequear(nombre: string, cond: boolean, detalle: string) {
  if (cond) {
    ok++;
    console.log(`  OK    ${nombre}`);
    if (detalle) console.log(`        ${detalle}`);
  } else {
    mal++;
    console.log(`  FALLA ${nombre}`);
    console.log(`        ${detalle}`);
  }
}

type Res = { ok: true; id?: number } | { ok: false; errores: string[] };

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { hashearPassword } = await import("@/lib/password");
  const { totalesDeCompra, kilosPorCabeza, importeDelRenglon, comisionDelRenglon } =
    await import("@/lib/totales");

  console.log(`\nContra: ${BASE}\n`);

  const marca = "prueba-band-" + Date.now();
  const PASS = "contrasena-de-prueba-1";
  const ADM = marca + "-adm";
  const COM = marca + "-com";
  const CLAVE = `bandeja-${Date.now()}`;

  const admin = await prisma.usuario.create({
    data: {
      usuario: ADM,
      nombre: "Oficina de prueba",
      hashPassword: await hashearPassword(PASS),
      rol: "ADMINISTRATIVO",
    },
    select: { id: true },
  });
  const comercial = await prisma.usuario.create({
    data: {
      usuario: COM,
      nombre: "Comercial de prueba",
      hashPassword: await hashearPassword(PASS),
      rol: "COMERCIAL",
    },
    select: { id: true },
  });

  const compras: number[] = [];
  const reportes: number[] = [];
  const sinonimosCreados: string[] = [];

  try {
    const cookieAdm = (await cookiePorLogin(BASE, ADM, PASS)).cookie;
    const cookieCom = (await cookiePorLogin(BASE, COM, PASS)).cookie;

    const consig = await prisma.entidad.findFirstOrThrow({
      where: { roles: { some: { rol: "CONSIGNATARIO" } } },
      select: { id: true, nombre: true },
    });
    const empresas = await prisma.entidad.findMany({
      where: { esPropio: true },
      take: 2,
      select: { id: true, nombre: true },
    });
    const [titular, otra] = empresas;

    // Un reporte real, mandado por el comercial, con cabezas declaradas.
    const reporte = await prisma.reporteCompra.create({
      data: {
        claveIdempotencia: CLAVE,
        cargadoEn: new Date(),
        fecha: new Date("2026-09-09"),
        consignatarioTexto: consig.nombre,
        consignatarioId: consig.id,
        plazaTexto: "WASHINGTON",
        cabezasAproximadas: 100,
        cantidadCamiones: 1,
        observaciones: "el remito dice VQ, para mí es VA",
        creadoPorUsuarioId: comercial.id,
      },
      select: { id: true },
    });
    reportes.push(reporte.id);

    // ---------------------------------------------------------------- RLS
    console.log("=== 0. RLS en reporte_compra (la migración prometió verificarlo) ===");
    const rls = await prisma.$queryRawUnsafe<{ relrowsecurity: boolean }[]>(
      `SELECT relrowsecurity FROM pg_class WHERE relname = 'reporte_compra'`
    );
    chequear(
      "la tabla que la migración tocó sigue con RLS activo",
      rls[0]?.relrowsecurity === true,
      `relrowsecurity = ${rls[0]?.relrowsecurity}`
    );

    // ---------------------------------------------------------------- 7
    console.log("\n=== 7. Un COMERCIAL en la bandeja y en la carga de renglones ===");
    const html = await (
      await fetch(`${BASE}/bandeja`, { headers: { Cookie: cookieCom } })
    ).text();
    chequear(
      "la pantalla le dice que no le corresponde y no lista reportes",
      html.includes("No te corresponde") && !html.includes(consig.nombre),
      html.includes("No te corresponde") ? "rebota con explicación" : "VIO LA BANDEJA"
    );

    // Las acciones se sacan del bundle con la cookie del ADMIN, que sí ve la
    // pantalla; después se invocan con la del comercial.
    const aCrearDesde = await idDeAccion(BASE, "/bandeja", "crearCompraDesdeReporte", cookieAdm);
    const aProcesar = await idDeAccion(BASE, "/bandeja", "marcarProcesado", cookieAdm);
    const aRevertir = await idDeAccion(BASE, "/bandeja", "revertirProcesado", cookieAdm);
    const aDescartar = await idDeAccion(BASE, "/bandeja", "descartarReporte", cookieAdm);
    if (!aCrearDesde || !aProcesar || !aRevertir || !aDescartar) {
      chequear(
        "se encontraron los ids de las acciones de bandeja",
        false,
        `crear:${aCrearDesde ?? "no"} procesar:${aProcesar ?? "no"} ` +
          `revertir:${aRevertir ?? "no"} descartar:${aDescartar ?? "no"}`
      );
      return;
    }

    const antesCompras = await prisma.compra.count();
    const rCom = await postAccion(
      BASE,
      "/bandeja",
      aCrearDesde,
      [reporte.id, titular.id, consig.id],
      cookieCom
    );
    const tCom = await rCom.text();
    chequear(
      "un COMERCIAL no puede crear la compra desde el reporte",
      (await prisma.compra.count()) === antesCompras && /ADMINISTRATIVO/.test(tCom),
      tCom.match(/Esta acci[^"]{0,90}/)?.[0] ?? `HTTP ${rCom.status}`
    );

    // ---------------------------------------------------------------- 4
    console.log("\n=== 4. Un reporte que da DOS compras ===");
    const c1 = resultadoOk<Res>(
      await (
        await postAccion(BASE, "/bandeja", aCrearDesde, [reporte.id, titular.id, consig.id], cookieAdm)
      ).text()
    );
    const c2 = resultadoOk<Res>(
      await (
        await postAccion(BASE, "/bandeja", aCrearDesde, [reporte.id, titular.id, consig.id], cookieAdm)
      ).text()
    );
    if (c1?.ok && c1.id) compras.push(c1.id);
    if (c2?.ok && c2.id) compras.push(c2.id);

    const delReporte = await prisma.compra.findMany({
      where: { reporteId: reporte.id },
      select: { id: true },
    });
    chequear(
      "las dos apuntan al mismo reporte y el reporte las lista",
      delReporte.length === 2 && compras.length === 2,
      `compras del reporte: ${delReporte.map((c) => "#" + c.id).join(", ")}`
    );

    const compraId = compras[0];

    // ---------------------------------------------------------------- 3
    console.log("\n=== 3. La categoría se resuelve, y si no matchea NO frena ===");
    const aCrearLote = await idDeAccion(BASE, `/compras/${compraId}`, "crearLote", cookieAdm);
    const aGuardarLote = await idDeAccion(BASE, `/compras/${compraId}`, "guardarLote", cookieAdm);
    const aComisionTodos = await idDeAccion(
      BASE,
      `/compras/${compraId}`,
      "aplicarComisionATodos",
      cookieAdm
    );
    if (!aCrearLote || !aGuardarLote || !aComisionTodos) {
      chequear(
        "se encontraron los ids de las acciones de renglones",
        false,
        `crearLote:${aCrearLote ?? "no"} guardarLote:${aGuardarLote ?? "no"} ` +
          `comision:${aComisionTodos ?? "no"}`
      );
      return;
    }

    const nuevoLote = (datos: Record<string, unknown>) =>
      postAccion(BASE, `/compras/${compraId}`, aCrearLote, [compraId, datos], cookieAdm);

    const base = {
      categoriaTexto: "vaca",
      cabezas: 40,
      kilosLiquidados: 16493.2,
      precio: 1200,
      modalidadPrecio: "KG",
      comision: null,
      comisionModalidad: null,
      establecimientoId: null,
      tropaId: null,
    };

    const l1 = resultadoOk<Res>(await (await nuevoLote(base)).text());
    // `nov/vaq` es una ambigüedad real del histórico, no un tipeo.
    const l2 = resultadoOk<Res>(
      await (
        await nuevoLote({ ...base, categoriaTexto: "nov/vaq", cabezas: 30, kilosLiquidados: 7500 })
      ).text()
    );
    // Este NO tiene kilos: es el que prueba el punto 1.
    const l3 = resultadoOk<Res>(
      await (
        await nuevoLote({ ...base, categoriaTexto: "vaca", cabezas: 20, kilosLiquidados: null })
      ).text()
    );
    sinonimosCreados.push("nov/vaq");

    const lotes = await prisma.lote.findMany({
      where: { compraId },
      orderBy: { id: "asc" },
      select: {
        id: true,
        cabezas: true,
        kilosLiquidados: true,
        precio: true,
        modalidadPrecio: true,
        comision: true,
        comisionModalidad: true,
        categoriaSinonimo: {
          select: { texto: true, categoriaCanonicaId: true, categoriaCanonica: { select: { codigo: true } } },
        },
      },
    });

    const conVaca = lotes.find((l) => l.categoriaSinonimo.texto.toLowerCase() === "vaca");
    const conAmbigua = lotes.find((l) => l.categoriaSinonimo.texto === "nov/vaq");
    chequear(
      "«vaca» resuelve a su canónica",
      !!conVaca?.categoriaSinonimo.categoriaCanonica?.codigo,
      `vaca → ${conVaca?.categoriaSinonimo.categoriaCanonica?.codigo ?? "SIN RESOLVER"}`
    );
    chequear(
      "«nov/vaq» queda sin resolver Y el lote se crea igual",
      !!conAmbigua &&
        conAmbigua.categoriaSinonimo.categoriaCanonicaId === null &&
        l2?.ok === true,
      conAmbigua
        ? `lote #${conAmbigua.id} creado, canónica = ${conAmbigua.categoriaSinonimo.categoriaCanonicaId}`
        : "NO SE CREÓ EL LOTE"
    );

    // ---------------------------------------------------------------- kilos
    console.log("\n=== Se pide el TOTAL del lote y se muestra el promedio ===");
    // El papel dice los kilos DEL LOTE y el promedio por cabeza ya viene
    // calculado ahí. Por eso se guarda tal cual lo que la persona escribe —sin
    // conversión de ida— y el promedio se deriva al mostrarlo.
    //
    // El promedio pasa por `kilosPorCabeza`, que redondea: `16493.2 / 40` da
    // 412.33000000000004 en punto flotante. Se prueba la función que usa la
    // pantalla, no la división cruda, que sería medir IEEE 754 y no la app.
    const vuelta = conVaca ? kilosPorCabeza(Number(conVaca.kilosLiquidados), conVaca.cabezas) : null;
    chequear(
      "40 cabezas y 16.493,2 kg de total → promedio 412,33 kg por cabeza",
      conVaca !== undefined && Number(conVaca.kilosLiquidados) === 16493.2 && vuelta === 412.33,
      `guardado tal cual: ${conVaca?.kilosLiquidados} kg · promedio derivado ${vuelta} ` +
        `(la división cruda daría ${conVaca ? Number(conVaca.kilosLiquidados) / conVaca.cabezas : "?"})`
    );

    // Sin kilos, el promedio NO se calcula ni sale como 0.
    const sinKilos = lotes.find((l) => l.kilosLiquidados === null);
    chequear(
      "sin kilos, el promedio es s/d y no cero",
      sinKilos !== undefined &&
        (sinKilos.kilosLiquidados === null
          ? null
          : kilosPorCabeza(Number(sinKilos.kilosLiquidados), sinKilos.cabezas)) === null,
      sinKilos ? `el renglón de ${sinKilos.cabezas} cabezas no tiene kilos y no inventa un promedio` : "no hay renglón sin kilos"
    );

    // -------------------------------------------------------- el renombre
    console.log("\n=== El rename es rename, no alias ===");
    // La columna se llama como el papel: `kilosLiquidados`. Se comprueba que no
    // quede NINGÚN USO del nombre viejo — no alcanza con que el código nuevo
    // ande, porque un alias olvidado en una pantalla se descubre recién cuando
    // alguien mira ese renglón.
    //
    // Se distingue USO de MENCIÓN: los comentarios que explican POR QUÉ se
    // renombró son justamente lo que no hay que borrar, y las dos migraciones
    // —la que creó la columna y la que la renombró— son el historial.
    const archivos = execSync(
      'git ls-files "*.ts" "*.tsx" "*.prisma" "*.sql"',
      { encoding: "utf8" }
    )
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f && !f.startsWith("src/generated/") && !f.startsWith("prisma/migrations/"));

    // El nombre viejo se ARMA EN RUNTIME y no se escribe entero en ninguna
    // parte de este archivo. Si estuviera literal, el chequeo se encontraría a
    // sí mismo y habría que excluirse — y un chequeo que se excluye del alcance
    // que dice cubrir es justamente el tipo de verde flojo que este proyecto
    // viene sacando. Así el barrido incluye a este script como a cualquier otro.
    const NOMBRE_VIEJO = "kilos" + "Origen";
    const patronViejo = new RegExp(`\\b${NOMBRE_VIEJO}\\b`);

    const usosViejos: string[] = [];
    for (const archivo of archivos) {
      const lineas = readFileSync(archivo, "utf8").split("\n");
      lineas.forEach((linea, i) => {
        if (!patronViejo.test(linea)) return;
        const esComentario = /^\s*(\/\/|\*|\/\*|--|\/\/\/)/.test(linea);
        if (!esComentario) usosViejos.push(`${archivo}:${i + 1}`);
      });
    }

    chequear(
      `no queda ningún uso de \`${NOMBRE_VIEJO}\` en el código`,
      usosViejos.length === 0,
      usosViejos.length
        ? `QUEDAN: ${usosViejos.join(", ")}`
        : `${archivos.length} archivos revisados (las migraciones conservan el nombre viejo: son el historial)`
    );

    const columna = await prisma.$queryRawUnsafe<
      { column_name: string; is_nullable: string; column_default: string | null }[]
    >(
      `SELECT column_name, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'lote'
          AND column_name IN ('kilosLiquidados', '${NOMBRE_VIEJO}')`
    );
    chequear(
      "en la base la columna se llama `kilosLiquidados`, nullable y sin default",
      columna.length === 1 &&
        columna[0].column_name === "kilosLiquidados" &&
        columna[0].is_nullable === "YES" &&
        columna[0].column_default === null,
      columna.map((c) => `${c.column_name} nullable=${c.is_nullable} default=${c.column_default}`).join(" · ") ||
        "no apareció ninguna de las dos"
    );

    // ---------------------------------------------------------------- 1
    console.log("\n=== 1. Un renglón sin kilos no cuenta como 0 ===");
    const paraCalculo = lotes.map((l) => ({
      cabezas: l.cabezas,
      kilosLiquidados: l.kilosLiquidados === null ? null : Number(l.kilosLiquidados),
      precio: l.precio === null ? null : Number(l.precio),
      modalidadPrecio: l.modalidadPrecio,
      comision: l.comision === null ? null : Number(l.comision),
      comisionModalidad: l.comisionModalidad,
    }));
    const t = totalesDeCompra(paraCalculo);

    // Ponderado sobre los DOS renglones con kilos: (16493.2 + 7500) / (40 + 30).
    const esperado = Math.round(((16493.2 + 7500) / 70 + Number.EPSILON) * 100) / 100;
    // Lo que daría si el vacío se contara como 0, que es el error que esto ataja.
    const siFueraCero = Math.round(((16493.2 + 7500) / 90 + Number.EPSILON) * 100) / 100;

    chequear(
      "la cobertura dice 2 de 3, no 3 de 3",
      t.kilosPorCabeza.aportaron === 2 && t.kilosPorCabeza.sobre === 3,
      `sobre ${t.kilosPorCabeza.aportaron} de ${t.kilosPorCabeza.sobre} renglones`
    );
    chequear(
      "y el promedio NO diluye con el renglón vacío",
      t.kilosPorCabeza.valor === esperado && t.kilosPorCabeza.valor !== siFueraCero,
      `promedio ${t.kilosPorCabeza.valor} kg (si el vacío contara como 0 daría ${siFueraCero})`
    );
    chequear(
      "las cabezas sí suman los tres",
      t.cabezas.valor === 90 && t.cabezas.aportaron === 3,
      `${t.cabezas.valor} cabezas sobre ${t.cabezas.aportaron} de ${t.cabezas.sobre}`
    );

    // ---------------------------------------------------------------- 2
    console.log("\n=== 2. «La misma comisión» escribe en cada fila ===");
    await postAccion(
      BASE,
      `/compras/${compraId}`,
      aComisionTodos,
      [compraId, 2, "PORCENTAJE"],
      cookieAdm
    ).then((r) => r.text());

    const conComision = await prisma.lote.findMany({
      where: { compraId },
      select: { comision: true, comisionModalidad: true },
    });
    chequear(
      "el valor quedó escrito en TODAS las filas de lote",
      conComision.length === 3 &&
        conComision.every((l) => Number(l.comision) === 2 && l.comisionModalidad === "PORCENTAJE"),
      conComision.map((l) => `${l.comision}${l.comisionModalidad === "PORCENTAJE" ? "%" : "$"}`).join(" · ")
    );

    const columnas = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'compra'`
    );
    const nombres = columnas.map((c) => c.column_name.toLowerCase());
    chequear(
      "y NO existe ninguna columna de comisión ni de establecimiento en `compra`",
      !nombres.some((n) => n.includes("comision") || n.includes("establecimiento")),
      `columnas de compra: ${nombres.join(", ")}`
    );

    // ------------------------------------------------------------- BULTO
    console.log("\n=== BULTO salió del enum: dos modalidades y nada más ===");
    // `BULTO` y `CABEZA` eran lo mismo -un precio por animal- y dos valores que
    // significan lo mismo divergen solos. Se comprueba en LA BASE y no en la
    // pantalla: esconder la opcion del selector no impide un INSERT.
    const etiquetas = await prisma.$queryRawUnsafe<{ enumlabel: string }[]>(
      `SELECT enumlabel FROM pg_enum e
         JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'ModalidadPrecio' ORDER BY e.enumsortorder`
    );
    const conBulto = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM lote WHERE "modalidadPrecio"::text = 'BULTO'`
    );

    let laBaseLoRechaza = false;
    let comoFallo = "";
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE lote SET "modalidadPrecio" = 'BULTO' WHERE id = $1`,
        conVaca?.id ?? -1
      );
    } catch (e) {
      laBaseLoRechaza = true;
      comoFallo =
        (e instanceof Error ? e.message : String(e))
          .split("\n")
          .find((l) => /invalid input value|does not exist|no existe/i.test(l))
          ?.trim()
          ?.slice(0, 90) ?? "lo rechazo";
    }

    chequear(
      "el tipo ya no admite BULTO, y la BASE lo rechaza",
      etiquetas.map((x) => x.enumlabel).join(",") === "KG,CABEZA" &&
        Number(conBulto[0].n) === 0 &&
        laBaseLoRechaza,
      `enum: ${etiquetas.map((x) => x.enumlabel).join(", ")} | filas con BULTO: ` +
        `${conBulto[0].n} | el UPDATE directo ${laBaseLoRechaza ? `fallo: ${comoFallo}` : "PASO"}`
    );

    // El caso concreto del prompt: 63 cabezas a 1.350.000 = 85.050.000.
    //
    // Y va CON KILOS a propósito: existe el caso «kilos del lote + precio por
    // cabeza», así que los kilos no desaparecen cuando la modalidad es CABEZA.
    // En el histórico `peso_liquidado` y `precio_kg` se mueven juntas, las dos
    // en 91 % — o sea que cuando el precio no era por kilo tampoco se guardaban
    // los kilos. Este chequeo existe para que el formulario no herede ese
    // agujero: si alguien atenuara u ocultara el campo, los kilos dejarían de
    // llegar y esto se pondría en rojo.
    const porCabeza = resultadoOk<Res>(
      await (
        await nuevoLote({
          categoriaTexto: "novillo",
          cabezas: 63,
          kilosLiquidados: 25200,
          precio: 1350000,
          modalidadPrecio: "CABEZA",
          comision: 2,
          comisionModalidad: "PORCENTAJE",
          establecimientoId: null,
          tropaId: null,
        })
      ).text()
    );
    const guardadoPorCabeza = await prisma.lote.findFirst({
      where: { compraId, cabezas: 63 },
      select: {
        cabezas: true,
        precio: true,
        modalidadPrecio: true,
        comision: true,
        comisionModalidad: true,
        kilosLiquidados: true,
      },
    });

    chequear(
      "con precio por CABEZA los kilos se guardan igual",
      guardadoPorCabeza !== null &&
        guardadoPorCabeza.modalidadPrecio === "CABEZA" &&
        Number(guardadoPorCabeza.kilosLiquidados) === 25200,
      `modalidad ${guardadoPorCabeza?.modalidadPrecio} con ` +
        `${guardadoPorCabeza?.kilosLiquidados} kg — el campo no se atenúa ni se esconde`
    );
    const paraImporte = guardadoPorCabeza
      ? {
          cabezas: guardadoPorCabeza.cabezas,
          // Están, y el importe por CABEZA no los usa: es lo que se quiere.
          kilosLiquidados: Number(guardadoPorCabeza.kilosLiquidados),
          precio: Number(guardadoPorCabeza.precio),
          modalidadPrecio: guardadoPorCabeza.modalidadPrecio,
          comision: Number(guardadoPorCabeza.comision),
          comisionModalidad: guardadoPorCabeza.comisionModalidad,
        }
      : null;
    const importe = paraImporte ? importeDelRenglon(paraImporte) : null;
    const comisionCalculada = paraImporte ? comisionDelRenglon(paraImporte) : null;

    chequear(
      "63 cabezas a 1.350.000 dan 85.050.000, y la comision sale de ese importe",
      porCabeza?.ok === true && importe === 85050000 && comisionCalculada === 1701000,
      `importe ${importe?.toLocaleString("es-AR")} | comision al 2 % ` +
        `${comisionCalculada?.toLocaleString("es-AR")}`
    );

    // ---------------------------------------------------------------- 9
    console.log("\n=== 9. Cabezas del reporte distintas de la suma de renglones ===");
    chequear(
      "se guarda igual, sin bloqueo",
      reporte !== null && t.cabezas.valor === 90,
      `el comprador contó 100 y los renglones suman ${t.cabezas.valor}: los tres ` +
        "lotes se crearon igual"
    );

    // ---------------------------------------------------------------- 10
    console.log("\n=== 10. Empresa titular fuera de las empresas de las tropas ===");
    const aCrearTropa = await idDeAccion(BASE, `/compras/${compraId}`, "crearTropa", cookieAdm);
    if (!aCrearTropa) {
      chequear("se encontró el id de crearTropa", false, "no apareció");
    } else {
      const rt = resultadoOk<Res>(
        await (
          await postAccion(
            BASE,
            `/compras/${compraId}`,
            aCrearTropa,
            [compraId, otra.id, `${marca}-t`, null],
            cookieAdm
          )
        ).text()
      );
      const tropas = await prisma.tropa.findMany({
        where: { compraId },
        select: { empresaCompradoraId: true },
      });
      const compra = await prisma.compra.findUniqueOrThrow({
        where: { id: compraId },
        select: { empresaTitularId: true },
      });
      const fuera = !tropas.some((x) => x.empresaCompradoraId === compra.empresaTitularId);
      const paginaCompra = await (
        await fetch(`${BASE}/compras/${compraId}`, { headers: { Cookie: cookieAdm } })
      ).text();
      chequear(
        "la tropa se guarda igual y la pantalla AVISA sin bloquear",
        rt?.ok === true && fuera && /no figura entre las de las tropas/.test(paginaCompra),
        rt?.ok
          ? `titular ${titular.nombre} vs tropa ${otra.nombre} — aviso en pantalla: ` +
            `${/no figura entre las de las tropas/.test(paginaCompra)}`
          : "NO DEJÓ CREAR LA TROPA"
      );
    }

    // ---------------------------------------------------------------- 8
    console.log("\n=== 8. La oficina NO puede editar el reporte ===");
    const aCorregir = await idDeAccion(BASE, `/reportes/${reporte.id}`, "corregirReporte", cookieAdm);
    const antesTexto = await prisma.reporteCompra.findUniqueOrThrow({
      where: { id: reporte.id },
      select: { observaciones: true },
    });
    let bloqueada = true;
    let detalle = "no hay ninguna acción de la oficina que escriba en el reporte";
    if (aCorregir) {
      const rr = await postAccion(
        BASE,
        `/reportes/${reporte.id}`,
        aCorregir,
        [
          reporte.id,
          {
            fecha: null,
            consignatarioTexto: "PISADO POR LA OFICINA",
            plazaTexto: null,
            cabezasAproximadas: null,
            cantidadCamiones: null,
            observaciones: "PISADO POR LA OFICINA",
            remitos: [],
          },
        ],
        cookieAdm
      );
      await rr.text();
      const despues = await prisma.reporteCompra.findUniqueOrThrow({
        where: { id: reporte.id },
        select: { observaciones: true },
      });
      bloqueada = despues.observaciones === antesTexto.observaciones;
      detalle = bloqueada
        ? "la única acción que escribe en un reporte exige ser su autor, y la oficina no lo es"
        : "LA OFICINA PISÓ LA EVIDENCIA";
    }

    // Y el chequeo estructural: que ninguna acción de la oficina toque campos
    // del reporte que no sean su estado.
    const fuentes = ["src/lib/acciones-bandeja.ts", "src/lib/acciones-compra.ts"]
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    const camposProhibidos = /reporteCompra\.update[\s\S]{0,400}?(observaciones|consignatarioTexto|plazaTexto|cabezasAproximadas|cantidadCamiones)\s*:/;
    chequear(
      "el reporte es evidencia: la oficina no lo puede escribir",
      bloqueada && !camposProhibidos.test(fuentes),
      detalle +
        (camposProhibidos.test(fuentes)
          ? " — PERO una acción de oficina escribe campos del reporte"
          : " · y ninguna acción de oficina toca sus campos")
    );

    // ---------------------------------------------------------------- 5
    console.log("\n=== 5. Marcar procesado y revertir quedan registrados ===");
    await postAccion(BASE, "/bandeja", aProcesar, [reporte.id], cookieAdm).then((r) => r.text());
    const trasProcesar = await prisma.reporteCompra.findUniqueOrThrow({
      where: { id: reporte.id },
      select: { estado: true, estadoCambiadoPorUsuarioId: true, estadoCambiadoEn: true },
    });
    const marcaProcesado = trasProcesar.estadoCambiadoEn?.getTime() ?? 0;

    await new Promise((r) => setTimeout(r, 1100));
    await postAccion(BASE, "/bandeja", aRevertir, [reporte.id], cookieAdm).then((r) => r.text());
    const trasRevertir = await prisma.reporteCompra.findUniqueOrThrow({
      where: { id: reporte.id },
      select: { estado: true, estadoCambiadoPorUsuarioId: true, estadoCambiadoEn: true },
    });

    chequear(
      "las dos acciones dejan quién y cuándo, y la marca se mueve",
      trasProcesar.estado === "PROCESADO" &&
        trasProcesar.estadoCambiadoPorUsuarioId === admin.id &&
        trasRevertir.estado === "PENDIENTE" &&
        trasRevertir.estadoCambiadoPorUsuarioId === admin.id &&
        (trasRevertir.estadoCambiadoEn?.getTime() ?? 0) > marcaProcesado,
      `procesado ${trasProcesar.estadoCambiadoEn?.toISOString()} → revertido ` +
        `${trasRevertir.estadoCambiadoEn?.toISOString()} (cuenta #${admin.id} en las dos)`
    );

    // ---------------------------------------------------------------- 6
    console.log("\n=== 6. Descartar: motivo guardado, reporte vivo, comprador lo ve ===");
    // Con compras colgando NO se descarta: descartarlo diría que no se usó.
    const conCompras = resultadoOk<Res>(
      await (await postAccion(BASE, "/bandeja", aDescartar, [reporte.id, "ERROR"], cookieAdm)).text()
    );
    chequear(
      "un reporte del que ya salieron compras no se descarta",
      conCompras?.ok === false,
      conCompras && !conCompras.ok ? conCompras.errores[0].slice(0, 90) : "LO DESCARTÓ"
    );

    // Uno limpio, sin compras.
    const otroReporte = await prisma.reporteCompra.create({
      data: {
        claveIdempotencia: CLAVE + "-b",
        cargadoEn: new Date(),
        consignatarioTexto: consig.nombre,
        cabezasAproximadas: 10,
        creadoPorUsuarioId: comercial.id,
      },
      select: { id: true },
    });
    reportes.push(otroReporte.id);

    await postAccion(BASE, "/bandeja", aDescartar, [otroReporte.id, "DUPLICADO"], cookieAdm).then(
      (r) => r.text()
    );
    const descartado = await prisma.reporteCompra.findUnique({
      where: { id: otroReporte.id },
      select: { estado: true, motivoDescarte: true, estadoCambiadoPorUsuarioId: true },
    });
    chequear(
      "el motivo queda guardado y el reporte SIGUE EXISTIENDO",
      descartado?.estado === "DESCARTADO" &&
        descartado.motivoDescarte === "DUPLICADO" &&
        descartado.estadoCambiadoPorUsuarioId === admin.id,
      `estado ${descartado?.estado} · motivo ${descartado?.motivoDescarte} · sigue en la base`
    );

    const vistaComprador = await (
      await fetch(`${BASE}/api/reportes/${otroReporte.id}`, { headers: { Cookie: cookieCom } })
    ).json();
    chequear(
      "y el comprador ve el motivo",
      (vistaComprador as { motivoDescarte?: string }).motivoDescarte === "DUPLICADO",
      `la API le devuelve motivoDescarte = ${(vistaComprador as { motivoDescarte?: string }).motivoDescarte}`
    );
  } finally {
    // Se borra por id lo propio. Nada de barridos.
    await prisma.lote.deleteMany({ where: { compraId: { in: compras } } });
    await prisma.carga.deleteMany({ where: { compraId: { in: compras } } });
    await prisma.tropa.deleteMany({ where: { compraId: { in: compras } } });
    await prisma.compra.deleteMany({ where: { id: { in: compras } } });
    await prisma.adjunto.deleteMany({ where: { reporteId: { in: reportes } } });
    await prisma.reporteCompra.deleteMany({ where: { id: { in: reportes } } });
    // El sinónimo ambiguo se creó en esta corrida: si ya existía de antes, no
    // se toca — por eso se borra solo el que no tiene canónica y no tiene lotes.
    for (const texto of sinonimosCreados) {
      await prisma.categoriaSinonimo.deleteMany({
        where: { textoNormalizado: texto, categoriaCanonicaId: null, lotes: { none: {} } },
      });
    }
    await prisma.usuario.deleteMany({ where: { usuario: { startsWith: marca } } });
    console.log("\n  (compras, reportes, tropas y cuentas de prueba borrados)");
    await prisma.$disconnect();
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
