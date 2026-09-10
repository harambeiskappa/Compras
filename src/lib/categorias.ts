import "server-only";

import { normalizarTexto } from "@/lib/normalizar";
import { prisma } from "@/lib/prisma";

/**
 * La categoría se escribe libre y se resuelve contra el diccionario.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ EL DICCIONARIO ES LA VÍA PRINCIPAL DE ENTRADA, NO UN ACCESORIO.          │
 * │                                                                          │
 * │ Medido sobre 345 renglones del último año: el 21 % dice `vaca` y el 7 %  │
 * │ dice `VA`. La palabra le gana al código, y la gente mezcla los dos todo  │
 * │ el tiempo. Un selector de 8 códigos obligaría a traducir mentalmente en  │
 * │ cada renglón; el texto libre con resolución detrás no obliga a nada.     │
 * │                                                                          │
 * │ Y SI NO MATCHEA, NO SE ADIVINA. Queda con `categoriaCanonicaId` en NULL  │
 * │ y lo resuelve una persona. Los 18 pendientes de hoy —`nov/vaq`,          │
 * │ `vac/cria`, `machos`, `130`— son ambigüedades REALES, no errores de      │
 * │ tipeo: adivinar que `nov/vaq` es NV es inventar la mitad de un dato.     │
 * │                                                                          │
 * │ Lo que NO hace es frenar la carga: el lote se guarda igual y completo.   │
 * │ Lo único que queda pendiente es la resolución canónica.                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

export type CategoriaResuelta = {
  sinonimoId: number;
  /** El texto tal como se escribió. Es el dato crudo y no se toca. */
  texto: string;
  /** `null` = pendiente de mapeo. La pantalla lo sella SIN RESOLVER. */
  canonica: { id: number; codigo: string; descripcion: string } | null;
};

/**
 * Devuelve el sinónimo para un texto, creándolo si hace falta.
 *
 * La búsqueda y el alta van por `textoNormalizado` (trim + minúsculas, la
 * misma `normalizarTexto` de siempre — no se inventa una tercera), que es el
 * que lleva el unique: así «vaca», «Vaca» y « VACA » son una sola fila.
 */
export async function resolverCategoria(textoCrudo: string): Promise<CategoriaResuelta> {
  const texto = (textoCrudo ?? "").trim();
  if (!texto) throw new Error("La categoría no puede estar vacía.");
  const textoNormalizado = normalizarTexto(texto);

  const existente = await prisma.categoriaSinonimo.findUnique({
    where: { textoNormalizado },
    select: {
      id: true,
      texto: true,
      categoriaCanonica: { select: { id: true, codigo: true, descripcion: true } },
    },
  });
  if (existente) {
    return {
      sinonimoId: existente.id,
      texto: existente.texto,
      canonica: existente.categoriaCanonica,
    };
  }

  // Nace SIN canónica. No se busca parecido ni se elige «la más probable»:
  // eso es adivinar, y un mapeo inventado es peor que uno faltante porque nadie
  // vuelve a mirarlo.
  const creado = await prisma.categoriaSinonimo.create({
    data: { texto, textoNormalizado },
    select: { id: true, texto: true },
  });
  return { sinonimoId: creado.id, texto: creado.texto, canonica: null };
}

/** Para el `datalist` del formulario: lo que ya se escribió alguna vez. */
export async function sinonimosConocidos(): Promise<
  { texto: string; codigo: string | null }[]
> {
  const filas = await prisma.categoriaSinonimo.findMany({
    orderBy: { texto: "asc" },
    select: { texto: true, categoriaCanonica: { select: { codigo: true } } },
  });
  return filas.map((f) => ({ texto: f.texto, codigo: f.categoriaCanonica?.codigo ?? null }));
}
