# Vitácora — App de Compras

Registro del desarrollo: qué se decidió, por qué, qué se midió y qué quedó abierto.
Formato de cada entrada: **fecha · qué pasó · por qué · qué queda**.
El código lo escribe Claude Code en VS Code; acá va el análisis y el registro.

> **Si volvés después de un corte, leé solo esta primera sección.** Dice dónde estamos y cuál es el próximo comando. Las entradas de abajo son el historial y el porqué de cada decisión; no hacen falta para retomar.

---

## Dónde retomamos — actualizado 2026-09-10 (fase 1 completa)

**Próximo paso concreto:** Claude Code cierra las dos correcciones de kilos —`docs/prompt-kilos-total.md` y `docs/prompt-renombrar-kilos.md`—, y **recién después** sale el documento de diseño del módulo 3 para Claude Design.

**El orden lo eligió Iñaki y es el correcto:** las dos correcciones tocan la bandeja, que es la pantalla que Design va a tener al lado cuando diseñe la liquidación. Mandarle un documento nuevo mientras la pantalla anterior está a medio corregir es pedirle que diseñe contra algo que se mueve.

Las 8 decisiones de `docs/prompt-arranque-modulo-3.md` están **todas cerradas**, así que el documento de diseño no está bloqueado por nada más. **Iñaki eligió plantear el módulo 3 primero y testear de punta a punta después**, con el circuito completo a la vista. El argumento a favor: algunas decisiones del módulo 2 recién se validan cuando se sabe qué necesita el 3, y encontrar ahora que falta algo es barato porque `lote` está vacía.

**Con un límite: plantear no es construir.** Se mide, se escribe el documento, se cierran las decisiones, y recién ahí se decide qué se construye.

| | |
|---|---|
| **Fase** | 1 — Módulos 1 y 2. **Completa.** |
| **Situación** | Todo construido, verificado y en producción. Sin uso real todavía. |
| **Stack** | Next.js 16 + TypeScript + Tailwind + Prisma 7.10.0 + Postgres de Supabase, deploy en Vercel |
| **Repo** | `github.com/harambeiskappa/Compras` → https://compras-ten-mu.vercel.app |
| **Verificación** | `npm run verificar` — ocho verificaciones, **86 en verde, 0 en rojo** |
| **Base** | Supabase `compras-db`, São Paulo, plan free. Una sola cuenta: `admin`. |
| **Base de referencia** | `C:\Users\zemma\Claude\Projects\WinCompras\backend\db.sqlite3` (solo lectura) |

### Ya está hecho

- **Módulo 1 completo de punta a punta:** esquema, migraciones, seed, padrón único, validación de servidor, las tres pantallas y producción verificada. 19 chequeos en verde.
- **Infraestructura:** repo, GitHub, Vercel y Supabase enganchados; Prisma 7.10.0 pinneado exacto; TLS con el CA de Supabase verificado por fingerprint; `prisma migrate deploy` en el build; RLS en todas las tablas.
- **Seeds:** 8 categorías canónicas y 217 sinónimos (199 mapeados, 18 pendientes); 191 entidades con 210 roles y 11 prefijos; 12 plazas como sugerencias iniciales; **8 establecimientos**.
- **La prueba contra el histórico**, con criterio estructural y catálogo de motivos, que no se rompe cuando el pipeline de WinCompras trae datos nuevos.
- **El esquema del módulo 2, cerrado:** `ReporteCompra` con clave de idempotencia, `Adjunto` con dos padres posibles y CHECK de exactamente uno, `Lote.origenCategoria` y `Lote.establecimientoId`.
- **Auth y cuentas, cerradas y verificadas contra producción:** cuentas con rol, `scrypt`, cookie firmada de 30 días, proxy en Edge, comprobación de rol adentro de cada server action, `/usuarios` (alta, baja, reseteo) y `/mi-cuenta`. Auth 8/8, usuarios 14/14.
- **El diseño del módulo 2, aprobado.** `diseno-modulo-2.md`, `cambios-diseno-modulo-2.md` y el prompt de implementación.

### Falta, en orden

1. **La pantalla del comprador y la máquina del offline**, juntas y en ese orden — `docs/prompt-pantalla-comprador.md`: endpoint de catálogos, borradores locales con fotos, cola de envío con clave de idempotencia, service worker. Prueba: modo avión → cargar → cerrar el navegador → reabrir → **envía una sola vez**.
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

---

### 2026-08-28 · Auth implementada: commit `7cd7b32`

**Lo que quedó.** `Usuario` con `RolUsuario`, contraseñas con `scrypt` de `node:crypto` (`src/lib/password.ts`), cookie firmada de 30 días (`src/lib/sesion.ts`), protección de rutas en `src/proxy.ts`, la decisión de permisos en `src/lib/auth.ts`, atribución `creadoPorUsuarioId` en `Compra` y `ReporteCompra`, y `scripts/verificar-auth.ts`. Doce migraciones.

**«La cookie es identidad; la base es autoridad» quedó implementado, no solo escrito.** Adentro de la cookie va el id y nada más: el rol y el `activo` se leen de la base en cada llamada. Es lo que hace que cambiar un rol o desactivar una cuenta valga **hoy** y no dentro de treinta días.

**Tres decisiones que no pedí y están bien.**

1. **El proxy se queda en Edge, con el porqué escrito:** corre en cada request, incluidas las que Next prefetchea, así que una consulta a la base ahí se paga muchas veces. Verifica firma y vencimiento, nada más. La misma función de firma sirve en los dos runtimes porque está escrita con Web Crypto — **una segunda implementación para Edge habría sido una segunda oportunidad de que las dos no coincidan.**
2. **El `?volver=` guarda solo la ruta, nunca una URL completa.** Un `?volver=https://otrositio` sería un redirect abierto. No estaba en el pedido.
3. **`exigir()` tira en vez de devolver null.** Olvidarse de comprobar el resultado corta el paso en vez de habilitarlo: **el camino descuidado falla cerrado.**

**Y una asimetría deliberada en los `ON DELETE`, que es la correcta.** `adjunto` quedó `RESTRICT` en sus dos padres —borrar la fila no borra el archivo de Storage, así que un `CASCADE` perdía evidencia y dejaba huérfanos silenciosos—, pero `creadoPorUsuarioId` quedó `SET NULL`: si algún día se borra una cuenta, **la compra no se borra con ella**. Perder la atribución es aceptable; perder la compra, no. No son la misma regla porque no son la misma pérdida.

**Verificado por mí contra producción:** `/compras` redirige a `/ingresar`, y `/ingresar` responde el formulario. Eso confirma de paso el punto 6 de la lista: **la Deployment Protection está apagada**, así que el link del comercial no muere en un login de Vercel.

**Lo que queda por confirmar, y una trampa que encontré mirándolo.** Los otros seis puntos de la verificación exigida no vinieron reportados. Y hay uno que desde afuera **no se puede ver**: `leerSesion` devuelve null antes de tocar el secreto cuando no hay cookie, así que la pantalla de ingreso se dibuja perfecta **aunque `SESION_SECRETO` no exista en Vercel** — el error recién aparece cuando alguien aprieta «Entrar». Una pantalla de login que carga bien no prueba que el login funcione. Hay que probar entrar de verdad.

**Una verruga cosmética.** La carpeta `202608282029181_adjunto_on_delete_restrict` tiene quince dígitos donde van catorce. Ordena bien igual —`…202917` < `…2029181` carácter por carácter— y renombrar una migración ya aplicada rompería la fila de `_prisma_migrations`, así que **se deja como está**. Anotado para que dentro de seis meses nadie crea que descubrió un bug.

---

### 2026-09-09 · Por qué no se podía entrar: una variable que estaba en un entorno y no en el otro

**La causa.** `SESION_SECRETO` existía en el entorno **Development** de Vercel y no en **Production**. Como `vercel env pull` baja Development, la variable aparecía en el `.env.local` — y eso hizo que la diéramos por puesta. **Que un secreto esté en tu máquina no dice nada sobre producción.**

**Por qué el síntoma era tan mudo.** Todos los caminos de error del ingreso *devuelven* un valor: usuario vacío, cuenta inexistente, cuenta desactivada, contraseña mal. El único que **tira** es `firmarSesion`, y tira justo después de validar la contraseña y justo antes de grabar la cookie. O sea que el error aparecía **solo con las credenciales correctas**. Y como `setEntrando(false)` estaba después del `await` sin `try/finally`, la excepción dejaba el botón muerto sin decir nada.

**Y lo que más costó: la pantalla de ingreso cargaba perfecta sin la variable.** `leerSesion` devuelve null antes de tocar el secreto cuando no hay cookie, así que el formulario se dibujaba igual. **Una pantalla de login que carga bien no prueba que el login funcione.** Estaba anotado en la entrada del 28/08 como una trampa a chequear, y aun así no fue lo primero que miré.

**Dos errores míos, para que no se repitan.** Primero deduje que la cookie se había grabado porque «todos los caminos de error devuelven» — me faltaba justamente el que tira. Segundo, verifiqué producción con `/compras` y `/ingresar`, que **no tocan la base ni el secreto**: comprobé lo único que no podía fallar. Cuando el chequeo no pasa por la pieza sospechosa, no es un chequeo.

**El seed lo confirmó:** «admin ya existía; su contraseña no se toca». La cuenta estaba desde el principio.

**Lo que quedó como regla:** el secreto se carga en **Production y Preview**, con la nota de cómo rotarlo escrita en el campo *Note* de Vercel.

---

### 2026-09-09 · Dos decisiones de dominio para la pantalla del comprador

Las dos las contestó Iñaki, y las dos cambian la pantalla.

**El número de remito: la foto siempre, el número si puede.** Campo opcional al lado de cada foto. Si lo tipea entra, y si no queda «s/d» y lo completa la oficina. Es la forma de la regla 1 aplicada a la carga: **el dato que se conoce entra; el que no, se ve vacío a propósito**. Hacerlo obligatorio habría sido pedirle un dato a alguien parado en un remate — y ahí la gente inventa o no carga.

**El comprador puede corregir su reporte mientras la oficina no lo procese.** Una vez en PROCESADO, queda congelado. Esto tiene una consecuencia de alcance que hay que decir en voz alta: **el módulo 2 no es solo un formulario, es también una lista.** El comprador necesita ver sus reportes para poder volver a uno. Y `EstadoReporte` deja de ser una etiqueta informativa: **es lo que decide si algo se puede editar.**

Las dos entran al documento de diseño como restricciones de §1, no como preguntas.

---

### 2026-09-09 · La administración de usuarios, que faltaba

**Hoy la única forma de crear una cuenta es el seed, y no hay cómo cambiar una contraseña.** Es decir: **no se le puede dar acceso a un comercial**, que es exactamente lo que el módulo 2 necesita. Omisión del prompt de auth — pedí las cuentas y no pedí cómo se crean las siguientes.

Va en `docs/prompt-usuarios-y-arreglo-login.md`, junto con el arreglo del botón clavado. Cuatro restricciones con su porqué: nadie se desactiva a sí mismo, no puede quedar cero administrativo activo, mínimo 12 caracteres como en el seed, y el hash no sale hacia el cliente. **Desactivar es la baja; no hay borrado**, porque una cuenta borrada se lleva puesta la atribución de lo que cargó.

**Y una propuesta que dejé para que Claude Code evalúe:** cambiar la contraseña hoy no mata las sesiones viejas, y con cookies de 30 días eso pesa más, no menos — si alguien cambia la contraseña es porque sospecha algo. Se puede arreglar sin tocar el formato de la cookie, con un `credencialesDesde` en `Usuario` y derivando la emisión de `exp − DURACION_SESION`.

---

### 2026-09-09 · El documento de diseño del módulo 2, escrito

`docs/diseno-modulo-2.md`, con la misma forma que el del módulo 1: §1 restricciones con su porqué, §2 propuesta negociable, §3 preguntas que son del diseño, y la regla de desempate.

**Re-medido sobre las 117 compras del último año** (la ventana se corrió: eran 120 el 28/08). Darwash **59 de 117, 50 %**; Martin y Alonso 15; **14 sin consignatario**; Feria Rodeo Huinca 11; Ferialvarez 8; y siete nombres con una o dos. Cabezas por compra: mínimo 13, **mediana 80**, p90 328, máximo 859 — o sea que el campo de cabezas es casi siempre de dos o tres dígitos. Renglones: mediana 2, p90 6, máximo 9, y eso **no** va en esta pantalla.

**Las 14 sin consignatario son el argumento de la restricción, no un dato de color:** el consignatario existe siempre, también en la compra directa, y quedaron vacías porque el campo se leía como «la feria». Por eso §1.7 prohíbe ese rótulo.

**Dos restricciones nuevas que no estaban en el módulo 1**, las dos consecuencia del offline: el **estado del envío es contenido**, no un detalle de implementación —si no se distingue «lo mandé» de «está esperando señal», el comprador manda dos veces o cree que mandó algo que no salió—, y **sin señal se guarda el nombre escrito, no una selección de catálogo**.

**Y se mantuvo la disciplina de alcance:** la bandeja de la oficina va en su propio documento. Son dos usuarios, dos dispositivos y dos condiciones de uso; mezclarlos en una conversación de diseño es la forma más rápida de que ninguna de las dos pantallas salga bien.

§1.8 lista taxativamente los campos que hay dónde guardar, con la instrucción explícita de **preguntar en vez de inventar** si el diseño necesita algo más — que es la lección de «Cargada el 25/08/2026 · oficina» del módulo 1.

---

### 2026-09-09 · La vuelta del diseño del módulo 2: nada viola §1, y dos correcciones

**Los seis cambios de §2 quedan y las nueve preguntas de §3 están resueltas.** Registro completo en `docs/cambios-diseno-modulo-2.md`. Iñaki eligió **una sola hoja** y **remitos en fila**, las dos variantes que Design dejó conmutables.

**Lo mejor de la propuesta es cómo trató el offline: como estado normal y no como error.** «Esperando señal» es ámbar y nunca rojo, siempre con la razón al lado; y el acuse de un envío que todavía no ocurrió es **una pantalla completa** con la frase que realmente hace falta oír parado en una feria: «podés apagar el teléfono o irte». Eso es §1.2 entendida, no obedecida.

**Corrección 1, de Design.** Justificó las teclas de camiones con «el p90 de renglones es 6». Los renglones no son camiones, y encima el comprador no los carga. Medido sobre las compras con al menos un DTE —**86 de 117, 74 % de cobertura**—: **1 camión en el 79 %**, mediana 1, p90 2, máximo observado 4. La decisión se mantiene, pero **la primera tecla se lleva cuatro de cada cinco reportes** y eso es lo que debería gobernar esa fila. Y el 4 es **piso, no techo**: hay compras de 859 cabezas con un solo DTE registrado, así que la captura vieja subestima.

**Corrección 2, mía.** Design preguntó, sin inventar, si el reporte guarda quién lo cargó. **Sí lo guarda**: `creadoPorUsuarioId` (qué cuenta lo mandó) y `personaCompradoraId` (quién fue físicamente, que puede no tener cuenta). Mi §1.8 listó solo los campos que el comprador tipea y omitió los que salen de la sesión. La pregunta estaba bien hecha; la lista estaba incompleta.

**Y una nota que va a la implementación:** los cuatro estados **no viven en el mismo lugar**. Borrador y «esperando señal» son del dispositivo; enviado y procesado son `EstadoReporte` en la base. Un reporte esperando señal no existe todavía del lado del servidor — persistir ese estado sería pedirle a la base que sepa algo que, por definición, no le llegó.

---

### 2026-09-09 · El prompt de implementación de la pantalla del comprador

`docs/prompt-pantalla-comprador.md`. **Primero la máquina, después la pantalla**, y el envío pasa por la cola desde el día uno aunque con señal se vacíe al instante: colgarla después obliga a reescribir el camino de envío entero.

**Cinco decisiones técnicas que quedaron cerradas con su porqué:**

1. **IndexedDB y no `localStorage`** — las fotos son binarios y `localStorage` guarda strings con techo de ~5 MB: una sola foto lo revienta.
2. **La clave repetida devuelve el reporte existente, no un error.** Un 409 haría que la cola reintente para siempre justo en el caso que la clave existe para resolver.
3. **Las fotos suben por nuestro servidor, no del navegador a Storage.** Subir directo obligaría a poner una clave de Supabase en el cliente; con fotos ya comprimidas el rodeo es despreciable.
4. **En `Adjunto.url` va la ruta del bucket, no una URL pública.** Una URL pública de un remito es un documento comercial abierto a quien tenga el link; se firma al mostrarla.
5. **El endpoint de catálogos devuelve 18 consignatarios y las plazas, no el padrón entero.** Los 192 vendedores son el grueso y el comprador no los toca.

**Y `creadoPorUsuarioId` sale de la sesión, nunca del cliente:** el cliente no decide quién es.

La prueba de aceptación es una sola y es dura: **modo avión → cargar con fotos → cerrar el navegador → reabrir → volver la señal → llega una sola vez.**

---

### 2026-09-09 · Usuarios y login: dos correcciones que mejoran mi propuesta, y un verde que no valía nada

**El login arreglado.** `<form action={...}>` con `useActionState`, así que el «entrando» sale del `pending` del hook y **ninguna rama del código puede olvidarse de apagarlo** — que era el problema de fondo, no el síntoma. El `redirect()` quedó fuera del `try` porque funciona tirando una excepción que Next tiene que ver pasar. Y un detalle que no pedí y está bien: tras un intento fallido vuelve el usuario tipeado, la contraseña no.

**Por qué «solo vino el punto 6»: no era desidia, y me equivoqué al insinuarlo.** `SESION_SECRETO` está marcado **Sensitive** en Vercel, así que su valor no se puede releer — `vercel env pull` escribe `[SENSITIVE]`. El script firmaba con el secreto de Development, producción rechazaba las cookies con 307, y los puntos 1 a 4 **nunca llegaban a ejecutarse**. Yo lo leí como que faltó correrlos.

**Y lo peor no era eso: los puntos 5 y 7 daban VERDE.** Verde vacío — el 5 no tocaba la red y el 7 buscaba el hash dentro de redirects sin cuerpo. **Un verde que sale de no haber mirado nada es peor que un rojo**, porque el rojo se investiga. Es la tercera vez que este proyecto se topa con la misma forma, después de la condición inalcanzable de la prueba histórica y del aviso que no podía ver lo que la consulta ya había descartado. **Ahora es regla en `CLAUDE.md`: todo chequeo tiene que fallar si su precondición no se cumplió.**

La solución fue de raíz: el script **entra por el login**, mandando el formulario como lo mandaría un navegador con JavaScript apagado, y **copia los campos ocultos de la acción del HTML servido** en vez de reconstruirlos —reconstruirlos se rompe con cada versión de Next—. El script ya no depende del secreto.

## Las dos correcciones a mi propuesta de `credencialesDesde`

**Las dos son mejores que lo que propuse.**

**1. El `iat` viaja explícito en la cookie, no derivado de `exp − DURACION_SESION`.** Mi versión da el valor exacto hoy, pero **el día que alguien mueva esa constante, toda cookie ya emitida cambia de fecha de emisión sin que nadie la toque**. Alargarla las envejece y echa a todos —molesto pero visible—; **acortarla las rejuvenece, y una cookie robada sobreviviría al cambio de contraseña que existe para matarla**. Ese lado es silencioso, que es lo que lo hace grave. Las cookies viejas sin `iat` caen al derivado, así que el deploy no echa a nadie.

**2. Los dos lados se comparan en segundos enteros.** `iat` viene floorado y `credencialesDesde` tiene milisegundos: sin el floor, **la cookie emitida en el mismo segundo del cambio se ve hasta 999 ms más vieja que el corte y te echa del dispositivo donde acabás de cambiar la contraseña.**

## Una guarda que no puede dispararse, y por qué no es lo mismo que una prueba que no puede fallar

Encontró que la regla «no puede quedar cero administrativo activo» es hoy inalcanzable: quien llama pasó por `exigir("ADMINISTRATIVO")`, o sea que es un administrativo **activo**; si desactiva a otro él mismo queda, y si se desactiva a sí mismo corta antes la otra regla.

La dejó, y corresponde. **Una prueba que no puede fallar es un adorno: su trabajo es detectar, y reporta éxito falsamente.** Una **guarda** que no puede dispararse es un cinturón: su trabajo es impedir, no cuesta nada mientras duerme, y **es el invariante de verdad** — la regla de «nadie se desactiva a sí mismo» es una comodidad que alguien puede sacar mañana sin darse cuenta de que sostenía a la otra. Quedó movida a `usuarios.ts` con el porqué escrito, y la prueba la ejercita **construyendo el estado dentro de una transacción que se revierte**, en vez de fingir que pasó.

## Un hueco que el documento no preveía

**Una sesión de una cuenta desactivada pasaba el proxy y veía las pantallas sin encabezado, hasta 30 días.** El proxy no puede detectarlo —corre en Edge y no toca la base, que es justamente la decisión que lo hace barato—, así que lo detecta el layout, que ya consulta `usuarioActual()`, y rebota a `/api/salir`. **Borrar la cookie primero es lo que evita el bucle:** sin eso, el proxy ve una firma válida en `/ingresar` y devuelve a `/compras`.

Es el precio de la división proxy/base que elegimos, y está bien pagado: la alternativa era consultar la base en cada request, incluidos los prefetch.

**Verificación de usuarios: 9 en verde, 0 en rojo.** La de auth contra producción queda pendiente del deploy, y la circularidad es real: el login desplegado todavía es el `onSubmit` viejo, que no acepta envío sin JavaScript.

---

### 2026-09-09 · Auth y usuarios, cerrados contra producción

`verificar-auth.ts --produccion`: **8 en verde, 0 en rojo**, incluidos los cuatro puntos que nunca habían llegado a ejecutarse. `verificar-usuarios.ts --produccion`: **14 en verde, 0 en rojo**. `main` limpio en `713768a`.

**El detalle que vale más que los números.** Los dos rebotes por rol ahora traen **el mensaje real del servidor** —«Esta acción es para ADMINISTRATIVO, y la cuenta es COMERCIAL»— en vez de un 307 mudo. Es exactamente la regla nueva llevada un paso más allá: un 307 habría dado verde, pero verde de **«no había sesión»**, no de «el permiso funciona». **Dos rechazos por motivos distintos se ven iguales desde afuera si uno solo mira que rechazó.**

**El reseteo de contraseña mueve `credencialesDesde`**, verificado de punta a punta contra producción: la sesión abierta de esa persona muere y el administrativo que resetea no se echa a sí mismo. Cambiar la cerradura sin dejar la copia de la llave.

**La base de producción quedó con una sola cuenta, `admin`**, y se verificó explícitamente que ninguna cuenta de prueba sobreviviera — una que quedara viva sería un ADMINISTRATIVO con contraseña conocida. Es el chequeo que casi nadie hace y el que más caro sale no hacer.

**Dos cosas quedan como decisiones de dominio, no de código:**

1. **La guarda del último administrativo no puede dispararse hoy** —quien llama siempre se cuenta a sí mismo— y queda documentada **como invariante, no como control activo**. Si mañana alguien agrega cambiar el rol de una cuenta, esa guarda pasa a ser el único freno.
2. **Una sesión de una cuenta desactivada ya no ve pantallas.** La echa el layout vía `/api/salir`, que **borra la cookie antes** de mandar al login — sin eso el proxy ve firma válida y devuelve a `/compras` en un bucle.

**Con esto el módulo 2 no tiene ninguna dependencia abierta:** esquema, auth, cuentas y diseño listos. Lo único que falta es construir la pantalla.

---

### 2026-09-09 · La pantalla del comprador, construida y probada en un navegador de verdad

**Navegador (Chromium con perfil en disco): 8 en verde. HTTP: 12 en verde. 0 en rojo.**

**La prueba dura pasó entera:** modo avión → dos fotos → cerrar el navegador de verdad → reabrir → el reporte y las fotos siguen ahí → vuelve la señal → **llega una sola vez**, con los dos adjuntos, y la cola queda vacía. Una foto de **6,6 MB quedó en 202 KB**.

**Y se probó donde se rompe.** IndexedDB, el canvas y el service worker no existen en Node: **probarlos con un mock habría sido comprobar que el mock funciona**, y el offline se rompe justo en las costuras con el navegador real. Es la regla del verde vacío aplicada antes de escribir el test, no después de que fallara.

## Tres decisiones que el prompt no cubría

**1. Las pantallas del comprador no renderizan ningún dato de la persona en el servidor** — y esto resuelve una contradicción que dejé yo en el documento. Pedí cachear el shell **y** no cachear páginas autenticadas: las dos cosas chocan si la página trae el nombre adentro, porque **un HTML cacheado sobrevive al logout**. Así que `/reportar` y `/reportes` son cáscaras que se llenan en el cliente. La consecuencia hay que decirla en voz alta para que nadie la «arregle» después: **el shell se puede cargar sin sesión, y está bien** — no tiene datos, y traerlos exige la cookie.

Lo mejor es el agregado: **un chequeo (7b) que se pone en rojo si alguna de esas páginas vuelve a traer datos.** El comentario del service worker depende de esa condición, y **un comentario no se hace cumplir solo**.

**2. «6+» no guarda 6: abre un campo para el número exacto.** Guardar 6 cuando fueron nueve es inventar el dato. Es regla 1, así que no volvió a Design: una restricción de dominio no admite empate.

**3. La ruta de cada foto en Storage es determinística** (clave del reporte + índice, con `upsert`). Las fotos suben antes de crear las filas, así que un intento que falla a mitad y se reintenta las vuelve a subir: **con ruta aleatoria, cada reintento dejaba copias huérfanas comiéndose el GB del plan free.** Es la idempotencia extendida más allá de la fila: **si el reintento es parte del diseño, todo lo que el reintento toca tiene que ser idempotente, también los archivos.**

## Un diagnóstico equivocado que el navegador desmintió

El comercial entraba a `/compras` en vez de a su pantalla. El primer diagnóstico —cómo Next resuelve `redirect("/")`— era falso: la causa real era que **la página de login mandaba `volver="/compras"` por defecto** y eso pisaba la decisión por rol. El comentario quedó diciendo la razón verdadera, no la primera.

Ese `?? "/compras"` está en `ingresar/page.tsx` desde el día uno y **yo leí esa línea el 28/08 sin verla**: entonces no había decisión por rol, así que no era un bug todavía. **Un valor por defecto razonable envejece mal cuando alguien agrega una decisión más arriba.**

Es el segundo diagnóstico confiado y equivocado de la jornada —el primero fue mío, con la cookie— y las dos veces lo desmintió ir a mirar. **La diferencia entre las dos: esta se desmintió sola porque había una prueba corriendo.**

## Una verificación podrida, y la regla que deja

**`scripts/verificar-modulo-1.ts` está roto desde el commit de auth**, hace once días, y nadie lo notó. Llama a las server actions en proceso y `exigir()` necesita `cookies()`, que fuera de una request no existe. O sea que **los «19 chequeos en verde» del módulo 1 no se pueden reproducir hoy**: dejaron de ser un hecho verificable y pasaron a ser una anécdota.

Tres reglas nuevas en `CLAUDE.md`: las verificaciones se corren **todas juntas con un solo comando**, para que un script roto sea tan visible como un chequeo en rojo; **entran por el login y llaman por HTTP**, nunca a las server actions en proceso, porque llamar la función directo saltea justo las capas que se quieren probar; y **lo que hay que preparar en Supabase se prepara desde un script del repo, no con un clic en el panel** — vale para las tablas y ahora también para Storage, con `preparar-storage.ts` y el bucket `remitos` privado, tope de 5 MB, solo imágenes.

---

### 2026-09-09 · `npm run verificar`: 65 en verde, y una bomba desactivada

**Las seis verificaciones bajo un solo comando**, en serie porque comparten base —la de usuarios cuenta administrativos activos y otra en paralelo le cambiaría el resultado—:

| | |
|---|---:|
| módulo 1 | 20 |
| auth | 8 |
| usuarios | 14 |
| comprador (HTTP) | 12 |
| comprador (navegador) | 10 |
| prueba histórica | 1 |
| **total** | **65 en verde, 0 en rojo** |

El módulo 1 pasó de 19 a **20**: el chequeo nuevo es que la acción rebote **sin cookie**, que es exactamente donde el script se había roto. Y la histórica conserva su criterio propio — el runner lee su veredicto y su código de salida, no cuenta chequeos por su cuenta.

**Una bomba desactivada de paso.** `verificar-modulo-1.ts` tenía un `--limpiar` que hacía `deleteMany({})` sobre **todas** las compras. Mientras la base estuvo vacía fue inofensivo; con compras reales era una bomba a un flag de distancia, apuntando a la única base que existe. Ahora borra solo lo suyo, por id, y quedó como regla en `CLAUDE.md`. **Un peligro que envejece mal: no cambió el código, cambió lo que había del otro lado.** Es el mismo patrón que el `?? "/compras"` del login.

**El primer intento de probar la guarda no probó nada, y lo encontró él.** Metió `import { estoNoExiste } from "./modulo-que-no-existe"` y el comando siguió dando 65 en verde: **`tsx` elide un import cuyo binding nadie usa**, así que el script corría igual. Con `import "./modulo-que-no-existe"` —de efecto, no elidible— sí revienta, y el resumen marca `NO ARRANCÓ` como rojo, 57 en verde, 1 en rojo, código 1.

Es la cuarta vez que este proyecto se topa con la misma forma, y esta vez **en la prueba de la guarda que existe para detectar esa forma**. Por eso lo que más va a durar no es la guarda: es que **quedó escrito en el encabezado de `verificar-todo.ts` cómo romperla bien y por qué la forma obvia no sirve.** Sin esa nota, el próximo que quiera reprobarla hace lo mismo y se queda tranquilo.

**Y la pregunta del índice de las fotos era el primer caso:** cada envío sube todas, `corregirReporte` no toca fotos, y `encolar` congela el juego y borra el borrador, así que entre dos intentos los índices no se pueden mover. No había nada que arreglar — **pero agregó el caso igual** (tres fotos de tamaños distintos, borrar la del medio, reenviar, comprobar contra Storage que cada fila apunta a su imagen), y eso es lo correcto: **una propiedad que hoy se cumple por una razón que nadie escribió deja de cumplirse el día que esa razón cambia.**

## Un cabo suelto que sí hay que cerrar

**Un reporte que el servidor rechaza con 4xx queda en un callejón sin salida:** no reintenta —correcto, reintentar no lo va a arreglar— pero **no hay forma de verlo, corregirlo ni descartarlo desde la pantalla**. Hoy solo se destraba borrando los datos del navegador.

Es grave por lo que es, no por lo que rompe: **un reporte atrapado es evidencia perdida**, que es exactamente lo que este módulo existe para no perder. Y es la misma regla del botón muerto, subida un nivel: ahora lo que queda inutilizable sin decir por qué no es un botón, es un registro entero.

**Decisión de dominio:** un reporte nunca puede quedar inalcanzable. La persona tiene que poder verlo, corregirlo y reintentar, o descartarlo **deliberadamente**. **La forma de ese quinto estado va a Claude Design**, junto con la bandeja: el vocabulario de estados de esa pantalla es suyo —ámbar y nunca rojo, siempre con la razón al lado— y agregarle uno por afuera lo rompería.

---

### 2026-09-09 · El documento de la bandeja, y un hallazgo que cambia el formulario

`docs/diseno-bandeja-modulo-2.md`. Tercer documento del mismo circuito, con §4 addendum del quinto estado para que salga todo en un solo envío a Claude Design.

**El hallazgo, medido sobre los 345 renglones del último año:**

| | cobertura |
|---|---:|
| cabezas | **100 %** |
| comisión | 97 % |
| precio por kilo | 91 % |
| kilos **por cabeza** | 91 % |
| establecimiento | **10 %** |
| **peso de origen (total)** | **0 %** |

**El peso total de origen está en 0 %, pero los kilos por cabeza están en 91 %.** O sea que **no es que no sepan los kilos: es que la casa los escribe por cabeza y no en total.** Nuestro esquema guarda `kilosOrigen` como total, y está bien —el total es el hecho, el promedio se calcula—, pero **si el formulario pide el total está pidiendo un número que nadie tiene en la mano.** Es exactamente el tipo de cosa que hace que un campo quede en 0 % de cobertura durante seis años, y no se veía en la medición anterior porque estaba hecha a nivel compra y no a nivel renglón.

**Cómo escriben las categorías:** mezclan código y palabra, y la palabra gana — **`vaca` sola es el 21 % de los renglones**, contra 7 % de `VA`. El diccionario de 217 sinónimos no es una comodidad: es el mecanismo principal de entrada.

**Y el establecimiento está en 10 %**, que es medio proyecto: la comisión lo sigue —feedlot 2 %, campo 3 %— y sin él no se reconstruye nada.

**Una nota de forma que vale para los tres documentos:** el dato que más cambió el diseño no fue el que buscaba, sino el que apareció al medir a otro nivel de grano. Los 117 y el 50 % de Darwash ya los sabía; los kilos por cabeza no.

---

### 2026-09-10 · La bandeja vuelve del diseño: nada viola §1, y el prototipo se atrapó a sí mismo

**Los siete cambios de §2 quedan y las diez preguntas de §3 están resueltas.** Registro en `docs/cambios-diseno-bandeja.md`; el prompt de implementación en `docs/prompt-bandeja.md`.

**Lo más importante del entregable es un bug que encontró y arregló solo: un campo vacío contaba como 0.** El panel decía «sobre 3 de 3» cuando solo dos renglones tenían kilos, y el promedio daba 268 en vez de 339. **Es el error fundacional del proyecto —las 19 columnas `REAL NOT NULL` con 0 donde no hay dato— reproducido adentro de la pantalla que promete no cometerlo, y en el mismo panel que muestra la cobertura.** La regla más fácil de romper es la que uno cree que ya internalizó.

**Respondió §3.3 con la medición, no con el gusto:** el campo es **KILOS POR CABEZA** y el total se muestra derivado. Es lo que decían los números —por cabeza 91 %, total 0 %— y es la diferencia entre un campo que se llena y uno que se queda vacío seis años.

**Verifiqué el 93 % que afirmó, y da 94 %:** de las 74 compras multi-renglón del último año, 71 permiten calcular el porcentaje y **67 tienen el mismo en todos los renglones**. Y de paso salió que el establecimiento mixto es más fuerte de lo que yo había escrito: **5 de las 7 compras multi-renglón con establecimiento cargado lo tienen mixto**.

**Lo que hay que agregar: el motivo del descarte no tiene dónde vivir.** El diálogo promete que el comprador va a ver **por qué** se descartó, y `ReporteCompra` no tiene ese campo — `observaciones` es del comprador y es evidencia, así que la oficina no escribe ahí. Va migración: `motivoDescarte` más `estadoCambiadoPorUsuarioId` y `estadoCambiadoEn`, **que cubren también el marcado como procesado y su reversión**: son decisiones que le sacan algo a otra persona y `actualizadoEn` no alcanza porque se mueve con cualquier cambio.

**Y la pregunta de la atribución tiene respuesta, no es un agujero.** «Lo mandó Ramiro» sale de la cuenta y miente si dos la comparten — pero son dos campos distintos y los dos existen: `creadoPorUsuarioId` dice qué cuenta, y eso siempre es cierto; `personaCompradoraId` dice quién fue físicamente. **La pantalla tiene que rotular la cuenta como cuenta**, no afirmar la persona.

**Una anotación de higiene:** tres citas de §1 vinieron cambiadas de número. Las decisiones son correctas, las citas no, y quedó dicho en el prompt que se siga la regla y no el número. Ya nos pasó con las teclas de camiones que una decisión buena viniera con la razón equivocada, y la razón es lo que sobrevive a la decisión.

---

### 2026-09-10 · La bandeja, y un agujero que habría vaciado de sentido al módulo

**84 en verde, 0 en rojo**, con la bandeja sumada a `npm run verificar` — siete verificaciones. El RLS de la migración **comprobado contra `pg_class`, no supuesto**.

## El hallazgo grande: la oficina podía pisar la evidencia

`corregirReporte` usaba `puedeVer`, que le da acceso a un ADMINISTRATIVO. **Correcto para leer** —la oficina necesita ver el reporte en la bandeja— **y equivocado para escribir**: con eso, por POST directo, la oficina podía reescribir lo que el comprador había mandado. **La diferencia entre lo que dice el remito y lo que vio el comprador se podía hacer desaparecer sin dejar rastro** — y esa diferencia es la razón por la que el reporte existe. Un módulo entero apoyado en «el reporte es evidencia y no se pisa», con la puerta abierta.

**Leer y escribir el mismo dato son dos permisos distintos aunque el sujeto sea el mismo.** Reusar un predicado de lectura para autorizar una escritura es una familia de bug, no un descuido, y quedó como regla en `CLAUDE.md`.

Lo arregló por dos vías, que es lo correcto: **intentándolo de verdad con cookie de oficina**, y un **chequeo estructural** de que ninguna acción de oficina escriba campos del reporte. El primero prueba el caso; el segundo previene el próximo.

## Un rojo que estaba midiendo otra cosa

El chequeo de ida y vuelta de los kilos falló: `16493,2 / 40` da `412.33000000000004`. **La app estaba bien** —usa la función que redondea—; el chequeo hacía la división cruda, o sea que **estaba midiendo IEEE 754 y no la app**. Es la quinta vez que aparece la misma familia, y esta vez del lado opuesto: no un verde vacío, un **rojo ajeno**. La regla en `CLAUDE.md` se amplió: un chequeo tiene que fallar si su precondición no se cumplió **y tiene que medir la app, no otra cosa**.

## La suposición del `BULTO` estaba al revés, y hubo que preguntar

Supuso que en `BULTO` el precio es el del renglón entero. **Es por animal**, confirmado por Iñaki. El histórico lo respalda: de los 32 renglones sin precio por kilo, varios dan un `importe/cabezas` **exactamente redondo** — 480.000 con 1 cabeza, 670.000 con 2, 722.000 con 25, 1.090.000 con 12, 1.240.000 con 58, 1.290.000 con 17. Un precio por lote entero no produce eso.

**No se podía medir del todo, porque el esquema viejo no guarda la modalidad.** Y esa es la lección: **que un dato no se pueda medir es una razón para preguntar, no para suponer.** La suposición estaba anotada —eso estuvo bien— pero anotada y equivocada: una nota que explica un razonamiento falso es peor que ninguna, porque la próxima persona la lee y la cree.

Las dos modalidades se conservan separadas igual: registran **cómo se pactó**, que es un hecho comercial distinto aunque la aritmética coincida. Regla 14 en `CLAUDE.md`; corrección en `docs/prompt-bulto.md`.

## Y el aviso del módulo 1, por fin disparando

El aviso de empresa titular quedó pendiente desde el módulo 1 porque **no había tropas contra las cuales comparar**. Ahora las hay y aparece: señala, no bloquea, y el chequeo 10 confirma que la tropa se guarda igual. Es la primera vez en el proyecto que una decisión tomada por adelantado se activa sola al llegar la pieza que le faltaba.

---

### 2026-09-10 · `BULTO` no existía, y la culpa fue de mi pregunta

**Corrección de lo que registré hace un rato.** Escribí que «por bulto» el precio es por animal y que las dos modalidades se conservaban separadas porque registran cómo se pactó. **La respuesta completa es más simple: `BULTO` y `CABEZA` son lo mismo.** En los dos casos pasan un precio por animal y el importe sale de cabezas × precio. **No hay ninguna operación que se pacte por el lote entero.**

**El error fue mío y fue de método.** La primera pregunta ofrecía «por el lote entero», «por animal» y «las dos cosas pasan» — **las tres daban por sentado que `BULTO` era algo distinto de `CABEZA`**. Una pregunta que no incluye la respuesta correcta entre sus opciones no la puede recibir, y encima devuelve una respuesta que parece una confirmación. **Es la misma familia que la prueba que no puede fallar, aplicada a preguntarle a una persona.** Hizo falta que Iñaki insistiera —«no sé si me entendiste»— para que la reformulara con los dos casos en números.

**La consecuencia: `BULTO` sale del enum `ModalidadPrecio`, que queda con `KG` y `CABEZA`.** No es cosmético. Dos valores que significan lo mismo son la misma enfermedad que un total guardado: el mismo hecho en dos lugares. **Divergen solos** —una persona carga el trato como `BULTO`, otra el mismo trato como `CABEZA`— y a los seis meses cualquier corte por modalidad parte en dos una sola realidad.

**Y el histórico nunca lo justificó.** El «90,8 % por kilo, el resto por bulto o por cabeza» que anduvo dando vueltas desde la primera medición era una inferencia mía: **el esquema viejo no guarda la modalidad**. La distinción entró por la puerta del vocabulario, no del dato, y sobrevivió cuatro documentos sin que nadie la mirara de frente.

Regla 14 de `CLAUDE.md` reescrita. `docs/prompt-bulto.md` reemplazado — el anterior decía lo contrario y quedaba peligroso: **una instrucción equivocada es peor que ninguna, igual que una nota que explica un razonamiento falso.**

---

### 2026-09-10 · `BULTO` fuera. 86 en verde, y una migración que se rompía a sí misma

**Cero renglones movidos: la tabla `lote` está vacía.** Era un problema teórico hoy, **y por eso es el mejor momento**: es exactamente el mismo razonamiento que con el padrón único — era lo más barato que iba a ser nunca. El paso del `UPDATE` quedó igual en la migración, con el motivo escrito: **el archivo tiene que ser correcto el día que corra sobre datos, no solo hoy.**

**La guarda de re-ejecución no es decorativa, y el mecanismo es nuevo.** Sin ella, la segunda corrida fallaría con `invalid input value for enum` en el `WHERE "modalidadPrecio" = 'BULTO'` — **precisamente porque la primera corrida sacó la etiqueta**. La migración se rompería a sí misma al reintentarse. La regla que teníamos era «escribí las migraciones re-ejecutables»; lo que aparece acá es que **cuando lo que cambia es un tipo, la guarda tiene que ser sobre el tipo y no sobre las filas** — si no, el paso que preserva el dato se vuelve imposible de repetir por culpa del paso que lo sigue.

**La verificación se hizo en la base, no en la pantalla:** un `UPDATE` crudo por SQL con `'BULTO'` que la base tiene que rechazar, y lo rechaza con `22P02`. **Esconder la opción del selector no impide un INSERT**, así que verificarlo en la pantalla habría sido otro verde vacío. Sexta aplicación de la misma regla, y esta vez preventiva: no se equivocó y después lo arregló, lo pensó antes.

**Y la mejor observación del informe es sobre un rojo que él mismo causó.** Al insertar los chequeos nuevos después del punto 1, el renglón de 63 cabezas le cambió la cobertura de «2 de 3» a «2 de 4» y lo puso en rojo. Movió el bloque, pero anotó lo que importa: **el chequeo 1 es el que protege el error fundacional del proyecto, y es bueno que sea frágil ante un renglón de más.** Si hubiera seguido en verde con cuatro renglones, **no estaría mirando la cobertura** — estaría mirando cualquier otra cosa. Un chequeo de cobertura que no se rompe cuando cambia el universo no es un chequeo de cobertura.

**El caso concreto, cerrado:** 63 cabezas a 1.350.000 → importe 85.050.000, comisión al 2 % → 1.701.000. **`npm run verificar`: 86 en verde, 0 en rojo.**

---

**Con esto la fase 1 está completa.** Módulo 1 —información de la compra— y módulo 2 —el reporte del comprador y la bandeja de la oficina— construidos, verificados y en producción, con auth, cuentas y ocho verificaciones bajo un solo comando.

---

### 2026-09-10 · Módulo 3 medido: la liquidación vieja es casi toda dato derivado

`docs/prompt-arranque-modulo-3.md`. **Ocho columnas resultaron ser cuentas guardadas**, reconstruidas contra los datos reales: `importe = peso_liquidado × precio_kg` (100 %), `kg_x_cab = peso_liquidado / cabezas` (100 %), `total_c_iva = importe + iva + comisión` (99 %), `importe_hacienda`, `comision` e `impuestos` de cabecera son **exactamente la suma de sus renglones** (100 % las tres), `compra_total = hacienda + comisión` (99 %), y los tres `costo_puesto_*` salen del flete y de los kilos de llegada.

**Dos hallazgos que valen por sí solos:**

**`importe_total` es una copia literal de `importe_hacienda`, en el 100 % de los casos.** Dos columnas, el mismo número, seis años. Nadie lo notó porque nada obliga a mirarlas juntas — que es exactamente la forma en que un dato duplicado sobrevive.

**`compra_total` no es el total de la compra: es `hacienda + comisión`, sin impuestos.** Una columna que se llama «total» y no lo es, y cualquiera que la sume creyendo el nombre se equivoca por unos once puntos. **El nombre de una columna es documentación, y una documentación equivocada es peor que ninguna** — es la misma lección que la nota del `BULTO`, ahora a escala de esquema.

## El flete: no falta, miente

Está en **1 de 117**, y Iñaki confirmó que **existe y se paga; nunca se cargó**. Consecuencia: las 62 compras con `costo_puesto_kg` cargado tienen un número que **no incluye el flete y se llama «puesto» igual**. No es un dato faltante, es un dato equivocado con nombre de correcto. **Capturar el flete es la razón de ser del módulo 3.**

## El costo puesto no se puede cerrar en el módulo 3

Verificado: `costo_puesto_kg = costo_puesto_total / kg_llegada`, y **los kilos de llegada son de la balanza, o sea del módulo 4**. La liquidación fija lo que se paga; el costo puesto por kilo recién existe cuando la hacienda llegó y se pesó. Un diseño que prometa el costo puesto dentro del módulo 3 va a mostrarlo en s/d la mitad del tiempo — o peor, va a calcularlo sobre los kilos liquidados y dar un número parecido pero distinto. Es la decisión #6 y hay que tomarla antes de escribir código.

## Una corrección a lo que le dije a Claude Design

Le pasé que «la casa escribe los kilos por cabeza (91 %) y el total nunca (0 %)», apoyado en `kg_x_cab`. **`kg_x_cab` es una columna derivada de `peso_liquidado`, que es un dato de la LIQUIDACIÓN, no de la compra.** O sea que ese 91 % nunca fue evidencia sobre lo que la oficina escribe al armar la compra: era evidencia sobre otra etapa.

**La conclusión de fondo se sostiene por otra vía**, y mejor: Iñaki confirmó que **el remito trae los kilos casi siempre**, así que el 0 % de `peso_origen` es un agujero de captura puro y el campo del módulo 2 es el que lo cierra. Pero **la razón que le di al diseño era falsa**, y queda pendiente si el campo debe pedir el total —como lo dice el remito— o por cabeza.

Es la tercera vez en dos días que una decisión correcta viene con la razón equivocada —las teclas de camiones, el `BULTO`, y ahora esto—, y las tres veces la razón equivocada fue mía o pasó por mí sin que la chequeara. **La razón sobrevive a la decisión: es lo que alguien va a usar para decidir el próximo caso.**

## Una suposición declarada

Iñaki no contestó si los kilos que se facturan pueden diferir de los del remito. **Asumo que sí y que la diferencia importa**, por dos razones: existen `reclamo_kg` y `reclamo_monto` en el 5-6 % de los renglones —un reclamo por kilos solo tiene sentido si los kilos pueden discrepar—, y es el mismo patrón que ya está en el proyecto con cabezas compradas contra llegadas. Queda como suposición explícita, para revisar.

---

### 2026-09-10 · El papel dice el total del lote, y el formulario lo pedía al revés

**Iñaki describió el documento real:** dice **los kilos liquidados del lote comprado**, y aparte aclara **KG promedio** y **el precio por kilo**. Y existe la otra forma, **kilos del lote más precio por cabeza**.

**O sea que el número que la persona tiene delante es el total, y el promedio ya viene calculado en el propio papel.** El formulario de la bandeja pedía por cabeza y mostraba el total: **invertido respecto del documento que se está copiando**. Se da vuelta. No hace falta migración — `Lote.kilosOrigen` ya guarda el total y el otro se deriva.

**Y no es cosmético.** Un formulario que obliga a convertir a mano lo que el papel ya trae es un formulario que se llena mal o no se llena. **El 0 % de cobertura histórica de los kilos de origen es exactamente lo que pasa cuando el campo no se parece al documento.** Es la misma lección que «establecimiento» en vez de «destino»: si el campo se llama y se comporta como el papel, nadie tiene que traducir.

**Segundo hallazgo del mismo dato:** los kilos aparecen **también cuando el precio es por cabeza**. En el histórico `peso_liquidado` y `precio_kg` se mueven juntas —las dos en 91 %—, o sea que **cuando el precio no era por kilo tampoco se guardaban los kilos**. Otro agujero de captura, y el formulario no lo tiene que heredar: el campo de kilos no se atenúa cuando la modalidad es `CABEZA`.

**El error fue mío y ya lo había marcado media hora antes:** usé el 91 % de `kg_x_cab` como evidencia de lo que la oficina escribe, cuando `kg_x_cab` es una **columna derivada** de un dato de la liquidación. Corregí los dos documentos de diseño en su lugar, tachado y con la fecha, en vez de reescribirlos en silencio — **un documento que cambia de opinión sin decirlo hace dudar de todo lo demás que dice.**

**Y abre la pregunta que ahora es el centro del módulo 3:** si el papel de la compra ya trae «kilos liquidados», ¿son ese mismo número los kilos de la liquidación, o pueden volver a moverse? Es la decisión #3 del documento de arranque y decide si son un dato o dos.

---

### 2026-09-10 · Los kilos son un solo hecho, y el sistema viejo lo venía gritando

**Confirmado por Iñaki: los kilos del papel de la compra son los mismos que van a la liquidación, y no se tocan.** No hay dos números: hay uno. **Cierra la decisión #3 del módulo 3** y el campo ya está capturado en el módulo 2.

**Y hay una confirmación del sistema viejo que hasta ahora había leído como un agujero y es otra cosa.** `liquidaciones_detalleliquidacion` tiene **las dos columnas**: `peso_origen` en **0 %** y `peso_liquidado` en **91 %**, sobre los mismos 345 renglones.

**Nadie decidió eso: lo decidió el vocabulario.** El papel dice «kilos liquidados», así que la gente llenó la columna que se llamaba igual que el papel y dejó vacía la que no. **Es la tesis entera del proyecto contenida en dos columnas de la misma tabla** — y durante todo el análisis yo leí ese 0 % como «no capturan los kilos», cuando lo que decía era «no usan ese nombre».

**Consecuencia inmediata:** `Lote.kilosOrigen` se renombra a `Lote.kilosLiquidados`. Con `lote` en 0 filas es lo más barato que va a ser nunca — mismo argumento que el padrón y el `BULTO`. Y sobre todo: **repetir en el esquema nuevo el nombre que quedó vacío en el viejo sería elegir a propósito el que no se usa.**

**El módulo 3 queda más fino de lo que esperaba.** Con kilos y precio ya capturados, el importe se calcula hoy. La liquidación agrega cuatro cosas y no reescribe ninguna: el número y la fecha, los impuestos, el flete con su factura, y los reclamos —que **no pisan los kilos**, se guardan al lado—. Eso cambia el peso de la decisión #1: «entidad propia o campos de `Compra`» pasa a decidirse casi enteramente por si una compra puede liquidarse más de una vez, y no por el volumen de datos.

---

### 2026-09-10 · Una compra, una liquidación — y por qué hubo que preguntarlo

**Cerradas las decisiones #1 y #2 del módulo 3.** Una compra se liquida una sola vez, así que la liquidación **no es una entidad propia**: son campos de `Compra`. Una tabla aparte que siempre tendría exactamente una fila es el mismo concepto en dos lugares — regla 2.

**Lo que vale registrar es por qué la pregunta existía.** En el esquema viejo la liquidación **es** la fila de la compra: una tabla, una fila. Así que aunque el caso de una compra liquidada en dos veces existiera en la realidad, **el esquema no lo podría haber mostrado nunca** — no tiene dónde ponerlo.

**Un dato que el esquema no puede representar se ve idéntico a un dato que no existe.** Es la misma familia que el aviso que no podía detectar lo que la consulta estricta ya había descartado, y que la condición inalcanzable de la prueba histórica: **la ausencia de evidencia solo vale como evidencia si el instrumento podía traerla.** Por eso esta no se medía, se preguntaba.

`n_liquidacion` queda nullable: **«sin liquidar» es un estado real**, y está en el 43 % del histórico.

**Quedan cinco decisiones abiertas** en el módulo 3: qué compone los impuestos (#4), si el flete es por compra, por carga o por camión (#5), si el costo puesto se cierra en el 3 o en el 4 (#6), si el reclamo es entidad propia (#7), y qué son `precio_ajustado` y `precio_con_comision` al 11 % (#8).

---

### 2026-09-10 · Tres decisiones más cerradas, y el costo puesto no vive en ningún módulo

**#5 — El flete se factura POR CAMIÓN.** Vive en `Carga.flete`, que ya existe desde el módulo 2; el total de la compra se **calcula** sumando las cargas. El `logistica_total` de la cabecera del sistema viejo era un total guardado más. Falta sumar la referencia de la factura al lado del monto.

**#6 — El costo puesto no se cierra en el módulo 3 ni en el 4: no se guarda en ninguno.** Es `(compra + flete) / kilos de llegada`. Se calcula donde se muestre, y mientras no existan los kilos de llegada es **«s/d — faltan los kilos de llegada»**: información, no un hueco. La pregunta estaba mal planteada por mí — buscaba **dónde vive** un número que, por la regla 2, no vive en ningún lado.

**#8 — Resuelta midiendo, no preguntando.** `precio_ajustado` es el **precio por kilo llegado**: `importe / peso_llegada` en el 66 % de los casos y prorrateado a nivel compra en el 34 % restante — **100 % entre las dos formas**. Y `precio_con_comision = precio_ajustado × (1 + comisión/importe)` en el **100 %**. Dos derivadas más, de la misma familia que el costo puesto.

**Con esto van once columnas del sistema viejo demostradas como cuentas guardadas.** No es una crítica al que las hizo: en una planilla no hay otra forma. Es la razón por la que este proyecto existe.

## Y un hallazgo que se paga en el módulo 4: el desbaste puede ser NEGATIVO

Entre las compras con desbaste cargado hay **−6,3 %, −1,85 % y −1,74 %**: la hacienda llegó **pesando más** de lo liquidado. No es un error de carga: es la misma forma que «cabezas compradas ≠ llegadas, en los dos sentidos», que ya es la regla 5.

**Cualquier validación que asuma desbaste ≥ 0 va a rechazar casos reales.** Quedó anotado en el documento de arranque, donde lo va a leer quien construya el módulo 4 — se descubre midiendo la liquidación, pero se paga dos módulos más adelante.

---

### 2026-09-10 · Las ocho decisiones del módulo 3, cerradas

**#4 — Impuestos: IVA más percepciones, guardados SEPARADOS.** Son conceptos distintos y no siempre están los dos. El sistema viejo los tiene **fundidos en una sola columna** `iva` por renglón —por eso la medición daba ~10,9 % y no el 10,5 % del IVA sobre hacienda— y **esa fusión es exactamente el motivo de separarlos**: hoy nadie puede decir cuánto fue impuesto y cuánto percepción. Ninguno se recalcula desde una alícuota; se capturan.

**#7 — El reclamo es una tabla propia.** Es un reclamo **al consignatario, que puede o no prosperar**: tiene estado y fecha, o sea vida propia. Dos columnas en el renglón no podrían representar «reclamado y todavía sin respuesta». Y **nunca pisa los kilos ni el importe**: se guarda al lado, como todo lo demás.

**Las ocho cerradas.** Tres se cerraron **midiendo** (#3 dónde viven los kilos, #6 el costo puesto, #8 los precios ajustados) y cinco **preguntando** (#1, #2, #4, #5, #7).

**Y hay un patrón en cuál fue cuál, que vale más que las decisiones.** Las cinco que hubo que preguntar son, todas, las que **el esquema viejo no podía contestar**: porque fundía dos conceptos en una columna (los impuestos), porque guardaba un total donde había un detalle (el flete), o porque no tenía dónde representar el caso (una compra con dos liquidaciones, un reclamo pendiente). **Los datos contestan las preguntas que su esquema permitió hacer; el resto hay que preguntárselo a una persona.** Es la versión general de lo que ya nos había pasado tres veces con las pruebas.
