-- Cuentas con usuario y contraseña, y atribución de la carga.
-- Decisiones #2 y #4, cerradas el 28/08/2026.
--
-- EL ROL VIAJA CON LA CUENTA. El link que se le pasa al comercial es un atajo
-- a la pantalla, nunca la credencial: si el link fuera la credencial,
-- reenviarlo por WhatsApp regalaría el acceso, y sacárselo a uno obligaría a
-- cambiárselo a todos.
--
-- NO se usa Supabase Auth: sus usuarios viven en `auth.users`, fuera de
-- prisma/schema.prisma, y eso rompe la regla de que el esquema esté entero en
-- el repo con historial.
--
-- `usuario` se guarda YA NORMALIZADO con normalizarTexto (trim + minúsculas).
-- El unique es sobre esa forma, así que "Nacho" y "nacho" son la misma cuenta.
--
-- `creadoPorUsuarioId` es NULLABLE en las dos tablas a propósito: lo cargado
-- antes de que existieran las cuentas no tiene autor, y eso es «s/d». Poner un
-- usuario "sistema" sería inventar el dato.
--
-- Re-ejecutable: Prisma no envuelve el archivo en una transacción.

DO $$ BEGIN
  CREATE TYPE "RolUsuario" AS ENUM ('ADMINISTRATIVO', 'COMERCIAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "usuario" (
    "id" SERIAL NOT NULL,
    "usuario" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "hashPassword" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    -- Solo para precargar la persona compradora. NO unifica los dos conceptos:
    -- quién fue a comprar y quién cargó esto son hechos distintos.
    "entidadId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "usuario_usuario_key" ON "usuario"("usuario");

ALTER TABLE "usuario" DROP CONSTRAINT IF EXISTS "usuario_entidadId_fkey";
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_entidadId_fkey"
  FOREIGN KEY ("entidadId") REFERENCES "entidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Atribución de la carga.
ALTER TABLE "compra"         ADD COLUMN IF NOT EXISTS "creadoPorUsuarioId" INTEGER;
ALTER TABLE "reporte_compra" ADD COLUMN IF NOT EXISTS "creadoPorUsuarioId" INTEGER;

-- ON DELETE SET NULL y no RESTRICT: si algún día se borra una cuenta, la compra
-- no se pierde — queda sin autor, que es «s/d» y es la verdad.
ALTER TABLE "compra" DROP CONSTRAINT IF EXISTS "compra_creadoPorUsuarioId_fkey";
ALTER TABLE "compra" ADD CONSTRAINT "compra_creadoPorUsuarioId_fkey"
  FOREIGN KEY ("creadoPorUsuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reporte_compra" DROP CONSTRAINT IF EXISTS "reporte_compra_creadoPorUsuarioId_fkey";
ALTER TABLE "reporte_compra" ADD CONSTRAINT "reporte_compra_creadoPorUsuarioId_fkey"
  FOREIGN KEY ("creadoPorUsuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS EN LA MISMA MIGRACIÓN QUE CREA LA TABLA.
-- Acá importa más que en ninguna otra: `usuario` guarda hashes de contraseña y
-- Supabase expone el schema public por su API REST con una anon key pública.
ALTER TABLE "usuario" ENABLE ROW LEVEL SECURITY;
