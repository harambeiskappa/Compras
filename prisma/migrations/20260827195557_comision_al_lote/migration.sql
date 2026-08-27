/*
  Warnings:

  - You are about to drop the column `comision` on the `compra` table. All the data in the column will be lost.
  - You are about to drop the column `comisionModalidad` on the `compra` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "compra" DROP COLUMN "comision",
DROP COLUMN "comisionModalidad";

-- AlterTable
ALTER TABLE "lote" ADD COLUMN     "comision" DECIMAL(14,2),
ADD COLUMN     "comisionModalidad" "ModalidadComision";
