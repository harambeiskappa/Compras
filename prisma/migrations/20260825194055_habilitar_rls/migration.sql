-- Habilita Row Level Security en las 14 tablas del schema public, SIN crear
-- ninguna política.
--
-- Por qué: Supabase expone automáticamente todo el schema `public` por su API
-- REST (PostgREST), y la anon key que la abre es pública por diseño — va en el
-- browser. Sin RLS, cualquiera con esa key puede leer y escribir las 14 tablas.
-- El dashboard lo reporta como 14 issues CRITICAL «RLS Disabled in Public».
--
-- Sin políticas, RLS deniega todo: es exactamente lo que se busca, porque la
-- app no usa PostgREST para nada. Si algún día se usa, hay que agregar las
-- políticas explícitamente — que es el orden correcto (denegar por defecto y
-- abrir a propósito), no al revés.
--
-- Por qué NO afecta a Prisma: se conecta con el rol `postgres`, que es el dueño
-- de las 14 tablas, y el dueño de una tabla no pasa por RLS. Eso deja de valer
-- si alguna vez se agrega FORCE ROW LEVEL SECURITY — no se usa acá a propósito.

-- `_prisma_migrations` va guardada por un chequeo de existencia a propósito:
-- Prisma valida cada migración replayándola contra una shadow database, y ahí
-- esa tabla no existe como tabla de usuario, así que un ALTER pelado hace
-- fallar la validación con «relation "_prisma_migrations" does not exist»
-- (error 42P01) y la migración no se aplica nunca. Con el guard, el shadow lo
-- saltea y la base real sí lo ejecuta. La tabla también la expone PostgREST y
-- filtra el historial de migraciones, así que entra en el lote.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = '_prisma_migrations'
  ) THEN
    EXECUTE 'ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY';
  END IF;
END
$$;

ALTER TABLE "adjunto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "carga" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categoria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categoria_sinonimo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "compra" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consignatario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "empresa" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hotelero" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "persona_compradora" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prefijo_tropa" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tropa" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vendedor" ENABLE ROW LEVEL SECURITY;
