-- Consultas de solo lectura para ejecutar manualmente en staging.
-- No contienen escrituras. No ejecutar desde esta tarea ni contra producción.

-- 1) Embudos, etapas y conteo de oportunidades por etapa.
select
  e.id as embudo_id,
  e.nombre as embudo,
  e.activo as embudo_activo,
  et.id as etapa_id,
  et.nombre as etapa,
  et.orden,
  et.tipo,
  et.activo as etapa_activa,
  count(o.id) as oportunidades_asociadas
from public.embudos e
left join public.etapas et on et.embudo_id = e.id
left join public.oportunidades o on o.etapa_id = et.id
group by e.id, e.nombre, e.activo, et.id, et.nombre, et.orden, et.tipo, et.activo
order by e.nombre, et.orden nulls first, et.nombre;

-- 2) Conteo de oportunidades cuya etapa no pertenece a su embudo.
select count(*) as oportunidades_con_etapa_inconsistente
from public.oportunidades o
where not exists (
  select 1
  from public.etapas et
  where et.id = o.etapa_id
    and et.embudo_id = o.embudo_id
);

-- 3) Columnas de tablas relacionadas con cotizaciones, sin leer registros comerciales.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name ilike '%cotiz%'
order by table_name, ordinal_position;

-- 4) Claves foráneas que relacionan oportunidades, contactos, llamadas y cotizaciones.
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as tabla_referenciada,
  ccu.column_name as columna_referenciada,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_schema = kcu.constraint_schema
 and tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_schema = tc.constraint_schema
 and ccu.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and (
    tc.table_name in ('prospectos', 'oportunidades', 'embudos', 'etapas', 'llamadas', 'eventos_oportunidad')
    or tc.table_name ilike '%cotiz%'
  )
order by tc.table_name, tc.constraint_name, kcu.ordinal_position;

-- 5) RPCs del flujo comercial: firmas y modo SECURITY DEFINER.
select
  p.proname as funcion,
  pg_get_function_identity_arguments(p.oid) as argumentos,
  pg_get_function_result(p.oid) as resultado,
  p.prosecdef as security_definer,
  p.proconfig as configuracion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname in ('crear_oportunidad', 'actualizar_oportunidad', 'crear_seguimiento_llamada')
    or p.proname ilike '%cotiz%'
  )
order by p.proname;

-- 6) Políticas RLS para las tablas de contacto, oportunidad, llamada e integración de cotizaciones.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (
    tablename in ('prospectos', 'oportunidades', 'embudos', 'etapas', 'llamadas', 'eventos_oportunidad')
    or tablename ilike '%cotiz%'
  )
order by tablename, policyname;

-- 7) Estado RLS de las tablas relevantes, incluso si todavía no tienen políticas.
select
  n.nspname as esquema,
  c.relname as tabla,
  c.relrowsecurity as rls_habilitado,
  c.relforcerowsecurity as rls_forzado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and (
    c.relname in ('prospectos', 'oportunidades', 'embudos', 'etapas', 'llamadas', 'eventos_oportunidad')
    or c.relname ilike '%cotiz%'
  )
order by c.relname;

-- 8) Privilegios de tabla otorgados a roles, sin consultar filas comerciales.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and (
    table_name in ('prospectos', 'oportunidades', 'embudos', 'etapas', 'llamadas', 'eventos_oportunidad')
    or table_name ilike '%cotiz%'
  )
order by table_name, grantee, privilege_type;
