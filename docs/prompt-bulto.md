# `BULTO` sobra: sale del enum — tarea para Claude Code

**Descartá `docs/prompt-bulto.md`**, que dice otra cosa y está mal. Esto lo reemplaza.

---

## Qué pasó

Te dije que en `BULTO` el precio es por animal y que las dos modalidades se conservaban separadas. **La respuesta completa es más simple: `BULTO` y `CABEZA` son lo mismo.** En los dos casos pasan **un precio por animal** y el importe del renglón sale de **cabezas × precio**. **No hay ninguna operación que se pacte por el lote entero.**

Confirmado por Iñaki, en dos vueltas: la primera pregunta que le hice ofrecía opciones que **las dos daban por sentado que `BULTO` era algo distinto**, así que no podía traer esta respuesta. La culpa es de la pregunta, no de la respuesta.

## Qué hay que hacer

**Sacar `BULTO` del enum `ModalidadPrecio`**, que queda con `KG` y `CABEZA`.

**Por qué, y no es cosmético:** dos valores que significan lo mismo son la misma enfermedad que un total guardado — el mismo hecho en dos lugares. **Divergen solos:** una persona carga el trato como `BULTO`, otra carga el mismo trato como `CABEZA`, y a los seis meses cualquier corte por modalidad reparte en dos una sola realidad. Es la regla 2 aplicada a un enum.

**La migración mueve el dato antes de tocar el tipo**, como manda la regla de las migraciones destructivas:

1. `UPDATE lote SET "modalidadPrecio" = 'CABEZA' WHERE "modalidadPrecio" = 'BULTO'` — **no borra ni anula ningún renglón**: el trato era el mismo, solo estaba etiquetado con dos nombres.
2. Recién después, el tipo nuevo sin `BULTO`, el `ALTER COLUMN ... USING`, y el descarte del viejo.

Re-ejecutable, como todas. Y **contá cuántas filas movió y decímelo**, aunque sean cero — es el número que dice si esto era un problema teórico o uno real.

**En `src/lib/totales.ts`:** desaparece la rama de `BULTO` y **desaparece la nota de la suposición**. No la corrijas: sacala. Explicaba un caso que no existe.

**En la pantalla:** el selector queda con dos opciones. El prototipo mostraba tres; **esto no vuelve a Claude Design** porque no es una decisión de diseño — una restricción de dominio no admite empate, igual que con el «6+».

Regla 14 en `CLAUDE.md`, ya corregida.

## Verificación

1. Un renglón `CABEZA` de 63 cabezas a 1.350.000 → importe **85.050.000**, y la comisión calculada sobre ese importe.
2. No queda ninguna fila con `BULTO`, y el tipo ya no admite el valor: intentar insertarlo **falla en la base**, no solo en la pantalla.
3. `npm run verificar` sigue en verde con este caso adentro.
