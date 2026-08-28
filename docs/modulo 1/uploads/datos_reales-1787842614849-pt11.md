# Datos reales para las pantallas del módulo 1

Nombres y casos sacados de la base de WinCompras, para que los mockups usen realidad y no `Empresa Ejemplo S.A.`. Los nombres largos y las mayúsculas inconsistentes **son así en el original** — parte de lo que el diseño tiene que aguantar.

**Volumen:** ~120 compras al año.

---

## Empresas propias (selector de «empresa titular»)

Ocho, y **Tercio Bravo NO va en este selector** — es de terceros. Sí va en el de hotelero.

| Empresa | Prefijos |
|---|---|
| Pecuaria El Garabí | PEG, PEC |
| Las Taperas del Oeste | TAP, LTA, LTP |
| Bulltrade | BUL |
| Darwash | DAR |
| Martín y Alonso | ALO |
| Unión Ganadera | UGM |
| El Saguaipe | SAG |

---

## Consignatarios (11 en el último año)

Uno concentra la mitad: cualquier orden alfabético lo entierra.

| Compras | Nombre |
|---:|---|
| 60 | Darwash |
| 15 | Martin y Alonso SRL |
| 11 | Feria Rodeo Huinca (Renanco) |
| 8 | Ferialvarez |
| 2 | Testa Lelli Liaudat |
| 2 | Haciendas Villaguay |
| 2 | Bressan y Cia |
| 1 | Vicar Ganadera |
| 1 | Talano Hnos |
| 1 | Saenz Valiente Bullrich |
| 1 | Colombo y Magliano |

---

## Vendedores / origen (los más frecuentes)

Muchos, largos, en mayúsculas y con abreviaturas inconsistentes. Es el catálogo que más crece y el que más se va a crear al vuelo.

| Veces | Nombre |
|---:|---|
| 143 | DARWASH SA |
| 56 | FERIA RODEO HUINCA S.R.L |
| 40 | SOC. RURAL. GRAL VILLEGAS |
| 31 | FERIALVAREZ S.A |
| 26 | EL HARAS |
| 25 | DON PEDRO |
| 17 | MARTIN Y ALONSO SRL |
| 17 | EL DESCANSO |
| 13 | SOC. RURAL DE CARLOS CASARES |
| 10 | SOC.RURAL RIO QUINTO |
| 10 | SOC. RURAL DE RIO CUARTO |
| 10 | EDUARDO A TRAVAGLIA |
| 9 | TESTA LELLI LIAUDAT Y CIA |
| 9 | CALVO DANIEL OMAR S.R.L |

---

## Hoteleros

| Veces | Nombre |
|---:|---|
| 577 | PEGSA |
| 41 | LAS TAPERAS |
| 26 | DARWASH SA |
| 11 | PECUARIA DESCANSO |
| 9 | PECUARIA EL COLORADITO |
| 8 | UGMA |
| 7 | PECUARIA DON PEDRO |
| 3 | TERCIO BRAVO SAS |
| 3 | BULLTRADE SRL |
| 2 | EL SAGUAIPE SAS |
| 1 | ZAMBRONI NICANOR |

---

## Plazas / localidades

| Veces | Nombre |
|---:|---|
| 204 | WASHINGTON |
| 86 | HUINCA RENANCO |
| 70 | RIO CUARTO |
| 45 | GENERAL VILLEGAS |
| 24 | CORDOBA |
| 21 | VILLA MERCEDES |
| 21 | CARLOS CASARES |
| 17 | BUENA ESPERANZA |
| 14 | DEL CAMPILLO |
| 12 | HUANGUELEN |
| 11 | EL CAMPILLO |
| 10 | VICUÑA MACKENNA |

---

## Diez compras reales para poblar la lista

Tomadas tal cual del último año. **Fijate cuántas tienen huecos** — no es descuido del ejemplo, es el estado real del dato de hoy, y es exactamente lo que las pantallas tienen que mostrar como «s/d» sin que parezca un error.

| Fecha | Consignatario | Empresa titular |
|---|---|---|
| 2026-08-19 | Darwash | PEG |
| 2026-08-18 | Darwash | PEG |
| 2026-08-07 | Darwash | PEG |
| 2026-08-05 | Darwash | PEG |
| 2026-07-28 | Darwash | TAP |
| 2026-07-23 | Darwash | PEG |
| 2026-07-21 | Darwash | PEG |
| 2026-07-21 | Darwash | UGM |
| 2026-07-17 | Feria Rodeo Huinca (Renanco) | PEG |
| 2026-06-26 | Darwash | TAP |

Y dos casos límite que existen de verdad y conviene que el diseño vea:

- **Compras 6284 y 6285:** sin fecha, sin consignatario y sin empresa. Los tres campos obligatorios vacíos a la vez. Hoy el formulario las impediría — pero muestran hasta dónde llega el desorden que venimos a ordenar.
- **Compra 6304:** empresa titular BUL, pero sus tropas dicen PEG. Es legítimo: la empresa puede cambiar entre la compra y la liquidación. Es el caso que dispara un **aviso que no bloquea**.

---

## Tono de los textos

- **«hacienda»**, no «ganado». **«cabezas»**, no «animales».
- Los términos del dominio van tal cual y no se traducen ni se explican: tropa, consignatario, hotelero, desbaste, DTE, jaula, feria, plaza.
- **«s/d»** es el término de la casa para «sin dato». No usar «N/A», «—», «vacío» ni «desconocido».
- Nada de vocabulario de software: ni «registro», ni «entidad», ni «ítem», ni «formulario». Se compra hacienda, no se crean registros.
- Los mensajes dicen qué pasó y por qué, en una línea. «La empresa titular no figura entre las empresas de las tropas» y no «Error de validación 3».

