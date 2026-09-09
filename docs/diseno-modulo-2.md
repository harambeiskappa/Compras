# Módulo 2 · La pantalla del comprador — documento para el diseño

Este documento va a Claude Design. Tiene tres secciones y **hay que leerlas distinto**:

- **§1 Restricciones de dominio** — no negociables. Cada una con su porqué, porque una restricción que no se entiende se saltea.
- **§2 Propuesta de rutas y pantallas** — **negociable**. Es un punto de partida, no una decisión tomada.
- **§3 Preguntas abiertas** — son del diseño, no del dominio. No tengo opinión y no debería tenerla.

**Regla de desempate:** si una propuesta de diseño no viola nada de §1, **gana el diseño**.

**Qué tiene que volver:** la propuesta, y aparte **qué puntos de §2 cambia y por qué**. Sin esa lista no se puede chequear contra §1.

---

## Contexto mínimo

La app reemplaza el Excel con el que se registra la compra de hacienda. El **módulo 1** —la identidad de la compra— ya está hecho y andando: lo usa la oficina, con conexión, en una computadora.

**Este documento cubre otra cosa: lo que carga el comprador, parado en la feria, con el celular en la mano.** Se llama *reporte*, y es lo que **inicia** la compra. Después la oficina lo toma y arma la compra de verdad —tropas, camiones, lotes, kilos, precios—, que es otra pantalla y se diseña aparte.

El comprador es un rol distinto (COMERCIAL) y tiene su propia cuenta. No edita compras: manda reportes.

**Y hay un camino que no pasa por acá.** En más de la mitad de las compras —la feria de Darwash es la mitad de todo— la oficina accede directamente a los remitos y **no hay reporte ninguno**. O sea: esta pantalla es importante pero **no es obligatoria**, y un diseño que asuma que toda compra empieza acá está asumiendo mal.

### Vocabulario, que se confunde todo el tiempo

| Término | Qué es |
|---|---|
| **hacienda** | los animales. Nunca «ganado», nunca «animales» en la interfaz. |
| **cabezas** | la unidad de conteo. Nunca «unidades» ni «animales». |
| **consignatario** | quien remata o intermedia la venta. **No es solo «la feria»**: también actúa en la compra directa. |
| **plaza** | el lugar donde se compró. |
| **remito** | el papel que acompaña la hacienda. De ahí sale casi todo el dato después. |
| **«s/d»** | sin dato. Es la palabra de la casa. Nunca «N/A», «—», «desconocido» ni un campo vacío a secas. |

---

## Datos reales, con sus agujeros

Medido sobre las **117 compras del último año**. Están acá para que el diseño trabaje con nombres y tamaños reales, no con «Lorem».

**Consignatarios — 11 nombres, y uno es la mitad de todo:**

| | compras | |
|---|---:|---:|
| Darwash | 59 | 50 % |
| Martin y Alonso SRL | 15 | 13 % |
| **(vacío)** | **14** | **12 %** |
| Feria Rodeo Huinca (Renanco) | 11 | 9 % |
| Ferialvarez | 8 | 7 % |
| Testa Lelli Liaudat · Haciendas Villaguay · Bressan y Cia | 2 c/u | |
| Vicar Ganadera · Talano Hnos · Saenz Valiente Bullrich · Colombo y Magliano | 1 c/u | |

**Las 14 vacías son el agujero que esta pantalla existe para tapar.** El consignatario siempre existe —también en la compra directa— pero en el sistema viejo, con un campo rotulado como si fuera «la feria», quien compraba directo lo dejaba en blanco.

Y **un orden alfabético entierra a Darwash**, que es la mitad de las compras. Ordenar por uso.

**Plazas conocidas (12):** Washington · Huinca Renanco · Río Cuarto · General Villegas · Córdoba · Villa Mercedes · Carlos Casares · Buena Esperanza · Del Campillo · Huanguelén · El Campillo · Vicuña Mackenna. Son sugerencias, no una lista cerrada: aparecen plazas nuevas.

**Tamaño de una compra, en cabezas:** mínimo 13 · **mediana 80** · p90 328 · máximo 859. O sea que el campo de cabezas es casi siempre de dos o tres dígitos, y alguna vez de tres largos.

**Renglones por compra:** mediana 2, p90 6, máximo 9. **Eso lo carga la oficina, no el comprador** — está acá para dejar claro el tamaño de lo que *no* va en esta pantalla.

---

## §1 · Restricciones de dominio — no negociables

**1. Funciona sin señal, de cero. No es un modo degradado: es el peor escenario para el que la app tiene que estar preparada.**
Lo normal es que haya conexión —Starlink en la computadora, datos móviles en el celular—, pero el comprador tiene que poder llegar a la feria sin nada y cargar el reporte entero igual. Consecuencias que el diseño tiene que absorber: la pantalla **abre sin red**, lo cargado **se guarda en el equipo** apenas se escribe, y se manda solo cuando hay señal. **Y manda una sola vez**: si la conexión va y viene, no pueden aparecer dos reportes iguales.

**2. El estado de un reporte se ve sin buscarlo.**
Borrador, esperando señal, enviado, procesado por la oficina. Si el comprador no puede distinguir «lo mandé» de «está esperando señal», va a mandar de nuevo — o peor, va a creer que mandó algo que no salió. En una pantalla que a veces trabaja sin red, **el estado del envío es contenido, no un detalle de implementación**.

**3. Sin dato es «s/d», nunca 0 ni un campo en blanco ambiguo.**
«No sé cuántas cabezas» y «cero cabezas» son afirmaciones distintas. El sistema viejo tiene 19 columnas numéricas que ponen 0 cuando no hay dato, y por eso hoy nadie puede distinguir una cosa de la otra. Ese es el error que esta app existe para no repetir. Un campo vacío tiene que **verse vacío a propósito**.

**4. El reporte es evidencia, no un formulario de carga.**
Guarda **lo que el comprador escribió**, no una interpretación. La oficina no lo pisa: arma la compra al lado, y el reporte sigue existiendo aunque termine registrando otra cosa. Esa diferencia —el remito dice VQ, el comprador dice VA— es justamente lo que interesa conservar, porque el consignatario clasifica para vender y el comprador mira lo que se lleva.

**5. Se puede corregir mientras la oficina no lo haya procesado. Después queda congelado, y eso se ve.**
Un reporte pendiente es editable; uno procesado, no. La diferencia tiene que leerse de un vistazo, y **cuando algo no se puede editar, la pantalla dice por qué** — no simplemente deshabilita un botón.

**6. El número de remito va al lado de la foto y es opcional.**
Si lo tipea, entra; si no, queda «s/d» y lo completa la oficina leyendo el papel. **Hacerlo obligatorio sería pedirle precisión a alguien parado en un remate**, y ahí la gente inventa un número o directamente no carga la foto. La foto es lo que no puede faltar.

**7. El campo del consignatario no se puede rotular «Feria».**
El consignatario existe también en la compra directa. Con ese rótulo, quien compra directo lo lee como que no le corresponde y lo deja vacío — que es exactamente el agujero de las 14 compras de arriba.

**8. La pantalla solo puede capturar lo que hay dónde guardar.**
La lista completa es: **fecha · consignatario · plaza · cabezas aproximadas · cantidad de camiones · observaciones**, y por cada foto: **el archivo · el número de remito · una nota**. Nada más. Si el diseño necesita mostrar algo que no está en esa lista, **decilo como pregunta**, no lo inventes: en el módulo 1 apareció una atribución que no tenía dónde vivir y la anotamos en vez de fabricarla.

**9. Se pide lo grueso, lo que se puede contar con una mano en un remate.**
Cabezas aproximadas y camiones. **No** categorías, **no** kilos, **no** precios, **no** DTE: eso lo pone la oficina con el papel delante. Cada etapa captura lo que sabe y nada más.

**10. Un consignatario o una plaza que no están en la lista no pueden frenar la carga.**
Se crean ahí mismo. Detalle que importa para el diseño: **sin señal se guarda el nombre escrito, no una selección de catálogo** — la entidad todavía no existe del otro lado, y la resuelve el servidor al recibir.

**11. Los avisos señalan, no bloquean.** Y cuando la app descarta o clasifica algo, **dice en una línea por qué**. Quien entiende la razón puede corregirla; quien solo ve el resultado, no.

**12. Es un celular, en la mano, en un remate.**
Con ruido, a veces al sol, a veces con una sola mano libre. No es una restricción de estilo: es la condición de uso.

---

## §2 · Propuesta de rutas y pantallas — negociable

Punto de partida. Cambiar lo que haga falta y decir qué se cambió.

| Ruta | Para qué |
|---|---|
| `/reportar` | cargar un reporte nuevo |
| `/reportes` | ver los propios y volver a uno pendiente |
| `/reportes/[id]` | ver o corregir uno |

**Punto de entrada del comercial.** Propongo que al entrar caiga en `/reportar`, porque el 90 % de las veces abre la app para cargar algo, no para mirar. Pero §1.2 y §1.5 piden que la lista esté a un toque.

**Campos del formulario.** Ninguno obligatorio salvo que exista *algo*: fecha (por defecto hoy), consignatario, plaza, cabezas aproximadas, camiones, observaciones, y el bloque de fotos con número y nota por cada una.

**Qué identifica un reporte en la lista.** Propongo fecha, consignatario y cabezas, más el estado. Deliberadamente **no** propongo un número correlativo: el id es un identificador, no un contador, y hay huecos.

---

## §3 · Preguntas abiertas — son del diseño

No tengo opinión sobre ninguna de estas.

1. **¿Cómo se ve «esperando señal»** de modo que tranquilice en vez de asustar? Es el estado normal en el campo, no un error.
2. **¿Cómo se confirma un envío que todavía no ocurrió?** No se puede decir «enviado» si está en la cola, pero tampoco se lo puede dejar sin respuesta después de apretar el botón.
3. **¿El formulario es una sola hoja o por pasos**, en una pantalla de celular con ocho campos y un bloque de fotos?
4. **¿Cómo se ve el bloque de fotos** —archivo, número opcional, nota— sin que se coma la pantalla cuando hay cuatro remitos?
5. **¿Cómo se ofrece el número de remito sin que parezca obligatorio?** (§1.6)
6. **¿Cómo se crea un consignatario o una plaza que no están, desde un celular y sin señal?** En el módulo 1 esto terminó siendo un combo con tres estados según qué haya en pantalla.
7. **¿Cómo se distingue un reporte editable de uno congelado**, en la lista y adentro?
8. **¿Qué ve el comercial la primera vez, cuando no tiene ningún reporte?**
9. **¿Cómo se pone «s/d» a un campo numérico** de modo que sea más fácil que inventar un número? En el módulo 1 se eligió un botón al lado del campo.

---

## Lo que este módulo no incluye

Tropas, lotes, categorías, kilos, precios, comisiones, fletes, DTE y liquidación. Todo eso es de la oficina y se diseña aparte. **La bandeja de pendientes de la oficina —donde un reporte se convierte en una compra— es la otra mitad de este módulo y va en su propio documento**, para no mezclar dos usuarios, dos dispositivos y dos condiciones de uso en la misma conversación.
