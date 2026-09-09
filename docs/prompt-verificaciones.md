# Verificaciones: arreglar la podrida y que no vuelva a pasar — tarea para Claude Code

Tres cosas. La primera es un sí, la segunda es una pregunta, y la tercera es el trabajo.

---

## 1. Commiteá y pusheá

La pantalla del comprador y la máquina del offline quedan aprobadas: 8 en verde por navegador, 12 por HTTP, 0 en rojo. Va a `main`.

Las tres decisiones que tomaste fuera del documento están bien y quedaron registradas en la vitácora. **La de la ruta determinística en Storage es la mejor del informe** y es una idea que el prompt debería haber tenido: si el reintento es parte del diseño, **todo lo que el reintento toca tiene que ser idempotente, también los archivos**.

Y anotá en el código, donde se decidió que `/reportar` y `/reportes` son cáscaras, la consecuencia que nadie debería «arreglar» después: **el shell se puede cargar sin sesión, y está bien.** No tiene datos, y traerlos exige la cookie. Sin esa frase escrita, alguien va a poner el nombre de la persona en el server render y va a romper el logout sin enterarse.

## 2. Una pregunta sobre el índice de las fotos

La ruta en Storage es **clave del reporte + índice**. Si el comprador edita un reporte pendiente y **borra la foto del medio**, las que quedan se reindexan: la que era #3 pasa a #2 y se sube encima de la vieja #2.

- Si en cada envío se re-suben **todas** las fotos, el contenido queda bien y no hay nada que hacer.
- Si solo se suben **las que cambiaron**, queda una fila apuntando a una foto que no le corresponde. En ese caso el índice tiene que salir de algo que no se mueva —un identificador propio de cada foto, generado en el dispositivo junto con el borrador— y no de la posición en la lista.

Decime cuál de los dos es. Si es el segundo, arreglalo y agregá el caso a la verificación: **cargar tres fotos, borrar la del medio, reenviar, y comprobar que cada fila apunta a la imagen que le corresponde.**

## 3. El trabajo: que una verificación podrida se vea

`scripts/verificar-modulo-1.ts` está roto desde el commit de auth, hace once días, **y nadie lo notó**. Eso es más grave que el bug: significa que los «19 chequeos en verde» del módulo 1 **dejaron de ser un hecho reproducible y pasaron a ser una anécdota**.

**Arreglalo como los otros:** que entre por el login y llame por HTTP. Llamar a las server actions en proceso saltea justo lo que se quiere probar —el proxy, la sesión, la comprobación de rol, la serialización— y además ata el script a detalles internos que cambian solos, como acaba de pasar.

**Y que no vuelva a pasar: un solo comando que corra todas las verificaciones** — módulo 1, auth, usuarios, comprador (HTTP y navegador), y la prueba histórica.

Tres requisitos, y el segundo es el que importa:

1. **Un resumen al final** con una línea por verificación: cuántos verdes, cuántos rojos.
2. **Un script que no arranca cuenta como ROJO, no como ausente.** Si una verificación revienta al importar, tiene que salir en el resumen como fallo y hacer fallar el comando entero. Un script que desaparece del resumen sin ruido es exactamente lo que nos pasó.
3. **Código de salida distinto de cero si algo falló**, para que correrlo desde otro script no diga que aprobó siempre.

Dejá escrito en el encabezado **cuándo hay que correrlo**: después de cualquier cambio que toque auth, el proxy, el ciclo de request o el esquema. Y que el criterio de la prueba histórica sigue siendo el suyo — este comando la corre, no la reemplaza.

### Verificación de esto mismo

Rompé una verificación a propósito —un import inválido en una— y comprobá que el comando **la reporta en rojo y falla**, en vez de saltearla. Después dejala como estaba. Es el mismo método con el que hiciste real la condición 2 de la prueba histórica: **una guarda que no se probó rompiéndola no está probada.**
