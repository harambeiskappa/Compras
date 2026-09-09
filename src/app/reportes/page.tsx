import { ArranqueComprador } from "@/componentes/ArranqueComprador";
import { ListaReportes } from "@/componentes/comprador/ListaReportes";
import { Marco } from "@/componentes/comprador/Marco";

export const dynamic = "force-dynamic";

/**
 * Cáscara sin datos de la persona, por el mismo motivo que `/reportar`: el
 * service worker guarda este HTML para que la lista abra sin señal.
 *
 * Igual que allá, la consecuencia NO es un bug: desde el cache esta pantalla
 * abre sin sesión, y lo único que muestra es lo que ya está en ESE teléfono —
 * los reportes del servidor los pide `/api/reportes/mios`, que exige la cookie.
 * No renderizar la sesión acá es lo que impide que un dato de alguien quede
 * guardado en el navegador después del logout.
 */
export default function PaginaReportes() {
  return (
    <Marco>
      <ArranqueComprador />
      <ListaReportes />
    </Marco>
  );
}
