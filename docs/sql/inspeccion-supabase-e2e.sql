-- Ejecutar solo contra staging identificado y con lectura autorizada.
-- Devuelve metadatos. Revisar y redactar expresiones antes de compartir el resultado.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';

SELECT n.nspname AS esquema, p.proname AS funcion,
       pg_get_function_identity_arguments(p.oid) AS identidad,
       pg_get_function_arguments(p.oid) AS argumentos,
       pg_get_function_result(p.oid) AS retorno,
       pg_get_userbyid(p.proowner) AS propietario,
       p.prosecdef AS security_definer, p.provolatile AS volatilidad,
       ARRAY(SELECT opcion FROM unnest(p.proconfig) AS opciones(opcion)
             WHERE opcion LIKE 'search_path=%') AS configuracion_search_path,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS ejecuta_anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS ejecuta_autenticado,
       EXISTS (
         SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) AS permiso
         WHERE permiso.grantee = 0 AND permiso.privilege_type = 'EXECUTE'
       ) AS ejecuta_public,
       has_schema_privilege('authenticated', n.oid, 'USAGE') AS uso_esquema_autenticado
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE p.prokind = 'f'
  AND p.proname IN ('mi_contexto_crm', 'iniciar_llamada', 'finalizar_llamada',
                    'crear_seguimiento_llamada', 'marcar_notificacion_leida',
                    'crear_oportunidad', 'actualizar_oportunidad',
                    'crear_cotizacion', 'actualizar_cotizacion', 'administrar_perfil')
ORDER BY esquema, funcion, identidad;

SELECT n.nspname AS esquema, c.relname AS objeto, c.relkind AS clase,
       pg_get_userbyid(c.relowner) AS propietario, c.reloptions AS opciones,
       c.relrowsecurity AS rls, c.relforcerowsecurity AS rls_forzada,
       rol.nombre AS rol_sql,
       has_table_privilege(rol.nombre, c.oid, 'SELECT') AS puede_leer,
       has_table_privilege(rol.nombre, c.oid, 'INSERT') AS puede_crear,
       has_table_privilege(rol.nombre, c.oid, 'UPDATE') AS puede_editar,
       has_table_privilege(rol.nombre, c.oid, 'DELETE') AS puede_borrar
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
CROSS JOIN (VALUES ('anon'), ('authenticated')) AS rol(nombre)
WHERE c.relkind IN ('r', 'p', 'v', 'm')
  AND ((n.nspname = 'public' AND c.relname IN (
         'perfiles', 'prospectos', 'llamadas', 'historial_llamadas', 'vista_llamadas_detalle',
         'vista_llamadas_hoy', 'vista_llamadas_vencidas', 'catalogo_motivos_llamada',
         'catalogo_resultados_llamada', 'notificaciones', 'imagenes_llamadas',
         'auditoria_usuarios', 'embudos', 'etapas', 'oportunidades', 'eventos_oportunidad',
         'cotizaciones', 'cotizacion_conceptos'))
       OR (n.nspname = 'storage' AND c.relname IN ('objects', 'buckets')))
ORDER BY esquema, objeto, rol_sql;

SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable, is_generated
FROM information_schema.columns
WHERE (table_schema = 'public' AND table_name IN ('perfiles', 'prospectos', 'llamadas',
       'historial_llamadas', 'vista_llamadas_detalle', 'vista_llamadas_hoy', 'vista_llamadas_vencidas'))
ORDER BY table_schema, table_name, ordinal_position;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN ('perfiles', 'prospectos', 'llamadas',
       'historial_llamadas', 'notificaciones', 'imagenes_llamadas', 'auditoria_usuarios',
       'oportunidades', 'cotizaciones', 'cotizacion_conceptos'))
   OR (schemaname = 'storage' AND tablename IN ('objects', 'buckets'))
ORDER BY schemaname, tablename, policyname;

SELECT c.conrelid::regclass AS tabla, c.conname AS restriccion, c.contype AS tipo,
       c.convalidated AS validada, pg_get_constraintdef(c.oid) AS definicion
FROM pg_constraint AS c
WHERE c.conrelid IN (to_regclass('public.llamadas'), to_regclass('public.prospectos'),
                      to_regclass('public.historial_llamadas'), to_regclass('public.perfiles'))
   OR c.confrelid IN (to_regclass('public.llamadas'), to_regclass('public.prospectos'),
                       to_regclass('public.perfiles'))
ORDER BY tabla, restriccion;

SELECT t.tgrelid::regclass AS tabla, t.tgname AS trigger, t.tgenabled AS habilitado,
       t.tgfoid::regprocedure AS funcion, pg_get_triggerdef(t.oid) AS definicion
FROM pg_trigger AS t
WHERE NOT t.tgisinternal
  AND t.tgrelid IN (to_regclass('public.llamadas'), to_regclass('public.historial_llamadas'),
                    to_regclass('public.notificaciones'))
ORDER BY tabla, trigger;

SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE schemaname = 'public' AND tablename IN ('llamadas', 'notificaciones')
ORDER BY pubname, tablename;

SELECT to_regclass('supabase_migrations.schema_migrations') AS registro_migraciones;

ROLLBACK;
