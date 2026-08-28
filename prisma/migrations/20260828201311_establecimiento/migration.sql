-- Establecimiento: a dónde va la hacienda de un lote.
--
-- ES LA PALABRA DE LA CASA: establecimiento, no «destino». El catálogo viejo
-- los tenía bajo `destino` mezclados con `Feedlot`, `Venta` y `VER`, que no son
-- establecimientos sino otra cosa.
--
-- CATÁLOGO PROPIO, NO ENTIDADES DEL PADRÓN. Los establecimientos no compran, no
-- consignan y no venden: no son empresas. Si fueran entidades, `Venta` tendría
-- que ser una entidad. La confusión de «PECUARIA EL COLORADITO» como hotelero
-- es un artefacto de nombres del sistema viejo — comparados exacto, el solape
-- con los hoteleros del padrón es CERO.
--
-- `nombreNormalizado` lleva el mismo unique estricto que las entidades: trim +
-- minúsculas + vocales sin acento, la ñ SIN plegar. Ver src/lib/normalizar.ts.
--
-- Re-ejecutable: Prisma no envuelve el archivo en una transacción.

CREATE TABLE IF NOT EXISTS "establecimiento" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombreNormalizado" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "establecimiento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "establecimiento_nombreNormalizado_key"
  ON "establecimiento"("nombreNormalizado");

-- Nullable y sin default: si no se sabe a dónde va el lote, es «s/d».
ALTER TABLE "lote" ADD COLUMN IF NOT EXISTS "establecimientoId" INTEGER;

ALTER TABLE "lote" DROP CONSTRAINT IF EXISTS "lote_establecimientoId_fkey";
ALTER TABLE "lote" ADD CONSTRAINT "lote_establecimientoId_fkey"
  FOREIGN KEY ("establecimientoId") REFERENCES "establecimiento"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS EN LA MISMA MIGRACIÓN QUE CREA LA TABLA.
-- Supabase expone el schema public por su API REST y la anon key es pública.
-- Una tabla nueva sin esto nace expuesta: ya pasó con `entidad`.
ALTER TABLE "establecimiento" ENABLE ROW LEVEL SECURITY;
