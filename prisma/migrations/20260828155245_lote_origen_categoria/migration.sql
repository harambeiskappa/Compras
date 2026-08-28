-- De dónde salió la categoría de cada lote: del remito o de la corrección del
-- comprador.
--
-- El comprador ve el animal; el remito dice otra cosa. Caso real y frecuente:
-- el remito dice VQ y el comprador dice VA, y suele tener razón — el
-- consignatario clasifica para vender, el comprador mira lo que se lleva. Esa
-- discrepancia es información, no un error, y el sistema viejo habría guardado
-- una de las dos y perdido la otra.
--
-- NULLABLE Y SIN DEFAULT, a propósito. Si nadie registró de dónde vino la
-- categoría, es «s/d». Poner REMITO por defecto sería inventar que alguien miró
-- el papel: el mismo error que el DEFAULT 0 en las columnas de cantidad, que es
-- justo lo que este proyecto existe para no repetir.
--
-- Re-ejecutable: Prisma no envuelve el archivo en una transacción.

DO $$ BEGIN
  CREATE TYPE "OrigenCategoria" AS ENUM ('REMITO', 'CORRECCION_COMPRADOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "lote" ADD COLUMN IF NOT EXISTS "origenCategoria" "OrigenCategoria";
