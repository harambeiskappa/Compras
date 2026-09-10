-- El motivo del descarte, y quién cambió el estado de un reporte.
--
-- POR QUÉ EL MOTIVO NECESITA COLUMNA PROPIA. La pantalla del comprador promete
-- que va a ver que su reporte se descartó Y POR QUÉ, y hoy no hay dónde
-- guardar ese porqué. `observaciones` NO sirve: es del comprador y es
-- evidencia — la oficina no escribe ahí. Es el mismo caso que la atribución
-- «· oficina» del módulo 1, con la diferencia de que esta vez el campo sí se
-- agrega, porque la pantalla ya promete el dato.
--
-- POR QUÉ `estadoCambiadoPor` Y `estadoCambiadoEn`, y no alcanza `actualizadoEn`.
-- Cubren también el marcado como procesado y su reversión, que son decisiones
-- que le SACAN algo a otra persona: procesar congela la pantalla del comprador.
-- `actualizadoEn` se mueve con cualquier cambio —una nota, un número de
-- remito—, así que no puede contestar «quién congeló esto y cuándo».
--
-- Los tres son NULLABLE: un reporte que nunca cambió de estado no tiene ni
-- motivo ni autor del cambio, y eso es «s/d», no un valor por defecto.
--
-- Re-ejecutable: Prisma no envuelve el archivo en una transacción.

DO $$ BEGIN
  CREATE TYPE "MotivoDescarte" AS ENUM ('DUPLICADO', 'ERROR', 'NO_SE_HIZO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "reporte_compra" ADD COLUMN IF NOT EXISTS "motivoDescarte" "MotivoDescarte";
ALTER TABLE "reporte_compra" ADD COLUMN IF NOT EXISTS "estadoCambiadoPorUsuarioId" INTEGER;
ALTER TABLE "reporte_compra" ADD COLUMN IF NOT EXISTS "estadoCambiadoEn" TIMESTAMP(3);

-- ON DELETE SET NULL, igual que las otras atribuciones: si algún día se borra
-- una cuenta, el reporte no se pierde — queda sin autor del cambio, que es
-- «s/d» y es la verdad.
ALTER TABLE "reporte_compra" DROP CONSTRAINT IF EXISTS "reporte_compra_estadoCambiadoPorUsuarioId_fkey";
ALTER TABLE "reporte_compra" ADD CONSTRAINT "reporte_compra_estadoCambiadoPorUsuarioId_fkey"
  FOREIGN KEY ("estadoCambiadoPorUsuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- La tabla ya existía y ya tenía RLS, así que acá no hay tabla nueva que
-- proteger. Se re-afirma igual porque es idempotente y porque el costo de
-- suponerlo es un CRITICAL en el dashboard que solo ve quien lo mira.
ALTER TABLE "reporte_compra" ENABLE ROW LEVEL SECURITY;
