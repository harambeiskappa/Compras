import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { SUPABASE_CA_CERT } from "@/lib/supabase-ca";

// POSTGRES_PRISMA_URL es el pooler en transaction mode (puerto 6543, pgbouncer).
// Las migraciones NO van por acá: usan POSTGRES_URL_NON_POOLING (puerto 5432,
// session mode), configurada en prisma.config.ts.
const connectionString = process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
  throw new Error(
    "Falta POSTGRES_PRISMA_URL. En local se trae con `vercel env pull`."
  );
}

// Sin el CA de Supabase, `pg` falla con «self-signed certificate in certificate
// chain»: la cadena (leaf → Supabase Intermediate 2021 CA → Supabase Root 2021
// CA) no encadena contra el store de CAs del sistema. Ver `supabase-ca.ts` para
// de dónde sale el certificado y cómo reemplazarlo cuando venza.
//
// `sslmode` dentro de la cadena pisa el objeto `ssl` de abajo, así que se saca y
// la verificación se configura de forma explícita. Además evita depender de cómo
// interprete `sslmode=require` cada versión de pg: hoy lo trata como
// verify-full, y en pg 9 va a cambiar a la semántica de libpq.
const url = new URL(connectionString);
url.searchParams.delete("sslmode");

function crearPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: url.toString(),
    // El pooling real lo hace pgbouncer del otro lado. Un pool propio encima,
    // multiplicado por cada invocación serverless, agota las conexiones.
    max: 1,
    ssl: { ca: SUPABASE_CA_CERT, rejectUnauthorized: true },
  });

  return new PrismaClient({ adapter });
}

// En dev, el hot reload de Next re-evalúa este módulo en cada cambio. Sin el
// singleton en globalThis, cada recarga deja un cliente y su conexión colgando
// hasta agotar el límite de la base.
const globalParaPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof crearPrismaClient>;
};

export const prisma = globalParaPrisma.prisma ?? crearPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prisma = prisma;
}
