# Los kilos van en total, no por cabeza — tarea para Claude Code

Corrección sobre la bandeja, que ya está construida. **El campo está al revés.**

---

## Qué dice el papel

Iñaki lo describió así: **el papel dice los kilos liquidados DEL LOTE comprado**, y aparte aclara **KG promedio** y **el precio por kilo**. Y existe la otra forma: **kilos del lote más precio por cabeza**.

O sea que **el número que la persona tiene delante es el total del lote**, y el promedio por cabeza **ya viene calculado en el propio papel**. Hoy el formulario pide los kilos por cabeza y muestra el total: **está invertido respecto del documento que la persona está copiando.**

**Dalo vuelta:** se pide el **total del lote** y se muestra el **promedio por cabeza** calculado al lado, con la misma forma que ya tiene («Total del renglón: …» pasa a ser «Promedio: … kg por cabeza»). Sigue habiendo un solo dato guardado —`Lote.kilosOrigen`, que ya es el total— y el otro se deriva. **No hace falta migración.**

**Por qué importa y no es cosmético:** un formulario que obliga a convertir a mano lo que el papel ya trae es un formulario que se llena mal o no se llena. El 0 % de cobertura histórica de los kilos de origen es exactamente lo que pasa cuando el campo no se parece al documento.

## Y una cosa más, del mismo hallazgo

**Los kilos aparecen también cuando el precio es por cabeza.** Existe el caso «kilos del lote + precio por cabeza». Así que **el campo de kilos no se atenúa ni se esconde cuando la modalidad es `CABEZA`**: se conoce igual, y es el dato que después permite calcular el desbaste contra la balanza.

En el histórico esas dos columnas se mueven juntas —`peso_liquidado` y `precio_kg`, las dos en 91 %— o sea que **cuando el precio no era por kilo, tampoco se guardaban los kilos**. Es otro agujero de captura del mismo tipo, y el formulario no lo tiene que heredar.

## Mi error, para que lo tengas al leer los documentos

`docs/diseno-bandeja-modulo-2.md` §3.3 y `docs/cambios-diseno-bandeja.md` dicen que «la casa escribe los kilos por cabeza (91 %) y el total nunca (0 %)». **Ese 91 % era de `kg_x_cab`, que es una columna DERIVADA de `peso_liquidado`** — no era evidencia sobre lo que la oficina escribe. La conclusión correcta es la de arriba. Los dos documentos quedan corregidos de mi lado; si los leés antes de que los actualice, seguí esto.

## Verificación

1. Cargar 40 cabezas y 16.493,2 kg de total → el promedio muestra **412,33 kg por cabeza** y lo guardado es **16.493,2**.
2. Cambiar la modalidad a `CABEZA` → **el campo de kilos sigue disponible y visible**, sin atenuar.
3. Sin kilos → «s/d», y el promedio **no** se calcula ni se muestra como 0.
4. `npm run verificar` en verde, con el caso 1 adentro.
