# Prompt de arranque — Módulo 2: la compra

**Estado:** borrador para revisar. Lo marcado **[DECIDIR]** no lo puedo resolver yo.
**Uso:** corregir, cerrar los `[DECIDIR]`, y pegar de vuelta para ejecutar.
**Requisito previo:** el módulo 1 está cerrado y funcionando en producción.

---

## 1. Qué cambió respecto del documento de fase

El documento de arranque de módulos 1 y 2 decía que el módulo 2 era «quién fue a comprar, remitos de la feria, cuántas cargas salieron», cargado por el comprador desde el celular, con el detalle por lote incluido.

**Eso cambió, y el cambio es de fondo: el comprador captura, la oficina estructura.**

Parado en un remate, con una mano, el comprador registra lo grueso y saca las fotos de los remitos. Enumerar categorías, cabezas, kilos y precios línea por línea es trabajo de escritorio con el papel en pantalla. La regla que ya teníamos —cada etapa captura lo que sabe— se aplica también dentro de una misma etapa: **no se le pide a alguien en una feria un dato que se lee mejor sentado.**

**Y hay una segunda entrada, que no estaba prevista.** En más de la mitad de las compras no va a haber reporte: en la feria de Darwash la oficina accede a los remitos directamente.

Medido sobre la ventana del último año (121 compras al 2026-08-28; **el número se mueve solo, porque WinCompras es un pipeline vivo** — lo que importa es la proporción, no el total):

| | Darwash | resto | sin consignatario |
|---|---:|---:|---:|
| compras | 62 | 45 | 14 |
| empresa compradora | 65 % | 47 % | 36 % |
| kg de origen | **19 %** | 3 % | 0 % |
| DTE | **18 %** | 3 % | 0 % |
| plantilla estándar | **19 %** | 3 % | 0 % |

Donde la oficina tiene los papeles el dato es unas seis veces mejor — **y aun así son 19 %.** El problema no es solo que el comprador no avise: es que nadie captura, por ninguno de los dos caminos.

**Consecuencia de diseño: el reporte NO puede ser obligatorio para que exista una compra.** Si lo fuera, en más de la mitad de los casos alguien tendría que inventar un reporte vacío para poder seguir, y un paso que se completa con mentiras es peor que no tenerlo.

### La prueba longitudinal, que vale más que cualquier porcentaje puntual

La cobertura del DTE **no es baja: se derrumbó.**

| año | compras | DTE |
|---:|---:|---:|
| 2019 | 63 | 17 % |
| 2020 | 166 | **74 %** |
| 2021 | 125 | **58 %** |
| 2022 | 126 | 6 % |
| 2023 | 155 | 5 % |
| 2024 | 182 | 1 % |
| 2025 | 157 | 3 % |
| 2026 | 71 | 14 % |

En 2020 se cargaba el DTE en tres de cada cuatro compras. Después cayó a casi cero y nunca volvió. **No es que el dato sea difícil de conseguir: se cargaba, y dejó de cargarse.** Algo cambió —una plantilla, una persona, un proceso— y el dato se fue con eso.

Es la tesis del proyecto con siete años de evidencia en vez de un argumento: no se puede hacer cumplir una plantilla, sí un formulario.

Y de paso: **`kg_origen`, flete y razón social están en 0 % todos los años hasta 2026.** No se cargaban mal antes — no existían. Empezaron este año.

---

## 2. El flujo

**La compra es el centro. El reporte es una de dos entradas posibles.**

```
  el comprador reporta desde el link  ─┐
                                       ├─→  la oficina arma la COMPRA
  la oficina ya tiene los remitos     ─┘        (tropas, cargas, lotes)
```

- El comprador abre el link, reporta y manda. El reporte cae en una **bandeja de pendientes**.
- Desde un reporte, la oficina crea la compra. El reporte queda **vinculado** a la compra que salió de él.
- O la oficina crea la compra directamente, sin reporte.
- Un reporte puede terminar en dos compras, o en ninguna si la operación se cae.

**El reporte no se pisa al armar la compra.** Es evidencia de lo que el comprador dijo, y sigue existiendo aunque la oficina registre otra cosa. Esa diferencia es justamente lo que interesa conservar (§4).

---

## 3. Sin señal, de cero

**Decidido: el comprador tiene que poder abrir la app sin nada de señal y cargar el reporte completo.** Lo normal es que haya conexión —Starlink en la computadora, datos móviles en el celular— pero el peor escenario es llegar a la feria sin nada, y ese es el que tiene que aguantar.

Cuatro consecuencias:

1. **Clave de idempotencia.** El reporte nace en el dispositivo con un identificador propio. El servidor lo usa para reconocer un reenvío: si la clave ya llegó, devuelve el reporte existente en vez de crear uno nuevo. Sin esto, una conexión intermitente genera duplicados.
2. **Catálogos cacheados.** Y son **pocos**: el comprador elige consignatario y plaza, no categorías. Son 18 consignatarios y 12 plazas — unos pocos KB. **El diccionario de 217 sinónimos y las 191 entidades NO hacen falta en el celular**, porque la clasificación por categoría la hace la oficina.
3. **El borrador no puede guardar un id de entidad creada al vuelo.** Si el comprador da de alta un consignatario nuevo estando offline, esa entidad todavía no existe en el servidor. El reporte guarda **el nombre**; el servidor resuelve o crea al recibir, apoyándose en el `nombreNormalizado` estricto. Si dos compradores dieron de alta el mismo, el `unique` los junta solo.
4. **Service worker**, porque la pantalla tiene que abrir sin red. Y **las fotos son la parte pesada**: se guardan en el dispositivo hasta que se puedan subir, y se comprimen del lado del cliente antes de salir — el plan free de Supabase da 1 GB y una foto de celular sin comprimir pesa ~3 MB.

**Y una distinción que vale guardar:** con carga offline, *cuándo lo cargó* y *cuándo llegó al servidor* son fechas distintas, y la diferencia es información. Las dos se guardan.

---

## 4. La discrepancia de categorías

**El comprador ve el animal; el remito dice otra cosa.** Caso real y frecuente: el remito dice VQ (vaquillona) y el comprador, mirándola, dice que es VA (vaca). Y suele tener razón — el consignatario clasifica para vender, el comprador mira lo que se lleva.

**Esa discrepancia es información, no un error.** El sistema viejo habría guardado una de las dos y perdido la otra; es el mismo patrón que kg liquidados contra kg de llegada.

Cómo se captura:

- **Del lado del comprador: una nota libre por remito**, junto a la foto. Nada de formulario estructurado — está parado en un remate. La estructura la pone la oficina, que es donde hay tiempo y pantalla.
- **Del lado del lote: de dónde salió la categoría.** Cuando la oficina define un lote, queda registrado si la categoría vino del remito o de la corrección del comprador. Es un campo, y es lo que a los seis meses permite contestar «¿cuántas veces el comprador vio algo distinto del papel?».

---

## 5. Modelo de datos

Las tablas `Tropa`, `Carga`, `Lote` y `Adjunto` **ya existen** desde la primera migración: se diseñaron para este módulo y la prueba contra el histórico las validó. Lo que falta es lo del reporte y dos campos.

### `ReporteCompra` — nuevo

Lo que manda el comprador. **Es evidencia: guarda lo que él escribió, no una interpretación.**

- `claveIdempotencia` — `unique`, generada en el dispositivo.
- `fecha` — la que él declara.
- `consignatarioTexto` — **el nombre tal como lo eligió o escribió**, siempre. Más `consignatarioId` nullable, si lo eligió del catálogo cacheado. El texto es la verdad del reporte; el id es una comodidad.
- `plazaTexto` — igual.
- `cabezasAproximadas`, `cantidadCamiones` — nullable, es lo grueso.
- `observaciones` — texto libre, donde marca las discrepancias.
- `personaCompradoraId` — quién reportó. Sale del link, no se tipea.
- `cargadoEn` y `recibidoEn` — las dos fechas de §3.
- `estado` — PENDIENTE / PROCESADO / DESCARTADO.
- `compraId` — nullable. La compra que salió de este reporte.

**Ningún `NOT NULL` de más.** El comprador puede no saber la plaza, o mandar solo fotos.

### `Adjunto` — modificar

Hoy `compraId` es **`NOT NULL`**, así que esto es una migración, no un agregado. La tabla está vacía: barata ahora, cara después. Las fotos ahora llegan por el reporte, pero en el camino de Darwash las sube la oficina directo a la compra. **Los dos padres son reales**: `reporteId` y `compraId`, ambos nullable, con un check de que exactamente uno esté puesto. Y una nota por adjunto, para la discrepancia de §4.

### `Lote` — un campo

- **De dónde salió la categoría:** del remito o de la corrección del comprador. Nullable — si nadie lo registró, es «s/d», no una suposición.

### `[DECIDIR]` — el destino del lote

Los lotes de una misma compra van a destinos distintos: **5 de 11** compras con el destino cargado en todos sus renglones lo tienen mixto. Y el destino se correlaciona con la comisión: feedlot 2 %, campo 3 %.

**¿El destino es una entidad con rol DESTINO, o un catálogo aparte?**

A favor del catálogo aparte: el catálogo viejo mezcla cosas de distinta naturaleza. `Feedlot`, `Venta` y `VER` conviven con campos reales como `La Cucuca` y `Pancho Primero`. Si el destino fuera una entidad, `Venta` tendría que ser una entidad, y no lo es.

Lo que **no** es un problema: `EL DESCANSO` y `EL COLORADITO` son campos de Pecuaria El Garabí, y en el padrón existen `PECUARIA DESCANSO` y `PECUARIA EL COLORADITO` solo con rol HOTELERO. Comparados exacto, el solape con el catálogo de destinos es **cero** — son textos distintos. Así que la decisión no arrastra un lío de datos, solo una pregunta conceptual.

### Lo que NO se agrega

**No hay tabla para el total de comisión, ni para cabezas totales, ni para kilos totales.** Se calculan. Ya reprodujimos una vez el error de guardar un total —`Compra.comision` era la suma de sus renglones— y costó una migración sacarlo.

---

## 6. Restricciones de dominio

Las de `CLAUDE.md` valen todas. Las que este módulo toca de cerca:

1. **Sin dato es NULL y se muestra «s/d».** En particular: **un renglón sin comisión tiene que poder decir «s/d», no 0.** En el sistema viejo esa columna es `REAL NOT NULL` y **210 de 2409 renglones tienen 0**: nadie puede saber cuáles son «no se cobró» y cuáles «no se sabe». Es el error central del proyecto, en el campo que acabamos de mover justamente para evitarlo. `Lote.comision` ya es nullable, así que el módulo 2 nace bien — pero el formulario no puede empujar a poner 0.
2. **La regla general es comodidad de carga, no dato guardado.** «La misma comisión para todos los renglones», «todo al feedlot»: rellenan las líneas de una vez, pero lo guardado es el valor de cada línea. Medido: en el 93 % de las compras todos los renglones llevan el mismo porcentaje, así que **al agregar un renglón, la comisión viene precargada con la del anterior**.
3. **Cada lote tiene identidad propia** y sobrevive hasta la recepción. El desbaste se calcula por cabeza y se mira por lote.
4. **Cabezas compradas ≠ cabezas llegadas.** Este módulo escribe solo las compradas.
5. **Si un texto de categoría no matchea el diccionario, no se adivina** — queda pendiente de mapeo. Los 18 pendientes actuales (`nov/vaq`, `vaca/toro`, `machos`…) son ambigüedades reales, no errores de tipeo.
6. **El DTE es de primera clase, uno por carga.** En WinCampo existe para el 100 % de las tropas y en el Excel de compras para el 8,5 %: el dato existe, lo que falla es la captura.
7. **Todo número agregado con su cobertura al lado.**

---

## 7. Decisiones abiertas

| # | Decisión | Bloquea |
|---|---|---|
| 2 | **El link de carga: ¿token o login? ¿vence?** Recomendación: token por reporte, sin login, revocable — el comprador en la feria no va a hacer login, se identifica eligiendo su nombre. | el reporte |
| 4 | **Roles: quién carga, quién revisa, quién solo mira.** Referencia: `remates-app`, que ya los tiene. | el reporte y la bandeja |
| — | **El destino del lote:** ¿entidad con rol, o catálogo aparte? (§5) | el lote |
| 5 | **El imprimible:** qué campos, y si vuelve por foto. | alcance |
| 6 | **Compras de terceros** en formato del consignatario. Recomendación: no parsear, adjuntar el original y cargar a mano. | alcance |
| 12 | **¿El DTE se trae de WinCampo o se tipea?** Está al 100 % del lado de WinCampo. | alcance |

Las dos primeras son de auth y conviene resolverlas juntas. **Ninguna traba escribir el esquema**, sí las pantallas.

---

## 8. Verificación exigida

1. **La prueba contra el histórico sigue aprobando**, con el criterio estructural: (b) en cero y ningún motivo nuevo sin catalogar. Se corre después de cada cambio de esquema **y de cada cambio del seed**.
2. **Casos que tienen que funcionar**, cada uno con su test:
   - Un reporte que llega dos veces con la misma clave de idempotencia crea **un** reporte, no dos.
   - Un reporte cargado sin señal, con un consignatario que no existía, lo crea al llegar — y si otro reporte trajo el mismo nombre con otras mayúsculas, terminan siendo **una** entidad.
   - Una compra creada **sin** reporte, por el camino de la oficina.
   - Un reporte que termina en dos compras.
   - La compra 6315, que es un caso real y contradictorio: su texto nombra **3** tropas, la tabla de conciliación linkea **4**, hay **4** filas de DTE, y el campo de texto del Excel apelmaza **5** números. Es la contradicción `TROPAS_TEXTO_VS_CONCILIACION` que la prueba histórica ya cataloga — el test tiene que representar las 4 tropas y sus 4 DTE, no los 5 del string.
   - Un lote con la categoría corregida por el comprador, y otro con la del remito.
3. **Test de esquema:** ningún `DEFAULT 0` en columnas de cantidad, peso, precio o monto; ningún `NOT NULL` sin justificación escrita.
4. **RLS en toda tabla nueva, en la misma migración que la crea.**
5. **Sin señal, de verdad:** cargar un reporte con el modo avión puesto, cerrar el navegador, volver a abrirlo, y que el borrador siga ahí y se envíe al recuperar la conexión — **una sola vez**.
6. **Las fotos:** que se compriman antes de subir y que una carga con tres fotos sin señal no pierda ninguna.
7. **Cobertura visible:** ningún número agregado sin su cobertura al lado.

---

## 9. Lo que no entra

Recepción, balanza pública, desbaste, kilos de llegada e informe son módulos 3 a 5. Este módulo escribe lo que se compró; lo que llegó es otra cosa y se diseña aparte.
