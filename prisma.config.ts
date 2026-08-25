import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// `vercel env pull` sin argumentos escribe en .env.local, así que ése es el
// archivo que manda y .env queda como fallback. No cambiamos el destino del
// pull: si lo moviéramos, el día que alguien corra el comando pelado Prisma se
// rompería sin motivo aparente.
//
// dotenv no pisa lo que ya está definido, así que el orden es la precedencia:
// primero .env.local, después .env. Las variables reales del entorno (las que
// inyecta Vercel en el build) ganan sobre ambas, que es lo que se quiere.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // Conexión DIRECTA, no la pooleada. Las migraciones tienen que ir por acá:
  // pgbouncer rompe los locks de advisory y los prepared statements que usa
  // migrate. La app hace lo contrario — el adapter va contra la pooleada
  // (POSTGRES_PRISMA_URL / POSTGRES_URL), porque en serverless sin pool se
  // agotan las conexiones.
  datasource: { url: env("POSTGRES_URL_NON_POOLING") },
});
