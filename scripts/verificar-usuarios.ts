/**
 * Verificación de la administración de usuarios: los siete puntos del prompt
 * `docs/prompt-usuarios-y-arreglo-login.md`.
 *
 * Corre contra el servidor de verdad (por defecto local; con --produccion, el
 * de Vercel) y hace POST directo a las server actions, salteando la pantalla.
 * Es la única forma de comprobar que el permiso vive en el servidor: esconder
 * una pantalla no es un permiso.
 *
 * LAS COOKIES SE OBTIENEN ENTRANDO POR EL LOGIN, no firmándolas acá. El porqué
 * está en `scripts/login-http.ts`, y es lo que permite que esto corra contra
 * producción: el secreto de firma es Sensitive en Vercel y no se puede leer.
 *
 * Crea cuentas de prueba y las borra al final. NO toca ninguna cuenta real: el
 * único punto que necesita el estado «queda un solo administrativo activo» lo
 * monta dentro de una transacción que después revierte.
 *
 * Correr:  npx tsx scripts/verificar-usuarios.ts
 *          npx tsx scripts/verificar-usuarios.ts --produccion
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

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { hashearPassword, verificarPassword } = await import("@/lib/password");
  const { otrosAdminsActivos } = await import("@/lib/usuarios");

  console.log(`\nContra: ${BASE}\n`);

  const marca = "prueba-usu-" + Date.now();
  const USUARIO_ADM = marca + "-adm";
  const USUARIO_COM = marca + "-com";
  const PASS_1 = "contrasena-de-prueba-1";
  const PASS_2 = "contrasena-de-prueba-2";

  // Un COMERCIAL, para probar que la acción le rebota.
  const comercial = await prisma.usuario.create({
    data: {
      usuario: USUARIO_COM,
      nombre: "Comercial de prueba",
      hashPassword: await hashearPassword(PASS_1),
      rol: "COMERCIAL",
    },
    select: { id: true },
  });

  // Un ADMINISTRATIVO de prueba: es el que se intenta desactivar a sí mismo.
  // Nunca se toca una cuenta real, ni hace falta saber su contraseña.
  const adminPrueba = await prisma.usuario.create({
    data: {
      usuario: USUARIO_ADM,
      nombre: "Administrativo de prueba",
      hashPassword: await hashearPassword(PASS_1),
      rol: "ADMINISTRATIVO",
    },
    select: { id: true },
  });

  try {
    const cookieAdmin = (await cookiePorLogin(BASE, USUARIO_ADM, PASS_1)).cookie;
    const cookieComercial = (await cookiePorLogin(BASE, USUARIO_COM, PASS_1)).cookie;

    const accionCrear = await idDeAccion(BASE, "/usuarios", "crearUsuario", cookieAdmin);
    const accionActivo = await idDeAccion(BASE, "/usuarios", "cambiarActivo", cookieAdmin);
    const accionPass = await idDeAccion(BASE, "/mi-cuenta", "cambiarMiPassword", cookieAdmin);

    if (!accionCrear || !accionActivo || !accionPass) {
      chequear(
        "se encontraron los ids de las acciones en el bundle",
        false,
        `crearUsuario:${accionCrear ?? "no"} cambiarActivo:${accionActivo ?? "no"} ` +
          `cambiarMiPassword:${accionPass ?? "no"}`
      );
    } else {
      // -------------------------------------------------------------- 1
      console.log("=== 1. POST directo a crearUsuario con cookie de COMERCIAL ===");
      const intruso = marca + "-intruso";
      const r1 = await postAccion(
        "/usuarios",
        accionCrear,
        [
          {
            usuario: intruso,
            nombre: "No debería existir",
            rol: "ADMINISTRATIVO",
            entidadId: null,
            password: "una-contrasena-larga",
          },
        ],
        cookieComercial
      );
      const t1 = await r1.text();
      const creo1 = (await prisma.usuario.count({ where: { usuario: intruso } })) > 0;
      chequear(
        "rechazada, y no creó la cuenta",
        !creo1 && /ADMINISTRATIVO/.test(t1) && /COMERCIAL/.test(t1),
        creo1 ? "CREÓ LA CUENTA" : (t1.match(/Esta acci[^"]{0,90}/)?.[0] ?? "sin crear")
      );

      // -------------------------------------------------------------- 2
      console.log("\n=== 2. Un administrativo desactivándose a sí mismo ===");
      const r2 = await postAccion(
        "/usuarios",
        accionActivo,
        [adminPrueba.id, false],
        cookieAdmin
      );
      const t2 = await r2.text();
      const sigueActivo = await prisma.usuario.findUnique({
        where: { id: adminPrueba.id },
        select: { activo: true },
      });
      chequear(
        "rechazada, con mensaje, y la cuenta sigue activa",
        sigueActivo?.activo === true && /propia cuenta/.test(t2),
        sigueActivo?.activo
          ? (t2.match(/Nadie puede[^"]{0,80}/)?.[0] ?? "rechazada")
          : "SE DESACTIVÓ A SÍ MISMO"
      );

      // -------------------------------------------------------------- 4
      console.log("\n=== 4. Contraseña de menos de 12 caracteres ===");
      const corta = marca + "-corta";
      const r4 = await postAccion(
        "/usuarios",
        accionCrear,
        [
          {
            usuario: corta,
            nombre: "Contraseña corta",
            rol: "COMERCIAL",
            entidadId: null,
            password: "corta",
          },
        ],
        cookieAdmin
      );
      const t4 = await r4.text();
      const creo4 = (await prisma.usuario.count({ where: { usuario: corta } })) > 0;
      chequear(
        "rechazada, y no creó la cuenta",
        !creo4 && /al menos 12 caracteres/.test(t4),
        creo4 ? "CREÓ LA CUENTA" : "el mínimo lo pone validarPassword, no el formulario"
      );

      // -------------------------------------------------------------- 5
      console.log("\n=== 5. Cambio de la propia contraseña con la actual mal ===");
      const antes5 = await prisma.usuario.findUniqueOrThrow({
        where: { id: adminPrueba.id },
        select: { hashPassword: true },
      });
      const r5 = await postAccion(
        "/mi-cuenta",
        accionPass,
        ["la-que-no-es-1234", PASS_2, PASS_2],
        cookieAdmin
      );
      const t5 = await r5.text();
      const despues5 = await prisma.usuario.findUniqueOrThrow({
        where: { id: adminPrueba.id },
        select: { hashPassword: true },
      });
      chequear(
        "rechazada, y el hash no cambió",
        antes5.hashPassword === despues5.hashPassword && /no es la correcta/.test(t5),
        antes5.hashPassword === despues5.hashPassword
          ? "la contraseña vieja sigue siendo la que vale"
          : "CAMBIÓ LA CONTRASEÑA SIN SABER LA ACTUAL"
      );

      // -------------------------------------------------------------- 6
      console.log("\n=== 6. Sesión vieja después de cambiar la contraseña ===");
      // La cookie la firma el servidor al entrar, así que su `iat` es real. Va
      // un segundo de separación a propósito: `iat` y el corte se comparan en
      // segundos enteros, y sin la espera caen en el mismo y la sesión
      // sobreviviría — con razón, porque se emitió después del cambio.
      const vieja = (await cookiePorLogin(BASE, USUARIO_COM, PASS_1)).cookie;
      const antesDelCambio = await fetch(`${BASE}/compras`, {
        headers: { Cookie: vieja },
        redirect: "manual",
      });
      await esperar(1200);

      const r6 = await postAccion("/mi-cuenta", accionPass, [PASS_1, PASS_2, PASS_2], vieja);
      const t6 = await r6.text();
      const cambio = await verificarPassword(
        PASS_2,
        (
          await prisma.usuario.findUniqueOrThrow({
            where: { id: comercial.id },
            select: { hashPassword: true },
          })
        ).hashPassword
      );

      const despuesDelCambio = await fetch(`${BASE}/compras`, {
        headers: { Cookie: vieja },
        redirect: "manual",
      });
      const destino = despuesDelCambio.headers.get("location") ?? "";

      chequear(
        "el cambio se aplicó",
        cambio,
        cambio ? "la contraseña nueva es la que vale" : `no cambió: ${t6.slice(0, 120)}`
      );
      chequear(
        "la sesión vieja quedó AFUERA, y antes del cambio estaba adentro",
        antesDelCambio.status === 200 &&
          despuesDelCambio.status >= 300 &&
          despuesDelCambio.status < 400 &&
          /\/api\/salir|\/ingresar/.test(destino),
        `antes: HTTP ${antesDelCambio.status} · después: HTTP ` +
          `${despuesDelCambio.status} -> ${destino || "(sin redirect)"}`
      );
      // -------------------------------------------------------------- 8
      console.log("\n=== 8. Reseteo de contraseña por un administrativo ===");
      const accionReset = await idDeAccion(
        BASE,
        "/usuarios",
        "resetearPassword",
        cookieAdmin
      );
      if (!accionReset) {
        chequear("se encontró el id de resetearPassword", false, "no apareció");
      } else {
        // 8a. A un COMERCIAL le rebota POR EL ROL.
        // Se vuelve a entrar: el punto 6 le cambió la contraseña, así que la
        // cookie del principio ya está muerta. Con ésa, el rebote sería por
        // falta de sesión y la prueba estaría probando otra cosa — un verde
        // que no dice lo que dice es peor que un rojo.
        const cookieComercialViva = (await cookiePorLogin(BASE, USUARIO_COM, PASS_2)).cookie;
        const r8a = await postAccion(
          "/usuarios",
          accionReset,
          [comercial.id, "otra-contrasena-larga"],
          cookieComercialViva
        );
        const t8a = await r8a.text();
        const sigueValiendo = await verificarPassword(
          PASS_2,
          (
            await prisma.usuario.findUniqueOrThrow({
              where: { id: comercial.id },
              select: { hashPassword: true },
            })
          ).hashPassword
        );
        chequear(
          "un COMERCIAL con sesión VIVA no puede resetear contraseñas",
          sigueValiendo &&
            r8a.status === 200 &&
            /ADMINISTRATIVO/.test(t8a) &&
            /COMERCIAL/.test(t8a),
          !sigueValiendo
            ? "LE CAMBIÓ LA CONTRASEÑA"
            : r8a.status !== 200
              ? `rebotó con HTTP ${r8a.status}: la sesión no era válida, así que ` +
                "esto no probó el permiso"
              : (t8a.match(/Esta acci[^"]{0,90}/)?.[0] ?? "rechazada")
        );

        // 8b. Contraseña corta: el mismo mínimo que en el alta.
        const r8b = await postAccion(
          "/usuarios",
          accionReset,
          [comercial.id, "corta"],
          cookieAdmin
        );
        const t8b = await r8b.text();
        chequear(
          "el reseteo exige el mismo mínimo de 12 caracteres",
          /al menos 12 caracteres/.test(t8b),
          "un solo criterio, en un solo lugar"
        );

        // 8c. El reseteo funciona Y mata las sesiones viejas de esa persona.
        // La cookie se toma ANTES, con un segundo de separación por la
        // comparación en segundos enteros.
        const PASS_3 = "contrasena-de-prueba-3";
        const viejaDelComercial = (await cookiePorLogin(BASE, USUARIO_COM, PASS_2)).cookie;
        const antes8 = await fetch(`${BASE}/compras`, {
          headers: { Cookie: viejaDelComercial },
          redirect: "manual",
        });
        await esperar(1200);

        await postAccion("/usuarios", accionReset, [comercial.id, PASS_3], cookieAdmin);
        const quedo = await verificarPassword(
          PASS_3,
          (
            await prisma.usuario.findUniqueOrThrow({
              where: { id: comercial.id },
              select: { hashPassword: true },
            })
          ).hashPassword
        );
        const despues8 = await fetch(`${BASE}/compras`, {
          headers: { Cookie: viejaDelComercial },
          redirect: "manual",
        });
        const destino8 = despues8.headers.get("location") ?? "";

        chequear(
          "la contraseña asignada por el administrativo es la que vale",
          quedo,
          quedo ? "entra con la nueva" : "NO SE APLICÓ"
        );
        chequear(
          "y la sesión que esa persona tenía abierta quedó AFUERA",
          antes8.status === 200 &&
            despues8.status >= 300 &&
            despues8.status < 400 &&
            /\/api\/salir|\/ingresar/.test(destino8),
          `antes: HTTP ${antes8.status} · después: HTTP ${despues8.status} -> ` +
            `${destino8 || "(sin redirect)"}`
        );

        // 8d. El administrativo que reseteó NO se echa a sí mismo.
        const sigueAdentro = await fetch(`${BASE}/usuarios`, {
          headers: { Cookie: cookieAdmin },
          redirect: "manual",
        });
        chequear(
          "el administrativo que reseteó sigue adentro",
          sigueAdentro.status === 200,
          `HTTP ${sigueAdentro.status}`
        );
      }
    }

    // ---------------------------------------------------------------- 3
    console.log("\n=== 3. Desactivar al último administrativo activo ===");
    console.log(
      "        La guarda se prueba DENTRO de una transacción que se revierte:\n" +
        "        montar «queda un solo administrativo» commiteado contra la base\n" +
        "        compartida dejaría a las cuentas reales desactivadas si el script\n" +
        "        se muere a mitad."
    );
    const activosAntes = await prisma.usuario.count({
      where: { rol: "ADMINISTRATIVO", activo: true },
    });
    let otros = -1;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.usuario.updateMany({
          where: { rol: "ADMINISTRATIVO", activo: true, id: { not: adminPrueba.id } },
          data: { activo: false },
        });
        otros = await otrosAdminsActivos(tx, adminPrueba.id);
        throw new Error("REVERTIR");
      });
    } catch (e) {
      if (!(e instanceof Error) || e.message !== "REVERTIR") throw e;
    }
    const activosDespues = await prisma.usuario.count({
      where: { rol: "ADMINISTRATIVO", activo: true },
    });
    chequear(
      "con un solo administrativo activo la guarda devuelve 0 (y la baja se corta)",
      otros === 0,
      `otrosAdminsActivos = ${otros}`
    );
    chequear(
      "la transacción se revirtió: las cuentas reales quedaron como estaban",
      activosAntes === activosDespues && activosAntes > 0,
      `administrativos activos antes: ${activosAntes} · después: ${activosDespues}`
    );

    // ---------------------------------------------------------------- 7
    console.log("\n=== 7. El hash no sale por HTTP ===");
    // Se entra de nuevo: el punto 6 cambió la contraseña del comercial, pero el
    // administrativo sigue con la suya. Y se comprueba que las páginas
    // devuelvan 200 de verdad — mirar el hash en un redirect vacío es un verde
    // que no probó nada.
    const cookie7 = (await cookiePorLogin(BASE, USUARIO_ADM, PASS_1)).cookie;
    const paginas = ["/usuarios", "/mi-cuenta", "/compras", "/ingresar"];
    const conHash = await prisma.usuario.findFirstOrThrow({
      where: { rol: "ADMINISTRATIVO", activo: true },
      select: { hashPassword: true },
    });
    const trozo = conHash.hashPassword.split("$")[2].slice(0, 24);
    let filtrado: string | null = null;
    const vacias: string[] = [];
    for (const ruta of paginas) {
      const res = await fetch(`${BASE}${ruta}`, {
        headers: { Cookie: cookie7 },
        redirect: "manual",
      });
      const cuerpo = await res.text();
      // /ingresar con sesión válida rebota a /compras: ahí el 307 es lo correcto.
      if (res.status !== 200 && ruta !== "/ingresar") vacias.push(`${ruta} HTTP ${res.status}`);
      if (cuerpo.includes(trozo) || cuerpo.includes("hashPassword")) filtrado = ruta;
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
