# Módulo 1 — cambios del diseño sobre la propuesta original

Registro de lo que Claude Design cambió respecto de la §2 («propuesta de rutas y pantallas», marcada como negociable) de `diseno-modulo-1.md`, y por qué.

**Regla de desempate:** si un cambio no viola una restricción de dominio de §1, gana el diseño. **Los doce cambios se revisaron uno por uno y ninguno la viola**, así que quedan todos.

---

## Primera vuelta

| §2 decía | Qué se hizo | Por qué |
|---|---|---|
| Rutas `/compras`, `/compras/nueva`, `/compras/[id]` | Sin cambios | Alcanzan |
| Punto de entrada por definir | `/` lleva a `/compras` | Lo primero es encontrar o cargar una compra; un tablero no tiene qué mostrar todavía |
| Ver y editar: pregunta abierta | Una sola pantalla, edición campo por campo | Los opcionales entran tarde y de a uno; abrir otra pantalla para cambiar la plaza es fricción que hace que no se cambie |
| La lista identifica con fecha + consignatario + empresa | Se sumaron vendedor/origen y plaza — cinco columnas | 60 de 120 compras son del mismo consignatario: tres columnas no distinguen dos filas del mismo día |
| Orden de la lista sin especificar | Fecha descendente | — |
| Orden de los catálogos sin especificar | Consignatarios por frecuencia, no alfabético | Alfabético entierra a Darwash, que concentra la mitad |
| «Vendedor, hotelero, persona compradora y consignatario se pueden crear sin salir» | Igual, y el selector de empresa explica en una línea por qué ella no | §1.8 pedía la exclusión; §1.10 pide la razón |
| Campos: comisión y su modalidad | Salieron | Se aplica por renglón (medido); los renglones son del módulo 2 |
| Sin mención de búsqueda | Buscador sobre consignatario, empresa, vendedor y plaza | 120 al año: no hacen falta filtros, pero encontrar una es el caso de uso de la pantalla |
| Sin mención de avisos en la lista | Contador «1 aviso, en 1 de 13 compras» + punto en la fila | §1.2, el número con su cobertura al lado; §1.9, que no sea un cartel de 398 |

## Segunda vuelta

| §2 decía | Qué se hizo | Por qué |
|---|---|---|
| Nada sobre el catálogo al vuelo más allá de que se pueda crear sin salir | Una sola acción de crear pasó a **tres estados** según qué haya en pantalla | La normalización estricta de la base no atrapa duplicados por puntuación (`FERIA RODEO HUINCA S.R.L` contra el mismo con punto). Lo tiene que atajar la pantalla |

Los tres estados:

1. **Hay un casi-idéntico** — bloque en el color de los avisos, arriba de todo, con el candidato como botón grande: «Ya hay uno que se escribe casi igual: cambia un punto o una abreviatura. Si es el mismo, elegí el que ya está». Crear queda debajo, en letra chica.
2. **Hay parecidos pero ninguno casi-idéntico** — crear pasa a un pie gris, botón fantasma. Sigue a un clic, pero deja de ser lo más prominente.
3. **No hay candidatos** — crear vuelve a ser la acción principal: «No hay ninguno así. Crear «X» y elegirlo». Es el caso del vendedor nuevo de verdad.

**La comparación de parecidos normaliza más agresivo que el `unique` de la base** —además de mayúsculas y acentos, saca puntuación y sufijos societarios (srl, s.a., sas, hnos, cia)— pero **solo para avisar. Nunca para fusionar ni para bloquear.** La base impide los duplicados seguros; la pantalla señala los dudosos y una persona decide. Es la misma forma que el aviso de empresa titular y que los kilos faltantes.

---

## Variantes elegidas

El prototipo construyó las dos versiones de cuatro decisiones de §3 y las dejó conmutables. Elegidas por Iñaki:

| Decisión | Elegida | Descartada |
|---|---|---|
| La lista | **Tabla** | Tarjetas |
| El alta | **Una sola hoja** | Por pasos |
| Los cuatro roles | **Fichas** | Renglones |
| Poner «s/d» | **Botón al lado** | Casilla «no se sabe» |

Las otras cinco preguntas de §3 las resolvió el diseño: ver y editar en una sola pantalla con edición campo por campo; crear al vuelo como combo con buscador; el aviso que se cierra eligiendo entre «es un caso real» y «hay que corregirlo», reabrible; el vacío con su propia pantalla; y la raíz redirigiendo a `/compras`.

---

## Lo que el diseño muestra y todavía no tiene dónde vivir

Anotado acá para que no se pierda ni se implemente inventando el dato.

- **La resolución del aviso** («es real» / «hay que corregir», reabrible) es estado persistente y no existe tabla para guardarlo. Llega con el módulo 2, junto con las tropas — sin ellas el aviso no puede dispararse.
- **«Cargada el 25/08/2026 · oficina»** — hay `creadoEn` y `actualizadoEn`, pero ninguna atribución de usuario. Depende de la decisión #4 (roles), sin resolver. Hasta entonces se muestran las fechas sin atribución: poner «oficina» fijo sería inventar un dato.
