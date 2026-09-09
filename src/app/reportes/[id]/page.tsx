import { ArranqueComprador } from "@/componentes/ArranqueComprador";
import { DetalleReporte } from "@/componentes/comprador/DetalleReporte";
import { Marco } from "@/componentes/comprador/Marco";

export const dynamic = "force-dynamic";

/**
 * El id sale de la URL, no de la sesión: la cáscara sigue sin traer ningún dato
 * de la persona. El reporte lo pide el cliente a `/api/reportes/[id]`, que es
 * donde se comprueba que sea suyo.
 */
export default async function PaginaReporte({ params }: PageProps<"/reportes/[id]">) {
  const { id } = await params;
  return (
    <Marco>
      <ArranqueComprador />
      <DetalleReporte id={Number(id)} />
    </Marco>
  );
}
