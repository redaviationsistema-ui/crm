-- Consultas SELECT de solo lectura para inspeccionar el contrato de cotizaciones.
-- Ejecutar manualmente únicamente en el proyecto staging confirmado.
-- No leen filas de cotizaciones/contactos ni realizan cambios.

-- 1) Descubrir tablas y columnas relacionadas con cotización/propuesta/presupuesto.
select table_name, ordinal_position, column_name, data_type, udt_name, is_nullable,
       numeric_precision, numeric_scale, character_maximum_length, column_default
from information_schema.columns
where table_schema = 'public'
  and (
    table_name ilike '%cotiz%'
    or table_name ilike '%propuesta%'
    or table_name ilike '%presupuesto%'
    or table_name ilike '%quote%'
  )
order by table_name, ordinal_position;

-- 2) Ver las columnas de las entidades comerciales ya usadas por el CRM.
select table_name, ordinal_position, column_name, data_type, udt_name, is_nullable,
       numeric_precision, numeric_scale
from information_schema.columns
where table_schema = 'public'
  and table_name in ('prospectos', 'oportunidades', 'perfiles')
order by table_name, ordinal_position;

-- 3) Claves foráneas entre entidades de cotización y las entidades existentes.
select tc.table_name, kcu.column_name, ccu.table_name as tabla_referenciada,
       ccu.column_name as columna_referenciada, tc.constraint_name
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
    tc.table_name ilike '%cotiz%'
    or tc.table_name ilike '%propuesta%'
    or tc.table_name ilike '%presupuesto%'
    or tc.table_name ilike '%quote%'
    or (
      ccu.table_name in ('prospectos', 'oportunidades')
      and (
        tc.table_name ilike '%cotiz%'
        or tc.table_name ilike '%propuesta%'
        or tc.table_name ilike '%presupuesto%'
        or tc.table_name ilike '%quote%'
      )
    )
  )
order by tc.table_name, tc.constraint_name, kcu.ordinal_position;

-- 4) Constraints y reglas CHECK de las tablas encontradas por nombre.
select tc.table_name, tc.constraint_name, tc.constraint_type, cc.check_clause
from information_schema.table_constraints tc
left join information_schema.check_constraints cc
  on tc.constraint_schema = cc.constraint_schema
 and tc.constraint_name = cc.constraint_name
where tc.table_schema = 'public'
  and (
    tc.table_name ilike '%cotiz%'
    or tc.table_name ilike '%propuesta%'
    or tc.table_name ilike '%presupuesto%'
    or tc.table_name ilike '%quote%'
  )
order by tc.table_name, tc.constraint_type, tc.constraint_name;

-- 5) Funciones/RPC candidatas: firma, retorno y SECURITY DEFINER; no muestra cuerpos.
select p.proname as funcion,
       pg_get_function_identity_arguments(p.oid) as argumentos,
       pg_get_function_result(p.oid) as resultado,
       p.prosecdef as security_definer,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_puede_ejecutar,
       p.proconfig as configuracion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname ilike '%cotiz%'
    or p.proname ilike '%propuesta%'
    or p.proname ilike '%presupuesto%'
    or p.proname ilike '%quote%'
  )
order by p.proname, argumentos;

-- 6) Confirmar si RLS está habilitada y forzada para las tablas encontradas.
select n.nspname as esquema, c.relname as tabla,
       c.relrowsecurity as rls_habilitado, c.relforcerowsecurity as rls_forzado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and (
    c.relname ilike '%cotiz%'
    or c.relname ilike '%propuesta%'
    or c.relname ilike '%presupuesto%'
    or c.relname ilike '%quote%'
  )
order by c.relname;

-- 7) Políticas RLS de las tablas encontradas.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (
    tablename ilike '%cotiz%'
    or tablename ilike '%propuesta%'
    or tablename ilike '%presupuesto%'
    or tablename ilike '%quote%'
  )
order by tablename, policyname;

-- 8) Privilegios de tabla otorgados a roles.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and (
    table_name ilike '%cotiz%'
    or table_name ilike '%propuesta%'
    or table_name ilike '%presupuesto%'
    or table_name ilike '%quote%'
  )
order by table_name, grantee, privilege_type;
