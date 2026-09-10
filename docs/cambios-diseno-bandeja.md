# Bandeja de la oficina — cambios del diseño sobre la propuesta original

**Regla de desempate:** si un cambio no viola §1, gana el diseño. **Los siete cambios se revisaron uno por uno y ninguno la viola.** Las diez preguntas de §3 quedaron resueltas.

---

## Los cambios sobre §2

| §2 decía | Qué se hizo | Por qué |
|---|---|---|
| Bandeja en `/bandeja` | Sin cambios | — |
| (implícito) un reporte da una compra | **Un reporte puede dar varias**: la tarjeta muestra las que ya salieron y ofrece «armar otra» | Es §1.2. Forzar 1-a-1 obliga a cargar dos veces el mismo papel |
| La bandeja lista fecha, consignatario, cabezas | Se sumaron **plaza, camiones, remitos, autor y la nota del comprador** | Con la nota a la vista se decide sin abrir; el autor es a quién preguntarle |
| Totales como campos | **Derivados, no guardados, con la cobertura al lado de cada uno** | §1.7 y §1.10 |
| Agregar renglón en blanco | **Dos botones**: en blanco y «otro igual al último, sin las cabezas», más Duplicar por renglón | Lo que cambia entre renglones son las cabezas; el resto se repite |
| (implícito) comisión precargada | **No se precarga sola: un renglón nuevo nace en «s/d»** | §1.4: un valor heredado en silencio es un dato que nadie escribió |
| Sin mención del camino sin reporte | Panel lateral que lo explica como el caso mayoritario | Si no, la ausencia del reporte se lee como algo roto |

## Las diez de §3, resueltas

1. **El reporte va al costado, fijo, en papel ámbar** contra el blanco de la carga, rotulado «LO QUE MANDÓ EL COMPRADOR» y con la regla escrita: **«es evidencia: se mira, no se toca»**. Verificado en el prototipo: no hay ningún control que lo edite.
2. **Las fotos se agrandan a pantalla completa**, con anterior/siguiente y el número debajo — que es el gesto real: leer el número del papel para copiarlo al renglón.
3. ~~Se piden los kilos POR CABEZA y el total se muestra derivado.~~ **REVERTIDO el 10/09/2026.** La medición que lo justificaba era mía y estaba mal leída: el 91 % de `kg_x_cab` es una **columna derivada** del peso liquidado. El papel real dice **los kilos del lote** y aclara el promedio al lado, así que **se pide el total y se muestra el promedio**. Ver `docs/prompt-kilos-total.md`.
4. **Los renglones son tarjetas apiladas, no filas de tabla** — ocho campos no entran en una fila legible.
5. **Los dos gestos —misma comisión, mismo establecimiento— están en una caja aparte que dice que no guarda una cabecera**: escribe el número en cada línea, con destello verde al aplicarse, y después cada una se cambia sola.
6. **Categoría de texto libre.** Si se reconoce, aparece el código canónico debajo (`VQ · vaquillona`); si no, un sello **SIN RESOLVER** y la frase «se guarda tal cual; lo resuelve una persona». Nunca adivina.
7. **La diferencia de cabezas no se resalta como error**: un texto al pie dice cuánto contó él y cuánto suman los renglones, y que no hay que igualarlos.
8. **Marcar procesado pide confirmación nombrando al comprador y diciendo qué pierde.** Reversible, con la advertencia de que él ya vio el cartel.
9. **La bandeja vacía es el estado protagonista**: dice que es como está la mayor parte del tiempo, explica por qué, y ofrece el camino real —registrar una compra— más los procesados de la semana.
10. **Descartar sin usar es una acción propia, con motivo obligatorio** (duplicado / error / la compra no se hizo). El reporte se guarda igual: es evidencia.

**§4, el quinto estado:** «no lo pudo recibir la oficina», en el color de los avisos y no en rojo, con el motivo concreto, la garantía de que nada se perdió, y dos salidas: mandarlo de nuevo (deshabilitado hasta arreglar lo que falta) o descartarlo.

---

## Lo que hubo que verificar y lo que hay que corregir

**El 93 % de comisión igual: verificado, y da 94 %.** Sobre las 74 compras del último año con más de un renglón, 71 permiten calcular el porcentaje: **67 tienen el mismo % en todos los renglones y 4 no (94 % / 6 %)**. La decisión de no precargar y resolverlo con un clic visible se sostiene.

**Y el establecimiento mixto es más fuerte de lo que yo había dicho:** de las 7 compras multi-renglón con algún establecimiento cargado, **5 lo tienen mixto**. No alcanza con preguntarlo una vez arriba.

**El motivo del descarte no tiene dónde vivir.** El diálogo promete «el comprador va a ver que se descartó **y por qué**», y `ReporteCompra` no tiene ningún campo para eso — `observaciones` es del comprador y es evidencia, así que la oficina no puede escribir ahí. **Hace falta una migración.** Es el mismo caso que la atribución «· oficina» del módulo 1, con la diferencia de que esta vez sí se agrega el campo, porque la pantalla ya promete el dato.

**Tres citas de §1 quedaron cambiadas de número** (dice §1.5 donde va §1.2, §1.3 donde van §1.7 y §1.10, §1.7 donde va §1.4). Las decisiones son correctas; los números no. Se anota para que nadie siga la cita en vez de la regla — ya nos pasó una vez que una decisión buena viniera con la razón equivocada.

**Y la pregunta de la atribución tiene respuesta.** «Lo mandó Ramiro» sale de la cuenta, y si dos personas la comparten, miente. Pero **no es el agujero del módulo 1: son dos campos distintos y los dos existen.** `creadoPorUsuarioId` dice **qué cuenta** lo mandó — y eso es siempre cierto—; `personaCompradoraId` dice **quién fue físicamente**, y puede ser alguien sin cuenta. **La pantalla tiene que rotular la cuenta como cuenta**, no afirmar la persona.
