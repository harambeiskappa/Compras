/**
 * Los tres puntos que NECESITAN UN NAVEGADOR DE VERDAD.
 *
 *   1. La prueba dura: modo avión → cargar un reporte con dos fotos → cerrar el
 *      navegador → reabrir → está todo → volver la señal → llega UNA sola vez.
 *   6. Una foto de ~3 MB queda por debajo de ~300 KB.
 *   8. Con la app abierta y sin red, recargar la página → abre igual.
 *
 * IndexedDB, el canvas y el service worker no existen en Node. Probarlos con un
 * mock sería comprobar que el mock funciona: el offline se rompe justo en las
 * costuras entre esas tres cosas y el navegador real.
 *
 * Usa un perfil persistente en disco, así que «cerrar el navegador» es cerrarlo
 * de verdad y volver a abrirlo con lo que quedó guardado — que es el caso real:
 * el comprador manda, cierra todo y se va de la feria.
 *
 * Correr:  npx tsx scripts/verificar-comprador-navegador.ts
 *          npx tsx scripts/verificar-comprador-navegador.ts --produccion
 */
import { deflateSync } from "node:zlib";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

import { config as loadEnv } from "dotenv";
import { chromium, type BrowserContext } from "playwright";

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

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ la foto

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function trozo(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const suma = Buffer.alloc(4);
  suma.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, suma]);
}

/**
 * Un PNG grande y PARECIDO A UNA FOTO: degradé suave más un ruido bajo.
 *
 * Tiene que ser las dos cosas a la vez. Ruido puro daría un PNG grande pero
 * también un JPEG grande, y el test pasaría o fallaría por el contenido en vez
 * de por la compresión. Un degradé liso daría un PNG chiquito y no habría nada
 * que achicar. Esto se parece a un remito fotografiado, que es el caso real.
 */
function pngDePrueba(ancho: number, alto: number): Buffer {
  const filas: Buffer[] = [];
  let semilla = 12345;
  const azar = () => {
    semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
    return semilla / 0x7fffffff;
  };
  for (let y = 0; y < alto; y++) {
    const fila = Buffer.alloc(1 + ancho * 3);
    fila[0] = 0; // filtro None
    for (let x = 0; x < ancho; x++) {
      const base = 120 + 90 * Math.sin((x / ancho) * 3) + 40 * Math.cos((y / alto) * 5);
      const ruido = (azar() - 0.5) * 46;
      const v = Math.max(0, Math.min(255, base + ruido));
      fila[1 + x * 3] = v;
      fila[2 + x * 3] = Math.max(0, Math.min(255, v * 0.94));
      fila[3 + x * 3] = Math.max(0, Math.min(255, v * 0.86));
    }
    filas.push(fila);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // color RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", ihdr),
    trozo("IDAT", deflateSync(Buffer.concat(filas), { level: 6 })),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- navegador

async function entrar(ctx: BrowserContext, usuario: string, password: string) {
  const pagina = await ctx.newPage();
  await pagina.goto(`${BASE}/ingresar`, { waitUntil: "domcontentloaded" });
  await pagina.fill("#usuario", usuario);
  await pagina.fill("#password", password);
  await pagina.click('button[type="submit"]');
  await pagina.waitForURL(/\/reportar/, { timeout: 20000 });

  // La primera vez la pantalla explica qué es un reporte en tres pasos. Se pasa
  // como lo haría una persona: tocando el botón. Saltearlo escribiendo la marca
  // en localStorage probaría una app que nadie usa así.
  const intro = await pagina
    .waitForSelector("text=Cargar el primero", { timeout: 6000 })
    .catch(() => null);
  if (intro) await intro.click();
  await pagina.waitForSelector("text=Reporte de la feria", { timeout: 15000 });

  return pagina;
}

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { hashearPassword } = await import("@/lib/password");

  console.log(`\nContra: ${BASE}\n`);

  const marca = "prueba-nav-" + Date.now();
  const PASS = "contrasena-de-prueba-1";
  const CONSIGNATARIO = `Feria Navegador ${Date.now()}`;

  await prisma.usuario.create({
    data: {
      usuario: marca,
      nombre: "Comercial de prueba",
      hashPassword: await hashearPassword(PASS),
      rol: "COMERCIAL",
    },
  });

  const perfil = mkdtempSync(join(tmpdir(), "compras-perfil-"));
  const foto = pngDePrueba(2400, 1700);
  console.log(`  foto de prueba: ${(foto.length / 1024 / 1024).toFixed(2)} MB\n`);

  let ctx: BrowserContext | null = null;

  try {
    // ============================================================ sesión 1
    ctx = await chromium.launchPersistentContext(perfil, {
      headless: true,
      ignoreHTTPSErrors: true,
    });
    let pagina = await entrar(ctx, marca, PASS);

    // Que el service worker termine de instalarse y precachear. Sin esto, el
    // punto 8 probaría que el navegador todavía tenía la página en su propio
    // cache HTTP, que no es lo mismo.
    await pagina.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
      undefined,
      { timeout: 20000 }
    );
    await esperar(1500);

    // ---------------------------------------------------------------- 8
    console.log("=== 8. Sin red, recargar la página ===");
    await ctx.setOffline(true);
    const respuesta = await pagina.reload({ waitUntil: "domcontentloaded" });
    const abrio = await pagina
      .waitForSelector("text=Reporte de la feria", { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    chequear(
      "la pantalla abre sin red",
      abrio,
      `HTTP ${respuesta?.status() ?? "?"} desde el service worker · ` +
        `título visible: ${abrio}`
    );

    // ---------------------------------------------------------------- 6
    console.log("\n=== 6. La foto se comprime antes de guardarse ===");
    await pagina.setInputFiles('input[type="file"]', {
      name: "remito.png",
      mimeType: "image/png",
      buffer: foto,
    });
    await pagina.waitForSelector('img[alt="Remito 1"]', { timeout: 20000 });
    await esperar(600);

    const tamanos = await pagina.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const p = indexedDB.open("compras-comprador");
        p.onsuccess = () => res(p.result);
        p.onerror = () => rej(p.error);
      });
      const borradores = await new Promise<
        { remitos: { foto: Blob }[]; actualizadoEn: string }[]
      >((res, rej) => {
        const p = db.transaction("borradores").objectStore("borradores").getAll();
        p.onsuccess = () => res(p.result);
        p.onerror = () => rej(p.error);
      });
      const b = borradores.sort((x, y) => y.actualizadoEn.localeCompare(x.actualizadoEn))[0];
      return b ? b.remitos.map((r) => ({ bytes: r.foto.size, tipo: r.foto.type })) : [];
    });

    chequear(
      "una foto de ~3 MB queda por debajo de 300 KB",
      tamanos.length === 1 && tamanos[0].bytes < 300 * 1024,
      `${(foto.length / 1024).toFixed(0)} KB → ${(tamanos[0]?.bytes / 1024).toFixed(0)} KB ` +
        `(${tamanos[0]?.tipo})`
    );

    // ---------------------------------------------------------------- 6b
    console.log("\n=== 6b. Borrar la foto del medio no descoloca las que quedan ===");
    // La ruta en Storage es «clave del reporte + índice», así que si el índice
    // se corriera entre dos subidas, una fila podría terminar apuntando a la
    // imagen de otra. Acá se comprueba que no pasa: cada envío sube TODAS las
    // fotos y el juego queda congelado al encolar, así que los índices no se
    // mueven entre intentos.
    //
    // Las tres fotos tienen tamaños bien distintos a propósito: es lo que
    // permite distinguir cuál quedó guardada en cada fila.
    await pagina.setInputFiles('input[type="file"]', {
      name: "medio.png",
      mimeType: "image/png",
      buffer: pngDePrueba(300, 220),
    });
    await pagina.waitForSelector('img[alt="Remito 2"]', { timeout: 20000 });
    await pagina.setInputFiles('input[type="file"]', {
      name: "tercera.png",
      mimeType: "image/png",
      buffer: pngDePrueba(1200, 900),
    });
    await pagina.waitForSelector('img[alt="Remito 3"]', { timeout: 20000 });

    // Un número por foto, para poder aparear fila e imagen después.
    const numeros = pagina.locator('input[placeholder="número — si no, lo pone la oficina"]');
    await numeros.nth(0).fill("UNO");
    await numeros.nth(1).fill("DOS");
    await numeros.nth(2).fill("TRES");
    await esperar(700);

    // Se borra la del MEDIO.
    await pagina.locator("text=Sacar").nth(1).click();
    await esperar(700);

    const quedaron = await pagina.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((res) => {
        const p = indexedDB.open("compras-comprador");
        p.onsuccess = () => res(p.result);
      });
      const bs = await new Promise<
        { remitos: { foto: Blob; numero: string | null }[]; actualizadoEn: string }[]
      >((res) => {
        const p = db.transaction("borradores").objectStore("borradores").getAll();
        p.onsuccess = () => res(p.result);
      });
      const b = bs.sort((x, y) => y.actualizadoEn.localeCompare(x.actualizadoEn))[0];
      return b.remitos.map((r) => ({ numero: r.numero, bytes: r.foto.size }));
    });

    chequear(
      "quedan la primera y la tercera, cada una con su número",
      quedaron.length === 2 &&
        quedaron[0].numero === "UNO" &&
        quedaron[1].numero === "TRES" &&
        quedaron[0].bytes > quedaron[1].bytes,
      quedaron.map((q) => `${q.numero}=${(q.bytes / 1024).toFixed(0)}KB`).join(" · ")
    );
    // Se guardan los tamaños para comprobar, después de enviar, que la fila de
    // cada número sigue apuntando a SU imagen y no a la de al lado.
    const esperados = new Map(quedaron.map((q) => [q.numero, q.bytes]));

    // ---------------------------------------------------------------- 1
    console.log("\n=== 1. La prueba dura: modo avión de punta a punta ===");

    // El consignatario se escribe a mano y NO está en el catálogo: sin señal,
    // esa entidad todavía no existe del otro lado.
    await pagina.click("text=Consignatario >> xpath=following::button[1]");
    await pagina.fill('input[placeholder="Buscar o escribir"]', CONSIGNATARIO);
    await pagina.click(`text=que no está en la lista`);
    await pagina.fill('input[type="number"]', "80");
    await esperar(700);

    await pagina.click("text=Mandar el reporte");
    const acuse = await pagina
      .waitForSelector("text=Quedó guardado", { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    chequear(
      "sin señal, el acuse dice que quedó guardado y que puede irse",
      acuse,
      acuse ? "«Sale solo cuando haya señal»" : "no apareció el acuse"
    );

    const enColaAntes = await pagina.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((res) => {
        const p = indexedDB.open("compras-comprador");
        p.onsuccess = () => res(p.result);
      });
      return new Promise<number>((res) => {
        const p = db.transaction("cola").objectStore("cola").getAll();
        p.onsuccess = () => res(p.result.length);
      });
    });

    // --- CERRAR EL NAVEGADOR DE VERDAD ---
    await ctx.close();
    ctx = null;

    // ============================================================ sesión 2
    ctx = await chromium.launchPersistentContext(perfil, {
      headless: true,
      ignoreHTTPSErrors: true,
    });
    await ctx.setOffline(true);
    pagina = await ctx.newPage();
    await pagina.goto(`${BASE}/reportes`, { waitUntil: "domcontentloaded" });

    const sobrevivio = await pagina.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((res) => {
        const p = indexedDB.open("compras-comprador");
        p.onsuccess = () => res(p.result);
      });
      return new Promise<{ entradas: number; fotos: number }>((res) => {
        const p = db.transaction("cola").objectStore("cola").getAll();
        p.onsuccess = () =>
          res({
            entradas: p.result.length,
            fotos: p.result[0]?.reporte?.remitos?.length ?? 0,
          });
      });
    });

    chequear(
      "después de cerrar y reabrir el navegador, el reporte y sus DOS fotos siguen ahí",
      sobrevivio.entradas === 1 && sobrevivio.fotos === 2,
      `en cola antes de cerrar: ${enColaAntes} · después de reabrir: ` +
        `${sobrevivio.entradas} con ${sobrevivio.fotos} fotos`
    );

    const verEsperando = await pagina
      .waitForSelector("text=Esperando señal", { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    chequear(
      "y la lista lo muestra como «esperando señal», sin red",
      verEsperando,
      verEsperando ? "el estado se ve sin buscarlo" : "no apareció el sello"
    );

    // --- VUELVE LA SEÑAL ---
    await ctx.setOffline(false);
    await pagina.evaluate(() => window.dispatchEvent(new Event("online")));

    let llegaron = 0;
    for (let i = 0; i < 30; i++) {
      await esperar(1000);
      llegaron = await prisma.reporteCompra.count({
        where: { consignatarioTexto: CONSIGNATARIO },
      });
      if (llegaron > 0) break;
    }
    // Se espera un rato MÁS a propósito: el punto no es que llegue, es que
    // llegue UNA sola vez aunque la cola siga viva y la app siga abierta.
    await esperar(6000);
    const total = await prisma.reporteCompra.count({
      where: { consignatarioTexto: CONSIGNATARIO },
    });
    const conFotos = await prisma.adjunto.count({
      where: { reporte: { consignatarioTexto: CONSIGNATARIO } },
    });

    chequear(
      "al volver la señal llega UNA sola vez, con las dos fotos",
      total === 1 && conFotos === 2,
      `reportes en la base: ${total} · adjuntos: ${conFotos}`
    );

    // ---------------------------------------------------------------- 6c
    console.log("\n=== 6c. Cada fila apunta a SU imagen, no a la de al lado ===");
    const { urlFirmada } = await import("@/lib/almacenamiento");
    const filas = await prisma.adjunto.findMany({
      where: { reporte: { consignatarioTexto: CONSIGNATARIO } },
      orderBy: { id: "asc" },
      select: { numero: true, url: true },
    });
    const medidas: string[] = [];
    let apareanBien = filas.length === 2;
    for (const fila of filas) {
      const firmada = await urlFirmada(fila.url);
      const bytes = firmada ? (await (await fetch(firmada)).arrayBuffer()).byteLength : -1;
      const esperado = esperados.get(fila.numero ?? "");
      medidas.push(
        `${fila.numero}: guardada ${(bytes / 1024).toFixed(0)}KB vs esperada ` +
          `${esperado ? (esperado / 1024).toFixed(0) : "?"}KB`
      );
      // Se comparan tamaños y no bytes exactos: lo que se guarda en Storage es
      // el mismo Blob, pero alcanza con que sean distinguibles entre sí para
      // detectar un cruce — que es el fallo que este chequeo busca.
      if (!esperado || bytes !== esperado) apareanBien = false;
    }
    chequear(
      "después de borrar la del medio, cada número quedó con su foto",
      apareanBien,
      medidas.join(" · ") || "no se pudieron leer las fotos"
    );

    const colaVacia = await pagina.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((res) => {
        const p = indexedDB.open("compras-comprador");
        p.onsuccess = () => res(p.result);
      });
      return new Promise<number>((res) => {
        const p = db.transaction("cola").objectStore("cola").getAll();
        p.onsuccess = () => res(p.result.length);
      });
    });
    chequear(
      "y la cola queda vacía",
      colaVacia === 0,
      `${colaVacia} pendiente(s) después de enviar`
    );

    const entidad = await prisma.entidad.findFirst({
      where: { nombre: CONSIGNATARIO },
      select: { nombre: true },
    });
    chequear(
      "el consignatario escrito sin señal existe ahora en el padrón",
      !!entidad,
      entidad ? `creado al recibir: "${entidad.nombre}"` : "NO SE CREÓ"
    );
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    rmSync(perfil, { recursive: true, force: true });

    await prisma.adjunto.deleteMany({
      where: { reporte: { consignatarioTexto: CONSIGNATARIO } },
    });
    await prisma.reporteCompra.deleteMany({
      where: { consignatarioTexto: CONSIGNATARIO },
    });
    const e = await prisma.entidad.findFirst({
      where: { nombre: CONSIGNATARIO },
      select: { id: true },
    });
    if (e) {
      await prisma.entidadRol.deleteMany({ where: { entidadId: e.id } });
      await prisma.entidad.delete({ where: { id: e.id } });
    }
    await prisma.usuario.deleteMany({ where: { usuario: { startsWith: marca } } });
    console.log("\n  (perfil, reportes, entidad y cuenta de prueba borrados)");
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
