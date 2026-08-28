-- Simetría en el ON DELETE de `adjunto`: RESTRICT en los dos padres.
--
-- Quedó asimétrico: `reporteId` era CASCADE y `compraId` RESTRICT. El problema
-- del CASCADE es que borrar la fila NO borra el archivo de Supabase Storage:
-- deja huérfanos silenciosos que nadie va a encontrar, y de paso pierde
-- evidencia —las fotos de los remitos— de un plumazo.
--
-- SET NULL no es opción: violaría el CHECK de exactamente-un-padre.
--
-- Un reporte que no sirve se marca DESCARTADO, no se borra. Si alguna vez hay
-- que borrarlo de verdad, primero hay que decidir qué pasa con sus archivos, y
-- el RESTRICT obliga a esa conversación en vez de saltearla.
--
-- Re-ejecutable.

ALTER TABLE "adjunto" DROP CONSTRAINT IF EXISTS "adjunto_reporteId_fkey";
ALTER TABLE "adjunto" ADD CONSTRAINT "adjunto_reporteId_fkey"
  FOREIGN KEY ("reporteId") REFERENCES "reporte_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "adjunto" DROP CONSTRAINT IF EXISTS "adjunto_compraId_fkey";
ALTER TABLE "adjunto" ADD CONSTRAINT "adjunto_compraId_fkey"
  FOREIGN KEY ("compraId") REFERENCES "compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
