# Módulo 1 — Información de la compra · documento para el diseño

Este documento va a Claude Design. Tiene tres secciones y **hay que leerlas distinto**:

- **§1 Restricciones de dominio** — no negociables. Cada una con su porqué, porque una restricción que no se entiende se saltea.
- **§2 Propuesta de rutas y pantallas** — **negociable**. Es un punto de partida, no una decisión tomada.
- **§3 Preguntas abiertas** — son del diseño, no del dominio. No tengo opinión y no debería tenerla.

**Regla de desempate:** si una propuesta de diseño no viola nada de §1, **gana el diseño**.

**Qué tiene que volver:** la propuesta de diseño, y aparte, **qué puntos de §2 cambia y por qué**. Sin esa lista no se puede chequear contra §1.

---

## Contexto mínimo

La app reemplaza el Excel con el que se registra la compra de hacienda (ganado). Son cinco módulos; **este documento cubre solo el primero**.

El módulo 1 registra la **identidad de una compra**: cuándo, dónde, quién consigna, qué empresa nuestra compra, de quién era la hacienda. Nada más. Las cabezas, los kilos, los camiones y los precios son del módulo 2 y no existen todavía.

Lo usa **la oficina, con conexión**. El comprador parado en la feria con el celular es el módulo 2, que se diseñará aparte.

Por qué existe la app: de 120 compras del último año, 11 usaban la plantilla estándar y 109 eran archivos armados a mano. No se puede hacer cumplir una plantilla; sí se puede hacer cumplir un formulario. **Todo lo que el formulario no capture bien, no existe después.**

### Vocabulario, que se confunde todo el tiempo

| Término | Qué es |
|---|---|
| **consignatario** | quien remata o intermedia la venta. **No es solo «la feria»**: también actúa en la compra directa. |
| **empresa titular** | cuál de *nuestras* empresas registra la compra |
| **vendedor / origen** | de quién era la hacienda |
| **hotelero** | de quién es la hacienda una vez en el feedlot; puede ser un tercero |
| **persona compradora** | quién fue físicamente a comprar. No es la empresa. |

---

## §1 · Restricciones de dominio — no negociables

**1. Sin dato es «s/d», nunca 0 ni un espacio en blanco.**
Un cero se lee como un dato real. «No se sabe cuánto pesó» y «pesó cero» son afirmaciones distintas. El sistema viejo tiene 19 columnas numéricas que ponen 0 cuando no hay dato, y por eso hoy nadie puede distinguir una cosa de la otra. Ese es el error que esta app existe para no repetir. Un campo vacío tiene que **verse** vacío a propósito, no parecer un error de carga ni desaparecer de la pantalla.

**2. Ningún número agregado se muestra sin su cobertura al lado.**
«kg promedio 412 — sobre 3 de 4 lotes». Un promedio calculado sobre la mitad de los casos no es el mismo número que uno calculado sobre todos, y la diferencia va al lado del número, no en una nota al pie. *(En el módulo 1 casi no hay agregados, pero la regla aplica a cualquier cosa que se cuente.)*

**3. No se muestra un total que no se pueda calcular.**
En el módulo 1 no hay lotes, así que no hay cabezas ni kilos. No inventarlos, no mostrarlos en 0, no dejar la columna vacía esperando. Simplemente no están todavía.

**4. Los cuatro roles nunca se agrupan ni se intercambian.**
Consignatario, empresa titular, vendedor/origen y hotelero son cuatro cosas distintas, más la persona compradora. Agruparlos bajo un rótulo genérico tipo «Partes» o «Contactos» reintroduce exactamente la confusión que costó meses desarmar.

**5. El campo del consignatario no se puede rotular «Feria».**
El consignatario existe también en la compra directa. Con ese rótulo, quien compra directo lo lee como que no le corresponde y lo deja vacío — que es justo el agujero que estamos tapando.

**6. El selector de empresa titular muestra solo las empresas propias. El de hotelero, todas.**
Hay empresas de terceros en el catálogo: no compran para nosotros, pero su hacienda puede estar en nuestro feedlot. Ofrecerlas como titular invita a un error que después nadie detecta.

**7. Tres campos obligatorios, y ni uno más: fecha, consignatario, empresa titular.**
Todo lo demás es opcional y se puede dejar en «s/d» **a un toque, sin fricción**. Hacer obligatorio un dato que a veces no se conoce en ese momento hace que la gente invente datos, y un dato inventado es peor que un dato faltante: el faltante se ve.

**8. Vendedor, hotelero, persona compradora y consignatario se pueden crear sin salir del formulario.**
Aparece un vendedor que no está en el catálogo y eso no puede frenar la carga. **Las empresas no**: son nuestras, y crear una es una decisión, no un descuido.

**9. Los avisos señalan, no bloquean.**
Hay inconsistencias legítimas — por ejemplo, la empresa puede cambiar entre la compra y la liquidación. La app las marca y **una persona decide** si es un error o un caso real. Y ojo con el volumen: un cartel con 398 alertas equivale a no tener cartel.

**10. Cuando la app descarta o clasifica algo, dice en una línea por qué.**
Quien entiende la razón puede corregirla. Quien solo ve el resultado, no.

---

## §2 · Propuesta de rutas y pantallas — negociable

Punto de partida, no decisión tomada. Cambiar lo que haga falta y decir qué se cambió.

**Rutas propuestas**

| Ruta | Para qué |
|---|---|
| `/compras` | encontrar una compra existente |
| `/compras/nueva` | registrar una compra |
| `/compras/[id]` | ver y editar una compra |

**Qué identifica una compra en la lista.** Propongo fecha, consignatario y empresa titular. Es lo mínimo para reconocerla, y son justo los tres campos obligatorios. Deliberadamente **no** propongo cabezas ni kilos: no existen en este módulo (§1.3).

**Campos del formulario**

- *Obligatorios:* fecha, consignatario, empresa titular.
- *Opcionales:* vendedor/origen, hotelero, persona compradora, plaza o lugar, comisión y su modalidad (porcentaje o monto), observaciones.

**Punto de entrada.** Hoy la app no tiene ninguno: es el scaffold de Next.js. Habría que definir a dónde llega alguien que abre la raíz.

---

## §3 · Preguntas abiertas — son del diseño

No tengo opinión sobre ninguna de estas, y no debería tenerla.

1. **¿El alta es un formulario largo o por pasos?** Son doce campos, tres obligatorios y nueve opcionales.
2. **¿Cómo se ve «s/d»?** Tiene que leerse como una decisión, no como un error ni como un campo que se olvidaron de llenar. Y ponerlo tiene que ser más fácil que inventar un dato — si cuesta más, la gente inventa.
3. **¿La lista es tabla o tarjetas?** ¿Y qué pasa en una pantalla angosta?
4. **¿Ver y editar son la misma pantalla o dos?**
5. **¿Cómo se ofrece crear un vendedor nuevo sin sacar a la persona del formulario?**
6. **¿Cómo se muestra un aviso que no bloquea**, de modo que se lea pero no se pueda ignorar por costumbre?
7. **¿Cómo se distinguen los cuatro roles en pantalla** sin que parezcan cuatro campos iguales puestos uno abajo del otro?
8. **¿Qué se ve cuando no hay ninguna compra todavía?** Es el estado real del sistema hoy.
9. **¿Cuál es el punto de entrada de la app?**

---

## Lo que este módulo no incluye

Tropas, camiones, DTE, lotes, categorías, cabezas, kilos, precios, fletes, remitos y fotos. Todo eso es el módulo 2, que va a diseñarse por separado **después** de resolver si el comprador tiene señal en la feria — porque un formulario que tiene que sobrevivir sin conexión no se diseña igual que uno común.
