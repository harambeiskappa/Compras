/*
 * Service worker: para que la pantalla del comprador ABRA SIN RED.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CUIDADO 1 — QUE UNA VERSIÓN VIEJA NO QUEDE PEGADA PARA SIEMPRE.          │
 * │                                                                          │
 * │ El nombre del cache lleva VERSION. Al activarse, este worker BORRA todo  │
 * │ cache que no sea el suyo, así que subir el número desaloja lo viejo.     │
 * │                                                                          │
 * │ CÓMO SE ACTUALIZA, concretamente: hay que subir VERSION en este archivo  │
 * │ en el mismo commit que cambie algo de la pantalla del comprador. El      │
 * │ navegador revisa `sw.js` en cada carga; si el archivo cambió aunque sea  │
 * │ un byte, instala el nuevo. `skipWaiting` + `clients.claim` hacen que     │
 * │ tome el control sin esperar a que se cierren todas las pestañas — sin    │
 * │ eso, en un celular que nunca cierra la app la versión vieja puede vivir  │
 * │ semanas.                                                                 │
 * │                                                                          │
 * │ Si se olvida subir VERSION: el archivo igual cambia de contenido cuando  │
 * │ cambia la lista de rutas, pero NO cuando solo cambia la pantalla. Por    │
 * │ eso el número es obligatorio y está arriba de todo, a la vista.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CUIDADO 2 — NO SE CACHEAN LAS PÁGINAS AUTENTICADAS NI EL LOGIN.          │
 * │                                                                          │
 * │ Un HTML con datos de una persona guardado en el disco del navegador es   │
 * │ un dato que sobrevive al logout y que la siguiente sesión podría ver.    │
 * │ Y cachear la respuesta del login sería servir un «entraste» viejo a      │
 * │ alguien que ya no tiene sesión.                                          │
 * │                                                                          │
 * │ Por eso SOLO se cachean `/reportar` y `/reportes`, y solo porque esas    │
 * │ dos páginas NO RENDERIZAN NINGÚN DATO DE LA PERSONA del lado del         │
 * │ servidor: son cáscaras que se llenan en el cliente desde IndexedDB y     │
 * │ desde `/api`. Si algún día una de las dos empieza a renderizar datos en  │
 * │ el servidor, HAY QUE SACARLA DE ESTA LISTA.                              │
 * │                                                                          │
 * │ `/api/*` no se cachea nunca: son los datos. `/ingresar`, `/compras`,     │
 * │ `/usuarios` y `/mi-cuenta` tampoco.                                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CONSECUENCIA QUE NO HAY QUE «ARREGLAR»:                                  │
 * │ EL SHELL SE PUEDE CARGAR SIN SESIÓN, Y ESTÁ BIEN.                        │
 * │                                                                          │
 * │ Servido desde este cache, `/reportar` abre aunque la cookie haya vencido │
 * │ o no exista. No es un agujero: la cáscara no tiene NINGÚN dato, y todo   │
 * │ lo que muestra —catálogo, reportes, el reporte por id— sale de `/api`,   │
 * │ que exige la cookie y devuelve 401 sin ella. Lo que se ve sin sesión es  │
 * │ un formulario vacío y lo que ya estaba en ESE teléfono.                  │
 * │                                                                          │
 * │ Quien lo lea como un bug y lo «arregle» renderizando la sesión en el     │
 * │ servidor va a meter datos de una persona en este cache y romper el       │
 * │ logout sin enterarse. El chequeo 7b de `verificar-comprador.ts` se pone  │
 * │ en rojo si eso pasa.                                                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const VERSION = "v1";
const CACHE = `compras-comprador-${VERSION}`;

/** Las dos cáscaras sin datos, y nada más. */
const CASCARAS = ["/reportar", "/reportes"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // `reload` evita que el propio cache HTTP del navegador devuelva una
      // versión vieja justo en el momento de precachear.
      await Promise.allSettled(
        CASCARAS.map((ruta) => cache.add(new Request(ruta, { cache: "reload" })))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

function esCascara(url) {
  return CASCARAS.includes(url.pathname);
}

/** A qué cáscara caer cuando una navegación no llega a la red. */
function cascaraDeRespaldo(url) {
  if (url.pathname.startsWith("/reportes")) return "/reportes";
  if (url.pathname.startsWith("/reportar")) return "/reportar";
  return null;
}

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;

  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;

  // Los datos NUNCA salen del cache. El catálogo se cachea aparte, en
  // IndexedDB, con su fecha a la vista: dos caches del mismo dato se
  // contradicen el día que uno se refresca y el otro no.
  if (url.pathname.startsWith("/api/")) return;

  // Estático de Next: el nombre lleva hash, así que si el contenido cambia
  // cambia la URL. Cache primero, sin revalidar, es seguro y es lo que hace que
  // la pantalla abra instantánea.
  if (url.pathname.startsWith("/_next/static/")) {
    evento.respondWith(
      caches.match(pedido).then(
        (guardado) =>
          guardado ||
          fetch(pedido).then((res) => {
            if (res.ok) {
              const copia = res.clone();
              caches.open(CACHE).then((c) => c.put(pedido, copia));
            }
            return res;
          })
      )
    );
    return;
  }

  if (pedido.mode !== "navigate") return;

  const respaldo = cascaraDeRespaldo(url);
  if (!respaldo) return; // el resto de la app necesita red, y está bien

  // Red primero: con señal siempre gana lo fresco. El cache es la red de
  // seguridad, no la fuente.
  evento.respondWith(
    (async () => {
      try {
        const res = await fetch(pedido);
        if (res.ok && esCascara(url)) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(new Request(url.pathname), copia));
        }
        return res;
      } catch {
        const guardado = await caches.match(respaldo);
        if (guardado) return guardado;
        // Ni red ni cache: se dice qué pasó. Una pantalla en blanco haría
        // pensar que se perdió lo cargado, y no se perdió — está en IndexedDB.
        return new Response(
          "<!doctype html><meta charset=utf-8><title>Sin conexión</title>" +
            "<body style=\"font:16px/1.6 system-ui;padding:32px;max-width:34em\">" +
            "<h1 style=\"font-size:20px\">Sin conexión, y esta pantalla todavía no estaba guardada</h1>" +
            "<p>Lo que ya hayas cargado sigue en el teléfono y se manda solo cuando haya señal. " +
            "Abrí la app una vez con conexión para que quede disponible sin ella.</p>",
          { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      }
    })()
  );
});
