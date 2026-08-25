@AGENTS.md

# Proyecto Compras

App para registrar la compra de hacienda de punta a punta, reemplazando el Excel de compras. Cinco módulos, en el orden real del circuito: información de la compra, compra, liquidación, recepción, informe. **Fase actual: módulos 1 y 2.**

## Decisiones fijas — no volver a decidirlas

- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind. Deploy en Vercel.
- **Scaffolding:** npm, Tailwind sí, carpeta `src/` sí, alias `@/*`. Ya está hecho.
- **Base:** Postgres de Supabase (región São Paulo), conectada por la integración de Vercel. Las credenciales llegan como variables de entorno inyectadas por Vercel — **nunca hardcodearlas ni commitearlas**. En local se traen con `vercel env pull .env.local`; `.env*` ya está en el `.gitignore`.
- **ORM: Prisma.** El esquema vive en `prisma/schema.prisma` y las migraciones en `prisma/migrations/`, ambos versionados en el repo. **Prohibido crear o modificar tablas desde el editor de Supabase**: el esquema tiene que existir en el repo, con historial y reproducible. Un mismo dato definido en dos lugares diverge.
- **Versiones de Prisma pinneadas exactas a `7.10.0`** (CLI y client), sin caret. Al 25/08/2026 el tag `latest` de `prisma` en npm apunta a `8.0.0-rc.10`, un release candidate: **cualquier `npm install prisma` sin versión trae el RC**. Nunca destildar el pin ni correr un update a ciegas; si hace falta subir de versión, verificar antes qué devuelve `npm view prisma dist-tags --json`. El `package-lock.json` es lo que usa Vercel en el build, así que tiene que quedar commiteado.
- **Dos conexiones distintas, y el criterio es el modo, no el host.** Las tres URL que inyecta Supabase van al mismo pooler; lo que las diferencia es el puerto. `POSTGRES_URL_NON_POOLING` (5432, *session mode*) preserva prepared statements y locks de sesión: **es la que usa el CLI para migrar**, y va en `prisma.config.ts`. `POSTGRES_PRISMA_URL` (6543, *transaction mode*) es la que usa **el adapter de la app**, porque en serverless sin pool se agotan las conexiones. Nunca migrar por el 6543.
- **Supabase Storage** para los adjuntos (fotos de remitos). Las fotos se comprimen del lado del cliente antes de subir — el plan free tiene 1 GB y una foto de celular sin comprimir pesa ~3 MB.
- **Documento de arranque de la fase:** `docs/prompt-arranque-modulos-1-2.md`. Leerlo antes de proponer esquema o pantallas. Tiene 12 decisiones marcadas `[DECIDIR]`: **no resolverlas por cuenta propia** — si una bloquea el trabajo, decir cuál y qué se está suponiendo.
- **Base histórica de referencia:** la carpeta `WinCompras` del workspace, archivo `backend/db.sqlite3`. Consultarla con `sqlite3` por línea de comandos o un script Python. **Nunca leerla con el Read tool**: son 7,5 MB binarios.

## Reglas duras del dominio

1. **Sin dato es NULL y se muestra «s/d».** Prohibido `DEFAULT 0` en columnas de cantidad, peso, precio o monto, y ningún `NOT NULL` sin justificación escrita al lado. El esquema viejo tiene 19 columnas `REAL NOT NULL` y por eso hoy «no se sabe» y «vale cero» son el mismo valor. Ese es el error que esta app existe para no repetir.
2. **Un concepto, un lugar.** Totales, promedios y costos derivados se calculan, no se guardan. Nada de filas «TOTAL».
3. **Cada lote tiene identidad propia**, con sus cabezas y sus kilos de origen, y sobrevive hasta la recepción. El desbaste se calcula por cabeza y se mira por lote, nunca promediado.
4. **Cabezas compradas ≠ cabezas llegadas**, en los dos sentidos. Nunca tratar la diferencia como error.
5. **Categorías canónicas:** NV, NT, VQ, VA, TO, TM, TH y **T** (ternero/a mixto). **MEJ no es canónica: mapea a TO.** Si un texto no matchea el diccionario de sinónimos, **no se adivina** — queda pendiente de mapeo y lo resuelve una persona.
6. **Una compra tiene una empresa titular, y las tropas dicen a quién quedan las cabezas.** No son el mismo dato. Lo normal es una empresa por compra — PEGSA siempre va sola, UGM siempre va aparte— pero cuando una empresa compró poco (caso típico: Bulltrade) se cuelga de la compra de otra en vez de abrir la suya. De ahí que `Compra.empresaTitular` (bajo qué empresa se registra, dato del módulo 1) y `Tropa.empresaCompradora` (a quién le quedan esas cabezas, dato del módulo 2) sean campos distintos. **Validación al cerrar el módulo 2: la titular tiene que estar entre las empresas de las tropas de esa compra.** En el formulario, la empresa de cada tropa viene precargada con la titular y solo se cambia en el caso excepcional.
7. **Todo número agregado se muestra con su cobertura al lado.** «kg promedio 412 — sobre 3 de 4 lotes».
8. **Cuatro roles distintos**, nunca intercambiables: consignatario (la feria que remata), empresa compradora (cuál de nuestras empresas compra), vendedor/origen (de quién era la hacienda), hotelero (de quién es una vez en el feedlot). Y aparte la persona compradora, que es quien fue físicamente a comprar.
9. **Cada etapa captura lo que sabe y nada más.** No pedir en la feria un dato que recién se conoce en la balanza de llegada.

## Qué no tocar

- `docs/BITACORA.md` — el registro del proyecto, lo mantiene Iñaki desde otra sesión.
- `docs/prompt-arranque-modulos-1-2.md` — documento de referencia, no se edita desde acá.
- La carpeta `WinCompras` es de solo lectura para este proyecto: se consulta, no se modifica.
