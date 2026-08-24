# Prompt de arranque — Fase 1: Módulos 1 y 2

**Estado:** borrador para revisar. Los ítems marcados **[DECIDIR]** no los puedo resolver yo.
**Uso:** corregir, cerrar los **[DECIDIR]**, y pegar de vuelta para ejecutar.
**Base medida:** `WinCompras/backend/db.sqlite3`, ventana 2025-08-24 → 2026-08-24, **118 compras**.

---

## 1. Contexto

Se está reemplazando el Excel de compras de hacienda por una aplicación de cinco módulos. Esta fase construye los dos primeros:

1. **Información de la compra** — dónde se compró, qué empresa compra, quién consigna, fecha, identidad de la compra.
2. **Compra** — quién fue a comprar, remitos de feria, cuántas cargas salieron. Con imprimible para completar a mano y link para cargar desde el celular.

**Por qué se empieza acá y no por el informe.** De las 118 compras del último año, **11 usan la plantilla estándar y 107 son archivos viejos armados a mano** (`formato`: 11 `estandar` / 107 `viejo`). No se puede hacer cumplir una plantilla; sí se puede hacer cumplir un formulario. Todo lo que se capture bien acá deja de tener que parsearse después.

**Qué NO entra.** Recepción, balanza pública, desbaste, neto e informe son módulos 3–5. El modelo de datos tiene que dejarles la puerta abierta (§4), pero ninguna pantalla de esta fase pide un dato que recién se conoce en la balanza de llegada.

---

## 2. Lo que dicen los datos (medido, no supuesto)

### Cobertura hoy — 118 compras del último año

| Dato | Cobertura | Lectura |
|---|---:|---|
| `importe_total` | 99,2 % | lo que se paga siempre se anota |
| `comision` | 94,1 % | |
| `kg_llegada` | 70,3 % | |
| `n_liquidacion` | 56,8 % | |
| `costo_puesto_kg` | 52,5 % | calculado sobre datos incompletos |
| `comprador` (prefijo) | 55,1 % | **45 % de las compras no dice qué empresa compró** |
| `razon_social` | 9,3 % | |
| **`kg_origen`** | **9,3 %** | **sin esto no hay desbaste posible** |
| `cab_llegada` | 9,3 % | |
| `desbaste` | 8,5 % | consecuencia de `kg_origen` |
| `n_dte` | 8,5 % | |
| `transportistas` | 5,9 % | |
| `nro_tropa_texto` | 5,1 % | la «identidad fuerte» está en 6 de 118 |
| `logistica_total` (flete) | 0,8 % | 1 compra de 118 |
| `costo_puesto_completo` | 0,8 % | 1 compra de 118 |
| `guias`, `observaciones` | 0 % | campos que existen y nunca se usan |

### Cinco hallazgos que corrigen o amplían el brief

1. **`kg_origen` está en 9,3 %, no solo el flete.** El brief pone el foco en el flete (0,8 %), y es cierto que sin flete no hay costo puesto. Pero sin kilos de origen no hay desbaste ni merma, y ése es el otro número que la app promete. **Los kilos de origen se conocen en la feria** — son exactamente lo que el módulo 2 puede capturar. Es el mayor retorno de esta fase.

2. **El DTE existe siempre; lo que falla es el lado de la compra.** En WinCampo hay DTE para **688 de 688 tropas (100 %)**. El 8,5 % es la cobertura en el Excel de compras. El formulario no tiene que inventar el DTE: tiene que capturarlo, o traerlo de WinCampo. Además, hoy los DTE de varias jaulas se apelmazan en un solo campo de texto: `'032244385-4 / 032244312-9 / 032244287-4 / 03224295-5'`. Uno por carga, no un string.

3. **MEJ no es una categoría canónica.** En el catálogo, `mej`, `MEJ` y `Mej` mapean a **TO**. El brief la lista como canónica — corregir.

4. **Existe una canónica que el brief no menciona: `T`**, con 19 variantes (`tros/tras`, `ternero/as`, `T MACHO`, `T HEMBRA`, `tern`). Son lotes de ternero y ternera juntos, sin distinguir sexo. **Hay lotes mixtos por naturaleza.** Y hay 18 variantes más que **no tienen canónica asignada** y no son errores de tipeo, son ambigüedades reales: `nov/vaq`, `vaca/toro`, `vac/cria`, `machos`, `hembras`, `novillito/bulto`, `Invernada x kg`, `130`. Esto confirma la regla: si no matchea, **no se adivina**.

5. **Cabezas compradas ≠ cabezas llegadas, en los dos sentidos.** Casos reales: compra 6313 → 217 compradas / 216 llegadas; compra 6314 → 199 compradas / **222 llegadas**. El modelo no puede asumir que son iguales ni tratar la diferencia como error.

### Dimensiones para el formulario

- **Lotes por compra:** mediana 2, p90 6, máximo 9. La pantalla móvil tiene que aguantar cómoda hasta ~9 filas de detalle.
- **Compras con más de una tropa:** 34 de 369 (9,2 %), hasta 5 tropas en una. Hoy se concatenan en un campo: `'PEG.HUI.17/07/26 ; PEG.HUI.18/07/26 ; PEG.HUI.19/07/26'`.
- **Consignatarios distintos en el año: 11.** Darwash concentra 60 de 118 (51 %). Es un catálogo chico: un selector, no un campo libre.
- **Precio:** 315 de 347 lotes tienen `precio_kg` (90,8 %); 32 no. Las variantes de categoría incluyen `novillito/bulto`, `vaquillona bulto`, `Invernada x kg` — hay compras que no son por kilo. El lote necesita **modalidad de precio**.
- **Formato de fecha en el N° de tropa:** mezclado, `08/06/26` y `23/07/2026` conviven. Normalizar al parsear, guardar la fecha como fecha.

---

## 3. Stack y restricciones técnicas

- Next.js (App Router) + Postgres en Vercel. Mismo ecosistema que `remates-app`, para poder preguntar y copiar de un ejemplo andando en el mismo rubro.
- **El formulario tiene que tolerar quedarse sin señal.** Borrador persistido en el dispositivo, cola de envío con reintento, clave de idempotencia por borrador para que un reintento no duplique la carga. **[DECIDIR]** Preguntarle a Matías cómo lo resolvió en la balanza antes de elegir la implementación.
- Mobile primero. La pantalla de carga se usa parado en una feria, con una mano.
- Sin exigir que el comprador tenga cuenta (§6, link con token).

---

## 4. Vocabulario — cuatro roles que no son lo mismo

| Rol | Qué es | En la base hoy |
|---|---|---|
| **consignatario** | la feria o casa que remata | `consignatario` (88,1 %) |
| **empresa compradora** | cuál de nuestras empresas compra | `comprador` (55,1 %) |
| **vendedor / origen** | de quién era la hacienda | `proveedor` / `origen` |
| **hotelero** | de quién es la hacienda una vez en el feedlot; puede ser un tercero | `hotelero` |

Y aparte, la **persona compradora**: quién fue físicamente a comprar. No es la empresa compradora, y hoy no se registra en ningún lado.

---

## 5. Modelo de datos

### Principios que el esquema tiene que cumplir

1. **Sin dato es NULL, y NULL se muestra «s/d».** Prohibido `DEFAULT 0` en columnas de cantidad, peso, precio o monto. El esquema actual hace exactamente lo contrario: **19 columnas `REAL NOT NULL`** en `liquidaciones_liquidacion` — entre ellas `kg_origen`, `desbaste`, `logistica_total` y `kg_llegada` — todas con 0 cuando no hay dato. Por eso «no se sabe» y «vale cero» hoy son indistinguibles, y por eso las coberturas de §2 tuvieron que medirse como «distinto de 0» en vez de «no nulo». **No repetir esto.**
2. **Un concepto, un lugar.** Los kilos de origen se guardan una sola vez, en el lote. Totales y promedios **se calculan, no se guardan**. La tabla actual guarda `costo_puesto_total`, `costo_puesto_kg`, `costo_puesto_cab`, `compra_total`, `importe_hacienda` — cinco derivados que pueden divergir de su fuente.
3. **Nada de filas TOTAL.** Un total es una consulta, nunca un registro.
4. **Grano suficiente para el desbaste por lote.** El desbaste se calcula por cabeza y hay que verlo por lote, no promediado. Cada lote necesita identidad propia, con sus cabezas y sus kilos de origen, y tiene que sobrevivir hasta la recepción. Si en esta fase los lotes se guardan agregados, el módulo 4 no se puede construir.
5. **Cabezas compradas y cabezas llegadas son campos distintos.** Esta fase escribe solo las compradas.

### Entidades

**`empresa`** + **`prefijo_tropa`** — N:1, porque un mismo comprador puede tener más de un prefijo. Semilla medida del catálogo actual: **propios** PEG, BUL, DAR, LTA, LTP, PEC, SAG, TAP, UGM, ALO; **marcado como tercero** TRB. **[DECIDIR]** El brief lista TRB (Tercio Bravo) entre los compradores propios, pero en `catalogos_comprador` está con `propio = false`. Definir cuál vale. Además, los 11 registros tienen `nombre` vacío: hay que completar la razón social de cada uno.

**`consignatario`**, **`vendedor`**, **`hotelero`**, **`persona_compradora`** — catálogos separados. **[DECIDIR]** ¿Un padrón único de entidades con roles, como el de clientes de `remates-app`, o cuatro tablas? Si `remates-app` ya tiene padrón, reusar la idea.

**`categoria`** — canónicas medidas: **NV, NT, VQ, VA, TO, TM, TH y T** (mixto ternero/ternera). MEJ no va: mapea a TO.
**`categoria_sinonimo`** — 258 variantes ya existen y se importan tal cual como semilla. **Regla: si un texto no matchea, no se adivina.** Queda pendiente de mapeo, se le muestra al usuario, y el mapeo que elija se guarda. Las 18 variantes sin canónica de hoy son la prueba de que el caso existe y hay que manejarlo, no evitarlo.

**`compra`** (módulo 1) — consignatario, empresa compradora, vendedor/origen, hotelero, fecha, plaza/lugar, persona compradora, comisión, observaciones.

**`tropa`** — N:1 contra `compra`. Formato `COMPRADOR.VENDEDOR.FECHA` (`PEG.UTE.18/08/2026`), **nullable**: lo genera WinCampo y puede no conocerse cuando el comprador carga desde la feria. Una fila por tropa, nunca concatenadas. Cada tropa tiene su empresa compradora: así se representa 75 cabezas de Pecuaria + 5 de Las Taperas en el mismo camión.

**`carga`** (camión/jaula) — N:1 contra `compra`. **DTE como campo de primera clase, uno por carga.** Además: transportista, patente, fecha de salida, destino y **flete (monto)**.

**`lote`** — categoría, cabezas, kilos de origen, precio, **modalidad de precio** (por kg / por cabeza / por bulto). **[DECIDIR]** ¿El lote se pesa junto en la balanza pública de llegada? De eso depende que el desbaste por lote sea calculable. Si no se pesa junto, el grano del lote tiene que ser otro y conviene definirlo ahora y no en el módulo 4.

**`remito_feria`** — número y adjunto (foto), colgando de la compra.

**Relaciones que el esquema tiene que soportar sin trucos:**
- Una compra → varias tropas (medido: hasta 5).
- Una compra → varias cargas, cada una con su DTE (medido: hasta 5 DTE apelmazados en un campo).
- **[DECIDIR]** carga ↔ tropa: ¿una carga es siempre de una sola tropa, o un camión puede llevar dos? El caso de las 75 + 5 sugiere que sí. Si es así la relación es N:N y hay que decidirlo ahora.

---

## 6. Las dos pantallas

### Módulo 1 — Información de la compra

Campos: fecha, consignatario (selector, 11 opciones), empresa compradora (selector), vendedor/origen, hotelero, plaza/lugar, persona compradora, comisión, observaciones.

Obligatorio: **fecha, consignatario, empresa compradora**. La empresa compradora hoy falta en el 45 % de las compras y es lo que da identidad al ingreso: acá sí vale forzarla. Todo lo demás con **«s/d» explícito a un toque** — hacer obligatorio un dato que a veces no se conoce en el momento hace que la gente invente datos. **[DECIDIR]** Confirmar esta lista.

### Módulo 2 — Compra

Encabezado: persona que carga, remitos de feria (número + foto).

**Detalle por lote**, repetible, hasta ~9 filas cómodas: categoría (selector con búsqueda contra el diccionario de sinónimos), cabezas, **kilos de origen**, precio y modalidad. Los kilos de origen son el campo con más retorno de todo el formulario: hoy están en 9,3 % y sin ellos no hay desbaste.

**Cargas**, repetible: DTE, transportista, patente, fecha de salida, destino, flete. Cada campo puede quedar en «s/d», pero **DTE y flete se piden siempre y de forma visible** — son los dos agujeros grandes.

Al pie, calculado y nunca editable: cabezas totales, kilos totales, kilos promedio por cabeza, **cada uno con su cobertura al lado** («kg promedio 412 — sobre 3 de 4 lotes»). Si un lote está en s/d, el promedio lo dice; no lo tapa.

### El imprimible

Una hoja A4 con los mismos campos y espacio para completar a mano, el identificador de la compra y un QR al link de carga. **[DECIDIR]** ¿La planilla completada a mano vuelve por foto adjunta, o alguien la transcribe? Si es por foto, es un adjunto más y no hace falta OCR en esta fase.

---

## 7. Decisiones abiertas — cerrar antes de ejecutar

| # | Decisión | Recomendación de arranque |
|---|---|---|
| 1 | **Quién carga y desde dónde.** ¿El comprador en la feria? ¿Hay señal? | Asumir que no hay. Preguntarle a Matías cómo lo resolvió en la balanza. |
| 2 | **El link de carga:** ¿público con token o exige usuario? ¿Vence? | Token por compra, sin login, revocable, vencimiento largo. El comprador en la feria no va a hacer login; se identifica eligiendo su nombre de la lista. |
| 3 | **Obligatorios** (§6). | Mínimo duro + empresa compradora; el resto con «s/d» a un toque. |
| 4 | **Roles:** quién carga, quién revisa, quién solo mira. | Copiar el esquema de roles de `remates-app`. |
| 5 | **El imprimible:** cómo vuelve. | Foto adjunta, sin OCR en esta fase. |
| 6 | **Compras de terceros** en formato del consignatario. | No parsear. Adjuntar el original y cargar a mano contra el formulario. Parsear un Excel que edita una persona es una carrera que no se gana. |
| 7 | ¿Carga ↔ tropa es N:N? (§5) | — |
| 8 | ¿El lote se pesa junto en la balanza pública? (§5) | — |
| 9 | ¿Padrón único de entidades o catálogos separados? (§5) | — |
| 10 | **TRB: ¿propio o tercero?** El brief y el catálogo se contradicen. | — |
| 11 | **Lotes mixtos:** ¿el formulario permite cargar `T` (ternero/a junto) y `nov/vaq`, o obliga a separar? | Permitir `T`, que ya es canónica y tiene 19 variantes reales. Para el resto, pedir separación. |
| 12 | **¿El DTE se trae de WinCampo o se tipea?** Está al 100 % del lado de WinCampo. | Si hay conector, traerlo y dejar el campo editable. Ahorra el agujero entero. |

---

## 8. Verificación exigida

No se da la fase por cerrada sin esto:

1. **Prueba contra el histórico real.** Tomar las 118 compras del último año en `db.sqlite3` e intentar representar cada una en el modelo nuevo. Entregable: cuántas entran sin forzar nada y **la lista de las que no entran, con el motivo de cada una**. Ésta es la prueba del modelo; el resto son tests de código.
2. **Casos que tienen que funcionar**, cada uno con su test:
   - Una compra, dos empresas compradoras, un solo camión (75 PEG + 5 LTA) → dos tropas.
   - Una compra con 3 tropas y 5 DTE distintos (existe: compra 6315, `PEG.HUI` ×3).
   - Cabezas compradas ≠ llegadas en los dos sentidos (existen: 6313 → 217/216, 6314 → 199/222).
   - Una compra con un lote en «s/d» de kilos → el promedio se calcula sobre el resto y lo declara.
3. **Test de esquema automatizado:** ninguna columna de cantidad, peso, precio o monto con `DEFAULT 0`; ningún `NOT NULL` sin justificación escrita al lado. Este test existe para que el esquema nuevo no repita el viejo.
4. **Diccionario de sinónimos:** importar las 258 variantes de `catalogos_categoria` y verificar que las 240 con canónica resuelven. Las 18 sin canónica tienen que quedar **listadas como pendientes de mapeo, no adivinadas**.
5. **Test offline:** abrir el formulario, cortar la red, completar, restaurar → se envía **una sola vez**.
6. **Imprimible:** entra en una A4 con 9 filas de lote y es legible completado a mano.
7. **Cobertura visible:** ningún número agregado se muestra sin su cobertura al lado. Revisión manual pantalla por pantalla.

---

## 9. Al cerrar la fase, qué hay que correr

Completar con los comandos exactos al terminar la implementación: migraciones, seed de catálogos (11 compradores, 11 consignatarios, 8 categorías canónicas, 258 sinónimos), suite de tests, y el script de la prueba contra el histórico del punto 8.1.
