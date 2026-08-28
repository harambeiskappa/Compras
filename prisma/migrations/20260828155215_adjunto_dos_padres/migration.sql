-- Adjunto pasa a tener DOS padres posibles, y los dos son reales.
--
-- Hasta ahora `compraId` era NOT NULL, así que esto no es un agregado: es una
-- migración sobre una columna obligatoria. La tabla está VACÍA (0 filas,
-- verificado antes de escribir esto), y por eso alcanza con aflojar la
-- restricción. Con adjuntos cargados habría que decidir qué hacer con cada uno
-- antes de tocar nada — barata ahora, cara después.
--
-- Por qué dos padres: las fotos de los remitos llegan por el reporte del
-- comprador, pero en el camino de Darwash —más de la mitad de las compras— no
-- hay reporte y las sube la oficina directo a la compra. Ninguno de los dos es
-- el caso raro.
--
-- El CHECK de exactamente-uno se escribe acá porque Prisma no lo expresa. Un
-- adjunto sin padre es basura que nadie va a encontrar; uno con dos es
-- ambiguo, y la ambigüedad en el padre es peor que el faltante.
--
-- Re-ejecutable: Prisma no envuelve el archivo en una transacción.

ALTER TABLE "adjunto" ALTER COLUMN "compraId" DROP NOT NULL;

ALTER TABLE "adjunto" ADD COLUMN IF NOT EXISTS "reporteId" INTEGER;

-- La nota que el comprador escribe AL LADO DE LA FOTO: «el remito dice VQ,
-- para mí es VA». Texto libre a propósito — está parado en un remate.
ALTER TABLE "adjunto" ADD COLUMN IF NOT EXISTS "nota" TEXT;

ALTER TABLE "adjunto" DROP CONSTRAINT IF EXISTS "adjunto_reporteId_fkey";
ALTER TABLE "adjunto" ADD CONSTRAINT "adjunto_reporteId_fkey"
  FOREIGN KEY ("reporteId") REFERENCES "reporte_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactamente uno de los dos padres. Se cuenta cuántos están puestos y tiene
-- que dar 1: descarta el adjunto huérfano y el de padre ambiguo de una sola vez.
ALTER TABLE "adjunto" DROP CONSTRAINT IF EXISTS "adjunto_un_solo_padre_check";
ALTER TABLE "adjunto" ADD CONSTRAINT "adjunto_un_solo_padre_check" CHECK (
  (("compraId" IS NOT NULL)::int + ("reporteId" IS NOT NULL)::int) = 1
);
