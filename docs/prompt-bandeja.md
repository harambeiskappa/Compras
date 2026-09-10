# La bandeja de la oficina — tarea para Claude Code

Diseño aprobado: no viola ninguna restricción de dominio. Las fuentes de verdad son **`docs/diseno-bandeja-modulo-2.md`** (§1 no negociable, §4 el quinto estado) y **`docs/cambios-diseno-bandeja.md`** (qué cambió y qué hubo que corregir). Leelos antes de escribir código.

**Ojo con una cosa al leer el resumen del diseño: tres citas de §1 están cambiadas de número.** Las decisiones son correctas; las citas no. **Seguí la regla, no el número.**

---

## 1. Migración: el motivo del descarte

La pantalla promete que **el comprador va a ver que se descartó y por qué**, y hoy no hay dónde guardar ese porqué. `ReporteCompra.observaciones` **no sirve**: es del comprador y es evidencia — la oficina no escribe ahí.

Agregar a `ReporteCompra`, todo nullable:

- `motivoDescarte`, enum `MotivoDescarte { DUPLICADO, ERROR, NO_SE_HIZO }`.
- `estadoCambiadoPorUsuarioId` → `Usuario`, y `estadoCambiadoEn`.

**Los dos últimos cubren también el marcado como procesado y su reversión**, que son decisiones que le sacan algo a otra persona: `actualizadoEn` no alcanza porque se mueve con cualquier cambio. Migración re-ejecutable; la tabla ya existe, así que no hay RLS nueva que activar — **verificalo igual**.

## 2. Rutas

`/bandeja` para los reportes pendientes, y `/compras/[id]` **extendida**: además de la identidad que ya muestra, las tropas, los camiones y los renglones. El camino sin reporte sigue siendo `/compras/nueva` y usa la misma pantalla de renglones.

## 3. Las reglas que el código tiene que hacer cumplir

**El reporte es evidencia: se muestra al costado y no hay ningún control que lo edite.** No es solo que no haya botón — no debe existir la acción del lado del servidor.

**Ningún total se guarda.** Cabezas, kilos, promedio por cabeza y comisión salen de los renglones cada vez que se miran, **cada uno con su cobertura al lado** («sobre 2 de 3 renglones»).

**Un campo vacío es «s/d» en todo cálculo, nunca 0.** El propio diseño se tropezó con esto y lo arregló: un vacío contado como 0 hacía decir «sobre 3 de 3» cuando solo dos renglones tenían kilos, y el promedio salía 268 en vez de 339. **Es el error fundacional del proyecto reproducido adentro de la pantalla que promete no cometerlo.** Que no vuelva a entrar por la puerta del servidor.

**Los kilos se piden POR CABEZA y el total se muestra derivado.** Medido: por cabeza 91 % de cobertura, total 0 %. **`Lote.kilosOrigen` sigue guardando el TOTAL** —el total es el hecho— así que la conversión la hace el formulario. Cuidado con el redondeo: `Decimal(10,2)` aguanta, pero el número que la persona escribió tiene que poder volver a mostrarse igual.

**Los dos gestos —misma comisión, mismo establecimiento— escriben en cada renglón y no guardan nada de cabecera.** Que no aparezca una columna de comisión ni de establecimiento en `Compra`: sería el mismo total almacenado que le criticamos al esquema viejo.

**Un renglón nuevo nace en «s/d».** Nada se hereda en silencio: un valor heredado es un dato que nadie escribió.

**La categoría se escribe libre y se resuelve contra los sinónimos.** Si matchea, se muestra la canónica; si no, se guarda igual con `categoriaCanonicaId` en NULL y el sello **SIN RESOLVER**. **Nunca se adivina**, y no frena la carga. Medido: el 21 % de los renglones dice `vaca` y el 7 % dice `VA` — la palabra gana, así que el diccionario es la vía principal de entrada, no un accesorio.

**La diferencia entre las cabezas del reporte y la suma de los renglones no es un error.** Se muestra, no se resalta en rojo y no se pide igualar.

**El aviso de empresa titular señala, nunca bloquea.**

**Un reporte puede dar cero, una o varias compras.** Una compra sale de a lo sumo un reporte. La FK ya está del lado de `Compra`.

**Marcar procesado congela el reporte del lado del comprador.** Confirmación que nombra al comprador y dice qué pierde. Es reversible, y la reversión también queda registrada.

**La atribución: mostrá la cuenta como cuenta.** `creadoPorUsuarioId` dice **qué cuenta** mandó el reporte, y eso siempre es cierto. `personaCompradoraId` dice **quién fue físicamente**, y puede ser alguien sin cuenta. Un rótulo que afirme la persona a partir de la cuenta miente el día que dos comparten una.

## 4. Permisos

`/bandeja` y la carga de renglones son de **ADMINISTRATIVO**. Un COMERCIAL rebota, comprobado adentro de cada server action. Como siempre: pedir un reporte ajeno por id da **404 y no 403**, para no confirmar que existe.

## 5. Y las reglas que ya son de la casa

Ningún botón queda muerto por una excepción que nadie muestra. Ningún script borra por barrido. `npm run verificar` tiene que seguir dando todo en verde, y **la verificación nueva se suma a ese comando**.

---

## Verificación exigida

1. Un renglón con kilos vacíos → el total dice «sobre N−1 de N» y el promedio **no** cuenta ese renglón como 0.
2. Aplicar «la misma comisión a todos» → el valor queda escrito **en cada fila de `lote`**, y **no existe ninguna columna de comisión en `compra`**.
3. Cargar `vaca` → resuelve a la canónica. Cargar `nov/vaq` → se guarda con `categoriaCanonicaId` NULL y **el lote se crea igual**.
4. Un reporte procesado en dos compras distintas → las dos apuntan al mismo reporte y el reporte las lista.
5. Marcar procesado y revertir → `estadoCambiadoPorUsuarioId` y `estadoCambiadoEn` quedan con las dos acciones.
6. Descartar → `motivoDescarte` guardado, el reporte **sigue existiendo**, y el comprador ve el motivo.
7. Un COMERCIAL pidiendo `/bandeja` o haciendo POST a la acción de cargar renglones → rechazado.
8. Un intento de editar el reporte desde el lado de la oficina → **la acción no existe**.
9. Cabezas del reporte distintas de la suma de renglones → se guarda igual, sin bloqueo.
10. Empresa titular fuera de las empresas de las tropas → aviso, se guarda igual.
