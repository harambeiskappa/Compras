/**
 * Verificación de auth: los siete puntos del prompt.
 *
 * Corre contra el servidor de verdad (por defecto local; con --produccion, el
 * de Vercel) y hace POST directo a las server actions, salteando la pantalla.
 * Es la única forma de comprobar que el permiso vive en el servidor: esconder
 * un botón no es un permiso.
 *
 * Crea una cuenta COMERCIAL de prueba y la borra al final.
 *
 * Correr:  npx tsx scripts/verificar-auth.ts
 *          npx tsx scripts/verificar-auth.ts --produccion
 */
import { createRequire } from "node:module";

import { config as loadEnv } from "dotenv";

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

/**
 * Extrae el id de una server action del bundle servido.
 *
 * Necesita una cookie de ADMINISTRATIVO porque la ruta está protegida: sin ella
 * el proxy devuelve el login y ahí no está el bundle que se busca. Eso mismo ya
 * dice algo — la ruta no es accesible sin sesión.
 */
async function idDeAccion(
  ruta: string,
  nombre: string,
  cookie: string
): Promise<string | null> {
  const html = await (
    await fetch(`${BASE}${ruta}`, { headers: { Cookie: cookie }, redirect: "manual" })
  ).text();
  const chunks = [...html.matchAll(/\/_next\/static\/[^"']+\.js/g)].map((m) => m[0]);
  for (const c of [...new Set(chunks)]) {
    const js = await (await fetch(`${BASE}${c}`)).text();
    const m = js.match(new RegExp(`"([0-9a-f]{40,})"[^)]{0,120}${nombre}`));
    if (m) return m[1];
  }
  return null;
}

async function postAccion(ruta: string, accion: string, args: unknown[], cookie?: string) {
  return fetch(`${BASE}${ruta}`, {
    method: "POST",
    headers: {
      "Next-Action": accion,
      "Content-Type": "text/plain;charset=UTF-8",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(args),
    redirect: "manual",
  });
}

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { hashearPassword } = await import("@/lib/password");
  const { firmarSesion, COOKIE_SESION } = await import("@/lib/sesion");

  console.log(`\nContra: ${BASE}\n`);

  // --- cuentas de prueba ---
  const marca = "prueba-auth-" + Date.now();
  const comercial = await prisma.usuario.create({
    data: {
      usuario: marca,
      nombre: "Comercial de prueba",
      hashPassword: await hashearPassword("no-importa-12345"),
      rol: "COMERCIAL",
    },
    select: { id: true },
  });
  const inactivo = await prisma.usuario.create({
    data: {
      usuario: marca + "-off",
      nombre: "Cuenta desactivada",
      hashPassword: await hashearPassword("no-importa-12345"),
      rol: "ADMINISTRATIVO",
      activo: false,
    },
    select: { id: true },
  });

  const admin = await prisma.usuario.findFirstOrThrow({
    where: { rol: "ADMINISTRATIVO", activo: true },
    select: { id: true },
  });
  const cookieAdmin = `${COOKIE_SESION}=${await firmarSesion(admin.id)}`;
  const cookieComercial = `${COOKIE_SESION}=${await firmarSesion(comercial.id)}`;
  const cookieInactivo = `${COOKIE_SESION}=${await firmarSesion(inactivo.id)}`;

  const firmada = await firmarSesion(comercial.id);
  // Un byte de la firma cambiado: el payload queda igual, la firma no valida.
  const ultima = firmada.slice(-1);
  const alterada = firmada.slice(0, -1) + (ultima === "A" ? "B" : "A");
  const cookieAlterada = `${COOKIE_SESION}=${alterada}`;

  try {
    const accion = await idDeAccion("/compras/nueva", "crearCompra", cookieAdmin);
    if (!accion) {
      chequear("se encontró el id de crearCompra en el bundle", false, "no apareció");
    } else {
      const consig = await prisma.entidad.findFirstOrThrow({
        where: { roles: { some: { rol: "CONSIGNATARIO" } } },
        select: { id: true },
      });
      const emp = await prisma.entidad.findFirstOrThrow({
        where: { esPropio: true },
        select: { id: true },
      });
      const datos = [
        {
          fecha: "2026-08-28",
          consignatarioId: consig.id,
          empresaTitularId: emp.id,
          vendedorId: null,
          hoteleroId: null,
          personaCompradoraId: null,
          plazaLugar: null,
          observaciones: null,
        },
      ];
      const antes = await prisma.compra.count();

      // ---------------------------------------------------------------- 1
      console.log("=== 1. POST directo con cookie de COMERCIAL ===");
      const r1 = await postAccion("/compras/nueva", accion, datos, cookieComercial);
      const t1 = await r1.text();
      const creo1 = (await prisma.compra.count()) > antes;
      chequear(
        "rechazada",
        !creo1 && /ok":false|ADMINISTRATIVO|COMERCIAL/.test(t1),
        creo1 ? "CREÓ LA COMPRA" : (t1.match(/\{"ok":false[^}]*\}/)?.[0] ?? "no creó nada"),
      );

      // ---------------------------------------------------------------- 2
      console.log("\n=== 2. POST directo SIN cookie ===");
      const r2 = await postAccion("/compras/nueva", accion, datos);
      const t2 = await r2.text();
      const creo2 = (await prisma.compra.count()) > antes;
      chequear(
        "rechazada",
        !creo2,
        creo2 ? "CREÓ LA COMPRA" : `HTTP ${r2.status}, ${t2.match(/\{"ok":false[^}]*\}/)?.[0] ?? "sin crear"}`,
      );

      // ---------------------------------------------------------------- 3
      console.log("\n=== 3. Firma alterada en un byte ===");
      const r3 = await postAccion("/compras/nueva", accion, datos, cookieAlterada);
      const creo3 = (await prisma.compra.count()) > antes;
      chequear(
        "rechazada",
        !creo3,
        creo3 ? "CREÓ LA COMPRA" : `HTTP ${r3.status}, sin crear`,
      );

      // ---------------------------------------------------------------- 4
      console.log("\n=== 4. Cuenta activo=false con cookie válida ===");
      const r4 = await postAccion("/compras/nueva", accion, datos, cookieInactivo);
      const creo4 = (await prisma.compra.count()) > antes;
      chequear(
        "rechazada",
        !creo4,
        creo4 ? "CREÓ LA COMPRA" : `HTTP ${r4.status}, sin crear`,
      );
    }

    // ---------------------------------------------------------------- 5
    console.log("\n=== 5. La sesión sobrevive a cerrar el navegador ===");
    const { leerSesion, DURACION_SESION } = await import("@/lib/sesion");
    const leida = await leerSesion(firmada);
    const dias = leida ? (leida.exp - Math.floor(Date.now() / 1000)) / 86400 : 0;
    chequear(
      "la cookie es persistente y dura 30 días",
      !!leida && dias > 29,
      `vence en ${dias.toFixed(1)} días (maxAge=${DURACION_SESION}s). La cookie ` +
        "tiene maxAge, no es de sesión: cerrar el navegador no la borra.",
    );

    // ---------------------------------------------------------------- 6
    console.log("\n=== 6. La app responde sin credenciales de Vercel ===");
    const r6 = await fetch(`${BASE}/api/salud`, { redirect: "manual" });
    const cuerpo = await r6.text();
    const aVercel = (r6.headers.get("location") ?? "").includes("vercel.com");
    chequear(
      "/api/salud responde 200 y no redirige a vercel.com",
      r6.status === 200 && !aVercel && cuerpo.includes('"ok":true'),
      `HTTP ${r6.status}${aVercel ? " -> " + r6.headers.get("location") : ""} ${cuerpo.slice(0, 40)}`,
    );

    const r6b = await fetch(`${BASE}/compras`, { redirect: "manual" });
    const loc = r6b.headers.get("location") ?? "";
    chequear(
      "una ruta protegida sin sesión va a /ingresar, no a vercel.com",
      !loc.includes("vercel.com"),
      `HTTP ${r6b.status} -> ${loc || "(sin redirect)"}`,
    );

    // ---------------------------------------------------------------- 7
    console.log("\n=== 7. El hash no sale por HTTP ===");
    const paginas = ["/ingresar", "/compras", "/compras/nueva"];
    const conHash = await prisma.usuario.findFirstOrThrow({
      where: { rol: "ADMINISTRATIVO", activo: true },
      select: { hashPassword: true },
    });
    const trozo = conHash.hashPassword.split("$")[2].slice(0, 24);
    let filtrado: string | null = null;
    for (const ruta of paginas) {
      const cuerpo = await (
        await fetch(`${BASE}${ruta}`, { headers: { Cookie: cookieAdmin }, redirect: "manual" })
      ).text();
      if (cuerpo.includes(trozo) || cuerpo.includes("hashPassword")) filtrado = ruta;
    }
    chequear(
      "ni el hash ni la palabra hashPassword aparecen en el HTML servido",
      filtrado === null,
      filtrado ? `APARECE EN ${filtrado}` : `revisadas: ${paginas.join(", ")}`,
    );
  } finally {
    await prisma.usuario.deleteMany({ where: { usuario: { startsWith: marca } } });
    console.log("\n  (cuentas de prueba borradas)");
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
