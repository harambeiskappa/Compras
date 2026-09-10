# Módulo 3 · Liquidación — documento de arranque

Medido antes de diseñar, como siempre. **117 compras y 345 renglones del último año.**

---

## 1. Lo primero que hay que entender: la liquidación vieja es casi toda dato derivado

Se reconstruyeron las fórmulas contra los datos reales. **Ocho columnas resultaron ser cuentas guardadas, no hechos:**

| columna | es exactamente | coincide en |
|---|---|---:|
| `detalle.importe` | `peso_liquidado × precio_kg` | **100 %** |
| `detalle.kg_x_cab` | `peso_liquidado / cabezas` | **100 %** |
| `detalle.total_c_iva` | `importe + iva + comisión` | **99 %** |
| `liq.importe_hacienda` | `Σ importe` de sus renglones | **100 %** |
| `liq.comision` | `Σ comisión` de sus renglones | **100 %** |
| `liq.impuestos` | `Σ iva` de sus renglones | **100 %** |
| `liq.compra_total` | `importe_hacienda + comisión` | **99 %** |
| `liq.costo_puesto_total` | `compra_total + flete` | **100 %** de las cargadas |
| `liq.costo_puesto_kg` | `costo_puesto_total / kg_llegada` | **100 %** de las cargadas |
| `liq.costo_puesto_cab` | `costo_puesto_total / cabezas` | **97 %** de las cargadas |

**Y dos hallazgos que valen por sí solos:**

**`importe_total` es una copia literal de `importe_hacienda`, en el 100 % de los casos.** Dos columnas, el mismo número, seis años. Nadie lo notó porque nada obliga a mirarlas juntas.

**`compra_total` NO es el total de la compra: es `hacienda + comisión`, sin impuestos.** Una columna que se llama «total» y no lo es. Cualquiera que la sume creyendo el nombre se equivoca por el IVA, que son unos once puntos.

**Esto define el trabajo del módulo 3 antes de empezar:** casi nada de lo que la planilla vieja *guarda* hay que guardarlo. Hay que guardar los **cuatro o cinco hechos** de los que sale todo lo demás, y calcular el resto — regla 2, «un concepto, un lugar».

---

## 2. Coberturas medidas

**En la cabecera (117 compras):**

| | |
|---|---:|
| `importe_total` · `importe_hacienda` · `compra_total` · `impuestos` | 99 % |
| `comision` | 94 % |
| `kg_llegada` | 71 % |
| `n_liquidacion` | **57 %** |
| `costo_puesto_total` · `_kg` · `_cab` · `costo_comercial_kg` | 53 % |
| `motivo` | 26 % |
| `kg_llegada_dudoso` | 18 % |
| `kg_origen` · `desbaste` · `cab_llegada` · `razon_social` · `n_dte` | **9 %** |
| `transportistas` · `reclamo_kg` · `reclamo_total` | 6 % |
| **`logistica_total` (flete)** | **1 %** |
| `factura_flete` · `costo_puesto_completo` · `cab_extra_wc` | 1-2 % |
| `desbaste_previsto` · `guias` · `observaciones` · `venta_directa` · `cab_otro_destino` · `kg_otro_destino` · `kg_extra_wc` | **0 %** |

**En el renglón (345):**

| | |
|---|---:|
| `importe` · `iva` · `total_c_iva` | 100 % |
| `comision` | 97 % |
| `peso_liquidado` · `precio_kg` · `kg_x_cab` | 91 % |
| `precio_ajustado` · `precio_con_comision` · `raza` | 11 % |
| `peso_llegada` · `precio_llegada` · `lote_llegada` | 7 % |
| `reclamo_kg` · `reclamo_monto` | 5 % |
| **`peso_origen` · `desbaste`** | **0 %** |

**La comisión sigue las dos tasas conocidas:** 2 % en el 52 % de los renglones y 3 % en el 36 %. **El 88 % cae en una de las dos**, lo que confirma la regla del feedlot y el campo — y explica por qué el gesto de «la misma para todos» resuelve casi todo.

---

## 3. Los tres agujeros que el módulo 3 existe para tapar

**1. El flete está en 1 de 117, y sin flete el «costo puesto» es el costo de compra con otro nombre.** Confirmado por Iñaki: **existe y lo pagamos, nunca se cargó**. O sea que las 62 compras que tienen un `costo_puesto_kg` cargado tienen un número que **no incluye el flete y se llama «puesto» igual**. Es el peor tipo de dato equivocado: no falta, miente. **Capturar el flete es la razón de ser de este módulo.**

**2. Los kilos de origen están en 0 % a nivel renglón, y el remito los trae casi siempre** — también confirmado por Iñaki. Es un agujero de captura puro, exactamente el que la app viene a tapar. **Y tiene una consecuencia que ya está construida:** el campo de kilos de la bandeja del módulo 2 es el que lo cierra.

**3. El desbaste está en 9 % — y no hay que guardarlo.** Sale de los kilos de origen y los de llegada. Con los dos capturados se calcula; sin ellos no existe, y guardarlo como columna es repetir el error de arriba.

---

## 4. La consecuencia estructural más importante

**El costo puesto por kilo se calcula sobre los KILOS DE LLEGADA** —verificado, 100 % de las que están cargadas—, **y los kilos de llegada son de la balanza, o sea del módulo 4.**

Es decir: **el módulo 3 no puede cerrar el número solo.** La liquidación fija lo que se paga; el costo puesto por kilo recién existe cuando la hacienda llegó y se pesó. Un diseño que prometa «el costo puesto» dentro del módulo 3 va a tener que mostrarlo en s/d la mitad del tiempo, o peor, calcularlo sobre los kilos liquidados y dar un número parecido pero distinto.

**Esto hay que decidirlo antes de escribir una línea**, y es la decisión #6 de abajo.

---

## 5. Decisiones abiertas

| # | Decisión | Bloquea |
|---|---|---|
| 1 | ~~¿La liquidación es una entidad propia o son campos de `Compra`?~~ **CERRADA el 10/09/2026: son campos de `Compra`.** Una tabla que siempre tendría exactamente una fila es el mismo concepto en dos lugares. `n_liquidacion` queda nullable: «sin liquidar» es un estado real, y está en el 43 % del histórico. | — |
| 2 | ~~¿Una compra puede tener más de una liquidación?~~ **CERRADA el 10/09/2026: no. Una compra, una liquidación.** No se pudo medir y hubo que preguntar: en el esquema viejo la liquidación **es** la fila de la compra, así que el caso múltiple no podría haber aparecido aunque existiera. **Un dato que el esquema no puede representar se ve idéntico a un dato que no existe.** | — |
| 3 | ~~¿Dónde viven los kilos liquidados?~~ **CERRADA el 10/09/2026: viven en `Lote` y ya están capturados en el módulo 2.** Los kilos del papel de la compra son los mismos que van a la liquidación y no se tocan. Un solo hecho, un solo lugar. La columna se renombra a `kilosLiquidados`. | — |
| 4 | ~~¿Qué compone `impuestos`?~~ **CERRADA el 10/09/2026: IVA más percepciones, y se guardan SEPARADOS.** Son conceptos distintos y no siempre están los dos. El sistema viejo los tiene fundidos en una sola columna `iva` por renglón —por eso da ~10,9 % y no 10,5 %— y **esa fusión es precisamente el motivo de separarlos**: hoy nadie puede decir cuánto fue IVA y cuánto percepción. Ninguno se recalcula desde una alícuota: se capturan. | — |
| 5 | ~~¿El flete es por compra, por carga o por camión?~~ **CERRADA el 10/09/2026: la factura viene POR CAMIÓN.** Vive en `Carga.flete`, que ya existe; el total de la compra se **calcula** sumando las cargas. El `logistica_total` de la cabecera era un total guardado más. Falta agregar la referencia de la factura al lado del monto (`factura_flete` está en 2 %). | — |
| 6 | ~~¿El costo puesto se cierra en el módulo 3 o en el 4?~~ **CERRADA el 10/09/2026: en ninguno, porque no se guarda.** Es `(compra + flete) / kilos de llegada`, y los kilos de llegada son de la balanza. Se **calcula** donde se muestre, y hasta que existan los kilos de llegada es **«s/d — faltan los kilos de llegada»**, que es información y no un hueco (regla 11). Ningún módulo lo «tiene». | — |
| 7 | ~~¿El reclamo de kilos es una entidad propia?~~ **CERRADA el 10/09/2026: sí, tabla propia.** Es un **reclamo al consignatario que puede o no prosperar**, así que tiene estado y fecha: es un hecho con vida propia, no dos columnas del renglón. Y **nunca pisa los kilos ni el importe** — se guarda al lado, como todo lo demás en este proyecto. | — |
| 8 | ~~¿Qué son `precio_ajustado` y `precio_con_comision`?~~ **RESUELTA midiendo el 10/09/2026: las dos son derivadas y las dos dependen de la llegada.** `precio_ajustado` es el **precio por kilo llegado** —`importe / peso_llegada` en el 66 % de los casos y prorrateado a nivel compra en el 34 % restante, o sea 100 % entre las dos formas—. Y `precio_con_comision = precio_ajustado × (1 + comisión/importe)` en el **100 %**. No se guardan: se calculan, y pertenecen a la misma familia que el costo puesto. | — |

**Las ocho están cerradas al 10/09/2026.** Tres se cerraron midiendo (#3, #6, #8), cinco preguntando (#1, #2, #4, #5, #7). **Las que se preguntaron son, en todos los casos, las que el esquema viejo no podía contestar** — porque fundía dos conceptos en una columna, o porque no tenía dónde representar el caso.

**No re-decidir ninguna por cuenta propia.** Si algo no cierra, decir cuál y qué se está suponiendo.

---

## 5 bis. El módulo 3 es más fino de lo que parecía

**Con los kilos y el precio ya capturados en el módulo 2, el importe de la compra se puede calcular hoy.** Lo que agrega la liquidación es una capa delgada:

- el **número de liquidación** y su fecha,
- los **impuestos** —hay que averiguar qué los compone: no es 10,5 % exacto—,
- el **flete** con su factura, que es el agujero grande y la razón de ser del módulo,
- los **reclamos**, que **no pisan los kilos**: se guardan al lado, con su monto.

Eso cambia el peso de la decisión #1: si la liquidación agrega cuatro cosas y no reescribe ninguna, la pregunta «entidad propia o campos de `Compra`» se decide casi enteramente por la #2 —si una compra puede liquidarse más de una vez—, y no por el volumen de datos.

## 5 ter. Un hallazgo para el módulo 4: el desbaste puede ser NEGATIVO

Entre las compras con desbaste cargado aparecen **−6,3 %, −1,85 % y −1,74 %**: la hacienda llegó **pesando más** de lo liquidado. No es un error de carga, es un hecho — y es exactamente la misma forma que «cabezas compradas ≠ cabezas llegadas, **en los dos sentidos**».

Cualquier validación que asuma desbaste ≥ 0 va a rechazar casos reales. Anotado acá porque se descubre midiendo la liquidación pero se paga en el módulo 4.

## 6. Lo que este módulo NO incluye

Los kilos de llegada, el desbaste real y las cabezas llegadas son de la balanza: **módulo 4**. Acá solo se los referencia si ya existen.

---

## 7. La verificación exigida

La misma forma que el módulo 1: **representar las 117 compras del último año en el modelo nuevo y listar las que no entren, con el motivo.** Criterio estructural, no numérico. Y un chequeo propio de este módulo:

**Recalcular las ocho columnas derivadas de §1 desde los hechos capturados y comprobar que dan el mismo número que la planilla vieja.** Si el modelo nuevo no puede reproducir el importe que se pagó, el modelo está mal — no la planilla.
