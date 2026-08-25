# Vitácora — App de Compras

Registro del desarrollo: qué se decidió, por qué, qué se midió y qué quedó abierto.
Formato de cada entrada: **fecha · qué pasó · por qué · qué queda**.
El código lo escribe Claude Code en VS Code; acá va el análisis y el registro.

> **Si volvés después de un corte, leé solo esta primera sección.** Dice dónde estamos y cuál es el próximo comando. Las entradas de abajo son el historial y el porqué de cada decisión; no hacen falta para retomar.

---

## Dónde retomamos — actualizado 2026-08-25

**Próximo paso concreto:** agregar `prisma migrate deploy` al script de `build` (hoy nadie migra en el deploy), levantar `next dev` una vez para ejercitar el bug de Turbopack en aislamiento, y después el seed: 8 categorías canónicas y 258 sinónimos deduplicados por `textoNormalizado` desde `WinCompras/backend/db.sqlite3`.

| | |
|---|---|
| **Fase** | 1 — Módulos 1 (Información de la compra) y 2 (Compra) |
| **Situación** | Base migrada, con RLS, y el cliente conectando por TLS verificado. **Base vacía: falta el seed.** |
| **Stack** | Next.js 16 + TypeScript + Tailwind + Prisma 7.10.0 + Postgres de Supabase, deploy en Vercel |
| **Repo** | `github.com/harambeiskappa/Compras` → proyecto `inaki-pegsa/compras` en Vercel |
| **Base** | Supabase `compras-db`, São Paulo, plan free. Migración `20260825191736_modulos_1_y_2` aplicada. |
| **Base de referencia** | `C:\Users\zemma\Claude\Projects\WinCompras\backend\db.sqlite3` (solo lectura) |

### Ya está hecho

- Repo, GitHub, Vercel y Supabase enganchados. Primer deploy verde.
- Scaffolding de Next.js: App Router, TypeScript, Tailwind, `src/`, ESLint, npm.
- Prisma 7.10.0 pinneado exacto (CLI, client y `@prisma/adapter-pg`), con `prisma.config.ts`, generator `prisma-client` y `postinstall`.
- `prisma/schema.prisma` completo y validado: 11 modelos, 3 enums, sin un solo `DEFAULT 0`.
- `vercel link` y `vercel env pull` hechos: las variables están en `.env.local`.
- `CLAUDE.md` con las decisiones fijas y las reglas duras del dominio.
- **Primera migración aplicada.** Verificada consultando la base: el `CHECK (cabezas > 0)` está, las FK compuestas están, y ninguna de las seis columnas de cantidad/peso/precio/monto tiene default.
- **RLS activado en las 14 tablas**, sin políticas, con `relforcerowsecurity = false` para preservar el bypass del dueño. Verificado que Prisma sigue leyendo después.
- **Cliente conectando**, con el CA de Supabase inline y verificado por fingerprint contra el root que presenta el servidor.

### Falta, en orden

1. `prisma migrate deploy` en el build, y el smoke de `next dev` (el próximo paso de arriba).
2. El seed: 8 categorías canónicas y 258 sinónimos deduplicados por `textoNormalizado`. Requiere instalar `tsx` y escribir `prisma/seed.ts`, que hoy está declarado en el config pero no existe.
3. Instanciar el cliente con el adapter contra `POSTGRES_PRISMA_URL` (la pooleada).
4. La prueba contra el histórico: representar las 118 compras del último año en el modelo nuevo y listar las que no entren, con el motivo. Es la verificación exigida del punto 8.1 del prompt de arranque.
5. Las pantallas de los módulos 1 y 2.

### Decisiones abiertas

Ninguna bloquea la migración. Las cuatro que bloqueaban el esquema están resueltas o cerradas con evidencia.

| # | Decisión | Estado | Bloquea |
|---|---|---|---|
| 13 | Empresa titular vs. compradora | **Resuelta:** son dos conceptos distintos | — |
| 7 | ¿Carga ↔ tropa es N:N? | Cerrada como N:1 con evidencia; si aparece el caso, el arreglo es aditivo | — |
| 10 | TRB: ¿propio o tercero? | Sin resolver; `esPropio` quedó nullable a propósito | el seed |
| 8 | ¿El lote se pesa junto en la balanza? | Sin resolver; hay evidencia fuerte de que no | el módulo 4 |
| 9 | ¿Padrón único de entidades o catálogos separados? | Sin resolver; hoy son 4 catálogos | un refactor futuro |
| 11 | ¿El formulario acepta lotes mixtos? | Sin resolver; el esquema los soporta igual | la UI |
| 3 | Qué campos son obligatorios | Sin resolver; se asumió la lista del documento | la UI |
| 1 | ¿Hay señal en la feria? | Sin resolver — preguntarle a Matías | la arquitectura del formulario |
| 2 | Link de carga: ¿token o login? | Sin resolver | auth |
| 4 | Roles: quién carga, revisa, mira | Sin resolver — copiar de `remates-app` | auth |
| 5 | Cómo vuelve el imprimible | Sin resolver; `Adjunto.tipo` soporta las dos respuestas | alcance |
| 6 | Compras de terceros | Sin resolver; `Adjunto.tipo` la soporta | alcance |
| 12 | ¿El DTE se trae de WinCampo o se tipea? | Sin resolver; `Carga.dte` funciona en los dos casos | alcance |

### Cosas que ya nos mordieron una vez

- El tag `latest` de `prisma` en npm apunta a un release candidate: **cualquier `npm install prisma` sin versión trae el RC.**
- Prisma 7 + Next 16 + Turbopack tiene un bug documentado (`Cannot find module ".prisma/client/default"`) que va a aparecer recién al levantar `next dev`.
- Los resúmenes de Claude Code se equivocaron tres veces (la carpeta donde estaba parado, las flags del scaffolding, la lectura del registry). **Cuando dos lecturas no cierran, pedir los bytes crudos, no el resumen.**
- El repo está una carpeta más adentro de lo que parece: `Projects\Compras\Compras`.

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

---

### 2026-08-25 · Prisma 7 instalado y la decisión #13, resuelta

**Dependencias.** `prisma`, `@prisma/client` y `@prisma/adapter-pg` pinneadas exactas a `7.10.0`, sin caret, y el lockfile sin rastros de `-rc`/`-dev`/`-integration`. `pg` entra como dependencia del adapter. `dotenv` como devDep.

**Prisma 7 cambió de forma, y eso invalidó parte del plan.** No es solo que `datasource.url` salga del schema: son cuatro cambios. La URL y las rutas de schema, migraciones y seed van a `prisma.config.ts`; el generator `prisma-client-js` queda legacy y va `prisma-client` con `output` obligatorio; Postgres necesita el driver adapter `@prisma/adapter-pg` y el cliente se instancia con `new PrismaClient({ adapter })`. Verificado contra la documentación oficial, no supuesto.

**Dos trampas de despliegue anotadas antes de pisarlas.** Vercel cachea `node_modules` entre deploys y el cliente generado no se commitea, así que hace falta `"postinstall": "prisma generate"` o el build de producción falla aunque ande en local. Y Prisma 7 + Next 16 + Turbopack tiene un bug documentado (`Cannot find module ".prisma/client/default"`) que va a aparecer recién al levantar `next dev`.

**El `.env` de Prisma apunta a `.env.local`.** `prisma.config.ts` importa `dotenv/config`, que lee `.env`, pero las credenciales se traen con `vercel env pull`, que sin argumentos escribe en `.env.local`. Se decidió cambiar el config y no el flujo: si moviéramos el destino del pull, el día que alguien corra el comando pelado Prisma se rompe sin motivo aparente. Que el archivo raro sea el config, no el flujo estándar.

**Decisión #13, resuelta — y no era una duplicación.** La pregunta de esquema escondía una de dominio: *cuando en la misma feria y el mismo día se compra para varias empresas, ¿es una compra o varias?* La respuesta de Iñaki: **PEGSA siempre va sola y UGM siempre va aparte, pero si Bulltrade compró poco se puede agregar a la compra de PEGSA.**

O sea que son dos conceptos distintos y ambos campos se quedan, con nombres que no se confundan:
- `Compra.empresaTitular` — bajo qué empresa se registra la compra. Se contesta en el módulo 1, antes de que exista una tropa.
- `Tropa.empresaCompradora` — a quién le quedan efectivamente esas cabezas.

**Validación:** la titular tiene que aparecer entre las empresas de las tropas de esa compra. No puede ser constraint de base, porque en el módulo 1 todavía no hay tropas: es una validación al cerrar el módulo 2.

**Consecuencia para el formulario:** la empresa de cada tropa viene precargada con la titular, y solo se cambia en el caso excepcional. El camino común queda sin clicks y la excepción, explícita.

**Qué queda.** Aplicar el renombre y la validación, y recién ahí la primera migración.

---

### 2026-08-25 · Esquema cerrado, listo para la primera migración

**Última revisión, leyendo el archivo y no el resumen.** Tres cosas salieron de ahí:

1. **`Empresa.compras` → `comprasComoTitular`.** Ahora que titular y compradora son conceptos distintos, la back-relation vieja se leía como «las compras de esta empresa» cuando en realidad es «donde figura como titular».

2. **Un lote podía colgarse de una tropa de otra compra.** `Lote` tenía `compraId` obligatorio y `tropaId` opcional, sin nada que garantizara que esa tropa fuera de esa compra: se podía grabar un lote de la compra 5 apuntando a una tropa de la compra 9. Igual con `Carga`. Se cerró con clave foránea compuesta — `@@unique([id, compraId])` en `Tropa`, y `(tropaId, compraId)` referenciando ese par desde `Lote` y `Carga`. Con `tropaId` en NULL Postgres no chequea nada, así que el caso «todavía no sé la tropa» sigue funcionando.

   *Es la filosofía del proyecto aplicada al esquema:* que el estado incorrecto no se pueda escribir, en vez de salir a detectarlo después. Tres líneas hoy; más adelante habría sido una migración con filas mal apuntadas que limpiar.

   *Efecto lateral a recordar:* `lote.compraId` participa ahora de dos FK a la vez. Mover un lote de compra con una tropa ya asignada va a fallar salvo que la tropa también sea de la compra nueva. Es correcto —eso es una imputación mal hecha, no una corrección— pero va a sorprender el día que pase.

3. **`DATABASE_URL` probablemente no existe.** La integración de Supabase con Vercel inyecta un juego `POSTGRES_*`. Además Supabase da **dos** cadenas: una pooleada por pgbouncer y una directa. Las migraciones tienen que ir contra la directa (pgbouncer rompe los locks y los prepared statements de `migrate`) y el adapter de la app contra la pooleada (en serverless, sin pool se agotan las conexiones). Como el `prisma.config.ts` lo usa el CLI y el adapter se instancia en el código, la separación sale natural: **config → directa, adapter → pooleada.**

**Bloqueado en:** `vercel login` / `link` / `env pull` son interactivos y los tiene que correr Iñaki. Hasta tener los nombres reales de las variables no se tocan ni `prisma.config.ts` ni el comentario de `schema.prisma:11-13`, que hoy nombran `DATABASE_URL`.

---

### 2026-08-25 · Primera migración: `20260825191736_modulos_1_y_2`

**Qué hay.** 14 tablas en Supabase. La migración se generó con `--create-only`, se le agregó a mano el `CHECK (cabezas > 0)` que Prisma no genera, y recién después se aplicó.

**Lo verificado, consultando la base y no el archivo:**
- Ninguna de las seis columnas de cantidad, peso, precio o monto tiene default de ningún tipo. Los únicos `DEFAULT` del archivo son cinco `activo BOOLEAN DEFAULT true` y once `creadoEn DEFAULT CURRENT_TIMESTAMP`.
- `lote_cabezas_positivas_check` presente.
- `UNIQUE (id, compraId)` en `tropa` y las dos FK compuestas de `lote` y `carga` apuntando a ese par, sin `MATCH FULL` — o sea `MATCH SIMPLE`, y un `tropaId` NULL no dispara el chequeo, que es exactamente lo buscado.

**Una corrección al criterio que yo había dado.** Dije «conexión directa vs. pooleada». Es inexacto: las tres URL que inyecta Supabase van al mismo host pooler, porque Supabase dejó la conexión directa a `db.<ref>.supabase.co` como IPv6-only y rutea todo por ahí. Lo que distingue a `POSTGRES_URL_NON_POOLING` es el **puerto 5432, session mode**, que preserva prepared statements y locks de sesión. El que rompe `migrate` es el 6543, *transaction mode*. La decisión era la correcta pero por el motivo equivocado, y el criterio bueno —**session vs. transaction**— es el que quedó escrito en `CLAUDE.md`.

| variable | puerto | modo | para |
|---|---|---|---|
| `POSTGRES_URL_NON_POOLING` | 5432 | session | migraciones (CLI) |
| `POSTGRES_PRISMA_URL` | 6543 | transaction | el adapter de la app |
| `POSTGRES_URL` | 6543 | transaction | — |

**Un problema que espera en el adapter.** El `pg` que trae `@prisma/adapter-pg` trata `sslmode=require` como `verify-full`, y la cadena de certificados de Supabase no valida contra el store por defecto: `self-signed certificate in certificate chain`. Prisma no lo sufre al migrar porque usa su propio engine, no `pg`. Se esquivó con `rejectUnauthorized: false` **solo dentro de un script de verificación efímero**, nunca como configuración. Al escribir el cliente hay que resolverlo de verdad, con el CA de Supabase.

**Qué queda.** El cliente con el adapter, después el seed.

---

### 2026-08-25 · Cliente con adapter: el TLS y dónde vive el certificado

**Qué hay.** `src/lib/prisma.ts` con singleton en `globalThis` (evita agotar conexiones con el hot reload), `PrismaPg` contra `POSTGRES_PRISMA_URL` y `max: 1` en el pool — el pooling ya lo hace pgbouncer. Se le saca `sslmode` a la cadena antes de pasarla, porque pisa el objeto `ssl` y además desacopla de cómo `pg` reinterprete ese parámetro más adelante.

**La cadena TLS del pooler, interrogada a mano** (hay que hacer el `SSLRequest` de Postgres, no es TLS directo):

```
leaf  : CN=*.pooler.supabase.com   O=Supabase Inc
inter : CN=Supabase Intermediate 2021 CA
root  : CN=Supabase Root 2021 CA   ← self-signed, es el que hace falta
        válido 2021-04-28 → 2031-04-26
```

No hay URL pública para bajarlo: solo desde el dashboard (Settings → Database → SSL Configuration). Extraerlo del propio chain se descartó por circular — sería verificar una conexión con un certificado sacado de esa misma conexión.

**Decisión: el CA va inline como string en un módulo `.ts`, no como `.crt` leído con `fs`.** El motivo es el modo de falla, no la elegancia. Next no traza archivos arbitrarios al bundle de Vercel, así que `fs.readFileSync` anda en local y puede romper **solo en producción**; mantenerlo vivo exige `outputFileTracingIncludes`, una config más que se desincroniza en silencio. Un módulo TypeScript viaja con el bundle siempre — en local, en Vercel y en el script del seed. El certificado es público, así que no hay nada que proteger, y vence en 2031.

**Regla que no se negocia:** `rejectUnauthorized: false` no llega a producción. Por esa conexión viajan precios de compra.

**Un aviso que probablemente no aplique.** Se había anticipado `prepared statement s0 already exists` por pgbouncer en transaction mode. En `@prisma/adapter-pg@7.10.0`, `statementNameGenerator` es opcional y sin ella el adapter no cachea prepared statements, así que la config por defecto esquiva el problema. Queda anotado para reconocerlo si algún día aparece.

**Qué queda.** Pegar el CA, correr la consulta de prueba, y después el seed.

---

### 2026-08-25 · TLS verificado, RLS cerrado, cliente andando

**El certificado, verificado en vez de confiado.** Antes de inlinearlo se comparó el fingerprint SHA-256 del archivo bajado del dashboard contra el root que presenta el servidor en el handshake: coinciden, y la verificación TLS da `authorized: true`. Eso rompe la circularidad de haberlo sacado de la propia conexión. Vive en `src/lib/supabase-ca.ts` con procedencia, CN, vencimiento (2031-04-26), fingerprint y **el método para reemplazarlo**, no solo la instrucción. El `.crt` no se copió al repo: un concepto, un lugar.

**La prueba del cliente.** Siete consultas, todas pasando. La misma repetida tres veces a propósito: no apareció `prepared statement s0 already exists`, lo que confirma empíricamente que `@prisma/adapter-pg@7.10.0` no cachea prepared statements sin `statementNameGenerator`. La consulta cruda confirmó que conecta como `postgres`, que era lo que hacía falta para que el bypass de RLS funcione.

**RLS en las 14 tablas, sin políticas.** El dashboard reportaba 14 issues CRITICAL de «RLS Disabled in Public»: Supabase expone por API REST todo lo que está en el esquema `public`, y la llave que la abre —la `anon key`— es pública por diseño. Sin RLS, cualquiera con esa llave y la URL del proyecto podía leer y escribir todo, precios de compra incluidos. Activar RLS sin políticas deniega todo por esa vía y no toca a Prisma, que se conecta con el rol dueño. Verificado: `relrowsecurity = true` en las 14, cero políticas, `relforcerowsecurity = false` (eso es lo que preserva el bypass del dueño), y el smoke test repetido después de aplicarlo.

**Una trampa de Prisma que vale recordar.** `_prisma_migrations` no se puede tocar con un `ALTER` pelado dentro de una migración: Prisma valida cada migración replayándola contra una *shadow database* donde esa tabla no existe como tabla de usuario, y falla con `P3006 / 42P01`. Se resolvió guardando ese único `ALTER` detrás de un `IF EXISTS` — el shadow lo saltea, la base real lo aplica. El porqué quedó escrito en el SQL para que nadie lo «limpie» después. La base real nunca se tocó: la validación falla antes.

**Dos cosas del deploy que todavía no están cerradas.**
- **Nadie migra en el deploy.** `postinstall` corre `prisma generate` pero no `migrate`. Si se pushea un cambio de esquema, Vercel construye un cliente para tablas que no existen y la app rompe en producción con un error opaco. Se cierra agregando `prisma migrate deploy` al script de `build`; necesita `POSTGRES_URL_NON_POOLING`, que ya está inyectada.
- **Los tres entornos comparten base.** Production, Preview y Development apuntan a la misma, así que cualquier build va a migrar la única que hay. `migrate deploy` es idempotente, así que hoy no rompe — pero es la primera vez que esa decisión roza. **A revisar cuando haya datos reales.**

**Nota sobre `tsx`.** El smoke test corrió sin instalarlo, aprovechando el type stripping nativo de Node 25. Para el seed conviene instalarlo igual: `prisma.config.ts` lo declara, y no todas las máquinas ni el runtime de Vercel corren Node 25.
