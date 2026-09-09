# Arreglo del login y administración de usuarios — tarea para Claude Code

Tres cosas, en orden. Las dos primeras son chicas; la tercera es la que hoy impide que un comercial pueda usar la app.

---

## 1. El botón de ingresar queda clavado en «Entrando…»

**Ya sabemos por qué falló en producción y ya está arreglado del lado de la configuración:** faltaba `SESION_SECRETO` en el entorno Production de Vercel, así que `firmarSesion` tiraba la excepción que está escrita a propósito para no degradarse a un secreto por defecto. Se agregó la variable y el login anda.

**Pero el síntoma dejó a la vista un bug de la pantalla, y ese sigue.** En `src/componentes/FormularioIngreso.tsx`, `setEntrando(false)` está **después** del `await`, sin `try/finally`. Cualquier excepción de la acción —la del secreto, un corte de red, lo que sea— deja el botón deshabilitado **para siempre y sin decir nada**. Estuvimos media hora mirando una pantalla que no tenía forma de contarnos qué le pasaba.

Además `redirect()` se llama desde un `onSubmit` común, fuera de una transición, que no es la forma que Next espera para una acción que redirige.

**Arreglalo con `<form action={...}>` y `useActionState`**, atando el estado de «entrando» al `pending` de ese hook en vez de a un `useState` propio. Si un error inesperado sale de la acción, la pantalla tiene que mostrar algo genérico —sin filtrar el detalle interno— y **volver a estar usable**.

**La regla que sale de esto, y vale para todo el módulo 2:** ningún botón puede quedar muerto por una excepción que nadie muestra. Va a importar mucho más cuando el envío pase por la cola offline y falle por falta de señal, que ahí es el caso normal y no el excepcional.

## 2. La verificación de auth que quedó sin reportar

De los siete puntos pedidos en `docs/prompt-auth-modulo-2.md` solo vino el 6. Correr los otros seis contra producción y reportar cuántos dan verde.

## 3. Administración de usuarios — lo que hoy falta

**Hoy la única forma de crear una cuenta es el seed, y no hay manera de cambiar una contraseña.** O sea que no se le puede dar acceso a un comercial, que es justamente lo que el módulo 2 necesita. Fue una omisión del prompt de auth: se pidieron las cuentas, no cómo se crean las que siguen.

**Ruta `/usuarios`, solo ADMINISTRATIVO.** Lista de cuentas con su rol y su estado, y las acciones:

- **Crear cuenta:** usuario, nombre, rol, entidad del padrón (opcional, solo para precargar la persona compradora) y contraseña inicial. La contraseña la fija el administrativo y se la pasa a la persona por fuera de la app: no hay correo configurado y montar uno para esto sería agrandar el problema.
- **Desactivar y reactivar** una cuenta. Desactivar es la baja: **no hay borrado**, porque una cuenta borrada se lleva puesta la atribución de lo que cargó.
- **Cambiar la propia contraseña**, esta sí para cualquier rol, pidiendo la actual.

**Cuatro restricciones, cada una con su porqué:**

1. **Nadie puede desactivar su propia cuenta.** Es el clic que te deja afuera de la app que administrás.
2. **No puede quedar cero ADMINISTRATIVO activo.** Mismo problema, versión colectiva, y sin nadie que lo arregle desde adentro.
3. **Mínimo 12 caracteres**, igual que exige el seed. Un solo criterio, en un solo lugar.
4. **El hash no sale nunca hacia el cliente**, ni en una prop ni en un `select`.

Y como siempre: **el permiso se comprueba adentro de cada server action**, no escondiendo la pantalla. Un COMERCIAL que hace el POST a mano tiene que rebotar.

### Una decisión que propongo y quiero que evalúes

**Cambiar la contraseña hoy no invalida las sesiones viejas.** La cookie solo lleva el id, así que una sesión de 30 días abierta en otro dispositivo sigue viva después del cambio — y con cookies tan largas eso importa más, no menos: si alguien cambia la contraseña es porque sospecha algo.

Se puede resolver sin tocar el formato de la cookie: un campo `credencialesDesde` en `Usuario`, que se actualiza al cambiar la contraseña, y en `usuarioActual()` se descarta la sesión cuya emisión sea anterior. **La emisión se deriva de lo que ya está en la cookie**: `exp − DURACION_SESION`.

Si ves un problema con esto, decilo antes de implementarlo.

### Verificación

1. COMERCIAL haciendo POST directo a la acción de crear usuario → rechazada.
2. Un administrativo intentando desactivarse a sí mismo → rechazada, con mensaje.
3. Desactivar al último administrativo activo → rechazada, con mensaje.
4. Contraseña de menos de 12 caracteres → rechazada.
5. Cambio de la propia contraseña con la actual mal → rechazada.
6. Después de cambiar la contraseña, una sesión vieja del mismo usuario → afuera (si se implementa `credencialesDesde`).
7. El hash no aparece en ninguna respuesta HTTP ni en el HTML servido.
