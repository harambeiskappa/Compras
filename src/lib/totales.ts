/**
 * Los totales de una compra. TODOS DERIVADOS, ninguno guardado.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN CAMPO VACÍO ES «s/d» EN TODO CÁLCULO, NUNCA 0.                        │
 * │                                                                          │
 * │ El diseño de esta misma pantalla se tropezó con esto y lo corrigió: un   │
 * │ vacío contado como 0 hacía decir «sobre 3 de 3» cuando solo dos          │
 * │ renglones tenían kilos, y el promedio salía 268 en vez de 339. Es el     │
 * │ error fundacional del proyecto —19 columnas `REAL NOT NULL` en el        │
 * │ esquema viejo— reproducido adentro de la pantalla que existe para no     │
 * │ cometerlo. Por eso los agregados NO reciben números: reciben             │
 * │ `number | null`, y el null no suma ni cuenta.                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Y todo agregado sale con SU COBERTURA AL LADO. Un promedio sobre la mitad de
 * los casos no es el mismo número que uno sobre todos.
 */

export type Agregado = {
  /** `null` cuando ningún renglón aportó el dato. No es 0: es «s/d». */
  valor: number | null;
  /** Cuántos renglones tenían el dato. */
  aportaron: number;
  /** Sobre cuántos renglones. */
  sobre: number;
};

const VACIO = (sobre: number): Agregado => ({ valor: null, aportaron: 0, sobre });

/** Suma los que tienen dato. Si ninguno tiene, el resultado es s/d, no 0. */
export function sumar(valores: (number | null | undefined)[]): Agregado {
  const conDato = valores.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (conDato.length === 0) return VACIO(valores.length);
  return {
    valor: redondear(conDato.reduce((a, b) => a + b, 0)),
    aportaron: conDato.length,
    sobre: valores.length,
  };
}

/**
 * Promedio PONDERADO: divide la suma de una magnitud por la suma del peso, y
 * solo sobre los renglones que tienen las dos cosas.
 *
 * Ponderado y no promedio de promedios: los kilos por cabeza de un renglón de
 * 200 cabezas y los de uno de 5 no valen lo mismo, y promediarlos parejo da un
 * número que no existe en ningún lado.
 */
export function promedioPonderado(
  pares: { magnitud: number | null | undefined; peso: number | null | undefined }[]
): Agregado {
  const utiles = pares.filter(
    (p) =>
      typeof p.magnitud === "number" &&
      !Number.isNaN(p.magnitud) &&
      typeof p.peso === "number" &&
      p.peso > 0
  ) as { magnitud: number; peso: number }[];

  if (utiles.length === 0) return VACIO(pares.length);

  const magnitud = utiles.reduce((a, p) => a + p.magnitud, 0);
  const peso = utiles.reduce((a, p) => a + p.peso, 0);
  return { valor: redondear(magnitud / peso), aportaron: utiles.length, sobre: pares.length };
}

/** Dos decimales, sin la basura del punto flotante. */
export function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Kilos por cabeza → kilos totales, EXACTO.
 *
 * `Lote.kilosOrigen` guarda el TOTAL porque el total es el hecho, pero la casa
 * escribe por cabeza —medido: por cabeza 91 % de cobertura, total 0 %— así que
 * la conversión la hace el formulario.
 *
 * Se multiplica en centésimos ENTEROS y recién ahí se divide. En punto
 * flotante, `412.33 * 3` da 1236.9899999999998, que guardado y vuelto a
 * dividir no devuelve 412.33 — y el número que la persona escribió tiene que
 * poder volver a mostrarse igual.
 */
export function kilosTotales(porCabeza: number, cabezas: number): number {
  return (Math.round(porCabeza * 100) * cabezas) / 100;
}

/** El camino de vuelta: el total guardado se muestra por cabeza. */
export function kilosPorCabeza(total: number, cabezas: number): number | null {
  if (!cabezas) return null;
  return redondear(total / cabezas);
}

export type ModalidadPrecio = "KG" | "CABEZA" | "BULTO";
export type ModalidadComision = "PORCENTAJE" | "MONTO";

export type RenglonParaCalculo = {
  cabezas: number;
  kilosOrigen: number | null;
  precio: number | null;
  modalidadPrecio: ModalidadPrecio | null;
  comision: number | null;
  comisionModalidad: ModalidadComision | null;
};

/**
 * Cuánta plata es este renglón. `null` cuando falta algo — no 0.
 *
 * BULTO: el precio es el del renglón entero, no por unidad. Es la lectura
 * natural de «por bulto» y el 91 % de los renglones son por kilo, así que el
 * caso es marginal; si resultara al revés, se cambia acá y en ningún otro lado.
 */
export function importeDelRenglon(r: RenglonParaCalculo): number | null {
  if (r.precio === null || r.modalidadPrecio === null) return null;
  if (r.modalidadPrecio === "KG") {
    return r.kilosOrigen === null ? null : redondear(r.precio * r.kilosOrigen);
  }
  if (r.modalidadPrecio === "CABEZA") return redondear(r.precio * r.cabezas);
  return redondear(r.precio);
}

/**
 * Cuánta comisión es este renglón, en plata. `null` cuando no se puede saber.
 *
 * Con modalidad PORCENTAJE hace falta el importe del renglón; si el importe es
 * s/d, la comisión en plata también lo es. NO se asume 0: hay renglones
 * legítimos con comisión cero —cero es un valor— y confundirlos con «no se
 * sabe» es exactamente lo que rompió el esquema viejo.
 */
export function comisionDelRenglon(r: RenglonParaCalculo): number | null {
  if (r.comision === null || r.comisionModalidad === null) return null;
  if (r.comisionModalidad === "MONTO") return redondear(r.comision);
  const importe = importeDelRenglon(r);
  return importe === null ? null : redondear((importe * r.comision) / 100);
}

export type TotalesCompra = {
  cabezas: Agregado;
  kilos: Agregado;
  /** Kilos por cabeza, ponderado por las cabezas de cada renglón. */
  kilosPorCabeza: Agregado;
  importe: Agregado;
  comision: Agregado;
  /**
   * El porcentaje de comisión cuando TODOS los renglones que lo tienen usan el
   * mismo. Medido: pasa en el 94 % de las compras multi-renglón. Cuando no,
   * queda en null y la pantalla dice que varía — sumar porcentajes no
   * significa nada.
   */
  porcentajeUniforme: number | null;
};

export function totalesDeCompra(renglones: RenglonParaCalculo[]): TotalesCompra {
  const porcentajes = renglones
    .filter((r) => r.comisionModalidad === "PORCENTAJE" && r.comision !== null)
    .map((r) => r.comision as number);
  const uniforme =
    porcentajes.length > 0 && porcentajes.every((p) => p === porcentajes[0])
      ? porcentajes[0]
      : null;

  return {
    // Las cabezas son lo único obligatorio de un lote, así que su cobertura es
    // siempre completa. Se muestra igual: la cobertura no se omite cuando da
    // bien, porque entonces nadie sabe si se miró.
    cabezas: sumar(renglones.map((r) => r.cabezas)),
    kilos: sumar(renglones.map((r) => r.kilosOrigen)),
    kilosPorCabeza: promedioPonderado(
      renglones.map((r) => ({
        // Solo los renglones CON kilos entran, y entran con su peso en cabezas.
        magnitud: r.kilosOrigen,
        peso: r.kilosOrigen === null ? null : r.cabezas,
      }))
    ),
    importe: sumar(renglones.map(importeDelRenglon)),
    comision: sumar(renglones.map(comisionDelRenglon)),
    porcentajeUniforme: uniforme,
  };
}

/** «412,5 — sobre 3 de 4 renglones». La cobertura va AL LADO, no al pie. */
export function conCobertura(a: Agregado, unidad = "", sustantivo = "renglones"): string {
  if (a.valor === null) return `s/d — ningún ${sustantivo.replace(/es$/, "")} lo tiene`;
  const numero = a.valor.toLocaleString("es-AR", { maximumFractionDigits: 2 });
  return `${numero}${unidad} — sobre ${a.aportaron} de ${a.sobre} ${sustantivo}`;
}
