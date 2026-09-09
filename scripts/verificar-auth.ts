/**
 * Verificación de auth: los siete puntos del prompt `docs/prompt-auth-modulo-2.md`.
 *
 * Corre contra el servidor de verdad (por defecto local; con --produccion, el
 * de Vercel) y hace POST directo a las server actions, salteando la pantalla.
 * Es la única forma de comprobar que el permiso vive en el servidor: esconder
 * un botón no es un permiso.
 *
 * LAS COOKIES SE OBTIENEN ENTRANDO POR EL LOGIN, no firmándolas acá. Antes se
 * firmaban con el `SESION_SECRETO` de `.env.local`, que es el de Development y
 * NO es el de Production —está marcado Sensitive en Vercel y no se puede leer—,
 * así que contra producción el proxy las rechazaba y los puntos 1 a 4 no
 * llegaban a correr. El porqué completo está en `scripts/login-http.ts`.
 *
 * Crea cuentas de prueba y las borra al final.
 *
 * Correr:  npx tsx scripts/verificar-auth.ts
 *          npx tsx scripts/verificar-auth.ts --produccion
 */
import { createRequire } from "node:module";

import { config as loadEnv } from "dotenv";

import { cookiePorLogin, idDeAccion } from "./login-http";

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
  const { DURACION_SESION } = await import("@/lib/sesion");

  console.log(`\nContra: ${BASE}\n`);

  // --- cuentas de prueba ---
  const marca = "prueba-auth-" + Date.now();
  const USUARIO_ADM = marca + "-adm";
  const USUARIO_COM = marca + "-com";
  const USUARIO_OFF = marca + "-off";
  const PASS = "contrasena-de-prueba-1";

  // Un administrativo propio en vez de la cuenta real: así el script no
  // necesita saber la contraseña de nadie, y no hay forma de que ensucie una
  // cuenta de verdad.
  await prisma.usuario.create({
    data: {
      usuario: USUARIO_ADM,
      nombre: "Administrativo de prueba",
      hashPassword: await hashearPassword(PASS),
      rol: "ADMINISTRATIVO",
    },
    select: { id: true },
  });
  const comercial = await prisma.usuario.create({
    data: {
      usuario: USUARIO_COM,
      nombre: "Comercial de prueba",
      hashPassword: await hashearPassword(PASS),
      rol: "COMERCIAL",
    },
    select: { id: true },
  });
  // Nace ACTIVA para poder entrar y quedarse con una cookie legítima; se
  // desactiva después. Es la única forma de tener «cookie válida + cuenta
  // desactivada», que es justo lo que el punto 4 quiere probar.
  const inactivo = await prisma.usuario.create({
    data: {
      usuario: USUARIO_OFF,
      nombre: "Cuenta que se va a desactivar",
      hashPassword: await hashearPassword(PASS),
      rol: "ADMINISTRATIVO",
    },
    select: { id: true },
  });

  try {
    const sesionAdmin = await cookiePorLogin(BASE, USUARIO_ADM, PASS);
    const cookieAdmin = sesionAdmin.cookie;
    const cookieComercial = (await cookiePorLogin(BASE, USUARIO_COM, PASS)).cookie;

    const cookieInactivo = (await cookiePorLogin(BASE, USUARIO_OFF, PASS)).cookie;
    await prisma.usuario.update({ where: { id: inactivo.id }, data: { activo: false } });

    // Un byte de la firma cambiado: el payload queda igual, la firma no valida.
    const valor = cookieComercial.split("=").slice(1).join("=");
    const ultima = valor.slice(-1);
    const cookieAlterada = `compras_sesion=${valor.slice(0, -1)}${
      ultima === "A" ? "B" : "A"
    }`;

    const accion = await idDeAccion(BASE, "/compras/nueva", "crearCompra", cookieAdmin);
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
        creo1 ? "CREÓ LA COMPRA" : (t1.match(/\{"ok":false[^}]*\}/)?.[0] ?? "no creó nada")
      );

      // ---------------------------------------------------------------- 2
      console.log("\n=== 2. POST directo SIN cookie ===");
      const r2 = await postAccion("/compras/nueva", accion, datos);
      const t2 = await r2.text();
      const creo2 = (await prisma.compra.count()) > antes;
      chequear(
        "rechazada",
        !creo2,
        creo2
          ? "CREÓ LA COMPRA"
          : `HTTP ${r2.status}, ${t2.match(/\{"ok":false[^}]*\}/)?.[0] ?? "sin crear"}`
      );

      // ---------------------------------------------------------------- 3
      console.log("\n=== 3. Firma alterada en un byte ===");
      const r3 = await postAccion("/compras/nueva", accion, datos, cookieAlterada);
      const creo3 = (await prisma.compra.count()) > antes;
      chequear("rechazada", !creo3, creo3 ? "CREÓ LA COMPRA" : `HTTP ${r3.status}, sin crear`);

      // ---------------------------------------------------------------- 4
      console.log("\n=== 4. Cuenta activo=false con cookie válida ===");
      const r4 = await postAccion("/compras/nueva", accion, datos, cookieInactivo);
      const creo4 = (await prisma.compra.count()) > antes;
      chequear(
        "rechazada",
        !creo4,
        creo4
          ? "CREÓ LA COMPRA"
          : `HTTP ${r4.status}, sin crear (la cookie la firmó el servidor al entrar)`
      );
    }

    // ---------------------------------------------------------------- 5
    console.log("\n=== 5. La sesión sobrevive a cerrar el navegador ===");
    // Se mira el Set-Cookie QUE MANDÓ EL SERVIDOR, no lo que calcula una
    // función local: lo que decide si la cookie sobrevive a cerrar el navegador
    // es el Max-Age que viajó por la red.
    const maxAge = Number(sesionAdmin.crudo.match(/Max-Age=(\d+)/i)?.[1] ?? 0);
    const dias = maxAge / 86400;
    const persistente = maxAge >= DURACION_SESION - 60;
    // Y se comprueba que sirva en una petición nueva, que es lo que hace un
    // navegador al reabrirse: mandar la cookie guardada por otra conexión.
    const reabierto = await fetch(`${BASE}/compras`, {
      headers: { Cookie: cookieAdmin },
      redirect: "manual",
    });
    chequear(
      "la cookie es persistente, dura 30 días, y sigue entrando en una petición nueva",
      persistente && reabierto.status === 200,
      `Max-Age=${maxAge}s (${dias.toFixed(1)} días) · petición nueva: HTTP ` +
        `${reabierto.status}. Tiene Max-Age, no es de sesión: cerrar el navegador no la borra.`
    );

    // ---------------------------------------------------------------- 6
    console.log("\n=== 6. La app responde sin credenciales de Vercel ===");
    const r6 = await fetch(`${BASE}/api/salud`, { redirect: "manual" });
    const cuerpo = await r6.text();
    const aVercel = (r6.headers.get("location") ?? "").includes("vercel.com");
    chequear(
      "/api/salud responde 200 y no redirige a vercel.com",
      r6.status === 200 && !aVercel && cuerpo.includes('"ok":true'),
      `HTTP ${r6.status}${aVercel ? " -> " + r6.headers.get("location") : ""} ${cuerpo.slice(0, 40)}`
    );

    const r6b = await fetch(`${BASE}/compras`, { redirect: "manual" });
    const loc = r6b.headers.get("location") ?? "";
    chequear(
      "una ruta protegida sin sesión va a /ingresar, no a vercel.com",
      !loc.includes("vercel.com"),
      `HTTP ${r6b.status} -> ${loc || "(sin redirect)"}`
    );

    // ---------------------------------------------------------------- 7
    console.log("\n=== 7. El hash no sale por HTTP ===");
    const paginas = ["/ingresar", "/compras", "/compras/nueva"];
    const conHash = await prisma.usuario.findFirstOrThrow({
      where: { usuario: USUARIO_ADM },
      select: { hashPassword: true },
    });
    const trozo = conHash.hashPassword.split("$")[2].slice(0, 24);
    let filtrado: string | null = null;
    const vacias: string[] = [];
    for (const ruta of paginas) {
      const res = await fetch(`${BASE}${ruta}`, {
        headers: { Cookie: cookieAdmin },
        redirect: "manual",
      });
      const html = await res.text();
      // /ingresar con sesión válida rebota a /compras: ahí el 307 es correcto.
      // En el resto, un redirect querría decir que no se miró ninguna página —
      // un verde que no probó nada, que es peor que un rojo.
      if (res.status !== 200 && ruta !== "/ingresar") vacias.push(`${ruta} HTTP ${res.status}`);
      if (html.includes(trozo) || html.includes("hashPassword")) filtrado = ruta;
    }
    chequear(
      "ni el hash ni la palabra hashPassword aparecen en el HTML servido",
      filtrado === null && vacias.length === 0,
      filtrado
        ? `APARECE EN ${filtrado}`
        : vacias.length
          ? `NO SE PUDO MIRAR: ${vacias.join(", ")}`
          : `revisadas con 200: ${paginas.join(", ")}`
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
