-- ReporteCompra: lo que manda el comprador desde la feria.
--
-- Es EVIDENCIA, no una interpretación: guarda lo que él escribió y no se pisa
-- al armar la compra. Por eso `consignatarioTexto` y `plazaTexto` son texto
-- libre aunque exista el catálogo — sin señal el comprador puede nombrar algo
-- que todavía no existe como entidad en el servidor.
--
-- `claveIdempotencia` es lo único que impide que una conexión intermitente
-- cree reportes duplicados: se genera EN EL DISPOSITIVO, antes de que haya red,
-- y el servidor la usa para reconocer un reenvío. Es NOT NULL y unique porque
-- un reporte sin clave no se puede desduplicar, que es justo el caso que rompe
-- todo.
--
-- La FK con `compra` va del lado de COMPRA y no de acá: un reporte puede
-- terminar en dos compras (§2 del documento de arranque, y §8 lo exige como
-- caso de prueba). Un `compraId` en esta tabla solo podría apuntar a una.
--
-- Va escrita para poder re-ejecutarse: Prisma no envuelve el archivo en una
-- transacción, así que un fallo a mitad de camino deja la base a medias.

DO $$ BEGIN
  CREATE TYPE "EstadoReporte" AS ENUM ('PENDIENTE', 'PROCESADO', 'DESCARTADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "reporte_compra" (
    "id" SERIAL NOT NULL,
    "claveIdempotencia" TEXT NOT NULL,
    -- Todo lo que sigue es nullable a propósito: el comprador está parado en un
    -- remate y puede no saber la plaza, o mandar solo fotos.
    "fecha" DATE,
    "consignatarioTexto" TEXT,
    "consignatarioId" INTEGER,
    "plazaTexto" TEXT,
    "cabezasAproximadas" INTEGER,
    "cantidadCamiones" INTEGER,
    "observaciones" TEXT,
    "personaCompradoraId" INTEGER,
    -- DOS fechas distintas, y la diferencia es información: con carga sin señal
    -- pueden estar separadas por horas. `cargadoEn` es NOT NULL porque el
    -- dispositivo siempre lo sabe — se genera junto con la clave, antes de que
    -- haya red.
    "cargadoEn" TIMESTAMP(3) NOT NULL,
    "recibidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoReporte" NOT NULL DEFAULT 'PENDIENTE',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reporte_compra_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "reporte_compra_claveIdempotencia_key"
  ON "reporte_compra"("claveIdempotencia");

ALTER TABLE "reporte_compra" DROP CONSTRAINT IF EXISTS "reporte_compra_consignatarioId_fkey";
ALTER TABLE "reporte_compra" ADD CONSTRAINT "reporte_compra_consignatarioId_fkey"
  FOREIGN KEY ("consignatarioId") REFERENCES "entidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reporte_compra" DROP CONSTRAINT IF EXISTS "reporte_compra_personaCompradoraId_fkey";
ALTER TABLE "reporte_compra" ADD CONSTRAINT "reporte_compra_personaCompradoraId_fkey"
  FOREIGN KEY ("personaCompradoraId") REFERENCES "entidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- La compra apunta al reporte del que salió, si salió de alguno. Nullable
-- porque el camino más frecuente NO tiene reporte.
ALTER TABLE "compra" ADD COLUMN IF NOT EXISTS "reporteId" INTEGER;
ALTER TABLE "compra" DROP CONSTRAINT IF EXISTS "compra_reporteId_fkey";
ALTER TABLE "compra" ADD CONSTRAINT "compra_reporteId_fkey"
  FOREIGN KEY ("reporteId") REFERENCES "reporte_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS EN LA MISMA MIGRACIÓN QUE CREA LA TABLA.
-- Supabase expone el schema public por su API REST y la anon key es pública.
-- Sin políticas, RLS deniega todo por ahí y no afecta a Prisma, que conecta con
-- el rol dueño. Una tabla nueva sin esto nace expuesta: ya pasó con `entidad`.
ALTER TABLE "reporte_compra" ENABLE ROW LEVEL SECURITY;
