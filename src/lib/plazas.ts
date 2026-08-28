/**
 * Sugerencias iniciales de plaza.
 *
 * Son las 12 más frecuentes del histórico de WinCompras. NO es un catálogo:
 * `Compra.plazaLugar` es texto libre y sigue siéndolo. Esto solo alimenta el
 * `datalist` del formulario, que sugiere sin obligar.
 *
 * Por qué existe: un selector vacío el día uno no ayuda justo cuando la persona
 * menos conoce la app, y con texto libre sin sugerencias se termina con
 * WASHINGTON, Washington y Wash. como tres cosas distintas.
 *
 * Se unen con las plazas ya usadas en compras reales, así que la lista se
 * corrige sola a medida que se carga: lo que se tipee de verdad va a aparecer
 * como sugerencia la próxima vez, esté o no acá.
 *
 * Si alguna deja de usarse, sacarla de acá no borra nada: las compras que la
 * tengan la conservan, porque el dato vive en la compra y no en esta lista.
 */
export const PLAZAS_SUGERIDAS: readonly string[] = [
  "WASHINGTON",
  "HUINCA RENANCO",
  "RIO CUARTO",
  "GENERAL VILLEGAS",
  "CORDOBA",
  "VILLA MERCEDES",
  "CARLOS CASARES",
  "BUENA ESPERANZA",
  "DEL CAMPILLO",
  "HUANGUELEN",
  "EL CAMPILLO",
  "VICUÑA MACKENNA",
];
