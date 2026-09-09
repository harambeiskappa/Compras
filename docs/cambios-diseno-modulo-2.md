# Módulo 2 — cambios del diseño sobre la propuesta original

Registro de lo que Claude Design cambió respecto de la §2 de `diseno-modulo-2.md`, y por qué.

**Regla de desempate:** si un cambio no viola una restricción de §1, gana el diseño. **Los seis cambios se revisaron uno por uno y ninguno la viola**, así que quedan todos. Las nueve preguntas de §3 quedaron resueltas.

---

## Los cambios sobre §2

| §2 decía | Qué se hizo | Por qué |
|---|---|---|
| Rutas `/reportar`, `/reportes`, `/reportes/[id]` | Sin cambios | Alcanzan |
| Entrada en `/reportar`, con la lista a un toque | Igual, más **barra fija de dos pestañas abajo** | §1.2 pide el estado sin buscarlo; dos pestañas al alcance del pulgar lo dan siempre |
| — | **Aviso de cola arriba, en todas las pantallas** | El estado de la cola es contenido (§1.2), y en `/reportar` no habría dónde verlo |
| La lista identifica con fecha, consignatario, cabezas y estado | Se sumaron **plaza y cantidad de remitos** | Dos ferias del mismo día del mismo consignatario pasan; y «sin fotos» avisa de un reporte flojo |
| Sin correlativo | Igual, y **el id no se muestra** | Un id con huecos a la vista invita a leerlo como contador |
| Camiones como campo numérico | **Teclas de 1 a 6+ y s/d** | Una mano, sin teclado. *(La razón que dio estaba equivocada — ver abajo.)* |
| Fecha por defecto hoy | Igual, **con la razón al lado**: «si la feria fue ayer, se cambia» | §1.11 |

## Las nueve de §3, resueltas

1. **«Esperando señal» es ámbar, con un punto que late despacio**, y siempre con la razón: «está guardado en el teléfono y sale solo en cuanto haya señal». **Nunca rojo** — no es un error, es el estado normal en la feria.
2. **El acuse de un envío que todavía no ocurrió es una pantalla completa**, no un cartelito: «Quedó guardado. Sale solo cuando haya señal», con el resumen de lo mandado y la frase que hace falta oír: «podés apagar el teléfono o irte de la feria». Con señal, la misma pantalla dice «Llegó a la oficina».
3. **Una sola hoja** (elegida por Iñaki; la variante por pasos existía y se descarta).
4. **Remitos en fila**, cada foto con su número y su nota debajo (elegida por Iñaki; se descarta «tira + detalle»).
5. **El número de remito no parece obligatorio**: fondo hundido, sin rótulo propio, placeholder «número — si no, lo pone la oficina», y un pie que dice qué pasa si se deja: «va a quedar en s/d y la oficina lo lee del papel».
6. **Consignatario y plaza abren una hoja desde abajo** con los tres estados del módulo 1, más una línea al pie cuando no hay señal: «se guarda el nombre tal como lo escribiste» (§1.10).
7. **Editable contra congelado:** banda de color arriba con el estado y su explicación. **Congelado no muestra campos deshabilitados sino texto plano**, y dice por qué: «la oficina ya armó la compra… es lo que viste en la feria y así se guarda».
8. **La primera vez son tres pasos numerados** de qué es un reporte, aclarando que sin señal funciona igual.
9. **«s/d» en cabezas es un botón rayado al lado del campo**; en camiones es una tecla más de la fila de números. Misma forma que el módulo 1.

---

## Lo que hubo que corregir

**1. La razón de las teclas de camiones estaba equivocada, aunque la decisión esté bien.**

Design justificó el rango «1 a 6+» con «el p90 de renglones es 6». **Los renglones no son camiones**, y además el comprador no carga renglones: los carga la oficina. Era el número correcto de otra cosa.

Medido sobre las compras del último año con al menos un DTE — **86 de 117, o sea 74 % de cobertura**:

| camiones | compras | |
|---:|---:|---:|
| 1 | 68 | **79 %** |
| 2 | 10 | 12 % |
| 3 | 6 | 7 % |
| 4 | 2 | 2 % |

Mediana **1**, p90 **2**, máximo observado **4**.

O sea: **la primera tecla se lleva cuatro de cada cinco reportes**, y eso es lo que debería gobernar el diseño de esa fila. El rango hasta 6 no molesta y se deja, pero **el 4 es un piso y no un techo**: la captura de DTE del sistema viejo es floja —hay compras de 859 cabezas con un solo DTE registrado, que no cierra con ningún camión real— así que camiones de verdad puede haber más. Por eso la tecla «6+» tiene que existir de todas formas.

**2. «El reporte no guarda quién lo cargó» es incorrecto, y el error fue mío.**

`ReporteCompra` guarda **dos** atribuciones distintas, y la segunda se agregó el 28/08 con la auth:

- **`creadoPorUsuarioId`** — qué cuenta mandó el reporte.
- **`personaCompradoraId`** — quién fue físicamente a comprar, que puede ser alguien **sin cuenta**.

La §1.8 de mi documento listaba solo los campos que el comprador tipea y omitió los que salen de la sesión. La pregunta de Design estaba bien hecha —y su intuición sobre cuentas compartidas es exactamente por qué los dos campos existen separados— pero **el dato sí tiene dónde vivir**: no hay que inventar nada.

---

## Nota para la implementación

**Los cuatro estados no viven en el mismo lugar, y confundirlos rompe el offline.**

- **Borrador** y **esperando señal** son estados **del dispositivo**: viven en el almacenamiento local, junto con la cola de envío. El servidor no los conoce ni tiene por qué.
- **Enviado** (`PENDIENTE`) y **procesado** (`PROCESADO`) son `EstadoReporte`, en la base.

Un reporte esperando señal **no existe todavía del lado del servidor**. Intentar persistir ese estado sería pedirle a la base que sepa algo que, por definición, no le llegó.

---

## Un cambio posterior, forzado por el dominio

**«6+» no guarda 6: abre un campo para tipear el número exacto.**

El prototipo dejaba «6+» como una tecla más, y al implementarlo quedó a la vista que guardar `6` cuando fueron nueve **es inventar el dato** — regla 1, la que da origen a todo el proyecto. No vuelve a Claude Design porque no es una decisión de diseño: una restricción de dominio no admite empate.
