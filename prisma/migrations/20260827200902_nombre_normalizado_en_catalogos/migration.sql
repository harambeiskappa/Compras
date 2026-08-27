-- Agrega `nombreNormalizado` con UNIQUE a los cuatro catálogos que el
-- formulario crea al vuelo: consignatario, vendedor, hotelero y
-- persona_compradora. Hasta ahora nada impedía dos filas para la misma
-- entidad escrita distinto.
--
-- NO se hace con un ADD COLUMN ... NOT NULL pelado: `consignatario` ya tiene
-- 18 filas y Postgres lo rechaza sin default. El procedimiento es en tres
-- pasos — agregar nullable, rellenar desde `nombre`, recién ahí exigir
-- NOT NULL — y se aplica a las cuatro por igual, funcione la tabla vacía o no.
--
-- El translate de abajo es el equivalente EXACTO de normalizarNombre() en
-- src/lib/normalizar.ts. Si una cambia, la otra tiene que cambiar igual.
-- La `ñ` NO se pliega a propósito: en castellano es una letra propia, no una
-- `n` acentuada, y plegarla uniría «Peña» con «Pena». En los datos actuales
-- eso no es hipotético — «DOÑA ARVELIA SA» y «LEPORATI Y COMPAÑIA SA» son los
-- únicos dos nombres con diacríticos de todo el histórico.

-- consignatario
ALTER TABLE "consignatario" ADD COLUMN "nombreNormalizado" TEXT;
UPDATE "consignatario"
   SET "nombreNormalizado" = translate(lower(btrim("nombre")),
                                       'áàâäãéèêëíìîïóòôöõúùûü',
                                       'aaaaaeeeeiiiiooooouuuu');
ALTER TABLE "consignatario" ALTER COLUMN "nombreNormalizado" SET NOT NULL;

-- vendedor
ALTER TABLE "vendedor" ADD COLUMN "nombreNormalizado" TEXT;
UPDATE "vendedor"
   SET "nombreNormalizado" = translate(lower(btrim("nombre")),
                                       'áàâäãéèêëíìîïóòôöõúùûü',
                                       'aaaaaeeeeiiiiooooouuuu');
ALTER TABLE "vendedor" ALTER COLUMN "nombreNormalizado" SET NOT NULL;

-- hotelero
ALTER TABLE "hotelero" ADD COLUMN "nombreNormalizado" TEXT;
UPDATE "hotelero"
   SET "nombreNormalizado" = translate(lower(btrim("nombre")),
                                       'áàâäãéèêëíìîïóòôöõúùûü',
                                       'aaaaaeeeeiiiiooooouuuu');
ALTER TABLE "hotelero" ALTER COLUMN "nombreNormalizado" SET NOT NULL;

-- persona_compradora
ALTER TABLE "persona_compradora" ADD COLUMN "nombreNormalizado" TEXT;
UPDATE "persona_compradora"
   SET "nombreNormalizado" = translate(lower(btrim("nombre")),
                                       'áàâäãéèêëíìîïóòôöõúùûü',
                                       'aaaaaeeeeiiiiooooouuuu');
ALTER TABLE "persona_compradora" ALTER COLUMN "nombreNormalizado" SET NOT NULL;

-- Los unique van DESPUÉS del relleno. Si el histórico tuviera dos nombres que
-- colapsan al normalizar, esto falla acá y hay que resolverlo a mano — que es
-- el comportamiento que se quiere, no adivinar cuál gana.
CREATE UNIQUE INDEX "consignatario_nombreNormalizado_key" ON "consignatario"("nombreNormalizado");
CREATE UNIQUE INDEX "vendedor_nombreNormalizado_key" ON "vendedor"("nombreNormalizado");
CREATE UNIQUE INDEX "hotelero_nombreNormalizado_key" ON "hotelero"("nombreNormalizado");
CREATE UNIQUE INDEX "persona_compradora_nombreNormalizado_key" ON "persona_compradora"("nombreNormalizado");
