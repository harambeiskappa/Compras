-- RLS en las dos tablas del padrón único.
--
-- `entidad` y `entidad_rol` nacieron sin RLS, mientras que los cinco catálogos
-- que reemplazan sí lo tenían: la migración del padrón dejó dos tablas nuevas
-- expuestas por la API REST de Supabase, que es lo que la migración
-- `habilitar_rls` había cerrado para las 14 anteriores.
--
-- Sin políticas, RLS deniega todo por PostgREST y no afecta a Prisma, que
-- conecta con el rol dueño de las tablas. Igual que las demás.
--
-- Para acordarse: cada tabla nueva necesita su ALTER. No es automático.

ALTER TABLE "entidad" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entidad_rol" ENABLE ROW LEVEL SECURITY;
