"use server";

import { cookies } from "next/headers";

import type { RolUsuario } from "@/generated/prisma/enums";
import { exigir, SinPermiso } from "@/lib/auth";
import { asegurarRol } from "@/lib/entidades";
import { normalizarTexto } from "@/lib/normalizar";
import { hashearPassword, validarPassword, verificarPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { refrescar } from "@/lib/refrescar";
import { COOKIE_SESION, DURACION_SESION, firmarSesion } from "@/lib/sesion";
import { otrosAdminsActivos } from "@/lib/usuarios";

/**
 * Administración de cuentas.
 *
 * Hasta acá, la única forma de crear una cuenta era el seed y no había ninguna
 * de cambiar una contraseña: no se le podía dar acceso a un comercial, que es
 * justo lo que el módulo 2 necesita.
 *
 * LOS PERMISOS SE COMPRUEBAN ACÁ, NO ESCONDIENDO LA PANTALLA. Una server action
 * se alcanza por POST directo — en este proyecto ya se hizo exactamente eso
 * contra producción. Que `/usuarios` no le aparezca a un comercial es cortesía;
 * el `exigir("ADMINISTRATIVO")` de cada acción es el permiso.
 *
 * EL HASH NO SALE NUNCA HACIA EL CLIENTE: ningún `select` de este archivo lo
 * pide salvo el de `cambiarMiPassword`, que lo compara y lo descarta ahí mismo.
 */

export type ResultadoUsuario = { ok: true } | { ok: false; errores: string[] };

/** Convierte un `SinPermiso` en un resultado, en vez de dejarlo explotar. */
function sinPermiso(e: unknown): ResultadoUsuario | null {
  return e instanceof SinPermiso ? { ok: false, errores: [e.message] } : null;
}

export type DatosUsuarioNuevo = {
  usuario: string;
  nombre: string;
  rol: RolUsuario;
  /** Opcional, y para UNA sola cosa: precargar la persona compradora. */
  entidadId: number | null;
  password: string;
};

// ---------------------------------------------------------------- crear

export async function crearUsuario(
  datos: DatosUsuarioNuevo
): Promise<ResultadoUsuario> {
  try {
    await exigir("ADMINISTRATIVO");
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  const errores: string[] = [];

  // Se guarda ya normalizado, igual que en el seed: el unique es sobre esa
  // forma, así que "Nacho" y "nacho" son la misma cuenta.
  const usuario = normalizarTexto(datos.usuario ?? "");
  if (!usuario) {
    errores.push("Falta el usuario.");
  } else if (/\s/.test(usuario)) {
    errores.push(
      "El usuario no puede tener espacios: se tipea a mano en el login y un " +
        "espacio invisible es una tarde perdida."
    );
  }

  const nombre = (datos.nombre ?? "").trim();
  if (!nombre) errores.push("Falta el nombre de la persona.");

  if (datos.rol !== "ADMINISTRATIVO" && datos.rol !== "COMERCIAL") {
    errores.push("El rol tiene que ser ADMINISTRATIVO o COMERCIAL.");
  }

  const problema = validarPassword(datos.password ?? "");
  if (problema) errores.push(problema);

  if (datos.entidadId !== null) {
    const hay = await prisma.entidad.count({ where: { id: datos.entidadId } });
    if (!hay) errores.push("La entidad elegida no existe.");
  }

  if (usuario) {
    const repetido = await prisma.usuario.count({ where: { usuario } });
    if (repetido) errores.push(`Ya hay una cuenta con el usuario "${usuario}".`);
  }

  if (errores.length) return { ok: false, errores };

  // Vincular una entidad a una cuenta le declara ese rol, igual que elegirla en
  // un selector: es información nueva, no un error.
  if (datos.entidadId !== null) {
    await asegurarRol(datos.entidadId, "PERSONA_COMPRADORA");
  }

  try {
    await prisma.usuario.create({
      data: {
        usuario,
        nombre,
        hashPassword: await hashearPassword(datos.password),
        rol: datos.rol,
        entidadId: datos.entidadId,
      },
      select: { id: true },
    });
  } catch {
    // El unique puede saltar igual si dos altas entran a la vez: la
    // comprobación de arriba mira, y el índice decide.
    return { ok: false, errores: [`Ya hay una cuenta con el usuario "${usuario}".`] };
  }

  refrescar("/usuarios");
  return { ok: true };
}

// ------------------------------------------------- desactivar / reactivar

const NO_A_UNO_MISMO =
  "Nadie puede desactivar su propia cuenta: es el clic que te deja afuera de " +
  "la app que administrás. Que lo haga otro administrativo.";

const NO_SIN_ADMINISTRATIVOS =
  "Tiene que quedar al menos un administrativo activo. Si se desactiva el " +
  "último, no queda nadie adentro que pueda volver a activarlo.";

/**
 * Desactivar es la baja. NO HAY BORRADO: una cuenta borrada se lleva puesta la
 * atribución de todo lo que cargó, y «quién cargó esto» es justamente lo que
 * las cuentas vinieron a contestar.
 */
export async function cambiarActivo(
  id: number,
  activo: boolean
): Promise<ResultadoUsuario> {
  let yo;
  try {
    yo = await exigir("ADMINISTRATIVO");
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  if (!Number.isInteger(id)) return { ok: false, errores: ["Cuenta inválida."] };
  if (id === yo.id && !activo) return { ok: false, errores: [NO_A_UNO_MISMO] };

  try {
    // SERIALIZABLE, y no es adorno: la guarda del último administrativo lee y
    // después escribe. Con dos bajas simultáneas, en READ COMMITTED las dos ven
    // al otro activo, las dos pasan la guarda, y quedan cero. Es raro y es
    // barato de cerrar; son cinco cuentas y esto se corre casi nunca.
    await prisma.$transaction(
      async (tx) => {
        const objetivo = await tx.usuario.findUnique({
          where: { id },
          select: { id: true, rol: true, activo: true },
        });
        if (!objetivo) throw new Error("NO_EXISTE");

        // Hoy esta guarda no puede disparar —quien llama es un administrativo
        // activo, así que siempre se cuenta a sí mismo— y el porqué está
        // escrito en `otrosAdminsActivos`. Se deja porque es el invariante de
        // verdad, no la comodidad de pantalla de la regla de arriba.
        if (!activo && objetivo.rol === "ADMINISTRATIVO" && objetivo.activo) {
          if ((await otrosAdminsActivos(tx, id)) === 0) throw new Error("ULTIMO_ADMIN");
        }

        await tx.usuario.update({ where: { id }, data: { activo } });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NO_EXISTE") return { ok: false, errores: ["Esa cuenta no existe."] };
    if (msg === "ULTIMO_ADMIN") return { ok: false, errores: [NO_SIN_ADMINISTRATIVOS] };
    // Un choque de serialización no es un error de quien hizo clic: se reintenta.
    return {
      ok: false,
      errores: [
        "Otra persona estaba tocando las cuentas al mismo tiempo. Probá de nuevo.",
      ],
    };
  }

  refrescar("/usuarios");
  return { ok: true };
}

// --------------------------------------------------- reseteo por el admin

/**
 * Un administrativo le asigna una contraseña nueva a otra cuenta.
 *
 * POR QUÉ EXISTE. Sin esto, quien olvida su contraseña no tiene salida: no hay
 * correo configurado, y `cambiarMiPassword` pide la actual justamente porque es
 * la que no se acuerda. Y el escenario no es teórico — le pasa a un comercial
 * en el campo, que es el peor lugar para quedarse afuera.
 *
 * NO DEVUELVE LA CONTRASEÑA NI LA MANDA A NINGÚN LADO: la elige el
 * administrativo, que se la comunica a la persona por fuera de la app. Meterla
 * en un mail o en un mensaje sería agrandar el problema, no resolverlo.
 *
 * MUEVE `credencialesDesde`, y ése es el punto. Si un administrativo le cambia
 * la contraseña a alguien es porque esa persona perdió el control de la cuenta
 * o del dispositivo; dejarle vivas las sesiones viejas 30 días más sería
 * cambiar la cerradura y regalar la copia de la llave.
 */
export async function resetearPassword(
  id: number,
  nueva: string
): Promise<ResultadoUsuario> {
  let yo;
  try {
    yo = await exigir("ADMINISTRATIVO");
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  if (!Number.isInteger(id)) return { ok: false, errores: ["Cuenta inválida."] };

  const problema = validarPassword(nueva ?? "");
  if (problema) return { ok: false, errores: [problema] };

  const objetivo = await prisma.usuario.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!objetivo) return { ok: false, errores: ["Esa cuenta no existe."] };

  await prisma.usuario.update({
    where: { id },
    data: { hashPassword: await hashearPassword(nueva), credencialesDesde: new Date() },
  });

  // Si el administrativo se reseteó a sí mismo, se vuelve a firmar SU cookie —
  // después del update, para que la emisión no caiga antes del corte. Sin esto,
  // resetearse la propia contraseña te echa de la pantalla donde lo hiciste.
  if (id === yo.id) {
    (await cookies()).set(COOKIE_SESION, await firmarSesion(yo.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DURACION_SESION,
    });
  }

  refrescar("/usuarios");
  return { ok: true };
}

// ------------------------------------------------------- propia contraseña

/**
 * Cambiar la PROPIA contraseña. Cualquier rol: un comercial también tiene que
 * poder, y no hay correo configurado para un flujo de recuperación.
 *
 * Pide la actual a propósito: sin eso, una sesión ajena que quedó abierta en un
 * dispositivo prestado alcanza para quedarse con la cuenta.
 */
export async function cambiarMiPassword(
  actual: string,
  nueva: string,
  repetida: string
): Promise<ResultadoUsuario> {
  let yo;
  try {
    yo = await exigir();
  } catch (e) {
    const r = sinPermiso(e);
    if (r) return r;
    throw e;
  }

  const errores: string[] = [];
  const problema = validarPassword(nueva ?? "");
  if (problema) errores.push(problema);
  if (nueva !== repetida) errores.push("Las dos contraseñas nuevas no coinciden.");
  if (nueva && nueva === actual) {
    errores.push("La contraseña nueva es igual a la actual.");
  }
  if (errores.length) return { ok: false, errores };

  const u = await prisma.usuario.findUnique({
    where: { id: yo.id },
    select: { hashPassword: true },
  });
  if (!u || !(await verificarPassword(actual ?? "", u.hashPassword))) {
    return { ok: false, errores: ["La contraseña actual no es la correcta."] };
  }

  // `credencialesDesde` se mueve acá: toda sesión emitida antes de este instante
  // queda afuera en `usuarioActual()`. Es el punto del cambio — si alguien
  // cambia la contraseña es porque quiere echar a quien esté adentro, y con
  // cookies de 30 días eso no pasaba solo.
  const ahora = new Date();
  await prisma.usuario.update({
    where: { id: yo.id },
    data: { hashPassword: await hashearPassword(nueva), credencialesDesde: ahora },
  });

  // La cookie de ESTE dispositivo se vuelve a firmar, y se firma DESPUÉS del
  // update: así su emisión nunca cae antes del corte. Sin esto, cambiar la
  // contraseña te echaría a vos mismo de la pantalla donde la cambiaste.
  (await cookies()).set(COOKIE_SESION, await firmarSesion(yo.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SESION,
  });

  refrescar("/mi-cuenta");
  return { ok: true };
}
