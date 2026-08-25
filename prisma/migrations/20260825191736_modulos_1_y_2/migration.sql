-- CreateEnum
CREATE TYPE "ModalidadPrecio" AS ENUM ('KG', 'CABEZA', 'BULTO');

-- CreateEnum
CREATE TYPE "ModalidadComision" AS ENUM ('PORCENTAJE', 'MONTO');

-- CreateEnum
CREATE TYPE "TipoAdjunto" AS ENUM ('REMITO_FERIA', 'ORIGEN_TERCERO', 'IMPRIMIBLE');

-- CreateTable
CREATE TABLE "empresa" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "esPropio" BOOLEAN,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prefijo_tropa" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "empresaId" INTEGER NOT NULL,

    CONSTRAINT "prefijo_tropa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consignatario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consignatario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendedor" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotelero" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotelero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona_compradora" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persona_compradora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria_sinonimo" (
    "id" SERIAL NOT NULL,
    "texto" TEXT NOT NULL,
    "textoNormalizado" TEXT NOT NULL,
    "categoriaCanonicaId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categoria_sinonimo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compra" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "consignatarioId" INTEGER NOT NULL,
    "empresaTitularId" INTEGER NOT NULL,
    "vendedorId" INTEGER,
    "hoteleroId" INTEGER,
    "personaCompradoraId" INTEGER,
    "plazaLugar" TEXT,
    "comision" DECIMAL(14,2),
    "comisionModalidad" "ModalidadComision",
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tropa" (
    "id" SERIAL NOT NULL,
    "compraId" INTEGER NOT NULL,
    "empresaCompradoraId" INTEGER NOT NULL,
    "nroTropa" TEXT,
    "fecha" DATE,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tropa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carga" (
    "id" SERIAL NOT NULL,
    "compraId" INTEGER NOT NULL,
    "tropaId" INTEGER,
    "dte" TEXT,
    "transportista" TEXT,
    "patente" TEXT,
    "fechaSalida" DATE,
    "destino" TEXT,
    "flete" DECIMAL(14,2),
    "cabezas" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lote" (
    "id" SERIAL NOT NULL,
    "compraId" INTEGER NOT NULL,
    "tropaId" INTEGER,
    "categoriaSinonimoId" INTEGER NOT NULL,
    "cabezas" INTEGER NOT NULL,
    "kilosOrigen" DECIMAL(10,2),
    "precio" DECIMAL(14,2),
    "modalidadPrecio" "ModalidadPrecio",
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lote_pkey" PRIMARY KEY ("id"),
    -- Agregado a mano (no lo genera Prisma): un lote existe para declarar una
    -- cantidad de cabezas de una categoría, así que 0 no es un hecho de negocio
    -- posible. En el histórico hay exactamente 1 fila con 0 cabezas y es un
    -- error de carga. NULL no aplica: la columna es NOT NULL.
    CONSTRAINT "lote_cabezas_positivas_check" CHECK ("cabezas" > 0)
);

-- CreateTable
CREATE TABLE "adjunto" (
    "id" SERIAL NOT NULL,
    "compraId" INTEGER NOT NULL,
    "tipo" "TipoAdjunto" NOT NULL,
    "url" TEXT NOT NULL,
    "numero" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adjunto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prefijo_tropa_codigo_key" ON "prefijo_tropa"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_codigo_key" ON "categoria"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_sinonimo_textoNormalizado_key" ON "categoria_sinonimo"("textoNormalizado");

-- CreateIndex
CREATE UNIQUE INDEX "tropa_nroTropa_key" ON "tropa"("nroTropa");

-- CreateIndex
CREATE UNIQUE INDEX "tropa_id_compraId_key" ON "tropa"("id", "compraId");

-- AddForeignKey
ALTER TABLE "prefijo_tropa" ADD CONSTRAINT "prefijo_tropa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categoria_sinonimo" ADD CONSTRAINT "categoria_sinonimo_categoriaCanonicaId_fkey" FOREIGN KEY ("categoriaCanonicaId") REFERENCES "categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_consignatarioId_fkey" FOREIGN KEY ("consignatarioId") REFERENCES "consignatario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_empresaTitularId_fkey" FOREIGN KEY ("empresaTitularId") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "vendedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_hoteleroId_fkey" FOREIGN KEY ("hoteleroId") REFERENCES "hotelero"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_personaCompradoraId_fkey" FOREIGN KEY ("personaCompradoraId") REFERENCES "persona_compradora"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tropa" ADD CONSTRAINT "tropa_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tropa" ADD CONSTRAINT "tropa_empresaCompradoraId_fkey" FOREIGN KEY ("empresaCompradoraId") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carga" ADD CONSTRAINT "carga_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carga" ADD CONSTRAINT "carga_tropaId_compraId_fkey" FOREIGN KEY ("tropaId", "compraId") REFERENCES "tropa"("id", "compraId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_tropaId_compraId_fkey" FOREIGN KEY ("tropaId", "compraId") REFERENCES "tropa"("id", "compraId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_categoriaSinonimoId_fkey" FOREIGN KEY ("categoriaSinonimoId") REFERENCES "categoria_sinonimo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjunto" ADD CONSTRAINT "adjunto_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
