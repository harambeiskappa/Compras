# Auth: cuentas, roles y sesión — tarea para Claude Code

Decisiones #2 y #4, cerradas el 28/08/2026 y escritas en `CLAUDE.md`.
**No volver a decidirlas.** Si alguna traba el trabajo, decir cuál y qué se está suponiendo.

---

## Lo que se decidió, con su porqué

- Cada persona tiene **cuenta con usuario y contraseña**, y **el rol viaja con la cuenta**. El link que se le pasa al comercial es un atajo a la pantalla, **nunca la credencial**: si el link fuera la credencial, reenviarlo por WhatsApp regalaría el acceso, y sacárselo a uno obligaría a cambiárselo a todos.
- Dos roles y por ahora ni uno más: **ADMINISTRATIVO** (acceso completo) y **COMERCIAL** (crea el reporte que inicia la compra, y casi no edita).
- **No se usa Supabase Auth.** Sus usuarios viven en `auth.users`, fuera de `prisma/schema.prisma`, y eso rompe la regla de que el esquema esté entero en el repo con historial — la misma razón por la que está prohibido crear tablas desde el editor de Supabase. Además la app se conecta como dueño y saltea RLS, así que las políticas que Supabase Auth habilita no se usarían.

---

## 1. Esquema

Modelo `Usuario` y enum `RolUsuario { ADMINISTRATIVO, COMERCIAL }`.

Campos: `usuario` (unique, guardado normalizado — usar `normalizarTexto` de `src/lib/normalizar.ts`, **no inventar una tercera normalización**), `nombre`, `hashPassword`, `rol`, `activo`, `entidadId` nullable hacia `Entidad`, y los timestamps de siempre.

Migración **re-ejecutable** y con **RLS activado en la misma migración que crea la tabla**.

`entidadId` es opcional y sirve para una sola cosa: precargar la persona compradora. **No unifica los dos conceptos.** `ReporteCompra.personaCompradoraId` responde *quién fue físicamente a comprar* — puede ser alguien sin cuenta. La cuenta responde *quién cargó esto*. Son dos hechos distintos, y precargar no es ser lo mismo.

## 2. Atribución de la carga

Agregar `creadoPorUsuarioId` nullable a `Compra` y a `ReporteCompra`.

Nullable a propósito: las compras cargadas antes de que existieran las cuentas no tienen autor, y eso es **«s/d», no «oficina»**. Esto destraba la línea que el diseño del módulo 1 mostraba —«Cargada el 25/08/2026 · oficina»— y que quedó sin implementar porque no había dato al cual atribuirla.

## 3. Contraseñas

Salt aleatorio por usuario, función de derivación con costo (`scrypt` de `node:crypto` alcanza y no agrega dependencia), comparación en tiempo constante con `timingSafeEqual`.

El hash **nunca** se selecciona hacia un componente cliente ni viaja en una prop.

## 4. Sesión: cookie firmada, larga

`httpOnly`, `secure`, `sameSite=lax`, vencimiento largo (30 días).

**Lo obliga el offline.** Una sesión de una hora deja al comprador afuera justo en el peor escenario: abrió el formulario en el campo, sin señal, con los borradores adentro y sin forma de renovar nada. Solo el primer login necesita conexión.

El secreto de firma va en una variable de entorno de Vercel. **Nunca en el repo.** Decir cómo se llamó, para crearla en el dashboard.

Dos detalles que importan:

- **La cookie es identidad; la base es autoridad.** En la cookie va el `id`, no el rol: si un administrativo cambia un rol, una cookie de 30 días seguiría diciendo lo viejo. El rol y el `activo` se leen de la base en cada acción.
- El **middleware corre en Edge**: que verifique solo la firma y el vencimiento (HMAC con Web Crypto, que existe en los dos runtimes), sin tocar la base ni `node:crypto`. Verificar si en Next 16 conviene declararlo en runtime Node; si se hace, decir por qué.

## 5. Permisos, verificados en el servidor

Esconder un botón no es un permiso: una server action se puede invocar directo, y **en este proyecto ya se hizo exactamente eso contra producción** para probar las validaciones del módulo 1. El middleware protege las rutas; la comprobación de rol va **además adentro de cada server action**.

**COMERCIAL:** crea y ve sus propios reportes. No crea, no edita ni borra compras, entidades ni establecimientos.

## 6. Semilla

Un primer ADMINISTRATIVO, con la contraseña leída de una variable de entorno. Si la variable no está, el seed **falla ruidosamente** — no inventa una contraseña por defecto.

## 7. De paso, un arreglo pendiente

El `ON DELETE` de `adjunto` quedó asimétrico: `reporteId` es `CASCADE` y `compraId` no. `SET NULL` no es opción porque violaría el CHECK de exactamente-un-padre.

Poner **`RESTRICT` en los dos**: borrar la fila no borra el archivo de Supabase Storage, así que un `CASCADE` deja huérfanos silenciosos y pierde evidencia de un plumazo. Un reporte descartado se marca `DESCARTADO`, no se borra.

---

## Verificación exigida

Hacer la lista y reportar cuántos dan verde:

1. POST directo a la server action de crear compra con cookie de COMERCIAL → rechazada.
2. Sin cookie → rechazada.
3. Cookie con un byte de la firma alterado → rechazada.
4. Usuario con `activo = false` y cookie válida → rechazada.
5. Login, cerrar el navegador, reabrir → sigue adentro.
6. `curl` sin credenciales contra `https://compras-ten-mu.vercel.app` → 200, no un 302 a `vercel.com/login`. La Deployment Protection tiene que quedar **apagada en producción**, o el link del comercial muere en un login de Vercel que él no tiene.
7. El hash no aparece en ninguna respuesta HTTP ni en el HTML servido.
