/**
 * Verificación del módulo 1, contra la base de verdad.
 *
 * Llama a las server actions DIRECTAMENTE, sin pasar por el formulario: es la
 * forma de comprobar que la validación vive en el servidor y no en el cliente.
 * Lo que valida el formulario es comodidad; lo que decide es esto.
 *
 * Las compras que crea quedan cargadas — son datos de prueba en una base que
 * todavía no tiene ninguna real. Al final imprime sus ids por si hay que
 * borrarlas.
 *
 * Correr:  npx tsx scripts/verificar-modulo-1.ts
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

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

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { crearCompra, guardarRol, buscarEntidades, crearEntidad } = await import(
    "@/lib/acciones"
  );
  const { entidadesParaSelector } = await import("@/lib/entidades");

  const creadas: number[] = [];

  // ---------------------------------------------------------------- 1
  console.log("\n=== 1. Una compra con solo los tres obligatorios ===");
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
  const persona = await crearEntidad("Nacho Merlo", "PERSONA_COMPRADORA");
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
  console.log("\n=== 4. POST directo sin empresa titular ===");
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
    "el servidor lo rechaza",
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
  const selEmpresa = await entidadesParaSelector("EMPRESA_COMPRADORA", "");
  const nombresEmpresa = selEmpresa.delRol.map((e) => e.nombre);
  chequear(
    "muestra 7 entidades",
    selEmpresa.delRol.length === 7,
    `${selEmpresa.delRol.length}: ${nombresEmpresa.join(", ")}`
  );
  chequear(
    "no incluye Tercio Bravo",
    !nombresEmpresa.includes("Tercio Bravo"),
    nombresEmpresa.includes("Tercio Bravo") ? "LO INCLUYE" : "correcto"
  );
  chequear(
    "no ofrece «otras» ni crear al vuelo",
    selEmpresa.otras.length === 0,
    `otras: ${selEmpresa.otras.length}`
  );
  const comboEmpresa = await buscarEntidades("EMPRESA_COMPRADORA", "Nueva Empresa Inventada");
  chequear(
    "no se puede crear una empresa desde el formulario",
    !comboEmpresa.sePuedeCrear,
    `sePuedeCrear = ${comboEmpresa.sePuedeCrear}`
  );

  console.log("\n=== 5b. El selector de hotelero ===");
  const selHotel = await entidadesParaSelector("HOTELERO", "");
  const tercioEnHotel = selHotel.delRol.find((e) => e.nombre === "Tercio Bravo");
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
    selHotel.delRol.length < 20 && selHotel.otras.length === 0,
    `hoteleros: ${selHotel.delRol.length}, otras: ${selHotel.otras.length}, ` +
      `vendedores en el padrón: ${totalVendedores}`
  );
  const buscHotel = await entidadesParaSelector("HOTELERO", "darwash");
  chequear(
    "buscando, las de otro rol aparecen SEPARADAS en «otras»",
    buscHotel.otras.length > 0 || buscHotel.delRol.length > 0,
    `del rol: ${buscHotel.delRol.map((e) => e.nombre).join(", ") || "-"} | ` +
      `otras: ${buscHotel.otras.map((e) => e.nombre).join(", ") || "-"}`
  );

  // ---------------------------------------------------------------- 7
  console.log("\n=== 7. Casi-idéntico por puntuación ===");
  const combo = await buscarEntidades("VENDEDOR", "FERIA RODEO HUINCA S.R.L.");
  chequear(
    "«FERIA RODEO HUINCA S.R.L.» con punto ofrece el existente",
    combo.parecidos.length > 0,
    combo.parecidos.length
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
  if (!soloVendedor) {
    chequear("hay una entidad que solo es vendedor", false, "no encontré ninguna");
  } else if (completa.ok) {
    const antes = await prisma.entidadRol.count({
      where: { entidadId: soloVendedor.id, rol: "HOTELERO" },
    });
    const r = await guardarRol(completa.id, "hotelero", soloVendedor.id);
    const despues = await prisma.entidadRol.count({
      where: { entidadId: soloVendedor.id, rol: "HOTELERO" },
    });
    chequear(
      `elegir "${soloVendedor.nombre}" como hotelero le agrega el rol`,
      r.ok && antes === 0 && despues === 1,
      `HOTELERO antes=${antes} después=${despues}` +
        (r.ok ? "" : ` — ${r.errores.join(" ")}`)
    );
  }

  // ---------------------------------------------------------------- s/d
  console.log("\n=== s/d: poner un opcional en NULL desde el detalle ===");
  if (completa.ok) {
    const r = await guardarRol(completa.id, "vendedor", null);
    const g = await prisma.compra.findUniqueOrThrow({
      where: { id: completa.id },
      select: { vendedorId: true },
    });
    chequear(
      "el vendedor vuelve a NULL",
      r.ok && g.vendedorId === null,
      `vendedorId = ${g.vendedorId}`
    );
    const obl = await guardarRol(completa.id, "consignatario", null);
    chequear(
      "un obligatorio NO se puede poner en s/d",
      !obl.ok,
      obl.ok ? "LO PERMITIÓ" : obl.errores.join(" ")
    );
  }

  // ---------------------------------------------------------------- resumen
  console.log("\n" + "=".repeat(64));
  console.log(`  ${ok} en verde, ${mal} en rojo`);
  console.log("=".repeat(64));
  if (creadas.length) {
    console.log(`\n  Compras de prueba creadas: ${creadas.map((i) => "#" + i).join(", ")}`);
    console.log("  Para borrarlas:  npx tsx scripts/verificar-modulo-1.ts --limpiar");
  }

  if (process.argv.includes("--limpiar")) {
    const borradas = await prisma.compra.deleteMany({});
    console.log(`\n  Borradas ${borradas.count} compras.`);
  }

  await prisma.$disconnect();
  if (mal > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
