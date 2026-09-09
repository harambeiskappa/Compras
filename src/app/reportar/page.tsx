import { ArranqueComprador } from "@/componentes/ArranqueComprador";
import { FormularioReporte } from "@/componentes/comprador/FormularioReporte";
import { Marco } from "@/componentes/comprador/Marco";

export const dynamic = "force-dynamic";

/**
 * CÁSCARA SIN DATOS DE LA PERSONA, y eso es una condición, no una casualidad.
 *
 * El service worker cachea el HTML de esta ruta para que la pantalla abra sin
 * red. Si acá se renderizara algo de quien está adentro —el nombre, sus
 * reportes— ese dato quedaría guardado en el disco del navegador y sobreviviría
 * al logout. Todo lo que se ve se llena en el cliente, desde IndexedDB y desde
 * `/api`. Ver `public/sw.js`.
 *
 * La sesión igual se exige: el proxy no deja llegar acá sin cookie válida.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ Y LA CONSECUENCIA, QUE NO ES UN BUG: servida desde el cache del service  │
 * │ worker, esta pantalla ABRE SIN SESIÓN. Está bien. No tiene ningún dato,  │
 * │ y traerlos exige la cookie — `/api/catalogos` y `/api/reportes/*`        │
 * │ devuelven 401 sin ella.                                                  │
 * │                                                                          │
 * │ NO «arreglar» esto renderizando la sesión acá: eso metería el nombre de  │
 * │ la persona en un HTML que queda guardado en el disco del navegador y     │
 * │ sobrevive al logout.                                                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export default function PaginaReportar() {
  return (
    <Marco>
      <ArranqueComprador />
      <FormularioReporte />
    </Marco>
  );
}
