# Los kilos son un solo hecho: renombrar `kilosOrigen` — tarea para Claude Code

Va junto con `docs/prompt-kilos-total.md`. **Hacé los dos en la misma pasada**, son el mismo hallazgo.

---

## Lo que se confirmó

Los kilos del papel de la compra **son los mismos que van a la liquidación, y no se tocan.** No hay dos números: hay uno.

**Y el sistema viejo lo venía gritando sin que nadie lo escuchara.** `liquidaciones_detalleliquidacion` tiene **las dos columnas**: `peso_origen` y `peso_liquidado`. Medido sobre los 345 renglones del último año:

| | cobertura |
|---|---:|
| `peso_liquidado` | **91 %** |
| `peso_origen` | **0 %** |

**Nadie decidió eso: lo decidió el vocabulario.** El papel dice «kilos liquidados», así que la gente llenó la columna que se llamaba igual que el papel y dejó vacía la otra. Es la tesis entera del proyecto en dos columnas de la misma tabla.

## Qué hay que hacer

**Renombrar `Lote.kilosOrigen` a `Lote.kilosLiquidados`**, con la migración correspondiente.

**Por qué ahora:** `lote` tiene 0 filas. Es lo más barato que va a ser nunca — el mismo argumento del padrón único y del `BULTO`. Con compras cargadas, un rename es una migración de datos y una coordinación; hoy es una línea.

**Por qué vale la pena:** el campo se va a llamar como lo llama el papel y como lo llama la casa. **Repetir en el esquema nuevo el nombre que quedó vacío en el viejo sería elegir a propósito el que no se usa.**

Cuidado con dos cosas:

- El contraste que importa en el dominio es **kilos liquidados (compra)** contra **kilos de llegada (balanza, módulo 4)**, y de ahí sale el desbaste. El nombre nuevo lo hace más claro, no menos.
- Que no queden usos de `kilosOrigen` sueltos en pantallas, cálculos o verificaciones. Es rename, no alias.

## Y una consecuencia para el módulo 3

**El reclamo de kilos no pisa el número.** Existe `reclamo_kg` en el 5 % de los renglones, pero los kilos no se tocan: el reclamo es un hecho propio que se guarda **al lado**, con su monto. Misma forma que todo el resto del proyecto — se señala, no se reescribe.

## Verificación

1. No queda ninguna referencia a `kilosOrigen` en el repo.
2. La columna se llama `kilosLiquidados` en la base, sigue siendo nullable y sin default.
3. `npm run verificar` en verde.
