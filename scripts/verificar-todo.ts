/**
 * TODAS las verificaciones, en un comando.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CUÁNDO HAY QUE CORRERLO                                                  │
 * │                                                                          │
 * │ Después de cualquier cambio que toque **auth**, el **proxy**, el **ciclo │
 * │ de request** o el **esquema**. No porque esos cambios sean más riesgosos │
 * │ que otros, sino porque son los que rompen verificaciones EN SILENCIO: no │
 * │ tocan la pantalla, no tocan el test, y sin embargo lo dejan sin poder    │
 * │ arrancar.                                                                │
 * │                                                                          │
 * │ Ya pasó: `verificar-modulo-1.ts` quedó roto once días con el commit de   │
 * │ auth, porque `exigir()` necesita `cookies()` y fuera de una request eso  │
 * │ no existe. Nadie lo notó, y en ese tiempo «19 chequeos en verde» dejó de │
 * │ ser un hecho reproducible para pasar a ser una anécdota.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN SCRIPT QUE NO ARRANCA CUENTA COMO ROJO, NO COMO AUSENTE.              │
 * │                                                                          │
 * │ Si una verificación revienta al importar, sale en el resumen como fallo  │
 * │ y hace fallar el comando entero. Desaparecer del resumen sin ruido es    │
 * │ exactamente lo que nos pasó, y es peor que un rojo: un rojo se mira.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * La prueba histórica CONSERVA SU PROPIO CRITERIO —(b) en cero y ningún motivo
 * sin catalogar— y su código de salida. Este comando la corre; no la reemplaza
 * ni la reinterpreta.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CÓMO PROBAR QUE ESTA GUARDA SIGUE VIVA, cuando haga falta.               │
 * │                                                                          │
 * │ Se le mete a una verificación un import que no existe, se corre esto, y  │
 * │ tiene que salir «NO ARRANCÓ» con código 1. Pero OJO CON CÓMO SE ROMPE:   │
 * │                                                                          │
 * │   import { algo } from "./no-existe";   ← NO sirve. `tsx` borra el       │
 * │                                            import si nadie usa `algo`,   │
 * │                                            el script corre igual y la    │
 * │                                            prueba «pasa» sin haber       │
 * │                                            probado nada.                 │
 * │   import "./no-existe";                 ← SÍ sirve: un import de efecto  │
 * │                                            no se puede elidir.           │
 * │                                                                          │
 * │ Pasó exactamente eso la primera vez que se probó esta guarda. Una guarda │
 * │ que no se rompió de verdad no está probada.                              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Correr:  npm run verificar
 *          npm run verificar -- --produccion
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const PROD = "https://compras-ten-mu.vercel.app";
const enProduccion = process.argv.includes("--produccion");
const BASE = enProduccion ? PROD : "http://localhost:3000";

type Verificacion = {
  nombre: string;
  script: string;
  /** La prueba histórica no cuenta verdes: aprueba o no. */
  propioCriterio?: boolean;
  /** La histórica lee la base de WinCompras, no el servidor. */
  necesitaServidor?: boolean;
};

const VERIFICACIONES: Verificacion[] = [
  { nombre: "módulo 1", script: "verificar-modulo-1.ts", necesitaServidor: true },
  { nombre: "auth", script: "verificar-auth.ts", necesitaServidor: true },
  { nombre: "usuarios", script: "verificar-usuarios.ts", necesitaServidor: true },
  { nombre: "bandeja", script: "verificar-bandeja.ts", necesitaServidor: true },
  { nombre: "comprador (HTTP)", script: "verificar-comprador.ts", necesitaServidor: true },
  {
    nombre: "comprador (navegador)",
    script: "verificar-comprador-navegador.ts",
    necesitaServidor: true,
  },
  { nombre: "prueba histórica", script: "prueba-historico.ts", propioCriterio: true },
];

type Resultado = {
  nombre: string;
  verdes: number;
  rojos: number;
  /** Cuando el script ni siquiera llegó a correr. Es un rojo, no un hueco. */
  noArranco: boolean;
  motivo: string;
  segundos: number;
};

function correr(v: Verificacion): Promise<Resultado> {
  const empezo = Date.now();
  return new Promise((resolver) => {
    const args = ["tsx", `scripts/${v.script}`];
    if (enProduccion) args.push("--produccion");

    // `shell: true` porque en Windows `npx` es un .cmd y sin shell no se
    // encuentra. La salida se captura entera para poder leer el resumen y, si
    // reventó, mostrar por qué.
    const hijo = spawn("npx", args, { shell: true });

    let salida = "";
    hijo.stdout.on("data", (d) => (salida += d.toString()));
    hijo.stderr.on("data", (d) => (salida += d.toString()));

    hijo.on("close", (codigo) => {
      const segundos = (Date.now() - empezo) / 1000;
      const resumen = [...salida.matchAll(/(\d+) en verde, (\d+) en rojo/g)].pop();

      if (v.propioCriterio) {
        const aprobada = /\bAPROBADA\b/.test(salida) && codigo === 0;
        return resolver({
          nombre: v.nombre,
          verdes: aprobada ? 1 : 0,
          rojos: aprobada ? 0 : 1,
          noArranco: false,
          motivo: aprobada
            ? "aprobada con su propio criterio: (b) en cero y ningún motivo sin catalogar"
            : primeraLineaDeError(salida) || "no aprobó",
          segundos,
        });
      }

      if (!resumen) {
        // Sin línea de resumen no se sabe nada, y «no se sabe» NO es «pasó».
        // Vale igual si el código de salida fue 0: un script que termina sin
        // reportar es un script que no verificó.
        return resolver({
          nombre: v.nombre,
          verdes: 0,
          rojos: 1,
          noArranco: true,
          motivo:
            `terminó con código ${codigo} y sin línea de resumen — ` +
            (primeraLineaDeError(salida) || "no llegó a correr ningún chequeo"),
          segundos,
        });
      }

      const verdes = Number(resumen[1]);
      const rojos = Number(resumen[2]);
      resolver({
        nombre: v.nombre,
        verdes,
        rojos,
        noArranco: false,
        motivo: rojos > 0 ? lineasEnRojo(salida) : "",
        segundos,
      });
    });
  });
}

function primeraLineaDeError(salida: string): string {
  const lineas = salida
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !l.startsWith("◇") &&
        !l.startsWith("|") &&
        !l.startsWith("=") &&
        !l.startsWith("at ")
    );
  const error = lineas.find((l) => /error|Error|Cannot|Timeout|FALLA/.test(l));
  return (error ?? lineas[lineas.length - 1] ?? "").slice(0, 160);
}

function lineasEnRojo(salida: string): string {
  return salida
    .split("\n")
    .filter((l) => l.includes("FALLA"))
    .map((l) => l.trim().replace(/^FALLA\s+/, ""))
    .slice(0, 4)
    .join(" · ");
}

async function servidorArriba(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/salud`, { redirect: "manual" });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  VERIFICACIONES — contra ${BASE}`);
  console.log(`${"=".repeat(70)}`);

  let servidorPropio: ReturnType<typeof spawn> | null = null;

  if (VERIFICACIONES.some((v) => v.necesitaServidor)) {
    if (!(await servidorArriba())) {
      if (enProduccion) {
        console.error(`\n  ${PROD} no responde. No hay nada contra qué verificar.`);
        process.exit(1);
      }
      if (!existsSync(".next")) {
        console.error(
          "\n  No hay build (`.next` no existe) y las verificaciones necesitan el\n" +
            "  servidor. Corré `npm run build` primero."
        );
        process.exit(1);
      }
      console.log("\n  El servidor local no estaba levantado: lo levanto yo.");
      servidorPropio = spawn("npx", ["next", "start", "-p", "3000"], { shell: true });
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (await servidorArriba()) break;
      }
      if (!(await servidorArriba())) {
        console.error("  No pudo levantarse. Probá `npm run build` y después de nuevo.");
        servidorPropio.kill();
        process.exit(1);
      }
      console.log("  Listo.");
    } else {
      console.log("\n  Uso el servidor que ya estaba escuchando.");
    }
  }

  const resultados: Resultado[] = [];
  try {
    // De a una, no en paralelo: TODAS escriben en la misma base y crean cuentas
    // de prueba. La de usuarios cuenta administrativos activos, así que otra
    // corriendo al mismo tiempo le cambiaría el resultado.
    for (const v of VERIFICACIONES) {
      console.log(`\n${"-".repeat(70)}\n  ${v.nombre}\n${"-".repeat(70)}`);
      const r = await correr(v);
      resultados.push(r);
      const sello = r.noArranco ? "NO ARRANCÓ" : r.rojos > 0 ? "EN ROJO" : "en verde";
      console.log(
        `  ${sello} — ${r.verdes} verde(s), ${r.rojos} rojo(s) · ${r.segundos.toFixed(0)}s`
      );
      if (r.motivo) console.log(`  ${r.motivo}`);
    }
  } finally {
    if (servidorPropio) {
      servidorPropio.kill();
      // En Windows matar el `npx` no siempre baja al `next start` que lanzó.
      spawn("npx", ["kill-port", "3000"], { shell: true, stdio: "ignore" }).on(
        "error",
        () => {}
      );
    }
  }

  // ------------------------------------------------------------- resumen
  console.log(`\n${"=".repeat(70)}`);
  console.log("  RESUMEN");
  console.log(`${"=".repeat(70)}`);

  const ancho = Math.max(...resultados.map((r) => r.nombre.length));
  for (const r of resultados) {
    const estado = r.noArranco
      ? "NO ARRANCÓ  ← cuenta como rojo"
      : r.rojos > 0
        ? `${r.verdes} en verde, ${r.rojos} EN ROJO`
        : `${r.verdes} en verde, 0 en rojo`;
    console.log(`  ${r.nombre.padEnd(ancho)}  ${estado}`);
  }

  const rojos = resultados.reduce((n, r) => n + r.rojos, 0);
  const verdes = resultados.reduce((n, r) => n + r.verdes, 0);
  const rotos = resultados.filter((r) => r.noArranco).length;

  console.log(`${"-".repeat(70)}`);
  console.log(
    `  ${verdes} en verde, ${rojos} en rojo` +
      (rotos ? ` · ${rotos} verificación(es) que no llegaron a correr` : "")
  );
  console.log(`${"=".repeat(70)}\n`);

  // Código de salida distinto de cero si algo falló: sin esto, correr este
  // comando desde otro script diría que aprobó siempre.
  process.exit(rojos > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
