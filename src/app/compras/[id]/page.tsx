import Link from "next/link";
import { notFound } from "next/navigation";

import { urlFirmada } from "@/lib/almacenamiento";
import { sinonimosConocidos } from "@/lib/categorias";
import { prisma } from "@/lib/prisma";
import { DetalleCompra } from "@/componentes/DetalleCompra";
import { PanelReporte } from "@/componentes/compra/PanelReporte";
import { Renglones } from "@/componentes/compra/Renglones";
import { TropasYCargas } from "@/componentes/compra/TropasYCargas";

export const dynamic = "force-dynamic";

export default async function PaginaDetalle({ params }: PageProps<"/compras/[id]">) {
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero)) notFound();

  const c = await prisma.compra.findUnique({
    where: { id: numero },
    select: {
      id: true,
      fecha: true,
      plazaLugar: true,
      observaciones: true,
      creadoEn: true,
      actualizadoEn: true,
      consignatario: { select: { id: true, nombre: true } },
      empresaTitular: { select: { id: true, nombre: true } },
      vendedor: { select: { id: true, nombre: true } },
      hotelero: { select: { id: true, nombre: true } },
      personaCompradora: { select: { id: true, nombre: true } },
      creadoPorUsuario: { select: { nombre: true } },
      empresaTitularId: true,
      tropas: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          nroTropa: true,
          fecha: true,
          empresaCompradoraId: true,
          empresaCompradora: { select: { nombre: true } },
          _count: { select: { lotes: true, cargas: true } },
        },
      },
      cargas: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          tropaId: true,
          dte: true,
          transportista: true,
          patente: true,
          fechaSalida: true,
          cabezas: true,
        },
      },
      lotes: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          cabezas: true,
          kilosLiquidados: true,
          precio: true,
          modalidadPrecio: true,
          comision: true,
          comisionModalidad: true,
          establecimientoId: true,
          tropaId: true,
          categoriaSinonimo: {
            select: {
              texto: true,
              categoriaCanonica: { select: { codigo: true, descripcion: true } },
            },
          },
        },
      },
      reporte: {
        select: {
          id: true,
          fecha: true,
          consignatarioTexto: true,
          plazaTexto: true,
          cabezasAproximadas: true,
          cantidadCamiones: true,
          observaciones: true,
          cargadoEn: true,
          recibidoEn: true,
          creadoPorUsuario: { select: { usuario: true } },
          personaCompradora: { select: { nombre: true } },
          adjuntos: {
            orderBy: { id: "asc" },
            select: { id: true, url: true, numero: true, nota: true },
          },
        },
      },
    },
  });

  if (!c) notFound();

  const compra = {
    id: c.id,
    fecha: c.fecha.toISOString().slice(0, 10),
    consignatario: c.consignatario,
    empresaTitular: c.empresaTitular,
    vendedor: c.vendedor,
    hotelero: c.hotelero,
    personaCompradora: c.personaCompradora,
    plazaLugar: c.plazaLugar,
    observaciones: c.observaciones,
    creadoEn: c.creadoEn.toISOString(),
    actualizadoEn: c.actualizadoEn.toISOString(),
    // Nullable a propósito: lo cargado antes de que existieran las cuentas no
    // tiene autor, y eso es «s/d». Poner «oficina» fijo sería inventar el dato.
    creadoPor: c.creadoPorUsuario?.nombre ?? null,
  };

  const establecimientos = await prisma.establecimiento.findMany({
    where: { activo: true },
    // Por USO y no alfabético: El Haras concentra la mayor parte del stock y un
    // orden por nombre lo entierra, igual que a Darwash en los consignatarios.
    // Es la tercera vez que aparece esta misma regla en el proyecto.
    select: { id: true, nombre: true, _count: { select: { lotes: true } } },
  });
  establecimientos.sort(
    (a, b) => b._count.lotes - a._count.lotes || a.nombre.localeCompare(b.nombre, "es")
  );

  const empresas = await prisma.entidad.findMany({
    where: { esPropio: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });

  const sinonimos = await sinonimosConocidos();

  const renglones = c.lotes.map((l) => ({
    id: l.id,
    categoriaTexto: l.categoriaSinonimo.texto,
    categoriaCodigo: l.categoriaSinonimo.categoriaCanonica?.codigo ?? null,
    categoriaDescripcion: l.categoriaSinonimo.categoriaCanonica?.descripcion ?? null,
    cabezas: l.cabezas,
    // Decimal → number para poder mandarlo al cliente. Los montos de esta app
    // están muy lejos del límite de precisión de un double.
    kilosLiquidados: l.kilosLiquidados === null ? null : Number(l.kilosLiquidados),
    precio: l.precio === null ? null : Number(l.precio),
    modalidadPrecio: l.modalidadPrecio,
    comision: l.comision === null ? null : Number(l.comision),
    comisionModalidad: l.comisionModalidad,
    establecimientoId: l.establecimientoId,
    tropaId: l.tropaId,
  }));

  const tropas = c.tropas.map((t) => ({
    id: t.id,
    empresa: t.empresaCompradora.nombre,
    empresaId: t.empresaCompradoraId,
    nroTropa: t.nroTropa,
    fecha: t.fecha ? t.fecha.toISOString().slice(0, 10) : null,
    lotes: t._count.lotes,
    cargas: t._count.cargas,
  }));

  /*
   * EL AVISO DE EMPRESA TITULAR: SEÑALA, NUNCA BLOQUEA.
   *
   * La titular puede cambiar legítimamente entre la compra y la liquidación —
   * se define comprar para BUL y se termina liquidando a PEGSA, que están muy
   * vinculadas. Medido: 9 de 120 compras del último año lo hacen. Bloquearlo
   * impediría un caso real, así que la app lo dice y una persona decide.
   *
   * Solo tiene sentido cuando hay tropas contra las cuales comparar: sin
   * tropas no hay nada que avisar, y un cartel permanente se vuelve invisible.
   */
  const titularFuera =
    tropas.length > 0 && !tropas.some((t) => t.empresaId === c.empresaTitularId);

  const reporte = c.reporte
    ? {
        id: c.reporte.id,
        fecha: c.reporte.fecha ? c.reporte.fecha.toISOString().slice(0, 10) : null,
        consignatario: c.reporte.consignatarioTexto,
        plaza: c.reporte.plazaTexto,
        cabezas: c.reporte.cabezasAproximadas,
        camiones: c.reporte.cantidadCamiones,
        observaciones: c.reporte.observaciones,
        cargadoEn: c.reporte.cargadoEn.toISOString(),
        recibidoEn: c.reporte.recibidoEn.toISOString(),
        cuenta: c.reporte.creadoPorUsuario?.usuario ?? null,
        personaCompradora: c.reporte.personaCompradora?.nombre ?? null,
        adjuntos: await Promise.all(
          c.reporte.adjuntos.map(async (a) => ({
            id: a.id,
            numero: a.numero,
            nota: a.nota,
            url: await urlFirmada(a.url),
          }))
        ),
      }
    : null;

  /*
   * EL ID ES UN IDENTIFICADOR, NO UN CONTADOR.
   *
   * Sale de una secuencia de Postgres, y una secuencia entrega números aunque
   * el INSERT después falle: un rechazo de validación, una constraint que salta
   * o una transacción abortada consumen su número igual. Van a aparecer huecos,
   * y no son un error ni un dato perdido.
   *
   * Leer «#47» como «llevamos 47 compras» es sacar un número inventado — y esta
   * pantalla lo muestra grande, así que la confusión es fácil. Para contar
   * compras se cuentan las filas, que es lo que hace el «N cargadas» de la lista.
   */
  const [a, m, d] = compra.fecha.split("-");

  return (
    <main style={{ maxWidth: 1220, margin: "0 auto", padding: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 18,
          paddingBottom: 16,
          borderBottom: "2px solid var(--tinta)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <Link
            href="/compras"
            style={{
              font: "400 13px var(--font-plex-mono), monospace",
              color: "var(--tinta-suave)",
              textDecoration: "none",
            }}
          >
            ← Compras
          </Link>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "baseline",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <h1
              style={{
                margin: 0,
                font: "600 26px/1.1 var(--font-plex-mono), monospace",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {d}/{m}/{a}
            </h1>
            <div
              style={{
                font: "400 22px/1.2 var(--font-plex-sans), sans-serif",
                color: "var(--tinta-media)",
              }}
            >
              {compra.consignatario.nombre} · {compra.empresaTitular.nombre}
            </div>
            <span
              style={{
                font: "400 13px/1 var(--font-plex-mono), monospace",
                color: "var(--tinta-fantasma)",
              }}
            >
              #{compra.id}
            </span>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            font: "400 13px/1.45 var(--font-plex-sans), sans-serif",
            color: "var(--tinta-suave)",
            textAlign: "right",
            maxWidth: "20em",
          }}
        >
          Se ve y se edita acá mismo: se toca el dato y se cambia. No hay otra
          pantalla.
        </div>
      </div>

      {/*
        EL AVISO DE EMPRESA TITULAR: SEÑALA, NUNCA BLOQUEA. Ahora sí hay contra
        qué compararlo — las tropas existen desde el módulo 2 — así que el
        cartel que el módulo 1 dejó pendiente aparece acá.
      */}
      {titularFuera && (
        <div
          role="status"
          style={{
            marginTop: 18,
            padding: "12px 14px",
            background: "var(--aviso-claro)",
            border: "1px solid var(--aviso-borde)",
            borderLeft: "4px solid var(--aviso)",
            borderRadius: 2,
            font: "400 14px/1.55 var(--font-plex-sans), sans-serif",
          }}
        >
          <strong>{compra.empresaTitular.nombre}</strong> es la empresa titular,
          pero no figura entre las de las tropas
          {" ("}
          {[...new Set(tropas.map((t) => t.empresa))].join(", ")}
          {"). "}
          Puede ser correcto: la titular cambia legítimamente entre la compra y
          la liquidación, y pasa en 9 de cada 120 compras. Se guarda igual — esto
          es un aviso, no un bloqueo.
        </div>
      )}

      {reporte ? (
        <div
          style={{
            marginTop: 24,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 320px",
            gap: 26,
            alignItems: "start",
          }}
        >
          <div>
            <DetalleCompra compra={compra} />
            <TropasYCargas
              compraId={compra.id}
              tropas={tropas}
              cargas={c.cargas.map((x) => ({
                id: x.id,
                tropaId: x.tropaId,
                dte: x.dte,
                transportista: x.transportista,
                patente: x.patente,
                fechaSalida: x.fechaSalida ? x.fechaSalida.toISOString().slice(0, 10) : null,
                cabezas: x.cabezas,
              }))}
              empresas={empresas}
            />
            <Renglones
              compraId={compra.id}
              renglones={renglones}
              establecimientos={establecimientos.map((e) => ({ id: e.id, nombre: e.nombre }))}
              tropas={tropas.map((t) => ({
                id: t.id,
                etiqueta: `${t.empresa}${t.nroTropa ? ` · ${t.nroTropa}` : ""}`,
              }))}
              sinonimos={sinonimos}
              cabezasDelReporte={reporte.cabezas}
            />
          </div>
          <PanelReporte reporte={reporte} />
        </div>
      ) : (
        <>
          <DetalleCompra compra={compra} />
          <TropasYCargas
            compraId={compra.id}
            tropas={tropas}
            cargas={c.cargas.map((x) => ({
              id: x.id,
              tropaId: x.tropaId,
              dte: x.dte,
              transportista: x.transportista,
              patente: x.patente,
              fechaSalida: x.fechaSalida ? x.fechaSalida.toISOString().slice(0, 10) : null,
              cabezas: x.cabezas,
            }))}
            empresas={empresas}
          />
          <Renglones
            compraId={compra.id}
            renglones={renglones}
            establecimientos={establecimientos.map((e) => ({ id: e.id, nombre: e.nombre }))}
            tropas={tropas.map((t) => ({
              id: t.id,
              etiqueta: `${t.empresa}${t.nroTropa ? ` · ${t.nroTropa}` : ""}`,
            }))}
            sinonimos={sinonimos}
            cabezasDelReporte={null}
          />
          {/*
            SIN REPORTE ES EL CASO MAYORITARIO, no algo roto: en más de la mitad
            de las compras los remitos llegan a la oficina directamente. Se dice
            para que la ausencia del panel no se lea como una falla.
          */}
          <p
            style={{
              marginTop: 36,
              paddingTop: 18,
              borderTop: "1px solid var(--borde)",
              font: "400 14px/1.6 var(--font-plex-sans), sans-serif",
              color: "var(--tinta-suave)",
              maxWidth: "44em",
            }}
          >
            Esta compra no salió de un reporte, y es lo más frecuente: en más de
            la mitad de los casos —la feria de Darwash es la mitad de todo— los
            remitos llegan acá directamente y nadie carga nada desde el celular.
          </p>
        </>
      )}
    </main>
  );
}
