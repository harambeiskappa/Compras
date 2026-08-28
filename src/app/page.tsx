import { redirect } from "next/navigation";

/**
 * Lo primero que se hace es encontrar o cargar una compra. Un tablero no
 * tendría qué mostrar todavía: no hay cabezas ni kilos hasta el módulo 2.
 */
export default function Raiz() {
  redirect("/compras");
}
