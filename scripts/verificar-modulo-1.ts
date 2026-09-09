/**
 * Verificación del módulo 1, contra el servidor de verdad.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ENTRA POR EL LOGIN Y LLAMA A LAS ACCIONES POR HTTP.                      │
 * │                                                                          │
 * │ Antes las llamaba en proceso, y eso saltea justo lo que hay que probar:  │
 * │ el proxy, la sesión, la comprobación de rol y la serialización. Además   │
 * │ ata el script a detalles internos que cambian solos — y así se rompió el │
 * │ día que llegó la auth, porque `exigir()` necesita `cookies()` y fuera de │
 * │ una request eso no existe. Estuvo roto ONCE DÍAS sin que nadie lo notara,│
 * │ y en ese tiempo «19 chequeos en verde» dejó de ser un hecho reproducible │
 * │ para pasar a ser una anécdota.                                           │
 * │                                                                          │
 * │ Correrlo por HTTP también prueba algo que antes no se probaba: que estas │
 * │ acciones son de ADMINISTRATIVO y que rebotan sin sesión.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Crea una cuenta y compras de prueba, y BORRA TODO al final: corre contra la
 * única base que hay.
 *
 * Correr:  npx tsx scripts/verificar-modulo-1.ts
 *          npx tsx scripts/verificar-modulo-1.ts --produccion
 */
import { createRequire } from "node:module";

import { config as loadEnv } from "dotenv";

import { cookiePorLogin, idDeAccion, postAccion, resultadoDeAccion, resultadoOk } from "./login-http";

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

type Resultado = { ok: true; id: number } | { ok: false; errores: string[] };
type ResultadoCrear =
  | { ok: true; id: number; nombre: string; yaExistia: boolean }
  | { ok: false; errores: string[] };
type Opcion = { id: number; nombre: string; meta?: string | null };
type EstadoCombo = {
  opciones: Opcion[];
  otras: Opcion[];
  parecidos: Opcion[];
  hayExacto: boolean;
  sePuedeCrear: boolean;
};

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { hashearPassword } = await import("@/lib/password");

  console.log(`\nContra: ${BASE}\n`);

  const marca = "prueba-m1-" + Date.now();
  const PASS = "contrasena-de-prueba-1";
  const PERSONA = `Comprador de Prueba ${Date.now()}`;

  await prisma.usuario.create({
    data: {
      usuario: marca,
      nombre: "Administrativo de prueba",
      hashPassword: await hashearPassword(PASS),
      rol: "ADMINISTRATIVO",
    },
  });

  const creadas: number[] = [];
  const rolesAgregados: { entidadId: number; rol: "HOTELERO" }[] = [];

  try {
    const cookie = (await cookiePorLogin(BASE, marca, PASS)).cookie;

    const aCrearCompra = await idDeAccion(BASE, "/compras/nueva", "crearCompra", cookie);
    const aBuscar = await idDeAccion(BASE, "/compras/nueva", "buscarEntidades", cookie);
    const aCrearEntidad = await idDeAccion(BASE, "/compras/nueva", "crearEntidad", cookie);
    if (!aCrearCompra || !aBuscar || !aCrearEntidad) {
      chequear(
        "se encontraron los ids de las acciones en el bundle",
        false,
        `crearCompra:${aCrearCompra ?? "no"} buscarEntidades:${aBuscar ?? "no"} ` +
          `crearEntidad:${aCrearEntidad ?? "no"}`
      );
      return;
    }

    const crearCompra = async (datos: Record<string, unknown>): Promise<Resultado> => {
      const res = await postAccion(BASE, "/compras/nueva", aCrearCompra, [datos], cookie);
      return (
        resultadoOk<Resultado>(await res.text()) ?? {
          ok: false,
          errores: [`sin resultado legible (HTTP ${res.status})`],
        }
      );
    };
    const crearEntidad = async (nombre: string, rol: string): Promise<ResultadoCrear> => {
      const res = await postAccion(BASE, "/compras/nueva", aCrearEntidad, [nombre, rol], cookie);
      return (
        resultadoOk<ResultadoCrear>(await res.text()) ?? {
          ok: false,
          errores: [`sin resultado legible (HTTP ${res.status})`],
        }
      );
    };
    const buscar = async (rol: string, q: string): Promise<EstadoCombo | null> => {
      const res = await postAccion(BASE, "/compras/nueva", aBuscar, [rol, q], cookie);
      return resultadoDeAccion<EstadoCombo>(
        await res.text(),
        (v) => typeof v === "object" && v !== null && "sePuedeCrear" in v
      );
    };

    // ---------------------------------------------------------------- 1
    console.log("=== 1. Una compra con solo los tres obligatorios ===");
    const consig = await prisma.entidad.findFirstOrThrow({
      where: { roles: { some: { rol: "CONSIGNATARIO" } } },
      select: { id: true, nombre: true },
    });
    const titular = await prisma.entidad.findFirstOrThrow({
      where: { esPropio: true },
      select: { id: true, nombre: true },
    });

    const minima = await crearCompra({
      fecha: "2026-08-20",
      consignatarioId: consig.id,
      empresaTitularId: titular.id,
      vendedorId: null,
      hoteleroId: null,
      personaCompradoraId: null,
      plazaLugar: "",
      observaciones: "",
    });
    chequear(
      "se guarda con fecha + consignatario + empresa titular",
      minima.ok,
      minima.ok
        ? `compra #${minima.id} — ${consig.nombre} / ${titular.nombre}`
        : minima.errores.join(" ")
    );
    if (minima.ok) creadas.push(minima.id);

    // ---------------------------------------------------------------- 1b
    console.log("\n=== 1b. La misma acción SIN sesión ===");
    // Esto es lo que la versión en proceso no podía probar: que la acción
    // rebota sin cookie. Es el chequeo que faltaba justo donde se rompió.
    const antesSinSesion = await prisma.compra.count();
    const sinSesion = await postAccion(BASE, "/compras/nueva", aCrearCompra, [
      {
        fecha: "2026-08-20",
        consignatarioId: consig.id,
        empresaTitularId: titular.id,
        vendedorId: null,
        hoteleroId: null,
        personaCompradoraId: null,
        plazaLugar: null,
        observaciones: null,
      },
    ]);
    chequear(
      "sin cookie no crea nada",
      (await prisma.compra.count()) === antesSinSesion,
      `HTTP ${sinSesion.status}, compras antes y después: ${antesSinSesion}`
    );

    // ---------------------------------------------------------------- 3
    console.log("\n=== 3. Los opcionales vacíos son NULL en la base ===");
    if (minima.ok) {
      const g = await prisma.compra.findUniqueOrThrow({
        where: { id: minima.id },
        select: {
          vendedorId: true,
          hoteleroId: true,
          personaCompradoraId: true,
          plazaLugar: true,
          observaciones: true,
        },
      });
      const todosNulos = Object.values(g).every((v) => v === null);
      chequear(
        "los 5 opcionales quedaron en NULL, no en cadena vacía ni 0",
        todosNulos,
        JSON.stringify(g)
      );
    }

    // ---------------------------------------------------------------- 2
    console.log("\n=== 2. Una compra con todos los campos ===");
    const vend = await prisma.entidad.findFirstOrThrow({
      where: { roles: { some: { rol: "VENDEDOR" } } },
      select: { id: true, nombre: true },
    });
    const hot = await prisma.entidad.findFirstOrThrow({
      where: { roles: { some: { rol: "HOTELERO" } } },
      select: { id: true, nombre: true },
    });
    const persona = await crearEntidad(PERSONA, "PERSONA_COMPRADORA");
    const completa = await crearCompra({
      fecha: "2026-08-21",
      consignatarioId: consig.id,
      empresaTitularId: titular.id,
      vendedorId: vend.id,
      hoteleroId: hot.id,
      personaCompradoraId: persona.ok ? persona.id : null,
      plazaLugar: "WASHINGTON",
      observaciones: "Compra de prueba con todos los campos.",
    });
    chequear(
      "se guarda con los doce campos",
      completa.ok,
      completa.ok ? `compra #${completa.id}` : completa.errores.join(" ")
    );
    if (completa.ok) creadas.push(completa.id);

    // ---------------------------------------------------------------- 4
    console.log("\n=== 4. Validaciones del servidor ===");
    const sinTitular = await crearCompra({
      fecha: "2026-08-22",
      consignatarioId: consig.id,
      empresaTitularId: null,
      vendedorId: null,
      hoteleroId: null,
      personaCompradoraId: null,
      plazaLugar: null,
      observaciones: null,
    });
    chequear(
      "sin empresa titular, el servidor lo rechaza",
      !sinTitular.ok,
      sinTitular.ok ? `SE GUARDÓ #${sinTitular.id}` : sinTitular.errores.join(" ")
    );

    const terceros = await prisma.entidad.findFirst({
      where: { esPropio: false },
      select: { id: true, nombre: true },
    });
    if (terceros) {
      const conTerceros = await crearCompra({
        fecha: "2026-08-22",
        consignatarioId: consig.id,
        empresaTitularId: terceros.id,
        vendedorId: null,
        hoteleroId: null,
        personaCompradoraId: null,
        plazaLugar: null,
        observaciones: null,
      });
      chequear(
        `una empresa de terceros (${terceros.nombre}) no puede ser titular`,
        !conTerceros.ok,
        conTerceros.ok ? "SE GUARDÓ" : conTerceros.errores.join(" ")
      );
    }

    const fechaMala = await crearCompra({
      fecha: "no es una fecha",
      consignatarioId: consig.id,
      empresaTitularId: titular.id,
      vendedorId: null,
      hoteleroId: null,
      personaCompradoraId: null,
      plazaLugar: null,
      observaciones: null,
    });
    chequear(
      "una fecha inválida se rechaza",
      !fechaMala.ok,
      fechaMala.ok ? "SE GUARDÓ" : fechaMala.errores.join(" ")
    );

    // ---------------------------------------------------------------- 5
    console.log("\n=== 5. El selector de empresa titular ===");
    const selEmpresa = await buscar("EMPRESA_COMPRADORA", "");
    const nombresEmpresa = selEmpresa?.opciones.map((e) => e.nombre) ?? [];
    chequear(
      "muestra 7 entidades",
      selEmpresa?.opciones.length === 7,
      `${selEmpresa?.opciones.length}: ${nombresEmpresa.join(", ")}`
    );
    chequear(
      "no incluye Tercio Bravo",
      !nombresEmpresa.includes("Tercio Bravo"),
      nombresEmpresa.includes("Tercio Bravo") ? "LO INCLUYE" : "correcto"
    );
    chequear(
      "no ofrece «otras» ni crear al vuelo",
      selEmpresa?.otras.length === 0,
      `otras: ${selEmpresa?.otras.length}`
    );
    const comboEmpresa = await buscar("EMPRESA_COMPRADORA", "Nueva Empresa Inventada");
    chequear(
      "no se puede crear una empresa desde el formulario",
      comboEmpresa?.sePuedeCrear === false,
      `sePuedeCrear = ${comboEmpresa?.sePuedeCrear}`
    );

    console.log("\n=== 5b. El selector de hotelero ===");
    const selHotel = await buscar("HOTELERO", "");
    const tercioEnHotel = selHotel?.opciones.find((e) => e.nombre === "Tercio Bravo");
    chequear(
      "incluye Tercio Bravo",
      !!tercioEnHotel,
      tercioEnHotel ? `meta: "${tercioEnHotel.meta}"` : "NO LO INCLUYE"
    );
    chequear(
      "y lo marca «de terceros»",
      tercioEnHotel?.meta === "de terceros",
      `meta: "${tercioEnHotel?.meta}"`
    );

    // ---------------------------------------------------------------- 6
    console.log("\n=== 6. El selector de hotelero no lista los vendedores ===");
    const totalVendedores = await prisma.entidad.count({
      where: { roles: { some: { rol: "VENDEDOR" } } },
    });
    chequear(
      "sin búsqueda, solo muestra hoteleros",
      (selHotel?.opciones.length ?? 99) < 20 && selHotel?.otras.length === 0,
      `hoteleros: ${selHotel?.opciones.length}, otras: ${selHotel?.otras.length}, ` +
        `vendedores en el padrón: ${totalVendedores}`
    );
    const buscHotel = await buscar("HOTELERO", "darwash");
    chequear(
      "buscando, las de otro rol aparecen SEPARADAS en «otras»",
      (buscHotel?.otras.length ?? 0) > 0 || (buscHotel?.opciones.length ?? 0) > 0,
      `del rol: ${buscHotel?.opciones.map((e) => e.nombre).join(", ") || "-"} | ` +
        `otras: ${buscHotel?.otras.map((e) => e.nombre).join(", ") || "-"}`
    );

    // ---------------------------------------------------------------- 7
    console.log("\n=== 7. Casi-idéntico por puntuación ===");
    const combo = await buscar("VENDEDOR", "FERIA RODEO HUINCA S.R.L.");
    chequear(
      "«FERIA RODEO HUINCA S.R.L.» con punto ofrece el existente",
      (combo?.parecidos.length ?? 0) > 0,
      combo?.parecidos.length
        ? `parecidos: ${combo.parecidos.map((p) => p.nombre).join(", ")}`
        : "NO detectó ninguno"
    );

    // ---------------------------------------------------------------- 8
    console.log("\n=== 8. Crear uno que ya existe con otras mayúsculas ===");
    const yaExiste = await prisma.entidad.findFirstOrThrow({
      where: { roles: { some: { rol: "VENDEDOR" } } },
      select: { id: true, nombre: true },
    });
    const rep = await crearEntidad(yaExiste.nombre.toUpperCase(), "VENDEDOR");
    chequear(
      "devuelve el existente y no un error de unique",
      rep.ok && rep.id === yaExiste.id && rep.yaExistia,
      rep.ok
        ? `pidió "${yaExiste.nombre.toUpperCase()}" y devolvió #${rep.id} "${rep.nombre}" (yaExistia=${rep.yaExistia})`
        : rep.errores.join(" ")
    );

    // ---------------------------------------------------------------- 9
    console.log("\n=== 9. Elegir en hotelero una entidad que solo era vendedor ===");
    const soloVendedor = await prisma.entidad.findFirst({
      where: {
        roles: { some: { rol: "VENDEDOR" } },
        AND: { roles: { none: { rol: "HOTELERO" } } },
      },
      select: { id: true, nombre: true },
    });

    const aGuardarRol =
      completa.ok
        ? await idDeAccion(BASE, `/compras/${completa.id}`, "guardarRol", cookie)
        : null;

    if (!soloVendedor) {
      chequear("hay una entidad que solo es vendedor", false, "no encontré ninguna");
    } else if (!aGuardarRol) {
      chequear("se encontró el id de guardarRol", false, "no apareció en el bundle del detalle");
    } else if (completa.ok) {
      const antes = await prisma.entidadRol.count({
        where: { entidadId: soloVendedor.id, rol: "HOTELERO" },
      });
      const res = await postAccion(
        BASE,
        `/compras/${completa.id}`,
        aGuardarRol,
        [completa.id, "hotelero", soloVendedor.id],
        cookie
      );
      const r = resultadoOk<Resultado>(await res.text());
      const despues = await prisma.entidadRol.count({
        where: { entidadId: soloVendedor.id, rol: "HOTELERO" },
      });
      if (antes === 0 && despues === 1) {
        rolesAgregados.push({ entidadId: soloVendedor.id, rol: "HOTELERO" });
      }
      chequear(
        `elegir "${soloVendedor.nombre}" como hotelero le agrega el rol`,
        r?.ok === true && antes === 0 && despues === 1,
        `HOTELERO antes=${antes} después=${despues}` +
          (r?.ok ? "" : ` — ${r && !r.ok ? r.errores.join(" ") : `HTTP ${res.status}`}`)
      );

      // ------------------------------------------------------------ s/d
      console.log("\n=== s/d: poner un opcional en NULL desde el detalle ===");
      const resVend = await postAccion(
        BASE,
        `/compras/${completa.id}`,
        aGuardarRol,
        [completa.id, "vendedor", null],
        cookie
      );
      const rv = resultadoOk<Resultado>(await resVend.text());
      const g = await prisma.compra.findUniqueOrThrow({
        where: { id: completa.id },
        select: { vendedorId: true },
      });
      chequear(
        "el vendedor vuelve a NULL",
        rv?.ok === true && g.vendedorId === null,
        `vendedorId = ${g.vendedorId}`
      );

      const resObl = await postAccion(
        BASE,
        `/compras/${completa.id}`,
        aGuardarRol,
        [completa.id, "consignatario", null],
        cookie
      );
      const ro = resultadoOk<Resultado>(await resObl.text());
      chequear(
        "un obligatorio NO se puede poner en s/d",
        ro?.ok === false,
        ro?.ok ? "LO PERMITIÓ" : (ro && !ro.ok ? ro.errores.join(" ") : `HTTP ${resObl.status}`)
      );
    }
  } finally {
    // Se borra TODO lo creado. La versión anterior dejaba las compras cargadas
    // y ofrecía un `--limpiar` que hacía `deleteMany({})`: con compras reales,
    // ese comando es una bomba. Se borra solo lo propio, por id.
    if (creadas.length) {
      await prisma.compra.deleteMany({ where: { id: { in: creadas } } });
    }
    for (const r of rolesAgregados) {
      await prisma.entidadRol.deleteMany({
        where: { entidadId: r.entidadId, rol: r.rol },
      });
    }
    const persona = await prisma.entidad.findFirst({
      where: { nombre: PERSONA },
      select: { id: true },
    });
    if (persona) {
      await prisma.entidadRol.deleteMany({ where: { entidadId: persona.id } });
      await prisma.entidad.delete({ where: { id: persona.id } });
    }
    await prisma.usuario.deleteMany({ where: { usuario: { startsWith: marca } } });
    console.log("\n  (compras, entidad, rol agregado y cuenta de prueba borrados)");
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
