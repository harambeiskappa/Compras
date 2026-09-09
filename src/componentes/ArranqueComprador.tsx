"use client";

import { useEffect } from "react";

import { arrancarCola } from "@/lib/dispositivo/cola";

/**
 * Arranca lo del dispositivo: registra el service worker y engancha la cola.
 *
 * Va montado en las pantallas del comprador y no en el layout de toda la app: a
 * la oficina, que trabaja en una computadora con conexión, no le sirve de nada
 * y le agregaría un worker que hay que mantener.
 */
export function ArranqueComprador() {
  useEffect(() => {
    arrancarCola();

    if (!("serviceWorker" in navigator)) return;
    // El scope es la raíz porque las cáscaras que cachea (`/reportar`,
    // `/reportes`) cuelgan de ahí. El archivo vive en /public.
    navigator.serviceWorker.register("/sw.js").catch((e) => {
      // Que no se registre NO puede voltear la pantalla: sin worker la app
      // sigue funcionando con señal, y lo cargado sigue guardándose en
      // IndexedDB, que es lo que de verdad no se puede perder.
      console.warn("No se pudo registrar el service worker:", e);
    });
  }, []);

  return null;
}
