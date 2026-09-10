-- `Lote.kilosOrigen` pasa a llamarse `kilosLiquidados`.
--
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ EL SISTEMA VIEJO LO VENÍA GRITANDO Y NADIE LO ESCUCHÓ.                   │
-- │                                                                          │
-- │ `liquidaciones_detalleliquidacion` tiene LAS DOS columnas. Sobre los 345 │
-- │ renglones del último año:                                                │
-- │                                                                          │
-- │     peso_liquidado ... 91 %                                              │
-- │     peso_origen ......  0 %                                              │
-- │                                                                          │
-- │ Nadie decidió eso: LO DECIDIÓ EL VOCABULARIO. El papel dice «kilos       │
-- │ liquidados», así que la gente llenó la columna que se llamaba igual que  │
-- │ el papel y dejó vacía la otra. Es la tesis entera del proyecto en dos    │
-- │ columnas de la misma tabla.                                              │
-- │                                                                          │
-- │ Repetir en el esquema nuevo el nombre que quedó vacío en el viejo sería  │
-- │ elegir a propósito el que no se usa.                                     │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- El contraste que importa en el dominio es kilos LIQUIDADOS (la compra, acá)
-- contra kilos de LLEGADA (la balanza, módulo 4), y de ahí sale el desbaste.
-- El nombre nuevo lo hace más claro, no menos.
--
-- POR QUÉ AHORA: `lote` tiene 0 filas. Es lo más barato que va a ser nunca —
-- el mismo argumento del padrón único y del BULTO. Con compras cargadas, un
-- rename es una migración de datos y una coordinación; hoy es una línea.
--
-- Re-ejecutable: si la columna vieja ya no está, no hace nada. Un RENAME pelado
-- fallaría en la segunda corrida.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'lote'
       AND column_name = 'kilosOrigen'
  ) THEN
    ALTER TABLE "lote" RENAME COLUMN "kilosOrigen" TO "kilosLiquidados";
    RAISE NOTICE 'lote.kilosOrigen renombrada a kilosLiquidados';
  ELSE
    RAISE NOTICE 'lote.kilosOrigen ya no existe: no hay nada que renombrar.';
  END IF;
END $$;
