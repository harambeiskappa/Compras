# Vitácora — App de Compras

Registro del desarrollo: qué se decidió, por qué, qué se midió y qué quedó abierto.
Formato de cada entrada: **fecha · qué pasó · por qué · qué queda**.
El código lo escribe Claude Code en VS Code; acá va el análisis y el registro.

---

## Estado actual

| | |
|---|---|
| **Fase** | 1 — Módulos 1 (Información de la compra) y 2 (Compra) |
| **Situación** | Prompt de arranque escrito y medido. Sin código todavía. |
| **Bloqueo** | 12 decisiones abiertas `[DECIDIR]` en el prompt de arranque |
| **Stack** | Next.js (App Router) + Postgres + Vercel |
| **Base de referencia** | `C:\Users\zemma\Claude\Projects\WinCompras\backend\db.sqlite3` |

### Decisiones abiertas que bloquean

| # | Decisión | Bloquea |
|---|---|---|
| 7 | ¿Carga ↔ tropa es N:N? | el esquema |
| 8 | ¿El lote se pesa junto en la balanza pública? | el grano del lote, y con él el módulo 4 |
| 9 | ¿Padrón único de entidades o catálogos separados? | el esquema |
| 10 | TRB: ¿comprador propio o tercero? | el seed |
| 11 | ¿El formulario acepta lotes mixtos (`T`, `nov/vaq`)? | el esquema y la UI |
| 1 | ¿Hay señal en la feria? | la arquitectura del formulario |
| 2 | Link de carga: ¿token o login? ¿vence? | auth |
| 3 | Qué campos son obligatorios | la UI |
| 4 | Roles: quién carga, quién revisa, quién mira | auth |
| 5 | Cómo vuelve el imprimible | alcance de la fase |
| 6 | Compras de terceros en formato del consignatario | alcance de la fase |
| 12 | ¿El DTE se trae de WinCampo o se tipea? | alcance de la fase |

Las cuatro primeras (7, 8, 9, 10) son las únicas que bloquean el esquema. Las demás se pueden cerrar mientras se construye.

---

## Entradas

### 2026-08-24 · Se midió la base antes de diseñar

**Qué se hizo.** Antes de escribir el prompt de arranque de módulos 1 y 2 se midió `db.sqlite3` sobre las **118 compras** entre 2025-08-24 y 2026-08-24.

**Por qué.** El principio del proyecto es medir antes de construir. En WinCompras varias veces lo que parecía obvio resultó ser otra cosa al mirar los números — y esta vez pasó cinco veces.

**Coberturas medidas** (118 compras):

| Dato | Cobertura |
|---|---:|
| `importe_total` | 99,2 % |
| `comision` | 94,1 % |
| `kg_llegada` | 70,3 % |
| `n_liquidacion` | 56,8 % |
| `comprador` (empresa) | 55,1 % |
| `costo_puesto_kg` | 52,5 % |
| `razon_social` | 9,3 % |
| **`kg_origen`** | **9,3 %** |
| `cab_llegada` | 9,3 % |
| `desbaste` | 8,5 % |
| `n_dte` | 8,5 % |
| `transportistas` | 5,9 % |
| `nro_tropa_texto` | 5,1 % |
| `logistica_total` (flete) | 0,8 % |
| `costo_puesto_completo` | 0,8 % |
| `guias`, `observaciones` | 0 % |

Formato: 11 compras estándar, 107 formato viejo.

**Cinco hallazgos que corrigen el brief:**

1. **`kg_origen` está en 9,3 %.** El brief pone el foco en el flete; sin kilos de origen tampoco hay desbaste. Y esos kilos se conocen en la feria → son lo que más rinde capturar en el módulo 2.
2. **El DTE existe en 688 de 688 tropas de WinCampo (100 %).** El agujero está del lado del Excel de compras, no del dato. Hoy varios DTE se apelmazan en un campo de texto: `032244385-4 / 032244312-9 / 032244287-4 / 03224295-5`.
3. **MEJ no es canónica**: `mej`, `MEJ` y `Mej` mapean a **TO**.
4. **Existe la canónica `T`** (ternero/a mixto, 19 variantes) que el brief no lista → hay lotes mixtos por naturaleza. Y 18 variantes sin canónica que no son errores de tipeo sino ambigüedades reales: `nov/vaq`, `vaca/toro`, `vac/cria`, `machos`, `Invernada x kg`, `130`.
5. **Cabezas compradas ≠ llegadas, en los dos sentidos.** Compra 6313: 217 compradas / 216 llegadas. Compra 6314: 199 / **222**.

**Dimensiones medidas.** Lotes por compra: mediana 2, p90 6, máx 9. Compras con más de una tropa: 34 de 369 (9,2 %), hasta 5. Consignatarios distintos en el año: 11, con Darwash en el 51 %. Precio: 315 de 347 lotes por kilo (90,8 %); el resto por bulto o por cabeza.

**Deuda del esquema viejo.** `liquidaciones_liquidacion` tiene **19 columnas `REAL NOT NULL`** con 0 cuando no hay dato — entre ellas `kg_origen`, `desbaste`, `logistica_total`, `kg_llegada`. Por eso «no se sabe» y «vale cero» son indistinguibles, y por eso las coberturas de arriba tuvieron que medirse como «distinto de 0» en vez de «no nulo». El esquema nuevo no puede repetirlo, y hay un test en el prompt de arranque (punto 8.3) para garantizarlo.

**Qué queda.** Cerrar las 12 decisiones `[DECIDIR]`. Las cuatro que bloquean el esquema son 7, 8, 9 y 10.

**Artefacto.** `prompt-arranque-modulos-1-2.md`.

---

### 2026-08-24 · Infraestructura: repo y despliegue

**Qué hay.** Repo `github.com/harambeiskappa/Compras`, branch `main`, un commit inicial con solo `.gitattributes`. GitHub Desktop conectado y sincronizado. Vercel con la cuenta `harambeiskappa` viendo el repo, todavía sin importar.

**Qué se ordenó.** El repo estaba una carpeta más adentro que el workspace abierto en VS Code (`Projects\Compras\Compras`), y los dos documentos habían quedado afuera, sin versionar. Se movieron adentro del repo: la vitácora y el prompt de arranque ahora se versionan junto al código.

**Por qué importa que la vitácora esté en el repo.** El historial del análisis queda al lado del historial del código, y cualquiera que entre al proyecto más adelante ve las dos cosas juntas.

**Qué queda.**
- Reabrir VS Code sobre `Projects\Compras\Compras` (el repo de verdad).
- Commitear los dos `.md` desde GitHub Desktop.
- Scaffolding de Next.js antes de importar a Vercel — importar un repo sin app deja un proyecto que no buildea.
- Elegir Postgres. Vercel lo ofrece desde el Marketplace (Neon o Supabase); definirlo antes de la primera migración.

---

### 2026-08-24 · Scaffolding de Next.js listo

**Qué hay.** Next.js 16.3.2 + React 19.2.8, App Router, TypeScript, Tailwind 4, carpeta `src/`, ESLint, npm. `npm run build` corre limpio. Nada commiteado todavía.

**Dos tropiezos y cómo se resolvieron.**

- *La carpeta equivocada.* Claude Code estaba parado en `Projects\Compras`, no en el repo, que está una carpeta más adentro (`Projects\Compras\Compras`). Lo delató él mismo al escribir en su plan que el directorio «no es un repo git». Se reabrió VS Code sobre el repo.
- *El nombre del paquete.* `create-next-app` saca el `name` del `package.json` del nombre de la carpeta, y npm no acepta mayúsculas: `Compras` lo rechazaba. No hay flag para forzar el nombre, así que se generó en una subcarpeta temporal `compras/` y se movió todo a la raíz. Quedó `name: "compras"`.

**Por qué los `.md` viven en `docs/`.** `create-next-app` solo tolera un puñado de archivos preexistentes en el destino (`.git`, `.gitattributes`, `LICENSE`, `README.md`, `docs/`). Con la vitácora y el prompt sueltos en la raíz, el comando se habría plantado.

**Un patrón a corregir.** En dos planes seguidos, Claude Code volvió a decidir por su cuenta cosas ya decididas (Tailwind, `src/`, `--force`), porque cada conversación nueva arranca sin memoria. Se agregó un `CLAUDE.md` en la raíz con las decisiones fijas y las reglas duras del dominio, para que dejen de re-litigarse. Nota: `create-next-app` genera un `CLAUDE.md` que solo contiene `@AGENTS.md`; el nuestro conserva esa línea arriba.

**Cuidado con la versión de Next.** El `AGENTS.md` que genera el scaffolding avisa que Next 16 trae breaking changes respecto de lo que un modelo pudo haber visto en entrenamiento, y que hay que leer `node_modules/next/dist/docs/` antes de escribir rutas o server actions. Vale tenerlo presente cuando empiece el código de verdad.

**Qué queda.**
- Commitear todo desde GitHub Desktop (13 archivos untracked + `docs/`).
- Importar el repo a Vercel — ahora sí buildea.
- Elegir Postgres y cargar la connection string como variable de entorno. `.gitignore` ya excluye `.env*`, así que no hay riesgo de que se filtre.
- Recién ahí, la propuesta de esquema.

---

### 2026-08-24 · Infraestructura completa y decisión de ORM

**Qué hay.** El circuito entero enganchado: repo `harambeiskappa/Compras` → Vercel (proyecto `compras`, primer deploy verde) → Supabase (`compras-db`, plan free, región São Paulo). Variables de entorno inyectadas por la integración, marcadas como sensibles, disponibles en Production, Preview y Development.

**Decisión: Prisma.** El esquema en `prisma/schema.prisma`, las migraciones en `prisma/migrations/`, todo versionado.

*Por qué, y el razonamiento importa más que la elección.* Las tres opciones (Prisma, Drizzle, SQL a mano) hacen lo mismo. Lo que inclinó la balanza no fue técnico: **Iñaki es quien revisa que ninguna columna tenga `DEFAULT 0`**, y esa revisión se va a repetir muchas veces. Con Prisma es abrir un archivo y leer una lista; con SQL a mano hay que seguir el hilo entre varios archivos de migración. La contra conocida de Prisma —más peso en serverless, arranques en frío algo más lentos— no se nota con la cantidad de usuarios que va a tener esta app.

**Regla que se desprende:** prohibido crear o modificar tablas desde el editor de Supabase. Es cómodo y es una trampa: el esquema terminaría existiendo solo en la nube, sin historial y divergiendo del repo. Ya sabemos cómo termina eso.

**Una cuenta para el módulo 2.** El plan free de Supabase da 1 GB de file storage. Con 128 compras al año y una o dos fotos de remito por compra, a ~3 MB por foto de celular sin comprimir, se llena en el primer año. Las fotos tienen que comprimirse del lado del cliente antes de subir: un remito legible entra cómodo en 300-400 KB.

**Riesgo asumido, a revisar más adelante.** Development quedó apuntando a la misma base que Production. Hoy da igual porque está vacía; cuando haya compras cargadas de verdad hay que separarlas, porque una migración corrida en local tocaría datos reales.

**Se agregó `CLAUDE.md`** en la raíz con las decisiones fijas y las reglas duras del dominio. Nace de un patrón observado: en dos planes seguidos, Claude Code volvió a decidir por su cuenta cosas ya resueltas, porque cada conversación nueva arranca sin memoria.

**Qué queda.** La propuesta de esquema Postgres. Es lo próximo.

---

### 2026-08-24 · Propuesta de esquema: revisión y correcciones

**Qué pasó.** Claude Code propuso el `schema.prisma` completo y la sesión se cortó por límite de uso justo antes de ejecutar. No se perdió nada: el transcript quedó en disco y el plan se recuperó entero. Prisma todavía no está instalado.

**Lo que hizo bien la propuesta.** Midió contra la base histórica en vez de suponer, se hizo revisar por un segundo agente, y —lo más valioso— **contradijo al documento de arranque con evidencia**: el caso «75 PEG + 5 LTA en un camión» no existe en los datos. Los casos reales más parecidos (Darwash 06/05/25 con PEG+BUL+UGM; Villegas 16/07/25 con PEG+LTA) resultaron ser camiones, tropas y DTE separados el mismo día, no un reparto dentro de un mismo camión. Sobre esa base cerró la decisión #7 (carga↔tropa) como N:1, dejando anotado que si el caso aparece, el arreglo es una tabla puente y es aditivo.

**Hallazgos sobre el sistema viejo que conviene no perder.**
- No existe tabla `compra` ni tabla `lote`: «la compra» es una fila de `liquidaciones_liquidacion` (un Excel = una fila) y «el lote» un renglón colgado directo de ahí, sin ningún vínculo con tropa.
- De los cuatro roles, **el único normalizado es empresa compradora** (`ingresos_tropa.comprador_id`, FK real). Consignatario, vendedor y hotelero son texto libre, y persona compradora no existe en ninguna forma.
- El mismo actor aparece en varios roles: DARWASH SA es consignatario en 239 tropas y proveedor en 143; PEGSA es hotelero en 577. Dato a favor de un padrón único cuando se retome la decisión #9.
- `detalleliquidacion.desbaste` y `.peso_origen` están en NULL en **2401 de 2401** filas: nunca se usaron. El desbaste real se calcula por tropa sumando jaulas, no por categoría. Evidencia fuerte para la decisión #8.

**Cinco correcciones pedidas antes de migrar.**

1. **`empresaCompradora` está en `Compra` y en `Tropa`.** El mismo dato en dos lugares, que es la regla que más caro salió en WinCompras. En una compra con dos tropas de empresas distintas, `Compra.empresaCompradora` es ambiguo, y nada impide que diga PEG mientras sus tropas dicen LTA. Hay dos salidas y la decisión es de Iñaki: que el dato viva solo en `Tropa` (y el módulo 1 cree la primera tropa, con `nroTropa` en NULL), o que sean dos conceptos distintos con nombres distintos más una validación de consistencia. **Queda como decisión abierta #13.**

2. **`Carga` no tiene cabezas.** El DTE declara cuántos animales se mueven, y como los lotes cuelgan de `Tropa` y no de `Carga`, tampoco es derivable. Sin eso no se puede contestar «cuántas cabezas iban en esta jaula», que es lo que va a hacer falta en recepción con las guías por jaula. Es un hecho capturado, no un total: `Carga.cabezas Int?`.

3. **`Tropa.nroTropa` va `@unique`.** En `ingresos_tropa` era `NOT NULL UNIQUE`; es la identidad fuerte del ingreso. Siendo nullable, Postgres deja convivir los NULL sin quejarse.

4. **Normalización de sinónimos: decidir ahora, no después.** Define qué filas entran en el seed — con normalización, `mej`/`MEJ`/`Mej` colapsan en una; sin ella, quedan tres. La solución evita la extensión `citext`: guardar `texto` (como vino) y `textoNormalizado` (trim + minúsculas) con el `@unique` sobre el normalizado.

5. **Columnas de dinero a `Decimal(14,2)`.** Con `(10,2)` topean en 99.999.999 y un precio por cabeza lo va a superar pronto.

**Anotado para el formulario, no para el esquema.** `Lote.tropaId` nullable está bien, pero si queda vacío el desbaste por lote del módulo 4 no se puede calcular. Es la misma trampa que `kg_origen` al 9,3 %: nadie lo llenó porque nada lo pedía. Tiene que estar visible en la pantalla, no escondido.

**Qué queda.** Que Claude Code aplique las cinco correcciones, y recién ahí la migración.

---

### 2026-08-25 · Prisma: el tag `latest` de npm apunta a un release candidate

**Qué pasó.** Al instalar Prisma, el CLI quedó en `8.0.0-rc.10` y el client en `7.10.0`: desalineados por un major. Claude Code lo detectó solo antes de seguir.

**La causa, después de descartar dos hipótesis mías equivocadas.** No fue caché de npm ni un registry proxy — se verificó con caché limpio y `registry = https://registry.npmjs.org/`. Es el estado real del paquete upstream:

```
"latest": "8.0.0-rc.10",
"next":   "8.0.0-rc.10",
"prev":   "7.10.0",
```

`latest` y `next` apuntan al mismo valor: el RC pisó el tag estable. Por la marca de tiempo del manifiesto, `7.10.0` se publicó prácticamente el mismo día, así que tiene pinta de error de publicación de Prisma más que de decisión.

**Decisión: pinnear exacto a `7.10.0`** (CLI y client), sin caret.

**Consecuencia que hay que recordar:** mientras el tag siga así, cualquier `npm install prisma` sin versión trae el release candidate. Quedó escrito en `CLAUDE.md`.

**Lo que importa más que el número: el `package-lock.json` es lo que Vercel usa para el build.** El `package.json` es una intención; el lockfile es el candado. Tiene que quedar commiteado.

**Dos correcciones a lo que yo había dicho antes**, anotadas porque el método vale más que el acierto:
1. Dije que ambas versiones venían de canales de prueba. Falso: `@prisma/client` en `7.10.0` era su estable correcto. El único desalineado era el CLI.
2. Dije que el pin iba a `7.9.1`, leyendo el registro público por HTTP. Esa lectura estaba vieja —caché de CDN— y el número correcto era `7.10.0`, que es lo que decía `prev` en la salida cruda de la propia máquina.

En los dos casos el dato bueno salió de pedir la **salida cruda sin resumir**. Vale como regla: cuando dos lecturas no cierran, pedir los bytes, no el resumen.
