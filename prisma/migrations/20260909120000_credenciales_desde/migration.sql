-- `credencialesDesde`: desde cuándo valen las credenciales actuales de la cuenta.
--
-- POR QUÉ EXISTE. Hasta ahora, cambiar la contraseña no invalidaba nada: la
-- cookie solo lleva el id, así que una sesión de 30 días abierta en otro
-- dispositivo seguía viva después del cambio. Con cookies tan largas eso
-- importa MÁS, no menos — si alguien cambia la contraseña es porque sospecha
-- algo, y lo que quiere es echar a quien esté adentro.
--
-- CÓMO CORTA. `usuarioActual()` compara la emisión de la sesión contra esta
-- columna y descarta la que sea anterior. Ver src/lib/auth.ts y src/lib/sesion.ts.
--
-- NOT NULL, con la justificación que exige la regla 1: acá no hay «s/d»
-- posible. Toda cuenta tiene un momento desde el cual sus credenciales son las
-- actuales, y para una que nunca cambió la contraseña ese momento es su
-- creación. Por eso las filas existentes se rellenan con `creadoEn`, que es el
-- valor verdadero, y no con un DEFAULT inventado.
--
-- Tres pasos, como manda CLAUDE.md para agregar un NOT NULL a una tabla con
-- filas: agregar nullable, rellenar, recién ahí exigir NOT NULL.
-- Re-ejecutable: Prisma no envuelve el archivo en una transacción.

ALTER TABLE "usuario" ADD COLUMN IF NOT EXISTS "credencialesDesde" TIMESTAMP(3);

UPDATE "usuario"
   SET "credencialesDesde" = "creadoEn"
 WHERE "credencialesDesde" IS NULL;

ALTER TABLE "usuario" ALTER COLUMN "credencialesDesde" SET NOT NULL;
ALTER TABLE "usuario" ALTER COLUMN "credencialesDesde" SET DEFAULT CURRENT_TIMESTAMP;
