/**
 * Normalización de texto para las columnas `*Normalizado` que llevan el
 * `@unique`.
 *
 * REGLA: toda la app normaliza con estas funciones y con ninguna otra. Ya nos
 * mordió una vez que `lower()` de SQLite plegara solo ASCII mientras
 * `toLowerCase()` de JS pliega Unicode: los conteos daban distinto. Si hace
 * falta normalizar en SQL, el equivalente exacto está documentado abajo.
 *
 * Son DOS funciones y no una a propósito: normalizan distinto porque el
 * problema es distinto.
 */

/**
 * Mapa explícito de vocales acentuadas. Se usa un mapa y no
 * `normalize("NFD")` + descarte de diacríticos para que la versión SQL de la
 * migración pueda ser idéntica carácter por carácter — con NFD, JS plegaría
 * cosas que un `translate` de Postgres no, y volveríamos a tener dos
 * normalizaciones que no coinciden.
 *
 * `ñ` NO está en el mapa, y es deliberado: en castellano es una letra propia,
 * no una `n` con acento. Plegarla uniría «Peña» con «Pena», que son entidades
 * distintas — el mismo error que sería recortar los sufijos societarios.
 * En el histórico esto no es hipotético: los únicos dos nombres con signos
 * diacríticos de los 209 son «DOÑA ARVELIA SA» y «LEPORATI Y COMPAÑIA SA», y
 * en los dos el diacrítico es la ñ.
 */
const SIN_ACENTO: Readonly<Record<string, string>> = {
  á: "a", à: "a", â: "a", ä: "a", ã: "a",
  é: "e", è: "e", ê: "e", ë: "e",
  í: "i", ì: "i", î: "i", ï: "i",
  ó: "o", ò: "o", ô: "o", ö: "o", õ: "o",
  ú: "u", ù: "u", û: "u", ü: "u",
};

/**
 * Para los nombres de las cuatro entidades que se crean al vuelo desde el
 * formulario: consignatario, vendedor, hotelero y persona compradora.
 *
 * trim + minúsculas + vocales sin acento. NO toca los sufijos societarios
 * (S.R.L., S.A., Hnos) ni la puntuación: recortarlos uniría entidades que
 * pueden ser distintas de verdad, y eso es adivinar.
 *
 * Consecuencia a tener presente: como no toca puntuación, «FERIA RODEO HUINCA
 * S.R.L» y «FERIA RODEO HUINCA S.R.L.» siguen siendo dos filas distintas.
 * Esta función previene los duplicados por mayúsculas y acentos, no los de
 * puntuación.
 *
 * Equivalente exacto en SQL (usado en la migración que crea las columnas):
 *   translate(lower(btrim(nombre)),
 *             'áàâäãéèêëíìîïóòôöõúùûü',
 *             'aaaaaeeeeiiiiooooouuuu')
 */
export function normalizarNombre(texto: string): string {
  let salida = "";
  for (const c of texto.trim().toLowerCase()) salida += SIN_ACENTO[c] ?? c;
  return salida;
}

/**
 * Para `CategoriaSinonimo.textoNormalizado`: trim + minúsculas, SIN tocar
 * acentos.
 *
 * Es distinta de `normalizarNombre` a propósito y no conviene «unificarlas»:
 * los 217 sinónimos ya sembrados están normalizados así, y agregarle el plegado
 * de acentos cambiaría el valor de filas existentes («crías» pasaría a «crias»),
 * lo que exige una migración de datos y puede colapsar filas. Si alguna vez se
 * quiere hacer, es un cambio deliberado con su propia migración, no un
 * refactor.
 *
 * `toLowerCase()` pliega Unicode, a diferencia de `lower()` de SQLite que solo
 * pliega ASCII: por eso «vaca preñada» y «VACA PREÑADA» colapsan acá y no
 * colapsarían con la semántica de SQLite.
 */
export function normalizarTexto(texto: string): string {
  return texto.trim().toLowerCase();
}

/**
 * Sufijos societarios que la comparación LAXA descarta. No se recortan al
 * guardar: son parte del nombre real de la entidad.
 */
const SUFIJOS_SOCIETARIOS =
  /\b(s\s*r\s*l|srl|s\s*a|sa|sas|s\s*h|sh|hnos|hermanos|cia|compania|ltda|sacif|saci)\b/g;

/**
 * Normalización LAXA — SOLO para detectar parecidos y avisar en pantalla.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ NUNCA usar esta función para guardar, para el @unique, ni para fusionar. │
 * │ Para eso está `normalizarNombre`.                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Qué se rompe si se usa ésta donde va la estricta: uniría entidades que son
 * distintas de verdad. Pliega la ñ, así que «Peña» y «Pena» colapsarían, y
 * «DOÑA ARVELIA SA» pasaría a ser «dona arvelia». Recorta sufijos societarios,
 * así que «Martín y Alonso» (nuestra empresa) y «MARTIN Y ALONSO SRL» (la
 * feria) darían la misma clave — que resultaron ser la misma entidad, pero eso
 * lo confirmó una persona mirándolas, no una regla.
 *
 * Al revés —usar la estricta donde va ésta— no rompe nada, solo deja pasar
 * duplicados sin avisar: «FERIA RODEO HUINCA S.R.L» y el mismo con punto final
 * son dos entidades para la base y nadie se entera.
 *
 * La división es: la base impide los duplicados SEGUROS, la pantalla señala los
 * DUDOSOS, y una persona decide. Cuando decide que sí, el par se registra en
 * ALIAS_ENTIDAD del seed.
 */
export function normalizarLaxo(texto: string): string {
  let salida = "";
  for (const c of texto.trim().toLowerCase()) salida += SIN_ACENTO[c] ?? c;
  return salida
    .replace(/ñ/g, "n") // acá SÍ se pliega, y solo acá
    .replace(/[.,\-·/&']/g, " ")
    .replace(SUFIJOS_SOCIETARIOS, " ")
    .replace(/\s+/g, " ")
    .trim();
}
