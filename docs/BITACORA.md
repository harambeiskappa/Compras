# Vitácora — App de Compras

Registro del desarrollo: qué se decidió, por qué, qué se midió y qué quedó abierto.
Formato de cada entrada: **fecha · qué pasó · por qué · qué queda**.
El código lo escribe Claude Code en VS Code; acá va el análisis y el registro.

> **Si volvés después de un corte, leé solo esta primera sección.** Dice dónde estamos y cuál es el próximo comando. Las entradas de abajo son el historial y el porqué de cada decisión; no hacen falta para retomar.

---

## Dónde retomamos — actualizado 2026-08-28

**Próximo paso concreto:** **auth**. Tabla `Usuario`, login, sesión y permisos por rol. Es lo último que traba las pantallas del módulo 2: el esquema ya está, el diseño está esperando saber quién entra y qué ve.

| | |
|---|---|
| **Fase** | 1 — Módulos 1 (Información de la compra) y 2 (Compra) |
| **Situación** | **Módulo 1 cerrado y andando en producción.** Módulo 2: esquema completo, pantallas sin empezar. |
| **Stack** | Next.js 16 + TypeScript + Tailwind + Prisma 7.10.0 + Postgres de Supabase, deploy en Vercel |
| **Repo** | `github.com/harambeiskappa/Compras` → `inaki-pegsa/compras` → https://compras-ten-mu.vercel.app |
| **Base** | Supabase `compras-db`, São Paulo, plan free. Diez migraciones aplicadas, la última `20260828201311_establecimiento`. |
| **Base de referencia** | `C:\Users\zemma\Claude\Projects\WinCompras\backend\db.sqlite3` (solo lectura) |

### Ya está hecho

- **Módulo 1 completo de punta a punta:** esquema, migraciones, seed, padrón único, validación de servidor, las tres pantallas y producción verificada. 19 chequeos en verde.
- **Infraestructura:** repo, GitHub, Vercel y Supabase enganchados; Prisma 7.10.0 pinneado exacto; TLS con el CA de Supabase verificado por fingerprint; `prisma migrate deploy` en el build; RLS en todas las tablas.
- **Seeds:** 8 categorías canónicas y 217 sinónimos (199 mapeados, 18 pendientes); 191 entidades con 210 roles y 11 prefijos; 12 plazas como sugerencias iniciales; **8 establecimientos**.
- **La prueba contra el histórico**, con criterio estructural y catálogo de motivos, que no se rompe cuando el pipeline de WinCompras trae datos nuevos.
- **El esquema del módulo 2, cerrado:** `ReporteCompra` con clave de idempotencia, `Adjunto` con dos padres posibles y CHECK de exactamente uno, `Lote.origenCategoria` y `Lote.establecimientoId`.

### Falta, en orden

1. **Auth:** tabla `Usuario`, login, sesión larga, permisos por rol verificados en el servidor.
2. **La máquina del offline:** endpoint de catálogos, borradores locales con fotos, cola de envío con clave de idempotencia, service worker. Prueba: modo avión → cargar → cerrar el navegador → reabrir → **envía una sola vez**.
3. **Diseño con Claude Design** de las dos pantallas del módulo 2: la del comprador en la feria y la bandeja de la oficina. Destrabado por la decisión de auth.
4. Las pantallas del módulo 2.
5. **Arreglar el `ON DELETE` de `adjunto`** y los archivos huérfanos de Storage (borrar la fila no borra la foto).

### Decisiones abiertas

Ninguna traba el módulo 2. Las de auth se cerraron el 28/08.

| # | Decisión | Estado | Bloquea |
|---|---|---|---|
| 1 | ¿Hay señal en la feria? | **Resuelta:** normalmente sí, pero la app tiene que aguantar sin nada | — |
| 2 | Link de carga: ¿token o login? | **Resuelta:** cuenta con usuario y contraseña; el link es un atajo, no la credencial | — |
| 4 | Roles | **Resuelta:** ADMINISTRATIVO y COMERCIAL | — |
| 9 | ¿Padrón único de entidades? | **Resuelta:** una sola tabla `entidad`, el rol lo da el campo | — |
| 10 | TRB: ¿propio o tercero? | **Resuelta:** tercero, `esPropio = false` | — |
| 13 | Empresa titular vs. compradora | **Resuelta:** son dos conceptos distintos | — |
| 7 | ¿Carga ↔ tropa es N:N? | Cerrada como N:1 con evidencia; si aparece el caso, el arreglo es aditivo | — |
| 3 | Qué campos son obligatorios | Resuelta para el módulo 1 (tres); abierta para el reporte del comprador | la UI del módulo 2 |
| 11 | ¿El formulario acepta lotes mixtos? | Sin resolver; el esquema los soporta igual | la UI |
| 8 | ¿El lote se pesa junto en la balanza? | Sin resolver; hay evidencia fuerte de que no | el módulo 4 |
| 5 | Cómo vuelve el imprimible | Sin resolver; `Adjunto.tipo` soporta las dos respuestas | alcance |
| 6 | Compras de terceros | Sin resolver; `Adjunto.tipo` la soporta | alcance |
| 12 | ¿El DTE se trae de WinCampo o se tipea? | Sin resolver; `Carga.dte` funciona en los dos casos | alcance |

### Cosas que ya nos mordieron una vez

- El tag `latest` de `prisma` en npm apunta a un release candidate: **cualquier `npm install prisma` sin versión trae el RC.**
- Los resúmenes se equivocaron varias veces (la carpeta donde estaba parado Claude Code, las flags del scaffolding, la lectura del registry). **Cuando dos lecturas no cierran, pedir los bytes crudos, no el resumen.**
- El repo está una carpeta más adentro de lo que parece: `Projects\Compras\Compras`.
- **Una migración de varios pasos que falla a mitad no tiene vuelta atrás automática:** Prisma no envuelve el archivo en una transacción. Se escriben re-ejecutables.
- **Toda tabla nueva nace sin RLS.** Nada lo avisa salvo el dashboard de Supabase, y solo si alguien lo mira.
- **Un aviso no puede detectar lo que la consulta ya descartó.** La comparación laxa no servía de nada porque el filtro estricto corría primero.
- **Una prueba que no puede fallar es un adorno.** Pasó con la condición 2 de la prueba histórica, inalcanzable por construcción.

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

---

### 2026-08-25 · Seed de categorías, y el deploy sin probar

**Health check honesto.** `/api/salud` devuelve `{ok:true}` o un 503 `{ok:false}`, sin conteos — publicaba volumen de negocio a cualquiera que encontrara la URL. Se probaron **las dos ramas**, porque el valor de un health check está en la que falla. Lleva `force-dynamic`: sin eso Next puede evaluarla en el build y devolver una respuesta cacheada, que para un health check es lo contrario de lo que se busca.

**Un número plausible sacado con la herramienta equivocada.** Contando con SQL daban **218** sinónimos únicos; con la semántica real del seed son **217**. La causa: `lower()` de SQLite solo pliega ASCII y `toLowerCase()` de JS pliega Unicode, así que `vaca preñada` y `VACA PREÑADA` colapsan en el seed y no colapsarían en SQL. Quedó escrito en el código para que nadie se asuste comparando contra un conteo de SQL. Es la lección del proyecto otra vez: medir con la herramienta que va a correr, no con una parecida.

**El resultado, leído de Postgres:** 8 canónicas; 258 filas leídas → 217 sinónimos, 41 colapsados por dedup, 199 mapeados y 18 pendientes. Reparto: VA 70, TM 32, NT 21, VQ 18, NV 17, T 16, TH 14, TO 11. MEJ entró como sinónimo apuntando a TO, y no existe canónica MEJ. Cero duplicados, cero normalizados mal formados, cero FK huérfanas. Idempotencia probada corriéndolo dos veces.

**Los 18 pendientes de mapeo:** `130`, `crías`, `hembra`, `hembras`, `invernada x kg`, `machos`, `nov/vaq`, `novillito/bulto`, `novillo/bulto`, `overito`, `overitos`, `preñadas`, `ternaro`, `terneras/caida`, `va/c ria`, `vac/ cría`, `vac/cria`, `vaca/toro`.

**Regla que salió de acá: el seed llena una canónica vacía, nunca cambia una que ya tiene valor.** Si el upsert pisara el mapeo, cada corrida borraría lo que una persona resolvió a mano, y «idempotente» y «lo resuelve una persona» se contradirían. La versión amplia protege también el caso de que alguien corrija uno de los 199: **el sistema nuevo es la fuente de verdad de acá en adelante, no WinCompras.**

**Anotado para la pantalla de mapeo:** `va/c ria`, `vac/ cría` y `vac/cria` quedaron como tres filas distintas, y casi seguro son el mismo concepto. Unirlas es decisión de dominio, no de normalización. La pantalla tiene que dejar resolver varias juntas: resolver el mismo concepto tres veces se lee como un error del sistema.

**Dependencias.** `tsx` entró (lo declara `prisma.config.ts`) y `@types/node` pasó de `^20` a `25.9.3`, porque el runtime local es Node 25 y `node:sqlite` no tiene tipos en 20. Para leer SQLite se usó `node:sqlite`, sin dependencias nuevas: el seed solo puede correr donde esté el archivo de WinCompras, nunca en Vercel.

**El riesgo que eso deja abierto.** Los tipos de Node 25 en local contra el Node con que Vercel buildea es la misma clase de divergencia que venimos peleando toda la sesión: código que type-checkea acá y falla allá. Hay que mirar qué versión usa Vercel y fijarla con `engines.node`.

**Y lo más grande que sigue sin probarse: nada se deployó desde el scaffold pelado.** `migrate deploy` en el build, el `postinstall`, el CA inline y el adapter contra el pooler solo corrieron en esta máquina. Es el próximo paso.

---

### 2026-08-25 · La regla del seed, cerrada; y el desfasaje de Node, confirmado

**La regla ampliada, probada en las dos direcciones.** El seed rellena una canónica vacía y **nunca** cambia una que ya tiene valor. Se verificó corrompiendo `mej` a propósito: con la base diciendo VA y WinCompras diciendo TO, **gana la base** y la divergencia se reporta en pantalla en vez de aplicarse en silencio; con la canónica en NULL, la rellena. El sistema nuevo es la fuente de verdad de acá en adelante.

**Node: confirmado contra la documentación de Vercel.** Las únicas versiones disponibles son **24.x (default), 22.x y 20.x**. Node 25 no existe como opción, así que la divergencia no era un riesgo sino un hecho: local corre 25 y Vercel iba a buildear con 24. Se fija `engines.node: "24.x"` y `@types/node` baja a `^24`.

Dos cosas que salieron de leer la doc:
- **`engines.node` pisa lo que diga el dashboard**, así que la versión queda determinística *y versionada en el repo*, sin depender de una config que alguien puede cambiar sin dejar rastro.
- Los tipos tienen que coincidir con **el destino del deploy**, no con la máquina de desarrollo. Type-chequear contra APIs de Node 25 que no existen en 24 mueve el error a producción.

El seed usa `node:sqlite`, que existe desde 22.5, así que sobrevive el bajón a 24 — y de todos modos nunca corre en Vercel.

**Sigue sin verse el deploy.** El push se hizo (`fce1fbb..72bd402`), pero Claude Code no tiene manera de observar el build: el CLI de Vercel exige login interactivo, `gh` no está instalado y la API pública de GitHub devuelve 403 por rate limit. Lo que sí hizo fue correr **el comando exacto que corre Vercel** en local: `prisma migrate deploy && next build` pasa, encuentra `POSTGRES_URL_NON_POOLING` en el 5432, dice «No pending migrations to apply», y `/api/salud` compila como `ƒ` (dinámica), o sea que el `force-dynamic` quedó bien. Si falla en Vercel, no va a ser por el comando.

---

### 2026-08-25 · Producción responde: el círculo cerrado

**`https://compras-ten-mu.vercel.app/api/salud` devuelve `{"ok":true}`.**

En una sola respuesta queda probado junto lo que veníamos validando por partes y siempre en la máquina de Iñaki: la app deployada llega a Supabase por el pooler, el CA inline valida la cadena de certificados, RLS está activo y no la bloquea porque conecta con el rol dueño, y `migrate deploy` corrió en el build dejando la base al día.

**Node fijado.** `engines.node: "24.x"` y `@types/node@^24`. Vercel solo ofrece 24.x (default), 22.x y 20.x — Node 25 no existe como opción, así que la divergencia era un hecho, no un riesgo. `tsc --noEmit` y `npm run build` pasan limpios tras el bajón; `node:sqlite` existe desde 22.5, así que el seed sobrevive. `engines.node` pisa lo que diga el dashboard, de modo que la versión queda determinística **y versionada en el repo**.

`npm install` en local ahora avisa `EBADENGINE` porque la máquina corre Node 25. Es la señal funcionando, no un problema. Vale alinear local a 24 con `fnm` o `nvm-windows` — no por la advertencia, sino porque elimina la última divergencia entre local y producción.

**Un descubrimiento lateral, para el módulo 2.** Los alias de preview de Vercel están detrás de Deployment Protection y redirigen a `vercel.com/login`. Producción no. Cuando llegue el link para cargar desde el celular hay que verificar que la protección siga apagada en el entorno que use el comprador: si estuviera activa, el link muere en un login de Vercel que esa persona no tiene ni va a tener. Se suma a la decisión abierta #2, como una capa por encima del token propio.

---

### 2026-08-25 · La prueba contra el histórico: el esquema aguanta

**Cero casos (b).** Ninguna de las 120 compras del último año quedó afuera porque el modelo no pudiera representar el dato. Eso era lo que se venía a buscar y es el resultado que habilita empezar las pantallas.

| | |
|---|---:|
| evaluadas | 120 |
| entraron | 62 |
| (a) falta un dato que el formulario nuevo va a exigir | 58 |
| **(b) el modelo no lo puede representar** | **0** |
| (c) el origen es contradictorio | 13 |

**Cómo se corrió, que importa.** Cada compra en su propio SAVEPOINT dentro de una transacción que se revierte al final —en Postgres una violación aborta la transacción entera, y sin savepoints la prueba se habría frenado en el primer fracaso— e inserciones con SQL parametrizado en vez del cliente tipado, porque Prisma rechaza en memoria antes de tocar la base y se estaría midiendo la validación de Prisma en lugar de las constraints reales. Reversión verificada: las 9 tablas tocadas volvieron a 0 y los 217 sinónimos quedaron intactos.

**Las (a): 58.** 53 sin empresa titular (previsto) y 14 sin consignatario (no previsto), superpuestas en 9. No son defectos del modelo: son exactamente los agujeros que la app existe para tapar.

**Las (c): 13, y dos hallazgos nuevos.** Cuatro compras donde el texto y la tabla de conciliación difieren en cuántas tropas hay — 6298, 6311, 6313 y la ya conocida 6315; las tres primeras no estaban identificadas. Y nueve donde la empresa titular no figura **en absoluto** entre las empresas de sus tropas (5583, 5584, 6266, 6288, 6297, 6301, 6304, 6316, 6319).

**Esas nueve invalidaron una regla que habíamos escrito.** No son datos mal cargados: **la empresa puede cambiar entre la compra y la liquidación** — se define comprar para BUL y se termina liquidando a PEGSA, cosa que pasa porque esas dos están muy vinculadas. Así que la validación «la titular tiene que estar entre las empresas de las tropas» bloquearía un caso legítimo. **Baja de bloqueo a aviso:** la app lo señala, una persona decide si fue un cambio legítimo o un error de carga. Es la misma forma que ya se usa para los kilos faltantes.

**El consignatario siempre existe, también en la compra directa.** No es sinónimo de feria. Así que `NOT NULL` está bien y las 14 son categoría (a). Lo que sí cambia es el rótulo en la pantalla: si dice «Feria», quien compra directo lo va a leer como que no le corresponde y lo va a dejar vacío.

**Lo que la prueba NO ejercitó, para que el cero no se lea como más de lo que es.** La FK compuesta de `lote` contra `tropa(id, compraId)` nunca se probó con un `tropaId` no nulo, porque en el sistema viejo el lote no tiene vínculo con la tropa: los 209 lotes entraron con NULL, que es justo el caso que la restricción no evalúa. La de `carga` sí se ejercitó, en 70 cargas. `Adjunto`, `PersonaCompradora` y `plazaLugar` no existen en el origen y quedaron sin probar.

**Sobre 120 y no 118.** La medición previa había dado 118 con el corte `fecha_compra >= '2025-08-24'`, que **excluye las 2 compras con `fecha_compra` en NULL**. 118 + 2 = 120. Como `Compra.fecha` es `NOT NULL`, esas dos son categoría (a) también.

---

### 2026-08-25 · Las empresas, y la decisión #10 cerrada

**Once prefijos, ocho empresas.**

| empresa | prefijos | propia |
|---|---|---|
| Pecuaria El Garabí | PEG, PEC | sí |
| Las Taperas del Oeste | TAP, LTA, LTP | sí |
| Bulltrade | BUL | sí |
| Darwash | DAR | sí |
| Martín y Alonso | ALO | sí |
| Unión Ganadera | UGM | sí |
| El Saguaipe | SAG | sí |
| Tercio Bravo | TRB | **no** |

Esto **valida la decisión de tener `PrefijoTropa` como tabla aparte** en vez de una columna suelta en `Empresa`: dos de las ocho tienen más de un prefijo, y no era un caso hipotético.

**Decisión #10, resuelta con más precisión de la esperada.** TRB no es solo «tercero»: su rol real no es el de empresa compradora sino el de **hotelero**. No analizamos sus compras, pero su hacienda puede entrar al feedlot o a campos adyacentes y hay que contabilizar su stock. Consecuencia concreta de UI: **una empresa con `esPropio = false` no aparece en el selector de empresa titular, pero sí en el de hotelero.**

**Una observación al pasar, para la decisión #9.** Darwash es a la vez una de nuestras empresas (prefijo DAR) y el consignatario más frecuente del último año (60 de 118 compras). Es otro caso del mismo actor en varios roles, que suma al argumento de un padrón único de entidades. No bloquea nada hoy.

**La fase se parte en dos.** El módulo 1 lo usa la oficina, con conexión, y no necesita resolver ninguna decisión abierta: se puede construir ya. El módulo 2 lo usa el comprador en la feria y depende de #1 (offline), #2 (token o login) y #4 (roles). Construir el 1 mientras se averigua lo del 2.

---

### 2026-08-25 · Cómo se decide el frontend

**Acuerdo de trabajo.** El frontend lo trabaja Iñaki con **Claude Design**, no esta sesión. La división:

- **Dominio (esta sesión):** el esquema, el seed, las validaciones del servidor, qué campos existen, cuáles son obligatorios, qué significa «s/d», y las reglas que el diseño no puede violar.
- **Diseño (Claude Design):** cómo se ve, cómo se ordena, qué muestra cada pantalla, el flujo del formulario, los estados vacíos.

**La zona gris —rutas y navegación— va por doble validación:** esta sesión propone, Claude Design evalúa, y vuelve acá para chequear contra las restricciones de dominio.

**Regla de desempate, para que no sea un ping-pong infinito: si la propuesta de diseño no viola una restricción de dominio, gana el diseño.** Esta sesión no es árbitro del gusto; chequea que la app no vuelva a ser el Excel. Por defecto es una vuelta sola; una segunda solo si apareció un conflicto concreto.

**Lo que tiene que volver de Claude Design:** la propuesta **y aparte la lista de qué puntos de la sección negociable cambió y por qué**. Sin esa lista no hay contra qué chequear.

**El artefacto: `docs/diseno-modulo-1.md`**, versionado como todo lo demás. Tres secciones leídas distinto — restricciones de dominio (no negociables, cada una con su porqué, porque una restricción que no se entiende se saltea), propuesta de rutas y pantallas (negociable), y preguntas abiertas que son del diseño.

**Solo el módulo 1.** Decisión explícita de Iñaki: no repetir el error de arrancar varios módulos a la vez, y menos el frontend. El módulo 2 se diseña después de saber si hay señal en la feria — un formulario que tiene que sobrevivir sin conexión no se diseña igual que uno común.

**La pregunta de diseño que más importa**, de las nueve abiertas: **cómo se ve «s/d» de modo que ponerlo sea más fácil que inventar un dato.** Si cuesta más, la gente inventa, y toda la disciplina del esquema no sirve de nada.

---

### 2026-08-27 · La comisión va en el renglón, y un principio que salió de ahí

**Lo que disparó todo.** Al revisar el prototipo, Iñaki señaló que la comisión estaba a nivel compra cuando en sus Excel siempre se aplica **por línea**, porque puede variar mucho.

**Lo medido (último año).** La comisión *en monto* varía entre renglones en el 99 % de las compras con más de uno — pero eso es aritmética: distinto importe por renglón, mismo porcentaje, distinto monto. Mirando el **porcentaje**: idéntico en 68 de 73 compras, por redondeo en 1, y **distinto de verdad en 4**.

Esas cuatro confirman la regla que Iñaki describió de memoria — *faena 2 %, invernada 3 %* — y el porcentaje **sigue al destino del lote**:

| compra | El Haras (feedlot) | otros campos |
|---|---|---|
| 6314 | 2 % | El Coloradito y El Descanso: 3 % |
| 6321 | 2 % | VER: 3 % |
| 6313 | 2 % | El Coloradito: 2,05 % |

**Pero no se deriva.** El destino está cargado en 35 de 347 renglones, y El Haras aparece con 2 %, 3 % y 4,5 %. La regla es «suele ser», no «es». Y como dijo Iñaki: *la comisión no la define, se la pasan*. Es un dato que se captura, no que se calcula. Lo que sí está bien respaldado es precargar el renglón nuevo con la comisión del anterior: en el 93 % de las compras se tipea una sola vez.

**Un error propio, encontrado de paso.** `Compra.comision` reproducía un defecto del esquema viejo: en `liquidaciones_liquidacion`, `comision` es **la suma de las de sus renglones** — la compra 5325 guarda 5.168.904, que es exactamente 2.275.896 + 1.443.256 + 1.286.600 + 163.152. Un total guardado, justo lo que prohíbe la regla 2, y una de las cinco columnas derivadas que le criticamos a ese esquema hace dos días. La copiamos igual, estaba en el plan original y no se vio en la revisión.

**Cambio:** `Compra.comision` y `Compra.comisionModalidad` salen; `Lote.comision` y `Lote.comisionModalidad` entran. El total de una compra se calcula sumando sus lotes.

**Consecuencia para el módulo 1:** la comisión sale de esa pantalla — los lotes son del módulo 2. Los datos opcionales pasan de 9 a 8.

---

**El principio que salió de acá, ahora regla 4 de `CLAUDE.md`.** Iñaki planteó lo mismo para el destino: una regla general arriba («todo al feedlot») con excepción por línea. Medido: **el destino de cabecera está cargado en 0 de 1047 liquidaciones** — en el sistema viejo el destino solo vive en el renglón. Y donde está completo, la excepción es lo normal: 5 de 7 compras tienen destinos distintos entre renglones (muestra chica, no apoyarse en el porcentaje).

De ahí: **la regla general es una comodidad de carga, no un dato guardado.** Rellena las líneas de una sola vez; lo guardado es siempre el valor de cada línea. Guardar además un valor de cabecera pondría el mismo concepto en dos lugares y divergiría apenas alguien cambie una línea y no la cabecera. Vale para comisión, para destino, y para lo que venga.

**Pendiente para el módulo 2, no ahora:** el lote necesita su propio destino, con catálogo. Hoy el esquema solo tiene `Carga.destino` como texto libre, así que hay que decidir si el destino vive en la carga, en el lote o en los dos. No se mezcla con la migración de la comisión: una migración, un tema.

**Dirección visual, para más adelante:** acercarse a algo estilo feedlot, manteniéndolo simple hasta que el back y los módulos estén funcionando. Decisión de Iñaki, y el orden es el correcto — una identidad visual sobre pantallas que todavía cambian de forma se rehace dos veces.

---

### 2026-08-27 · Comisión migrada, y el diseño del módulo 1 aprobado

**La migración.** `Compra.comision` y `Compra.comisionModalidad` salieron; `Lote.comision` (`numeric(14,2)`) y `Lote.comisionModalidad` entraron, ambas nullable. La prueba contra el histórico da idéntico a antes: 120 / 62 / 58, con **(b) en cero**.

**Claude Code afinó el análisis.** El total guardado no era un caso aislado: **en 99 de 119 compras del año, la comisión de cabecera es exactamente la suma de sus renglones.** Y separó las 7 compras con porcentajes distintos en tres categorías donde yo había visto dos:

| tipo | compras |
|---|---|
| diferencia real | 5946 (3/4 %), 6314 y 6321 (2/3 %) |
| un renglón con comisión **cero** | 5721, 6299 |
| ruido de redondeo | 5607 (2,09/2,10), 6313 (2,00/2,05) |

**Los ceros importan y son un caso conocido con nombre nuevo.** En `detalleliquidacion` la comisión es `NOT NULL`, así que un 0 puede significar «no se cobró en esta línea» o «no se sabe». Es el error central del proyecto, en el mismo campo que acabamos de mover. En el esquema nuevo la columna es nullable, así que la distinción se puede capturar — **pero el formulario del módulo 2 tiene que permitir «s/d» y no empujar a poner 0.**

**Una advertencia de método para la próxima migración destructiva.** Acá se verificó que `compra` estuviera en 0 filas antes de tirar las columnas, y estuvo bien. Pero `migrate deploy` corre en cada build de Vercel contra la única base que hay: cuando haya compras cargadas de verdad, una migración destructiva no se resuelve chequeando que la tabla esté vacía. Necesita plan — mover el dato antes de tirar la columna.

**El script de la prueba tiene una dependencia de estado.** Falló al correr después del seed de empresas porque creaba sus propios placeholders y chocaba contra el unique de `prefijo_tropa.codigo`. Ahora reusa los catálogos reales, lo que además la hace más fiel: corre contra los mismos datos que va a usar la app. Queda anotado en su encabezado que hay que correrla **después de cada cambio en el seed**, no solo tras cambios de esquema.

---

**El diseño del módulo 1 pasó la revisión.** Los tres puntos se verificaron leyendo el código, no el resumen: el botón «s/d» quedó envuelto en `<sc-if value="{{ r.opcional }}">` —usando la marca que ya estaba calculada—, no queda ningún rótulo de comisión en pantalla, y la lista sin fecha pasó a ser degradación explícita («NO SE PUEDEN CARGAR ASÍ»).

**Un error mío, corregido por el diseño.** Dije «los opcionales pasan de 9 a 8». Son **5**: vendedor, hotelero, persona compradora, plaza y observaciones. Conté de memoria en vez de contar.

**Los diez cambios a la sección negociable se revisaron uno por uno y ninguno viola una restricción de dominio**, así que por la regla de desempate quedan todos. Dos mejoran la propuesta original: sumar vendedor y plaza a la lista (con 60 de 120 compras del mismo consignatario, tres columnas no distinguen dos filas del mismo día) y ordenar los consignatarios por frecuencia en vez de alfabético.

**Las cuatro variantes, elegidas por Iñaki:** lista en **tabla**, alta en **una sola hoja**, roles en **fichas**, «s/d» con **botón al lado**.

**Sobre el Project Archive:** hace falta cuando el diseño cambió, y siempre antes de implementar. La verificación de las restricciones se hace leyendo el markup — el problema del botón «s/d» no aparecía en ningún resumen.

---

### 2026-08-27 · Normalización de catálogos, y por qué la ñ no se pliega

**Qué hay.** `nombreNormalizado` con `unique` y `NOT NULL` en los cuatro catálogos que se crean al vuelo: consignatario, vendedor, hotelero y persona compradora. Migración en tres pasos escrita a mano —agregar nullable, rellenar, exigir `NOT NULL`, y recién después el unique— porque `ADD COLUMN ... NOT NULL` sobre las 18 filas existentes no tiene solución sin default. Se aplicó el mismo patrón a las cuatro aunque tres estuvieran vacías, para que funcione igual donde sea que corra.

**El hallazgo que cambió la implementación.** De los 209 nombres del histórico, los únicos dos con diacríticos son `DOÑA ARVELIA SA` y `LEPORATI Y COMPAÑIA SA`, y en ambos el diacrítico es la **ñ**. No hay una sola vocal acentuada en todo el universo de datos.

O sea que la parte útil de la normalización de acentos es **preventiva** —para cuando alguien tipee «Dárwash» en el buscador— mientras que la parte peligrosa ya estaba en los datos: un `NFD` ingenuo habría convertido `DOÑA` en `dona` y unido **Peña con Pena** desde el primer día. **La ñ no se pliega**, y quedó escrito en los tres lugares donde alguien podría «arreglarlo».

**Y se usó un mapa explícito de vocales en vez de `NFD`**, para que el `translate` de la migración sea idéntico carácter por carácter al JS. Con `NFD`, JS plegaría cosas que Postgres no, y volveríamos a tener dos normalizaciones que no coinciden — exactamente el problema de `lower()` de SQLite contra `toLowerCase()` de JS, esta vez evitado antes de que ocurriera.

**La protección, probada corrompiendo:** `"DARWASH"`, `"  Darwash  "` y `"Dárwash"` los rechaza el unique; `"Darwash Sur"` entra, como debe.

**Lo que NO resuelve, dicho de frente.** `FERIA RODEO HUINCA S.R.L` y el mismo con punto final siguen siendo dos filas. Recortar puntuación es el mismo territorio que recortar sufijos societarios (S.R.L., S.A., Hnos): obliga a adivinar si dos textos son la misma entidad, y eso lo decide una persona. **Se resuelve en la pantalla, no en el esquema.**

Y en el prototipo hay un hueco concreto: «＋ Crear «X» y elegirlo» aparece cuando no hay coincidencia **exacta**, aunque haya casi-gemelos listados arriba. Alguien tipea el nombre con un punto de más, ve el botón, y crea el duplicado. Pedido a Claude Design: que elegir un existente le gane visualmente a crear uno nuevo mientras haya candidatos, sin esconder «crear» — un vendedor nuevo de verdad aparece seguido.

**Las dos notas quedaron escritas** donde se van a leer: en el encabezado de `scripts/prueba-historico.ts`, que depende del estado de los catálogos y hay que correrla tras cada cambio del seed (con el caso que ya pasó como evidencia); y en `CLAUDE.md`, que una migración destructiva con datos reales necesita mover el dato antes de tirar la columna, en migraciones separadas, porque `migrate deploy` corre en cada build contra la única base que hay.

---

### 2026-08-27 · Padrón único: decisión #9 cerrada

**Qué hay.** Una sola tabla `entidad` con 206 filas (de 212 nombres), más `entidad_rol` con 212 roles y los 11 prefijos colgando de ahí. Las cinco tablas de catálogo —`empresa`, `consignatario`, `vendedor`, `hotelero`, `persona_compradora`— desaparecieron.

| rol | entidades | | esPropio |
|---|---:|---|---:|
| VENDEDOR | 175 | true | 7 |
| CONSIGNATARIO | 18 | false | 1 (Tercio Bravo) |
| HOTELERO | 11 | null | 198 |
| EMPRESA_COMPRADORA | 8 | | |

**Los cuatro roles no se mezclaron.** Los cinco campos de `Compra` y el de `Tropa` siguen siendo columnas distintas, ahora las seis apuntando a `entidad`. **El rol lo da el campo, no la tabla** — es lo que permite que Darwash sea consignatario, vendedor y empresa propia sin ser tres filas que divergen. Verificado contra `information_schema`.

**Seis entidades colapsaron**, y el seed las lista en pantalla en cada corrida, no solo la primera: Darwash (consignatario + empresa), DARWASH SA y PEGSA (vendedor + hotelero), y Colombo y Magliano, Martin y Alonso SRL y Saenz Valiente Bullrich (consignatario + vendedor), estas tres escritas en mayúsculas en un campo y capitalizadas en el otro.

**Por qué se hizo ahora.** Había catálogos sembrados pero **cero compras cargadas**: ninguna fila real apuntaba a esas tablas. Fue una reconstrucción limpia, no una migración de datos con deduplicación manual. Era lo más barato que iba a ser nunca.

**Los alias, confirmados por Iñaki.** Las mismas empresas aparecían con nombres distintos según el rol; el padrón convirtió eso de un problema de esquema en una edición de datos, y estos siete pares se mapean en el seed: PEGSA → Pecuaria El Garabí · LAS TAPERAS → Las Taperas del Oeste · DARWASH SA → Darwash · BULLTRADE SRL → Bulltrade · EL SAGUAIPE SAS → El Saguaipe · UGMA → Unión Ganadera · TERCIO BRAVO SAS → Tercio Bravo.

**Un hallazgo que explica esa columna, para el módulo 2.** Entre los «hoteleros» del histórico están PECUARIA DESCANSO, PECUARIA EL COLORADITO y PECUARIA DON PEDRO, y los tres primeros nombres aparecen también en el catálogo de destinos. **EL DESCANSO y EL COLORADITO son campos de Pecuaria El Garabí**, no empresas. O sea que el sistema viejo mezclaba en la misma columna dos cosas distintas: **de quién es la hacienda** y **en qué campo está físicamente**. No se fusionan con PEGSA en el seed —no se sabe si son sociedades reales o etiquetas de campo, y fusionar sería adivinar— pero explica por qué esa columna tiene nombres que no son empresas. A resolver cuando el módulo 2 toque el destino. De Don Pedro no se sabe.

**Dos reglas que dejaron los tropiezos, ahora en `CLAUDE.md`:**

1. **Toda migración de varios pasos se escribe re-ejecutable.** La primera falló a mitad: el `DELETE FROM prefijo_tropa` estaba al final, pero la FK nueva se valida al crearse y las 11 filas viejas apuntaban a empresas ya borradas. Prisma no envuelve el archivo en una transacción, así que quedó a medias y sin rollback automático.
2. **Toda tabla nueva nace sin RLS**, y hay que activarlo en la migración que la crea. `entidad` y `entidad_rol` aparecieron con dos CRITICAL en el dashboard mientras las cinco tablas que reemplazaban sí lo tenían.

---

### 2026-08-28 · La prueba histórica dejó de comparar contra un número

**El problema.** La base de WinCompras es un **pipeline vivo**: entre dos corridas pasó de 1049 a 1051 filas y la ventana de 120 a 121 compras. El criterio de aprobación era numérico —«120 / 62 / 58»— así que cada ingesta la iba a hacer «fallar» sin que nada estuviera mal. En tres semanas nadie la mira más.

**El criterio nuevo, estructural.** Aprueba si y solo si **(b) es cero** —ninguna compra queda afuera porque el modelo no la pueda representar— **y todo fallo cae en un motivo ya catalogado**. Los conteos se reportan como información, junto con el tamaño y la fecha de modificación de la base de origen, para que un cambio de números se explique solo. El código de salida es el veredicto: si no, correrla desde un script diría que aprobó siempre.

**Lo mejor del cambio, y no lo pedí yo: la condición 2 no podía fallar nunca.** Al escribirla, Claude Code se dio cuenta de que todo fallo no reconocido caía en (b), así que «motivo sin catalogar» era inalcanzable por construcción. **Una prueba que no puede fallar no es una prueba, es un adorno que da confianza falsa.** La volvió real exigiendo que el motivo **explique el código de error que devolvió Postgres**: si una compra no trae empresa titular pero el rechazo no fue un `23502`, el diagnóstico es falso y queda sin catalogar. Y lo verificó **rompiéndola a propósito**, no afirmando que funcionaba.

**El catálogo de motivos, con su reparto actual:** `FALTA_EMPRESA_TITULAR` 53 · `FALTA_CONSIGNATARIO` 14 · `TITULAR_FUERA_DE_SUS_TROPAS` 9 · `TROPAS_TEXTO_VS_CONCILIACION` 4. Las 13 contradicciones dejaron de ser observaciones sueltas y son fallos (c) catalogados, así que una contradicción de un tipo nuevo hace fallar aunque los totales no se muevan.

**Y quedó escrito en el código lo que más va a valer con el tiempo:** agregar un motivo al catálogo es una decisión que dice «esto ya lo miramos», **no una forma de callar la prueba**. Sin esa frase, en seis meses el catálogo tiene veinte motivos y la prueba aprueba siempre.

**Una compra recién ingestada del pipeline real entró sin un rasguño en el modelo nuevo.** Es la mejor validación posible: datos que llegaron después de que el esquema se diseñó.

---

### 2026-08-28 · Los alias, y la convención que los explica

**Ocho pares más, confirmados por Iñaki**, además de los siete anteriores. Siete de los ocho tienen exactamente la misma forma:

| como CONSIGNATARIO | como VENDEDOR |
|---|---|
| Ferialvarez | FERIALVAREZ S.A |
| Bressan y Cia | BRESSAN Y CIA SRL |
| Ferias Mark Hnos | FERIAS MARK HNOS SRL |
| Orella | ORELLA SRL |
| Vicar Ganadera | VICAR GANADERA SA |
| Martín y Alonso | Martin y Alonso SRL |
| Pecuaria El Garabí | PECUARIA EL GARABI SA |

**La convención, que vale más que los ocho casos: la feria aparece con su nombre corto cuando consigna y con su razón social completa cuando es el origen.** No es ruido, es un patrón del sistema viejo, y va a seguir generando pares nuevos a medida que entren datos. El octavo es `FERIA RODEO HUINCA S.R.L` con y sin punto final.

Ninguno se fusiona por normalización automática —recortar sufijos societarios obliga a adivinar— sino por confirmación explícita en `ALIAS_ENTIDAD`. La detección los señala; una persona decide. Es la misma división que en la pantalla.

---

### 2026-08-28 · Módulo 1 terminado, y la decisión #1 resuelta

**Las pantallas del módulo 1 están, verificadas: 19 chequeos en verde, 0 en rojo.** Lista, alta y ver/editar, con el padrón, los tres estados del combo, «s/d» como NULL solo donde corresponde, y validación de servidor probada con un POST directo que saltea el formulario.

**El mejor resultado de la verificación es el que falló primero.** El chequeo 7 —el aviso de casi-idéntico por puntuación— no pasaba: el selector filtraba por `nombreNormalizado`, que es la forma **estricta** y conserva la puntuación, así que `FERIA RODEO HUINCA S.R.L.` con punto nunca llegaba a la comparación laxa. **El aviso no puede detectar lo que la consulta ya descartó.** Toda la discusión de las dos normalizaciones no servía de nada si la de arriba filtraba primero, y eso no se veía leyendo el código: se vio porque el chequeo estaba en la lista. Los parecidos ahora salen de una consulta propia.

**Tres decisiones de implementación.** Se sacó `import "server-only"` de `entidades.ts` porque rompe fuera del runtime de RSC y dejaba afuera al script de verificación —que existe justamente para probar que la validación es del servidor—; la protección sigue existiendo por otra vía y quedó documentada, aunque **quitar una guarda de compilación para que pase un test es en general la dirección equivocada del trade**. `revalidatePath` va envuelto en un helper que ignora un invariant de Next fuera de contexto y re-tira cualquier otro error. Y las plazas se siembran como sugerencias iniciales (12 del histórico) unidas a las ya usadas: un selector vacío el día uno no ayuda, y con texto libre se terminan teniendo `WASHINGTON`, `Washington` y `Wash.` como tres cosas distintas.

---

**Decisión #1, resuelta — y no como se esperaba.** La pregunta era si el comprador tiene señal en la feria. La respuesta de Iñaki: normalmente sí —Starlink en la computadora, datos móviles en el celular— **pero la app tiene que aguantar el peor escenario igual: llegar sin nada de señal y cargar la compra entera.**

O sea que el módulo 2 no es un formulario común. Cuatro consecuencias:

1. **Clave de idempotencia**, con `unique`. El borrador nace en el dispositivo con un identificador propio y el servidor lo usa para reconocer un reenvío. Es una columna nueva y hay que decidirla antes de escribir el módulo 2.
2. **Los catálogos viven cacheados en el dispositivo** — 191 entidades, 8 categorías, 217 sinónimos, 11 prefijos: unos pocos KB. Hace falta un endpoint que los entregue y una forma de saber cuándo refrescarlos.
3. **El borrador no puede guardar el id de una entidad creada al vuelo, tiene que guardar el nombre.** Estando offline esa entidad todavía no existe en el servidor, que la resuelve o la crea al recibir apoyándose en el `nombreNormalizado` estricto. Si dos compradores dan de alta el mismo vendedor cada uno por su lado, el `unique` los junta solo.
4. **Service worker**, porque la pantalla tiene que abrir sin red.

**Quedan dos decisiones abiertas para el módulo 2**, las dos de auth y probablemente resolubles juntas: el link de carga (#2, token o login) y los roles (#4). Las dos tienen la misma referencia disponible: `remates-app`, que ya las tiene funcionando.

---

### 2026-08-28 · Módulo 1 cerrado, andando en producción

**Los tres chequeos, contra `https://compras-ten-mu.vercel.app`:** la raíz redirige a `/compras` con el estado vacío; `/api/salud` devuelve `{"ok":true}`; y una compra creada contra la base real quedó con los cinco opcionales en **NULL**, no en cadena vacía. La lista la mostró con sus sellos «s/d» y el detalle sin ninguna mención de «oficina».

**La validación se probó en producción, no solo en local.** Se extrajo el id de la server action del bundle desplegado y se hizo el POST directo: sin empresa titular la rechaza, y con una entidad que no es nuestra también. Después se borró la compra de prueba y se restauró el padrón: 191 entidades, 210 roles, 11 prefijos, 0 huérfanos.

**El `server-only` se resolvió como correspondía.** En vez de dejar la app sin la guarda de compilación, la guarda volvió a `entidades.ts` y el script de verificación intercepta la resolución de ese módulo **solo para sí mismo**, con el porqué escrito en los dos lados. **El que se adapta es el test, no el código de producción.** Se re-corrió la verificación con la guarda puesta: 19 en verde.

**Las plazas** quedaron como 12 sugerencias iniciales unidas a las ya usadas en compras, deduplicando sin distinguir mayúsculas ni acentos, y ante empate **gana la forma que alguien escribió en una compra real** — así la lista se corrige sola con el uso en vez de quedar clavada al código.

**Una nota sobre los ids.** Los resets consumieron la secuencia y arrancan en 3. Se resetea a 1 antes de la primera compra real. Pero lo que importa más: **el id es un identificador, no un contador.** Un insert fallido consume un número, así que van a aparecer huecos. Si alguien lee `#47` como «llevamos 47 compras» está sacando un número inventado, y el diseño lo muestra grande.

---

**Con esto el módulo 1 está completo: esquema, seed, padrón, servidor, pantallas y producción.** Es lo primero del proyecto que funciona de punta a punta.

---

### 2026-08-28 · Los establecimientos son un catálogo propio, y no una entidad más

**La corrección es de vocabulario, y por eso importa.** La casa los llama **establecimientos**, no «destinos». LA CUCUCA, EL COLORADITO, EL DESCANSO, SAN ANTONIO y los demás son eso y nada más que eso: **no compran, no consignan y no venden**. Si el campo se llama como ellos lo llaman, nadie tiene que traducir mentalmente al cargar.

**Por qué no van al padrón de entidades.** La tentación era obvia —ya hay una tabla de entidades con roles— pero el test es simple: si los establecimientos fueran entidades, `Venta` tendría que ser una entidad, y no lo es. Se midió el solape con los hoteleros del padrón comparando exacto: **cero**. La confusión que veníamos arrastrando —«PECUARIA EL COLORADITO» apareciendo como hotelero— era un artefacto de nombres del sistema viejo, no un solape real. El sistema viejo mezclaba en una columna **de quién es la hacienda** y **en qué campo está**; acá quedan separados.

**Los ocho, sembrados:** El Haras · El Coloradito · El Descanso · La Cucuca · La Panchita · San Antonio · El Durazno · Pancho Primero. Del catálogo viejo **no** se migraron `Feedlot`, `Venta` ni `VER`: son otra cosa. «SIN ASIGNAR» era Pancho Primero, que el portal no tomó.

**Una nota para cuando se diseñe la pantalla:** El Haras concentra la mayor parte del stock, así que un orden alfabético lo entierra **igual que a Darwash en los consignatarios**. Ordenar por uso, no por nombre. Es la segunda vez que aparece la misma regla, y no va a ser la última.

**El establecimiento vive en el renglón, no en la cabecera** (regla 4): 5 de 11 compras con el destino cargado lo tienen mixto, y el establecimiento se correlaciona con la comisión —feedlot 2 %, campo 3 %—, que también es del renglón. «Todo al feedlot» es un gesto que rellena las líneas, no un dato guardado arriba.

**Con esto el esquema del módulo 2 quedó completo:** `ReporteCompra` con su clave de idempotencia, `Adjunto` con dos padres posibles y el CHECK de exactamente uno, `Lote.origenCategoria` y `Lote.establecimientoId`. Diez migraciones aplicadas.

---

### 2026-08-28 · Quién entra a la app: decisiones #2 y #4, cerradas

**Dos roles, y por ahora ni uno más.** **ADMINISTRATIVO**: acceso completo, edita compras, carga información. **COMERCIAL**: crea el inicio de la compra —el reporte desde la feria— y casi no edita. Si más adelante hacen falta más, se agregan; empezar con cinco roles hipotéticos habría sido inventar permisos para gente que no existe.

**Y la pregunta que eso abrió, que era la que trababa las pantallas: si el comercial tiene un rol, tiene una identidad. ¿Cómo entra?** Tres respuestas posibles: cuenta propia, el link como credencial, o link mágico sin contraseña.

**La respuesta: cuenta propia con usuario y contraseña, y el rol viaja con la cuenta.** El link que se le pasa al comercial es **un atajo a la pantalla, nunca la credencial**. La diferencia no es formal: si el link fuera la credencial, reenviarlo por WhatsApp regalaría el acceso, y sacárselo a una sola persona obligaría a cambiárselo a todas. Con cuenta, dar de baja a alguien es una fila.

**Tres consecuencias que no eran obvias.**

1. **No se usa Supabase Auth.** Sus usuarios viven en `auth.users`, fuera de `prisma/schema.prisma`, y eso rompe la regla de que el esquema esté entero en el repo con historial — la misma razón por la que está prohibido crear tablas desde el editor de Supabase. Además la app se conecta como dueño y saltea RLS, así que las políticas que Supabase Auth habilita no se usarían. `Usuario` es una tabla más, con su migración y su RLS.
2. **La sesión tiene que ser larga, y la obliga el offline.** Una sesión de una hora deja al comprador afuera justo en el peor escenario: abrió el formulario en el campo, sin señal, con los borradores adentro y sin forma de renovar nada. Solo el primer login necesita conexión.
3. **Los permisos se verifican adentro de cada server action, no escondiendo botones.** Una server action se puede invocar directo, y en este proyecto **ya se hizo exactamente eso contra producción** para probar las validaciones del módulo 1. Lo que se probó una vez como verificación es lo que hay que suponer que alguien puede hacer.

**Lo que esto destraba.** La atribución que el diseño del módulo 1 mostraba —«Cargada el 25/08/2026 · oficina»— quedaba sin dato y por eso se mostraban las fechas peladas: poner «oficina» fijo habría sido inventar. Con cuentas hay a quién atribuirle la carga, y se puede mostrar la persona en vez de una etiqueta genérica. Nullable igual: las compras cargadas antes de que existieran las cuentas no tienen autor, y eso es «s/d», no «oficina».

**Y una distinción que hay que sostener.** `ReporteCompra.personaCompradoraId` apunta al padrón y responde **quién fue físicamente a comprar** — puede ser alguien sin cuenta. La cuenta responde **quién cargó esto**. Son dos hechos distintos y se guardan por separado; la cuenta puede apuntar a su entidad para precargar el campo, pero precargar no es ser lo mismo.

**Con esto no queda ninguna decisión trabando el módulo 2.**

---

### 2026-08-28 · Los ocho establecimientos, verificados — y un número mío que no cerraba

**Verificación en verde.** Los ocho contra la base, con su normalizado; ninguno de los excluidos coló; 13 tablas, todas con RLS; `lote.establecimientoId` nullable y sin default; cero duplicados por normalizado; seed idempotente —segunda corrida crea 0—. La prueba histórica aprobada y las 16 comprobaciones del esquema del módulo 2 en verde, con `tsc` y `build` limpios.

**Dos correcciones sobre el catálogo viejo, encontradas al mapear los 12 destinos a los 8.** `El Haras (feedlot)` y `Haras` eran dos filas del mismo lugar, y `Haras` **nunca se usó en ningún renglón** — así que unificarlas no pierde nada, y eso está verificado, no supuesto. `SAN ANOTONIO` es un tipeo y quedó como `San Antonio`. La exclusión de `Feedlot`, `Venta` y `VER` quedó en un recuadro en el seed con el motivo de cada una: una es una clase de lugar, otra un destino comercial y la tercera una marca de «revisar esto». **Quien las vea faltar va a leer por qué antes de agregarlas** — que es la diferencia entre una decisión y un olvido.

**Un número mío que no cerraba, y la corrección es la regla 11 aplicada a mí.** Dije que El Haras concentra el **57,6 %** del stock. Medido sobre cabezas compradas con destino cargado en `detalleliquidacion`, da **45,9 % (735 de 1600)**. No es que uno esté mal: **son dos poblaciones distintas** — el 57,6 % sale del stock en el feedlot, que no es lo mismo que las cabezas compradas con destino registrado. El error fue mío y fue soltar un porcentaje sin su denominador, que es exactamente lo que la regla 11 prohíbe. **Cuando la pantalla muestre ese número, tiene que decir cuál de los dos está mostrando, con su cobertura al lado.** La conclusión no cambia por ninguno de los dos caminos: El Haras concentra la mayoría y un orden alfabético lo entierra.

**Un dato para cuando se arme el selector:** de los ocho, solo **cinco tienen uso registrado** —El Haras, El Coloradito, Pancho Primero, El Descanso, San Antonio—. La Cucuca, La Panchita y El Durazno existen en el catálogo pero nunca aparecieron en un renglón. Un orden por uso los va a dejar al final, que probablemente sea lo correcto, pero **conviene saberlo antes de que alguien piense que se perdieron**.
