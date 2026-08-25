import { prisma } from "@/lib/prisma";

// Sin esto Next puede evaluar la ruta en el build y servir una respuesta
// cacheada — para un health check es justo lo contrario de lo que se quiere:
// diría «ok» con la base caída.
export const dynamic = "force-dynamic";

// Devuelve solo si la base contesta. Nada de conteos ni datos: la ruta no tiene
// autenticación, así que cualquiera que la encuentre la puede pegar, y un
// conteo publicaría volumen de negocio.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
