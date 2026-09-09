/**
 * Verificación de la pantalla del comprador y de la máquina del offline.
 *
 * Cubre los puntos del prompt que se pueden probar por HTTP contra el servidor
 * de verdad: idempotencia, resolución del consignatario escrito a mano,
 * permisos por reporte, congelado de un PROCESADO, y que ninguna clave de
 * Supabase esté en el bundle del cliente.
 *
 * Los tres que NECESITAN UN NAVEGADOR —la prueba dura del modo avión, la
 * compresión de la foto y la recarga sin red— están en
 * `scripts/verificar-comprador-navegador.ts`, porque IndexedDB, el canvas y el
 * service worker no existen en Node y fingir que sí sería un verde vacío.
 *
 * Correr:  npx tsx scripts/verificar-comprador.ts
 *          npx tsx scripts/verificar-comprador.ts --produccion
 */
import { createRequire } from "node:module";

import { config as loadEnv } from "dotenv";

import { cookiePorLogin } from "./login-http";

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
const enProduccion = process.argv.includes("--produccion");
const BASE = enProduccion ? PROD : "http://localhost:3000";

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

/** Un JPEG mínimo de verdad, para que el servidor lo acepte como imagen. */
const JPEG_1PX = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
    "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA" +
    "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64"
);

function cuerpoReporte(
  datos: Record<string, unknown>,
  fotos = 0
): FormData {
  const cuerpo = new FormData();
  cuerpo.set("datos", JSON.stringify(datos));
  for (let i = 0; i < fotos; i++) {
    cuerpo.set(
      `foto_${i}`,
      new Blob([new Uint8Array(JPEG_1PX)], { type: "image/jpeg" }),
      `remito-${i}.jpg`
    );
  }
  return cuerpo;
}

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { hashearPassword } = await import("@/lib/password");
  const { normalizarNombre } = await import("@/lib/normalizar");

  console.log(`\nContra: ${BASE}\n`);

  const marca = "prueba-comp-" + Date.now();
  const PASS = "contrasena-de-prueba-1";
  const comercialA = marca + "-a";
  const comercialB = marca + "-b";

  const a = await prisma.usuario.create({
    data: {
      usuario: comercialA,
      nombre: "Comercial A",
      hashPassword: await hashearPassword(PASS),
      rol: "COMERCIAL",
    },
    select: { id: true },
  });
  await prisma.usuario.create({
    data: {
      usuario: comercialB,
      nombre: "Comercial B",
      hashPassword: await hashearPassword(PASS),
      rol: "COMERCIAL",
    },
    select: { id: true },
  });

  const clavesUsadas: string[] = [];
  const entidadesCreadas: string[] = [];

  try {
    const cookieA = (await cookiePorLogin(BASE, comercialA, PASS)).cookie;
    const cookieB = (await cookiePorLogin(BASE, comercialB, PASS)).cookie;

    // ---------------------------------------------------------------- 0
    console.log("=== 0. El catálogo trae lo justo ===");
    const rc = await fetch(`${BASE}/api/catalogos`, { headers: { Cookie: cookieA } });
    const cat = (await rc.json()) as {
      consignatarios: { nombre: string; usos: number }[];
      plazas: string[];
      generadoEn: string;
    };
    const ordenado = cat.consignatarios.every(
      (c, i) => i === 0 || cat.consignatarios[i - 1].usos >= c.usos
    );
    chequear(
      "devuelve consignatarios y plazas, ordenados por uso, con su fecha",
      rc.status === 200 &&
        cat.consignatarios.length > 0 &&
        cat.plazas.length > 0 &&
        ordenado &&
        !!cat.generadoEn,
      `${cat.consignatarios.length} consignatarios · ${cat.plazas.length} plazas · ` +
        `primero: ${cat.consignatarios[0]?.nombre} (${cat.consignatarios[0]?.usos} usos)`
    );
    const sinCookie = await fetch(`${BASE}/api/catalogos`, { redirect: "manual" });
    chequear(
      "y sin sesión no lo entrega",
      sinCookie.status === 401 || (sinCookie.status >= 300 && sinCookie.status < 400),
      `HTTP ${sinCookie.status}`
    );

    // ---------------------------------------------------------------- 2
    console.log("\n=== 2. La misma clave dos veces crea UN reporte ===");
    const clave = crypto.randomUUID();
    clavesUsadas.push(clave);
    const datos = {
      claveIdempotencia: clave,
      cargadoEn: new Date().toISOString(),
      fecha: "2026-09-09",
      consignatarioTexto: "Darwash",
      consignatarioId: null,
      plazaTexto: "Huinca Renanco",
      cabezasAproximadas: 80,
      cantidadCamiones: 1,
      observaciones: "el remito dice VQ, para mí es VA",
      remitos: [{ numero: "A-1", nota: "primera" }],
    };

    const p1 = await fetch(`${BASE}/api/reportes`, {
      method: "POST",
      headers: { Cookie: cookieA },
      body: cuerpoReporte(datos, 1),
    });
    const r1 = (await p1.json()) as { id: number; yaExistia: boolean };

    const p2 = await fetch(`${BASE}/api/reportes`, {
      method: "POST",
      headers: { Cookie: cookieA },
      body: cuerpoReporte(datos, 1),
    });
    const r2 = (await p2.json()) as { id: number; yaExistia: boolean };

    const cuantos = await prisma.reporteCompra.count({
      where: { claveIdempotencia: clave },
    });
    chequear(
      "un solo reporte, y la segunda respuesta devuelve el mismo id",
      cuantos === 1 && r1.id === r2.id && r2.yaExistia === true && p2.status === 200,
      `id ${r1.id} y ${r2.id} · filas: ${cuantos} · yaExistia: ${r2.yaExistia} · ` +
        `HTTP ${p2.status} (un 409 haría que la cola reintente para siempre)`
    );

    const conFotos = await prisma.adjunto.count({ where: { reporteId: r1.id } });
    chequear(
      "y el reenvío no duplicó la foto",
      conFotos === 1,
      `${conFotos} adjunto(s) para un reporte mandado dos veces`
    );

    // ---------------------------------------------------------------- 3
    console.log("\n=== 3. Un consignatario que no estaba en el catálogo ===");
    const nombreNuevo = `Feria de Prueba ${Date.now()}`;
    entidadesCreadas.push(normalizarNombre(nombreNuevo));
    const claveNueva = crypto.randomUUID();
    clavesUsadas.push(claveNueva);

    const p3 = await fetch(`${BASE}/api/reportes`, {
      method: "POST",
      headers: { Cookie: cookieA },
      body: cuerpoReporte({
        ...datos,
        claveIdempotencia: claveNueva,
        consignatarioTexto: nombreNuevo,
        consignatarioId: null,
        remitos: [],
      }),
    });
    const r3 = (await p3.json()) as { id: number };
    const guardado = await prisma.reporteCompra.findUnique({
      where: { id: r3.id },
      select: {
        consignatarioTexto: true,
        consignatario: { select: { nombre: true, nombreNormalizado: true } },
      },
    });
    chequear(
      "llega el nombre escrito y el servidor crea la entidad",
      guardado?.consignatarioTexto === nombreNuevo &&
        guardado?.consignatario?.nombreNormalizado === normalizarNombre(nombreNuevo),
      `texto guardado: "${guardado?.consignatarioTexto}" · entidad: ` +
        `"${guardado?.consignatario?.nombre}"`
    );

    // El mismo nombre con otras mayúsculas desde otro comercial: una sola entidad.
    const claveOtra = crypto.randomUUID();
    clavesUsadas.push(claveOtra);
    await fetch(`${BASE}/api/reportes`, {
      method: "POST",
      headers: { Cookie: cookieB },
      body: cuerpoReporte({
        ...datos,
        claveIdempotencia: claveOtra,
        consignatarioTexto: nombreNuevo.toUpperCase(),
        consignatarioId: null,
        remitos: [],
      }),
    });
    const cuantasEntidades = await prisma.entidad.count({
      where: { nombreNormalizado: normalizarNombre(nombreNuevo) },
    });
    chequear(
      "y el mismo nombre en mayúsculas desde otra cuenta NO crea una segunda",
      cuantasEntidades === 1,
      `${cuantasEntidades} entidad(es) para "${nombreNuevo}" — las junta el unique del normalizado`
    );

    // ---------------------------------------------------------------- 4
    console.log("\n=== 4. Un COMERCIAL pidiendo el reporte de otro ===");
    const propio = await fetch(`${BASE}/api/reportes/${r1.id}`, {
      headers: { Cookie: cookieA },
    });
    const ajeno = await fetch(`${BASE}/api/reportes/${r1.id}`, {
      headers: { Cookie: cookieB },
    });
    chequear(
      "el suyo lo ve, el de otro no",
      propio.status === 200 && ajeno.status === 404,
      `propio HTTP ${propio.status} · ajeno HTTP ${ajeno.status} (404 y no 403: un ` +
        "403 ya confirmaría que ese reporte existe)"
    );

    const lista = await fetch(`${BASE}/api/reportes/mios`, { headers: { Cookie: cookieB } });
    const deB = (await lista.json()) as { reportes: { id: number }[] };
    chequear(
      "y la lista de uno no trae los del otro",
      !deB.reportes.some((x) => x.id === r1.id),
      `B ve ${deB.reportes.length} reporte(s), y el de A no está entre ellos`
    );

    // ---------------------------------------------------------------- 5
    console.log("\n=== 5. Editar un reporte PROCESADO ===");
    await prisma.reporteCompra.update({
      where: { id: r3.id },
      data: { estado: "PROCESADO" },
    });
    const accionCorregir = await (
      await import("./login-http")
    ).idDeAccion(BASE, `/reportes/${r3.id}`, "corregirReporte", cookieA);

    if (!accionCorregir) {
      chequear("se encontró el id de corregirReporte", false, "no apareció en el bundle");
    } else {
      const antes = await prisma.reporteCompra.findUniqueOrThrow({
        where: { id: r3.id },
        select: { plazaTexto: true },
      });
      const res5 = await fetch(`${BASE}/reportes/${r3.id}`, {
        method: "POST",
        headers: {
          "Next-Action": accionCorregir,
          "Content-Type": "text/plain;charset=UTF-8",
          Cookie: cookieA,
        },
        body: JSON.stringify([
          r3.id,
          {
            fecha: "2026-09-09",
            consignatarioTexto: "Otro",
            plazaTexto: "CAMBIADA",
            cabezasAproximadas: 1,
            cantidadCamiones: 1,
            observaciones: "no",
            remitos: [],
          },
        ]),
      });
      const t5 = await res5.text();
      const despues = await prisma.reporteCompra.findUniqueOrThrow({
        where: { id: r3.id },
        select: { plazaTexto: true },
      });
      chequear(
        "rechazado CON EL MOTIVO, y sin cambiar nada",
        antes.plazaTexto === despues.plazaTexto && /congelado/i.test(t5),
        antes.plazaTexto === despues.plazaTexto
          ? (t5.match(/La oficina ya arm[^"]{0,120}/)?.[0] ?? "rechazado")
          : "MODIFICÓ UN REPORTE PROCESADO"
      );

      // Y uno PENDIENTE sí se corrige: si no, «rechaza» no probaría nada.
      const res5b = await fetch(`${BASE}/reportes/${r1.id}`, {
        method: "POST",
        headers: {
          "Next-Action": accionCorregir,
          "Content-Type": "text/plain;charset=UTF-8",
          Cookie: cookieA,
        },
        body: JSON.stringify([
          r1.id,
          {
            fecha: "2026-09-09",
            consignatarioTexto: "Darwash",
            plazaTexto: "CORREGIDA",
            cabezasAproximadas: 90,
            cantidadCamiones: 2,
            observaciones: "corregido",
            remitos: [],
          },
        ]),
      });
      await res5b.text();
      const pendienteCorregido = await prisma.reporteCompra.findUniqueOrThrow({
        where: { id: r1.id },
        select: { plazaTexto: true },
      });
      chequear(
        "y uno PENDIENTE sí se deja corregir",
        pendienteCorregido.plazaTexto === "CORREGIDA",
        `plaza quedó en "${pendienteCorregido.plazaTexto}"`
      );
    }

    // ---------------------------------------------------------------- 7
    console.log("\n=== 7. Ninguna clave de Supabase en el bundle del cliente ===");
    const secretos = [
      process.env.SUPABASE_SECRET_KEY,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      process.env.SUPABASE_JWT_SECRET,
      process.env.SESION_SECRETO,
      process.env.POSTGRES_PASSWORD,
    ].filter((s): s is string => !!s && s.length > 12);

    const paginas = ["/reportar", "/reportes"];
    const revisados: string[] = [];
    let filtrado: string | null = null;

    for (const ruta of paginas) {
      const html = await (
        await fetch(`${BASE}${ruta}`, { headers: { Cookie: cookieA } })
      ).text();
      if (secretos.some((s) => html.includes(s))) filtrado = ruta;
      const chunks = [
        ...new Set([...html.matchAll(/\/_next\/static\/[^"']+\.js/g)].map((m) => m[0])),
      ];
      for (const c of chunks) {
        const js = await (await fetch(`${BASE}${c}`)).text();
        revisados.push(c);
        if (secretos.some((s) => js.includes(s))) filtrado = c;
        // `service_role` en un bundle sería la clave con otro nombre.
        if (/service_role|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE/.test(js)) filtrado = c;
      }
    }
    chequear(
      "ni las claves ni sus nombres aparecen en el HTML ni en los chunks",
      filtrado === null && secretos.length > 0,
      filtrado
        ? `APARECE EN ${filtrado}`
        : `${secretos.length} secretos buscados en ${revisados.length} chunks + 2 páginas`
    );

    // ---------------------------------------------------------------- 7b
    console.log("\n=== 7b. Las cáscaras que cachea el service worker no traen datos ===");
    // El service worker guarda el HTML de /reportar y /reportes en el disco del
    // navegador. Eso SOLO es aceptable mientras ese HTML no traiga nada de la
    // persona: un dato cacheado ahí sobrevive al logout. Si algún día una de
    // esas páginas empieza a renderizar datos en el servidor, este chequeo tiene
    // que ponerse en rojo antes de que el service worker los guarde.
    let conDatos: string | null = null;
    for (const ruta of paginas) {
      const html = await (
        await fetch(`${BASE}${ruta}`, { headers: { Cookie: cookieA } })
      ).text();
      // El nombre de la cuenta y el usuario son lo que el encabezado pondría.
      if (html.includes("Comercial A") || html.includes(comercialA)) conDatos = ruta;
    }
    chequear(
      "el HTML servido no nombra a quien está adentro",
      conDatos === null,
      conDatos
        ? `APARECE EN ${conDatos} — sacala de CASCARAS en public/sw.js`
        : `revisadas: ${paginas.join(", ")} (se buscó el nombre y el usuario de la cuenta)`
    );
  } finally {
    // Se borra lo creado: esto corre contra la base de verdad.
    await prisma.adjunto.deleteMany({
      where: { reporte: { claveIdempotencia: { in: clavesUsadas } } },
    });
    await prisma.reporteCompra.deleteMany({
      where: { claveIdempotencia: { in: clavesUsadas } },
    });
    await prisma.entidadRol.deleteMany({
      where: { entidad: { nombreNormalizado: { in: entidadesCreadas } } },
    });
    await prisma.entidad.deleteMany({
      where: { nombreNormalizado: { in: entidadesCreadas } },
    });
    await prisma.usuario.deleteMany({ where: { usuario: { startsWith: marca } } });
    console.log("\n  (reportes, entidades y cuentas de prueba borrados)");
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
