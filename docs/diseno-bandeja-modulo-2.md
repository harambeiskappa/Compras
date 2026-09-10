# Módulo 2 · La bandeja de la oficina — documento para el diseño

Tercer documento del mismo circuito. Se lee igual que los anteriores:

- **§1 Restricciones de dominio** — no negociables, cada una con su porqué.
- **§2 Propuesta de rutas y pantallas** — **negociable**.
- **§3 Preguntas abiertas** — son del diseño.
- **§4 Addendum** — un agregado corto a la pantalla del comprador, que ya está construida.

**Regla de desempate:** si una propuesta no viola nada de §1, **gana el diseño**.
**Qué tiene que volver:** la propuesta, y aparte **qué puntos de §2 cambia y por qué**.

---

## Contexto mínimo

Esta es la otra mitad del módulo 2, y **el otro usuario**. La pantalla del comprador ya está construida y andando: él manda un *reporte* desde la feria, con el celular, a veces sin señal.

**Acá la oficina toma ese reporte y arma la compra de verdad**: las tropas, los camiones y los renglones —lotes— con sus categorías, cabezas, kilos, precios y comisiones. Es una computadora, con conexión, sin apuro y con los papeles delante. **No se parece en nada a la pantalla del comprador y no debería parecerse.**

**El módulo 1 ya existe y funciona:** `/compras` lista, `/compras/nueva` da de alta y `/compras/[id]` muestra y edita la identidad de una compra —fecha, consignatario, empresa titular, vendedor, hotelero, plaza—. Lo que falta es todo lo que cuelga de eso.

### Vocabulario nuevo respecto de los documentos anteriores

| Término | Qué es |
|---|---|
| **tropa** | el agrupamiento con el que la hacienda entra al sistema del campo. Dice **a qué empresa nuestra le quedan** esas cabezas. |
| **carga** | un camión. Lleva su DTE, su transportista, su patente. |
| **lote / renglón** | una línea de la compra: tantas cabezas de tal categoría, a tal precio. **Es la unidad que sobrevive hasta la recepción.** |
| **categoría** | NV, NT, VQ, VA, TO, TM, TH, T. |
| **establecimiento** | a dónde va la hacienda de ese lote. La palabra de la casa; nunca «destino». |

---

## Datos reales, con sus agujeros

Medido sobre las **117 compras y 345 renglones del último año**.

**Cuántos renglones tiene una compra:** mediana **2**, p90 **6**, máximo **9**. No es una planilla de cien líneas, pero tampoco es un formulario de dos campos.

**Qué se carga hoy, por renglón:**

| | cobertura |
|---|---:|
| cabezas | **100 %** |
| comisión | 97 % |
| precio por kilo | 91 % |
| kilos **por cabeza** | 91 % |
| establecimiento | **10 %** |
| **peso de origen (total)** | **0 %** |

**Los últimos dos renglones de esa tabla son el hallazgo, y cambian el diseño.**

**Primero: el peso total de origen está en 0 %, pero los kilos por cabeza están en 91 %.** No es que no sepan los kilos: **es que la casa los escribe por cabeza, no en total.** Nuestro esquema guarda `kilosOrigen` como total —y está bien, porque el total es el hecho y el promedio por cabeza se calcula—, pero **si el formulario pide el total, está pidiendo un número que nadie tiene en la mano.**

**Segundo: el establecimiento está cargado en 35 de 345 renglones.** Ese hueco es medio proyecto: la comisión sigue al establecimiento —feedlot 2 %, campo 3 %— y sin él no se puede reconstruir nada. **Las 5 de 11 compras que sí lo tienen cargado lo tienen mixto**, así que no alcanza con preguntarlo una vez arriba.

**Cómo escriben las categorías** (los 12 valores más usados de 345 renglones):

| | | |
|---:|---:|---|
| 73 | 21 % | `vaca` |
| 28 | 8 % | `TM` |
| 25 | 7 % | `VA` |
| 21 | 6 % | `vaquillona` |
| 21 | 6 % | `novillo` |
| 21 | 6 % | `TH` |
| 19 | 6 % | `VQ` |
| 16 | 5 % | `novillito` |
| 15 | 4 % | `toro` |
| 13 | 4 % | `ternero` |
| 12 | 3 % | `NOV` |
| 9 | 3 % | `ternera` |

**Mezclan código y palabra todo el tiempo**, y la palabra gana: `vaca` sola es el 21 %. El sistema tiene 217 sinónimos que mapean a las 8 canónicas, **199 mapeados y 18 pendientes** —`nov/vaq`, `vac/cria`, `machos`, `130`— que son ambigüedades reales y no errores de tipeo.

**El precio:** 91 % por kilo. El resto, por cabeza o por bulto.

**Y el dato que gobierna el tamaño de la bandeja: más de la mitad de las compras no van a tener reporte.** En la feria de Darwash —el 50 % de las compras— la oficina accede a los remitos directamente. **La bandeja va a estar vacía la mayor parte del tiempo, y eso es lo normal, no una falla.**

---

## §1 · Restricciones de dominio — no negociables

**1. El reporte es evidencia y no se pisa nunca.**
Se mira al lado mientras se arma la compra; no se «convierte» en ella ni se edita desde acá. Si el remito dice una cosa y el comprador escribió otra, **las dos afirmaciones se conservan** — esa diferencia es lo que a los seis meses permite contestar «¿cuántas veces el comprador vio algo distinto del papel?».

**2. Un reporte puede producir cero, una o varias compras. Una compra sale de a lo sumo un reporte.**
No es un caso hipotético: está exigido como caso de prueba del documento de arranque, y por eso la relación vive del lado de la compra. Un diseño que asuma «un reporte = una compra» no puede representar lo que ya pasa.

**3. Más de la mitad de las compras no tienen reporte. La bandeja no puede ser el único camino para armar una compra.**
El alta directa de `/compras/nueva` sigue siendo el camino principal en volumen. La bandeja es el atajo cuando hubo reporte, no la puerta obligatoria.

**4. Sin dato es «s/d», nunca 0 ni un campo en blanco ambiguo.**
El sistema viejo tiene 19 columnas numéricas que ponen 0 cuando no hay dato, y por eso hoy «no se sabe» y «vale cero» son el mismo valor. Ese es el error que esta app existe para no repetir. **Y ojo con la comisión: hay renglones legítimos con comisión cero** — cero es un valor, s/d es otra cosa.

**5. Cada lote tiene identidad propia**, con sus cabezas, sus kilos, su categoría, su establecimiento y su comisión, y sobrevive hasta la recepción. **Las cabezas son lo único obligatorio de un lote**: un lote existe para declarar una cantidad de cabezas de una categoría.

**6. La comisión y el establecimiento viven en el renglón, no en la cabecera.**
«Todo al feedlot» y «la misma comisión para todos» son **gestos que rellenan las líneas de una sola vez**; lo que queda guardado es siempre el valor de cada línea. Guardar además un valor de cabecera pondría el mismo concepto en dos lugares, y divergirían apenas alguien cambie una línea y no la cabecera. **Medido: el destino de cabecera está cargado en 0 de 1047 liquidaciones del sistema viejo.** El dato siempre vivió en el renglón.

**7. Ningún total se guarda. Se calcula.**
El total de comisión de una compra es la suma de sus renglones. El sistema viejo lo guardaba —y era literalmente la suma, con los errores que eso trae—. Nada de filas «TOTAL».

**8. Si un texto de categoría no matchea el diccionario, no se adivina.**
Queda pendiente de mapeo y **lo resuelve una persona**. El lote se guarda igual, completo: lo único pendiente es la resolución canónica. Adivinar que `nov/vaq` es NV es inventar la mitad de un dato.

**9. Que la empresa titular no esté entre las empresas de las tropas es un aviso, nunca un bloqueo.**
La titular puede cambiar legítimamente entre la compra y la liquidación —pasa entre empresas muy vinculadas—. Medido: **9 de 120 compras del último año**. Bloquearlo impediría un caso real.

**10. Todo número agregado se muestra con su cobertura al lado.**
«kg promedio 412 — sobre 3 de 4 lotes». Un promedio sobre la mitad de los casos no es el mismo número que uno sobre todos, y la diferencia va **al lado**, no en una nota al pie. Acá es donde más importa: la bandeja es la primera pantalla del proyecto que suma cosas.

**11. Marcar un reporte como procesado lo congela del lado del comprador.**
Quien aprieta ese botón tiene que saber que del otro lado alguien pierde la posibilidad de corregir. No es una acción administrativa: es una que le saca algo a otra persona.

**12. El id de una compra es un identificador, no un contador.** Hay huecos y no son errores.

**13. Cada etapa captura lo que sabe y nada más.** Acá no se piden los kilos de llegada ni el desbaste: eso es la balanza, y es el módulo 4.

---

## §2 · Propuesta de rutas y pantallas — negociable

Punto de partida. Cambiar lo que haga falta y decir qué se cambió.

| Ruta | Para qué |
|---|---|
| `/bandeja` | los reportes que esperan ser procesados |
| `/compras/[id]` | **extendida**: además de la identidad que ya muestra, las tropas, los camiones y los renglones |

**La idea de fondo:** desde la bandeja se abre un reporte, se decide qué compra o compras salen de él, y se cae en `/compras/[id]` con el reporte **a la vista al costado** — sus fotos, sus notas, lo que el comprador escribió. La carga de renglones ocurre ahí, contra la evidencia.

**Qué identifica un reporte en la bandeja.** Fecha, consignatario, plaza, cabezas aproximadas, cuántas fotos trae y quién lo mandó. **No** un correlativo.

**El camino sin reporte** sigue siendo `/compras/nueva`, y la parte de renglones es la misma pantalla.

---

## §3 · Preguntas abiertas — son del diseño

1. **¿Cómo se ve el reporte al lado mientras se arma la compra?** Sus fotos hay que poder agrandarlas: el número de remito se lee de ahí.
2. **¿Cómo se cargan dos renglones sin que se sienta una planilla, y nueve sin que se sienta imposible?** La mediana es 2 y el p90 es 6.
3. **¿Se piden los kilos por cabeza o el total?** El dato de arriba dice que la casa escribe **por cabeza** (91 %) y el total nunca (0 %). El esquema guarda el total. ¿Se pide por cabeza y se muestra el total calculado, al revés, o los dos con uno derivándose del otro?
4. **¿Cómo se ofrece «la misma comisión para todos» y «todo al mismo establecimiento» de modo que se vea que rellenó renglones y no que guardó una cabecera?** (§1.6)
5. **¿Cómo se escribe una categoría** cuando el 21 % de las veces la persona va a tipear «vaca» y otras veces «VQ»? ¿Y cómo se ve una que **no matcheó** y quedó pendiente, sin frenar la carga?
6. **¿Cómo se ve el aviso de empresa titular** para que se lea y no se ignore por costumbre? (§1.9)
7. **¿Cómo se marca un reporte como procesado** sabiendo que eso le congela la pantalla a otra persona? (§1.11)
8. **¿Cómo se representa que un reporte dio dos compras?** Desde la bandeja y desde cada compra.
9. **¿Qué ve la oficina cuando la bandeja está vacía?** Es el estado más frecuente, no el excepcional.
10. **¿Cómo se descarta un reporte** —el que llegó por error o duplicado— de modo que se distinga de «lo procesé»?

---

## §4 · Addendum a la pantalla del comprador: el quinto estado

La pantalla del comprador está construida y verificada, con cuatro estados: **borrador**, **esperando señal**, **enviado** y **procesado**. Falta uno, y lo encontró la implementación.

**Un reporte que el servidor rechaza —un 4xx— no reintenta, y hace bien: reintentar no lo va a arreglar. Pero hoy queda en un callejón sin salida: no se puede ver, ni corregir, ni descartar desde la pantalla.** Solo se destraba borrando los datos del navegador.

**Es grave por lo que es, no por lo que rompe: un reporte atrapado es evidencia perdida**, que es exactamente lo que este módulo existe para no perder. Y es la misma regla del botón que queda muerto sin decir por qué, subida un nivel: lo que queda inutilizable ahora no es un botón, es un registro entero.

**La restricción de dominio, que no es negociable:** un reporte **nunca** puede quedar inalcanzable. La persona tiene que poder **verlo, corregirlo y reintentar**, o **descartarlo deliberadamente**.

**Lo que es del diseño:** cómo se ve ese estado. Los otros cuatro tienen un vocabulario que funciona —ámbar y nunca rojo, siempre con la razón al lado— y este es el único que **sí** es un problema de verdad y **sí** necesita que la persona haga algo. Encontrar dónde cae entre «no te asustes» y «esto no se arregla solo» es la pregunta.
