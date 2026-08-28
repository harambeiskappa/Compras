/*
 * Reemplazo vacío de `server-only`, solo para scripts.
 *
 * `server-only` tira al importarse fuera del runtime de React Server
 * Components. Los scripts de verificación necesitan cargar módulos de servidor
 * de la app sin navegador, así que redirigen ese import acá.
 *
 * NO lo usa la app: en la app la guarda tiene que seguir funcionando.
 */
module.exports = {};
