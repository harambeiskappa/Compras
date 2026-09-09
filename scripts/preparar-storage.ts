/**
 * Crea el bucket de remitos si no está. Idempotente: correrlo dos veces no
 * hace nada la segunda.
 *
 * Existe como script y no como un clic en el dashboard de Supabase por la misma
 * razón que las tablas se crean con migraciones: lo que solo vive en un panel
 * no está en el repo, no tiene historial y no se puede reproducir. Acá al menos
 * queda escrito cuál es el bucket y con qué configuración nace.
 *
 * Correr:  npx tsx scripts/preparar-storage.ts
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

async function main() {
  const { asegurarBucket, BUCKET_REMITOS } = await import("@/lib/almacenamiento");
  const resultado = await asegurarBucket();
  console.log(`bucket "${BUCKET_REMITOS}": ${resultado}`);
  console.log("  privado, tope 5 MB por archivo, solo imágenes.");
  console.log(
    "  Las fotos llegan comprimidas del teléfono (~200 KB): el tope es para\n" +
      "  atajar el caso raro, no el normal."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
