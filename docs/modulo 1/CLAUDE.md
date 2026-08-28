# Notas del proyecto Compras

## Para el módulo 2 (compra: tropas, lotes, renglones)

- **La comisión va por renglón, no por compra.** Salió del módulo 1 el 27/08/2026:
  medido sobre el histórico, en 4 compras reales el porcentaje difiere entre
  renglones según el destino del lote (feedlot 2 %, campo 3 %).
- Al agregar un renglón, **la comisión viene precargada con la del renglón anterior**:
  en el 93 % de las compras todos los renglones llevan el mismo porcentaje, así que
  se tipea una vez y se repite.
- Pero **editable renglón por renglón**: el 7 % restante es real y no se puede forzar.

## Módulo 1 — decisiones ya tomadas

- Obligatorios: fecha, consignatario, empresa titular. Los tres son NOT NULL en la
  base, así que **no se les ofrece «poner en s/d»** en ninguna pantalla.
- Datos opcionales de la pantalla: vendedor/origen, hotelero, persona compradora,
  plaza y observaciones (5). La cobertura se cuenta sobre esos 5.
- Una compra sin fecha no se puede crear. La lista la muestra agrupada arriba solo
  como degradación defensiva, nunca como caso normal.

## Cómo entregar el diseño

Cada vuelta de diseño tiene que volver con **la lista explícita de cambios a §2**
del documento de especificaciones: un punto por cambio, qué decía §2, qué se hizo
y por qué. Sin esa lista no se puede chequear contra §1.
