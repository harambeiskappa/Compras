@AGENTS.md

# Proyecto Compras

App para registrar la compra de hacienda de punta a punta, reemplazando el Excel de compras. Cinco módulos, en el orden real del circuito: información de la compra, compra, liquidación, recepción, informe. **Fase actual: módulos 1 y 2.**

## Decisiones fijas — no volver a decidirlas

- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind + Postgres. Deploy en Vercel.
- **Scaffolding:** npm, Tailwind sí, carpeta `src/` sí, alias `@/*`. Ya está hecho.
- **Documento de arranque de la fase:** `docs/prompt-arranque-modulos-1-2.md`. Leerlo antes de proponer esquema o pantallas. Tiene 12 decisiones marcadas `[DECIDIR]`: **no resolverlas por cuenta propia** — si una bloquea el trabajo, decir cuál y qué se está suponiendo.
- **Base histórica de referencia:** la carpeta `WinCompras` del workspace, archivo `backend/db.sqlite3`. Consultarla con `sqlite3` por línea de comandos o un script Python. **Nunca leerla con el Read tool**: son 7,5 MB binarios.

## Reglas duras del dominio

1. **Sin dato es NULL y se muestra «s/d».** Prohibido `DEFAULT 0` en columnas de cantidad, peso, precio o monto, y ningún `NOT NULL` sin justificación escrita al lado. El esquema viejo tiene 19 columnas `REAL NOT NULL` y por eso hoy «no se sabe» y «vale cero» son el mismo valor. Ese es el error que esta app existe para no repetir.
2. **Un concepto, un lugar.** Totales, promedios y costos derivados se calculan, no se guardan. Nada de filas «TOTAL».
3. **Cada lote tiene identidad propia**, con sus cabezas y sus kilos de origen, y sobrevive hasta la recepción. El desbaste se calcula por cabeza y se mira por lote, nunca promediado.
4. **Cabezas compradas ≠ cabezas llegadas**, en los dos sentidos. Nunca tratar la diferencia como error.
5. **Categorías canónicas:** NV, NT, VQ, VA, TO, TM, TH y **T** (ternero/a mixto). **MEJ no es canónica: mapea a TO.** Si un texto no matchea el diccionario de sinónimos, **no se adivina** — queda pendiente de mapeo y lo resuelve una persona.
6. **Todo número agregado se muestra con su cobertura al lado.** «kg promedio 412 — sobre 3 de 4 lotes».
7. **Cuatro roles distintos**, nunca intercambiables: consignatario (la feria que remata), empresa compradora (cuál de nuestras empresas compra), vendedor/origen (de quién era la hacienda), hotelero (de quién es una vez en el feedlot). Y aparte la persona compradora, que es quien fue físicamente a comprar.
8. **Cada etapa captura lo que sabe y nada más.** No pedir en la feria un dato que recién se conoce en la balanza de llegada.

## Qué no tocar

- `docs/BITACORA.md` — el registro del proyecto, lo mantiene Iñaki desde otra sesión.
- `docs/prompt-arranque-modulos-1-2.md` — documento de referencia, no se edita desde acá.
- La carpeta `WinCompras` es de solo lectura para este proyecto: se consulta, no se modifica.
