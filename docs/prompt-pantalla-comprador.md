# La pantalla del comprador y la máquina del offline — tarea para Claude Code

El diseño está aprobado y no viola ninguna restricción de dominio. Las dos fuentes de verdad son **`docs/diseno-modulo-2.md`** (§1 es no negociable) y **`docs/cambios-diseno-modulo-2.md`** (qué cambió el diseño y las dos correcciones). Leelos antes de escribir código.

**El orden importa: primero la máquina, después la pantalla.** El envío pasa por la cola **desde el día uno**, aunque con señal se vacíe al instante. Si se cuelga la cola después, hay que reescribir el camino de envío entero.

---

## 1. Endpoint de catálogos

`GET /api/catalogos`, autenticado. Devuelve lo que el comprador necesita elegir y **nada más**: las entidades con rol `CONSIGNATARIO` (18) y las plazas. **No** los 192 vendedores ni los hoteleros — el comprador no los toca, y son el grueso del padrón.

Que devuelva también cuándo se generó, para saber si el cache está viejo. Se guarda en el dispositivo, se refresca al abrir y al recuperar señal. Son unos pocos KB.

## 2. Almacenamiento local

**IndexedDB, no `localStorage`.** Las fotos son binarios y `localStorage` guarda strings con un techo de unos 5 MB: una sola foto lo revienta.

Dos cosas ahí adentro: los **borradores** y la **cola de envío**.

- El borrador se guarda **apenas se escribe**, no al salir ni al apretar un botón. Si el teléfono se muere en la feria, lo escrito hasta ese momento tiene que estar.
- **El borrador guarda el nombre escrito del consignatario y de la plaza, no un id.** Sin señal esa entidad puede no existir todavía del otro lado. Si lo eligió del catálogo se pueden guardar los dos, pero **el texto es la verdad**.
- Las fotos van como `Blob`.

## 3. La clave de idempotencia

Ya está en el esquema: `ReporteCompra.claveIdempotencia`, `NOT NULL` y `unique`. **Se genera en el dispositivo** al crear el borrador, con `crypto.randomUUID()`, antes de que haya red.

**Cuando llega una clave que ya existe, el servidor devuelve el reporte existente. No crea otro y tampoco tira error.** Un 409 haría que la cola reintente para siempre justo en el caso que la clave existe para resolver.

## 4. La cola

Un envío en curso por vez. Reintento con espera creciente, no en bucle cerrado. Se vacía al volver la señal y al abrir la app. **Tiene que sobrevivir a cerrar el navegador**: es el caso real, el comprador cierra todo y se va de la feria.

## 5. Las fotos

**Comprimir en el cliente antes de subir** — lado largo ~1600 px, JPEG ~0.7. El plan free de Supabase tiene 1 GB y una foto de celular sin comprimir pesa unos 3 MB: sin comprimir, el primer mes de uso llena el bucket.

**La subida pasa por nuestro servidor, no del navegador a Storage.** Subir directo obligaría a poner una clave de Supabase en el cliente, y con fotos ya comprimidas el costo de pasar por el servidor es despreciable. **La clave de servicio no sale del servidor, nunca.**

En `Adjunto.url` guardá la ruta dentro del bucket, no una URL pública: el bucket es privado y la URL se firma al momento de mostrarla. Una URL pública de un remito es un documento comercial abierto a quien tenga el link.

## 6. Service worker

Para que la pantalla **abra sin red**. Cachea el shell de la app.

Dos cuidados, con su porqué escrito en el código: que una versión vieja no quede pegada para siempre —hay que decir cómo se actualiza—, y que **no se cacheen las páginas autenticadas ni la respuesta del login**.

## 7. La pantalla

Según el prototipo y `docs/cambios-diseno-modulo-2.md`. Elegidas por Iñaki: **una sola hoja** y **remitos en fila**. Rutas `/reportar`, `/reportes`, `/reportes/[id]`, con la barra fija de dos pestañas y el aviso de cola arriba en todas.

**Los cuatro estados no viven en el mismo lugar y confundirlos rompe el offline:**

- **borrador** y **esperando señal** son del **dispositivo** — IndexedDB. El servidor no los conoce.
- **enviado** (`PENDIENTE`) y **procesado** (`PROCESADO`) son `EstadoReporte`, en la base.

Un reporte esperando señal **todavía no existe del lado del servidor**.

## 8. Al recibir el reporte

- Resolver o crear el consignatario por `nombreNormalizado` **estricto** (`normalizarNombre` de `src/lib/normalizar.ts` — no inventes una tercera normalización). Si dos comerciales dieron de alta el mismo nombre por su lado, el `unique` los junta solo.
- Guardar `creadoPorUsuarioId` de la sesión. **No lo mandes desde el cliente**: el cliente no decide quién es.
- `cargadoEn` viene del dispositivo (es cuándo lo cargó); `recibidoEn` lo pone el servidor. **La diferencia entre las dos es información**, no ruido.

## 9. Permisos

`COMERCIAL` crea y ve **solo sus propios** reportes. Verificado en el servidor, adentro de cada acción — como el resto de la app. Un comercial pidiendo el reporte de otro rebota.

Editar un reporte en `PROCESADO` se rechaza **con el motivo**, no con un botón deshabilitado.

## 10. Y la regla que salió del login

**Ningún botón puede quedar muerto por una excepción que nadie muestra.** Acá es donde importa de verdad: sin señal, que el envío no salga es el caso **normal**. Si algo falla, la pantalla vuelve a estar usable y dice qué pasó.

---

## Verificación exigida

Hacé la lista y reportá cuántos dan verde.

1. **La prueba dura:** modo avión → cargar un reporte con dos fotos → cerrar el navegador → reabrir → está todo, con las fotos → volver la señal → **llega una sola vez**.
2. Mandar dos veces la misma clave de idempotencia → un solo reporte, y la segunda respuesta devuelve el mismo id.
3. Sin señal, escribir un consignatario que no está en el catálogo → llega el nombre y el servidor lo resuelve o lo crea.
4. Un `COMERCIAL` pidiendo por id el reporte de otro → rechazado.
5. Editar un reporte `PROCESADO` → rechazado, con motivo.
6. Una foto de 3 MB queda por debajo de ~300 KB al subir.
7. Ninguna clave de Supabase aparece en el bundle del cliente.
8. Con la app abierta y sin red, recargar la página → abre igual.
