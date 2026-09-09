"use client";

/**
 * Lo primero que ve el comercial cuando todavía no cargó nada.
 *
 * Tres pasos numerados y nada más. No es un tutorial: es la respuesta a «¿qué
 * se supone que tengo que hacer acá?», que es la única pregunta que alguien
 * tiene la primera vez. La tercera línea es la que importa en el campo — que
 * sin señal funciona igual — y por eso está y no se da por sabida.
 */
export function Primera({ alEmpezar }: { alEmpezar: () => void }) {
  return (
    <div style={{ paddingTop: 40 }}>
      <div className="rotulo" style={{ color: "var(--tinta-fantasma)" }}>
        Primera vez
      </div>
      <h1
        style={{
          margin: "14px 0 0",
          font: "600 27px/1.2 var(--font-plex-sans), sans-serif",
          letterSpacing: "-.015em",
        }}
      >
        Un reporte es lo que empieza una compra.
      </h1>

      <ol style={{ margin: "26px 0 0", padding: 0, listStyle: "none" }}>
        <Paso n={1} titulo="Cargás lo grueso">
          Fecha, consignatario, plaza, cabezas aproximadas y camiones. Nada de
          categorías, kilos ni precios: eso lo hace la oficina con el papel
          delante.
        </Paso>
        <Paso n={2} titulo="Sacás fotos de los remitos">
          Es lo que no puede faltar. El número de cada remito, si lo tenés a
          mano; si no, lo lee la oficina de la foto.
        </Paso>
        <Paso n={3} titulo="Mandás, y listo">
          <strong>Sin señal funciona igual.</strong> Queda guardado en el
          teléfono y sale solo cuando haya conexión — podés cerrar la app e irte
          de la feria.
        </Paso>
      </ol>

      <button
        type="button"
        onClick={alEmpezar}
        style={{
          width: "100%",
          marginTop: 30,
          padding: "16px 20px",
          font: "600 17px var(--font-plex-sans), sans-serif",
          color: "var(--papel)",
          background: "var(--verde)",
          border: "1px solid var(--verde-hondo)",
          borderRadius: 3,
          cursor: "pointer",
        }}
      >
        Cargar el primero
      </button>
    </div>
  );
}

function Paso({
  n,
  titulo,
  children,
}: {
  n: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <li style={{ display: "flex", gap: 14, marginBottom: 22 }}>
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: "var(--verde-claro)",
          border: "1px solid var(--verde-borde)",
          color: "var(--verde)",
          font: "600 14px var(--font-plex-mono), monospace",
        }}
      >
        {n}
      </span>
      <div>
        <div style={{ font: "600 16px/1.3 var(--font-plex-sans), sans-serif" }}>
          {titulo}
        </div>
        <p
          style={{
            margin: "5px 0 0",
            font: "400 14px/1.55 var(--font-plex-sans), sans-serif",
            color: "var(--tinta-media)",
          }}
        >
          {children}
        </p>
      </div>
    </li>
  );
}
