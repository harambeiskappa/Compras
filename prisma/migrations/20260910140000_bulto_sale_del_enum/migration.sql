-- `BULTO` sale de `ModalidadPrecio`, que queda con `KG` y `CABEZA`.
--
-- POR QUÉ, Y NO ES COSMÉTICO. `BULTO` y `CABEZA` son lo mismo: en los dos
-- casos pasan un precio POR ANIMAL y el importe del renglón sale de
-- cabezas × precio. No hay ninguna operación que se pacte por el lote entero
-- —confirmado el 10/09/2026, ver regla 14 de CLAUDE.md—.
--
-- Dos valores que significan lo mismo son la misma enfermedad que un total
-- guardado: el mismo hecho en dos lugares. Y divergen solos — una persona
-- carga el trato como BULTO, otra el mismo trato como CABEZA, y a los seis
-- meses cualquier corte por modalidad reparte en dos una sola realidad.
--
-- EL DATO SE MUEVE ANTES DE TOCAR EL TIPO, como manda la regla de las
-- migraciones destructivas. El UPDATE no borra ni anula ningún renglón: el
-- trato era el mismo, solo estaba etiquetado con dos nombres. Al momento de
-- escribir esto la tabla tiene 0 filas con BULTO —la app todavía no cargó
-- renglones de verdad— así que el movimiento es gratis; el paso está igual
-- porque el archivo tiene que ser correcto el día que se corra sobre datos.
--
-- RE-EJECUTABLE: todo el bloque está guardado por «¿existe todavía BULTO?».
-- En la segunda corrida no hace nada. Sin esa guarda, el `= 'BULTO'` del
-- UPDATE fallaría con «invalid input value for enum» justamente porque la
-- primera corrida sacó la etiqueta.

DO $$
DECLARE
  movidas INTEGER := 0;
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'ModalidadPrecio'
       AND e.enumlabel = 'BULTO'
  ) THEN
    -- 1. El dato primero. La comparación va por ::text para no depender de que
    --    la etiqueta siga existiendo en el tipo.
    UPDATE "lote"
       SET "modalidadPrecio" = 'CABEZA'
     WHERE "modalidadPrecio"::text = 'BULTO';
    GET DIAGNOSTICS movidas = ROW_COUNT;
    RAISE NOTICE 'BULTO → CABEZA: % renglón(es) movido(s)', movidas;

    -- 2. Recién ahora el tipo. Postgres no sabe quitar una etiqueta de un enum,
    --    así que se crea el tipo nuevo, se convierte la columna y se descarta
    --    el viejo.
    CREATE TYPE "ModalidadPrecio_nuevo" AS ENUM ('KG', 'CABEZA');

    ALTER TABLE "lote"
      ALTER COLUMN "modalidadPrecio" TYPE "ModalidadPrecio_nuevo"
      USING ("modalidadPrecio"::text::"ModalidadPrecio_nuevo");

    DROP TYPE "ModalidadPrecio";
    ALTER TYPE "ModalidadPrecio_nuevo" RENAME TO "ModalidadPrecio";
  ELSE
    RAISE NOTICE 'BULTO ya no está en el enum: no hay nada que hacer.';
  END IF;
END $$;
