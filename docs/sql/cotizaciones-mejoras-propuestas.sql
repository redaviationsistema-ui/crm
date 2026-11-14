-- COTIZACIONES: propuesta de endurecimiento para revisión manual en Supabase.
--
-- NO EJECUTAR SIN ADAPTARLA AL ESQUEMA Y A LAS FUNCIONES PUBLICADAS EN STAGING.
-- No crea ni altera objetos: las consultas activas son únicamente de inspección.
-- Las secciones posteriores describen el SQL que debe incorporarse en las RPC
-- existentes crear_cotizacion y actualizar_cotizacion; no deben aplicarse a
-- producción ni sustituir las funciones sin una revisión del propietario.

-- 1. Confirmar las firmas reales, configuración segura y privilegios antes de editar.
select
  p.oid::regprocedure as firma,
  p.prosecdef as security_definer,
  p.proconfig as configuracion,
  pg_get_function_result(p.oid) as retorno,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('crear_cotizacion', 'actualizar_cotizacion')
order by p.oid::regprocedure::text;

-- 2. Confirmar la semántica exacta de conceptos y la precisión de las columnas.
select table_name, column_name, data_type, udt_name, is_nullable,
       numeric_precision, numeric_scale, column_default, is_generated
from information_schema.columns
where table_schema = 'public'
  and table_name in ('cotizaciones', 'cotizacion_conceptos')
order by table_name, ordinal_position;

-- 3. Confirmar que ningún rol de navegador escribe directamente. Las escrituras
-- deben seguir concentradas en las RPC autorizadas.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('cotizaciones', 'cotizacion_conceptos')
  and grantee in ('anon', 'authenticated', 'public')
order by table_name, grantee, privilege_type;

-- ============================================================================
-- REQUISITOS QUE DEBE INCORPORAR EL CUERPO DE AMBAS RPC (NO EJECUTABLES AQUÍ)
-- ============================================================================
--
-- A. Autorización y contexto
--    * Fijar search_path a '' en SECURITY DEFINER y calificar todos los objetos
--      como public.<tabla> o crm_internal.<función>.
--    * Derivar actor exclusivamente de auth.uid(); rechazar NULL, perfil inactivo
--      o rol fuera de administrador/supervisor/ejecutivo.
--    * Administrador: oportunidad accesible. Supervisor/ejecutivo: solo si es
--      creado_por o responsable de la oportunidad. Repetir esta comprobación
--      dentro de la transacción, no confiar en filtros del navegador.
--    * Revocar EXECUTE de anon y PUBLIC; otorgar únicamente a authenticated.
--
-- B. p_conceptos (jsonb)
--    * Exigir arreglo JSON de 1 a 100 elementos.
--    * Por cada elemento, aceptar solamente las claves orden, descripcion,
--      cantidad y precio_unitario; rechazar claves adicionales, NULL, tipos
--      incorrectos, orden no consecutivo, descripción vacía, cantidad <= 0 y
--      precio_unitario < 0.
--    * Convertir mediante jsonb_to_recordset a numeric con la precisión que
--      confirme la consulta 2. No convertir importes derivados enviados por el
--      cliente: calcular importe en PostgreSQL para cada concepto.
--    * Insertar/reemplazar conceptos y cabecera en la misma transacción. Ante
--      cualquier error, no dejar una cabecera sin sus líneas.
--
-- C. actualizar_cotizacion y concurrencia
--    * Resolver la cabecera objetivo con SELECT ... FOR UPDATE.
--    * Permitir actualización solamente cuando estado = 'borrador'; preservar
--      oportunidad_id y creado_por.
--    * Para concurrencia optimista, añadir una versión de contrato explícita
--      (por ejemplo p_fecha_actualizacion_original timestamptz) y exigir que
--      coincida antes de actualizar. Si no coincide, lanzar un error de
--      conflicto SQLSTATE 40001 o uno documentado por el contrato JSON.
--    * Actualizar fecha_actualizacion exclusivamente en servidor.
--
-- D. Auditoría
--    * Registrar actor JWT, cotización, evento (creada/actualizada), instante,
--      estado anterior/nuevo y un resumen no sensible de la modificación.
--    * No incluir secretos, JWT ni datos de tarjetas. Antes de añadir INSERT,
--      confirmar con el propietario el nombre y las columnas de la tabla de
--      auditoría existente; este repositorio no inventa una nueva tabla.
--    * La escritura de auditoría debe pertenecer a la misma transacción que la
--      cabecera y los conceptos.
--
-- E. Respuesta y errores
--    * Retornar únicamente el UUID de la cotización confirmada.
--    * Usar SQLSTATE explícitos para autorización, validación y conflicto;
--      el frontend ya distingue rechazos explícitos de resultados inciertos y
--      relee la cotización antes de declararla guardada.
--
-- Pruebas manuales obligatorias posteriores en STAGING:
--   1) JWT de administrador, supervisor propio, ejecutivo propio y ajeno.
--   2) Conceptos límite 1/100, orden duplicado, cantidad cero y precio negativo.
--   3) Dos ediciones simultáneas del mismo borrador.
--   4) Rechazo de UPDATE/INSERT directos para authenticated.
--   5) Auditoría creada en la misma transacción y reversión completa ante error.
