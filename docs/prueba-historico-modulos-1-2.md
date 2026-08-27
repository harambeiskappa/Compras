# Prueba contra el histórico — módulos 1 y 2

Punto 8.1 del prompt de arranque. Fecha: 2026-08-27.

Objetivo: intentar representar las compras del último año de WinCompras en el
modelo nuevo y decir cuáles no entran y por qué. Lo que se busca no es un
número, es separar tres cosas que se parecen y no son lo mismo: que **falte un
dato**, que el **modelo no pueda representar** un dato que sí existe, y que el
**origen se contradiga**.

## Resultado en una línea

**No apareció ningún caso (b).** Ninguna compra quedó afuera porque el modelo no
pudiera representarla. Las 58 que no entraron es porque el dato no está en el
origen — que es exactamente el agujero que la app existe para tapar.

| | |
|---|---|
| compras evaluadas | **120** |
| entraron | **62** |
| no entraron | **58** |
| (a) falta un dato | **58** |
| (b) el modelo no lo representa | **0** |
| (c) el origen es contradictorio | **13** (ninguna bloqueó la inserción) |

Filas que llegaron a escribirse antes de revertir: 62 compras, 69 tropas,
70 cargas, 209 lotes.

## Cómo se corrió

Script: `scripts/prueba-historico.ts`.

Todo dentro de **una transacción que al final se aborta a propósito**. No quedó
ninguna fila: verificado después de correr, las 9 tablas que la prueba toca
(`compra`, `tropa`, `carga`, `lote`, `empresa`, `prefijo_tropa`,
`consignatario`, `vendedor`, `hotelero`) volvieron a 0, y los 217 sinónimos
sembrados quedaron intactos. Los `SERIAL` avanzaron, que no importa.

Dos decisiones que hacen que la prueba mida lo que dice medir:

- **Las inserciones van con SQL parametrizado, no con el cliente tipado.** Con
  el cliente, Prisma rechaza en memoria antes de tocar la base y lo que se
  estaría probando es la validación de Prisma, no las constraints. Así quien
  rechaza es Postgres: NOT NULL, FK compuestas, CHECK y unique de verdad.
- **Cada compra va dentro de su propio `SAVEPOINT`.** En Postgres, una sola
  violación aborta la transacción entera; sin savepoints la prueba se habría
  detenido en el primer fracaso y no habría podido medir las otras 119.

Corre por la conexión directa (session mode, `POSTGRES_URL_NON_POOLING`) por ser
una transacción larga.

Los catálogos que faltaban se crearon dentro de la misma transacción: las 11
empresas desde `catalogos_comprador` **con nombre placeholder**
(`(pendiente razón social) PEG`, etc. — la razón social real está bloqueada
esperando a Iñaki y no se inventó), y consignatarios, vendedores y hoteleros
desde los textos del histórico. Las categorías son las ya sembradas de verdad.

## Discrepancia en el universo: 120, no 118

El pedido decía 118 compras con `fecha_compra >= 2025-08-24`. **La consulta
devuelve 120.** No encontré ningún filtro que dé 118:

| corte | compras |
|---|---|
| `>= 2025-08-22` | 122 |
| `>= 2025-08-24` a `>= 2025-08-28` | **120** |

`venta_directa` es `0` en las 120, no hay duplicados por `hash_archivo`, y
ningún valor de `motivo` u `origen` recorta a 118. Se trabajó con las 120 y la
diferencia queda anotada acá para resolverla.

## (a) Falta un dato que el formulario nuevo va a exigir — 58

No son defectos del modelo. Son columnas `NOT NULL` que el origen no tiene, y
por eso el módulo 1 las va a pedir.

| motivo | compras |
|---|---|
| falta empresa titular | 44 |
| falta empresa titular **y** consignatario | 9 |
| falta consignatario | 5 |

Totales por campo: **53 sin empresa titular** (coincide exactamente con lo
previsto) y **14 sin consignatario**; se superponen en 9, de ahí las 58.

**Sin empresa titular (44):**
5325, 5365, 5402, 5418, 5452, 5498, 5518, 5527, 5528, 5575, 5645, 5647, 5678,
5682, 5769, 5770, 5842, 5851, 5884, 5890, 5898, 5943, 5985, 6023, 6097, 6113,
6157, 6224, 6245, 6246, 6293, 6294, 6295, 6296, 6299, 6300, 6302, 6303, 6305,
6306, 6308, 6309, 6317, 6318

**Sin empresa titular y sin consignatario (9):**
5712, 5810, 5844, 5845, 5883, 6067, 6074, 6193, 6217

**Sin consignatario (5):**
5410, 5560, 5690, 5946, 6298

En el origen, `comprador` es texto libre y toma solo cinco valores en el año:
`PEG` (62), `''` (53), `TAP` (3), `UGM` (1), `BUL` (1).

## (b) El dato existe pero el modelo no lo puede representar — 0

**Ninguna.** Es el resultado que la prueba venía a buscar y salió limpio.

En particular, no hubo una sola violación de las constraints que más riesgo
tenían:

- `lote.cabezas` es la única columna de cantidad `NOT NULL` y lleva
  `CHECK (cabezas > 0)`. De los 351 lotes del año: 0 con cabezas nulas, 0 con
  cabezas en cero, 0 negativas. El CHECK no rechazó nada.
- `lote.categoriaSinonimoId` es `NOT NULL`. Los 59 códigos de categoría
  distintos que usan esos lotes resolvieron todos contra sinónimos sembrados.
  Ninguno quedó sin correspondencia.
- `tropa.nroTropa` es `UNIQUE`. No hay número de tropa repetido ni vacío, y
  ninguna tropa aparece linkeada a más de una compra.
- `tropa.empresaCompradoraId` es `NOT NULL`. De las 116 tropas linkeadas por
  conciliación, 0 tienen comprador nulo.

## (c) El origen es contradictorio — 13

Ni el modelo ni el dato están mal: hay que decidir qué significan. **Ninguna de
estas trece impidió la inserción** — el modelo las representa sin problema. Doce
entraron; la 6298 quedó afuera por (a), por una razón distinta a su
contradicción.

### El texto y la conciliación no coinciden en cuántas tropas hay (4)

| compra | dice el texto | linkea la conciliación |
|---|---|---|
| 6298 | 1 | 3 |
| 6311 | 1 | 3 |
| 6313 | 1 | 3 |
| 6315 | 3 | 4 |

La 6315 es el caso ya conocido. Las otras tres son del mismo tipo y no estaban
identificadas.

### La empresa titular no está entre las empresas de sus tropas (9)

| compra | titular | empresas de sus tropas |
|---|---|---|
| 5583 | PEG | PEC |
| 5584 | PEG | PEC |
| 6266 | PEG | PEC |
| 6288 | TAP | LTP |
| 6297 | PEG | BUL |
| 6301 | TAP | BUL |
| 6304 | BUL | PEG |
| 6316 | PEG | SAG |
| 6319 | TAP | LTA |

Estas nueve violan la validación del módulo 2 (la titular tiene que aparecer
entre las empresas de las tropas de esa compra). No la violan «por poco»: la
titular no figura en absoluto. Es distinto del caso legítimo de la regla de
dominio, donde una empresa chica se cuelga de la compra de otra y **las dos**
aparecen entre las tropas.

Importa que esa validación es de aplicación y no de base — por eso estas nueve
entraron igual. Si el módulo 2 la aplica tal como está escrita, estos nueve
casos históricos no se podrían cerrar sin corregir el dato o revisar la regla.

## Qué esta prueba NO ejercitó

Para que nadie lea el «0 casos (b)» como más de lo que es:

- **La FK compuesta de `lote` contra `tropa(id, compraId)` nunca se probó con un
  `tropaId` no nulo.** En el sistema viejo el lote no tiene ningún vínculo con la
  tropa, así que los 209 lotes entraron con `tropaId` en NULL, que es el caso que
  la restricción no evalúa. La FK compuesta de `carga` sí se ejercitó, en las 70
  cargas.
- **`carga.cabezas` entró siempre en NULL**: el DTE viejo no registra cabezas.
- **`Adjunto`, `PersonaCompradora` y `plazaLugar` no se probaron**: no existen en
  el origen bajo ninguna forma.
- La compra **6224 no tiene ningún lote** en el origen. El modelo acepta una
  compra sin lotes, así que no habría fallado por eso; quedó afuera por (a),
  porque le falta la empresa titular.

## Conclusión

El modelo aguanta el histórico. Lo que no entra, no entra por falta de dato en
el origen, no por cómo está modelado — y las 53 compras sin empresa titular son
la medida exacta del problema que la app viene a resolver.

Quedan dos cosas para decidir, ninguna de las cuales toca el esquema: qué hacer
con las 13 contradicciones del origen, y por qué el universo da 120 y no 118.
