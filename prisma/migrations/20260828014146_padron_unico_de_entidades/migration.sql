-- Padrón único de entidades — decisión #9.
--
-- Reemplaza cinco catálogos separados (empresa, consignatario, vendedor,
-- hotelero, persona_compradora) por una tabla `entidad`, más una tabla puente
-- `entidad_rol` que dice en qué papeles se vio a cada una.
--
-- POR QUÉ ES SEGURO BORRAR EN LUGAR DE MIGRAR EL DATO: al momento de escribir
-- esto hay CERO compras y CERO tropas cargadas, y por lo tanto cero filas
-- apuntando a cualquiera de los cinco catálogos (verificado antes, columna por
-- columna). Lo que se pierde son catálogos sembrados, que `prisma db seed`
-- reconstruye. Es una reconstrucción limpia, no una deduplicación manual de
-- datos reales.
--
-- ESTO NO SE PUEDE REPETIR ASÍ una vez que haya compras cargadas: ahí el dato
-- hay que moverlo antes de tirar la columna, en migraciones separadas. Ver la
-- entrada correspondiente en CLAUDE.md.
--
-- Las FK de compra y tropa se recrean apuntando a `entidad`. Los cinco campos
-- de rol siguen siendo CINCO COLUMNAS DISTINTAS: el rol lo da el campo, no la
-- tabla. Unificar el catálogo es lo que permite que una misma entidad juegue
-- varios papeles sin ser varias filas que divergen.
--
-- Va escrita para poder re-ejecutarse: Prisma NO envuelve el archivo en una
-- transacción, así que un fallo a mitad de camino deja la base a medias y hace
-- falta poder retomar desde donde quedó.

-- 1. Soltar las FK que apuntan a los catálogos viejos.
ALTER TABLE "compra" DROP CONSTRAINT IF EXISTS "compra_consignatarioId_fkey";
ALTER TABLE "compra" DROP CONSTRAINT IF EXISTS "compra_empresaTitularId_fkey";
ALTER TABLE "compra" DROP CONSTRAINT IF EXISTS "compra_vendedorId_fkey";
ALTER TABLE "compra" DROP CONSTRAINT IF EXISTS "compra_hoteleroId_fkey";
ALTER TABLE "compra" DROP CONSTRAINT IF EXISTS "compra_personaCompradoraId_fkey";
ALTER TABLE "tropa" DROP CONSTRAINT IF EXISTS "tropa_empresaCompradoraId_fkey";
ALTER TABLE "prefijo_tropa" DROP CONSTRAINT IF EXISTS "prefijo_tropa_empresaId_fkey";
ALTER TABLE "prefijo_tropa" DROP CONSTRAINT IF EXISTS "prefijo_tropa_entidadId_fkey";

-- 2. Vaciar prefijo_tropa ANTES de tocar nada más: sus 11 filas apuntan a
--    `empresa`, que deja de existir abajo, y la FK nueva se valida al crearse.
--    El seed las reconstruye junto con las entidades.
DELETE FROM "prefijo_tropa";

-- 3. Los cinco catálogos viejos.
DROP TABLE IF EXISTS "consignatario";
DROP TABLE IF EXISTS "vendedor";
DROP TABLE IF EXISTS "hotelero";
DROP TABLE IF EXISTS "persona_compradora";
DROP TABLE IF EXISTS "empresa";

-- 4. El padrón.
CREATE TABLE IF NOT EXISTS "entidad" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombreNormalizado" TEXT NOT NULL,
    "esPropio" BOOLEAN,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entidad_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "entidad_nombreNormalizado_key" ON "entidad"("nombreNormalizado");

DO $$ BEGIN
  CREATE TYPE "RolEntidad" AS ENUM ('CONSIGNATARIO', 'EMPRESA_COMPRADORA', 'VENDEDOR', 'HOTELERO', 'PERSONA_COMPRADORA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- La PK compuesta ya impide declarar dos veces el mismo rol para una entidad.
CREATE TABLE IF NOT EXISTS "entidad_rol" (
    "entidadId" INTEGER NOT NULL,
    "rol" "RolEntidad" NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entidad_rol_pkey" PRIMARY KEY ("entidadId","rol")
);
ALTER TABLE "entidad_rol" DROP CONSTRAINT IF EXISTS "entidad_rol_entidadId_fkey";
-- ON DELETE CASCADE: los roles no tienen sentido sin su entidad.
ALTER TABLE "entidad_rol" ADD CONSTRAINT "entidad_rol_entidadId_fkey"
  FOREIGN KEY ("entidadId") REFERENCES "entidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. prefijo_tropa cuelga de entidad.
DO $$ BEGIN
  ALTER TABLE "prefijo_tropa" RENAME COLUMN "empresaId" TO "entidadId";
EXCEPTION WHEN undefined_column THEN NULL;
END $$;
ALTER TABLE "prefijo_tropa" ADD CONSTRAINT "prefijo_tropa_entidadId_fkey"
  FOREIGN KEY ("entidadId") REFERENCES "entidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Las FK de compra y tropa, ahora contra entidad. Cinco columnas distintas.
ALTER TABLE "compra" ADD CONSTRAINT "compra_consignatarioId_fkey"
  FOREIGN KEY ("consignatarioId") REFERENCES "entidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compra" ADD CONSTRAINT "compra_empresaTitularId_fkey"
  FOREIGN KEY ("empresaTitularId") REFERENCES "entidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compra" ADD CONSTRAINT "compra_vendedorId_fkey"
  FOREIGN KEY ("vendedorId") REFERENCES "entidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compra" ADD CONSTRAINT "compra_hoteleroId_fkey"
  FOREIGN KEY ("hoteleroId") REFERENCES "entidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compra" ADD CONSTRAINT "compra_personaCompradoraId_fkey"
  FOREIGN KEY ("personaCompradoraId") REFERENCES "entidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tropa" ADD CONSTRAINT "tropa_empresaCompradoraId_fkey"
  FOREIGN KEY ("empresaCompradoraId") REFERENCES "entidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
