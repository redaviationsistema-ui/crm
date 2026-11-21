# Diagnóstico de Supabase para la reprogramación de llamadas

20 de noviembre de 2026

**Causa confirmada en el contrato actual.** El cliente envía `fecha_programada` y `fecha_actualizacion` en la misma actualización de `public.llamadas`. El rol `authenticated` solo tiene UPDATE confirmado sobre la primera. La segunda hace que PostgreSQL rechace la sentencia antes de ejecutar los triggers de fila. La revisión de las funciones desplegadas, el historial y la reproducción autenticada en staging sigue pendiente. [Payload actual](../src/services/crmSupabaseService.js) · [Privilegios de UPDATE](https://www.postgresql.org/docs/current/sql-update.html)

## Privilegios y RLS

| Control | Evidencia confirmada o pendiente |
|---|---|
| UPDATE en tabla | `authenticated` carece de UPDATE global según el diagnóstico aportado. Esto es compatible con permisos por columna |
| UPDATE por columna | `fecha_programada` permitido. `fecha_actualizacion` protegido. Cada columna explícita en SET requiere permiso |
| SELECT | Verificar acceso a `id` y columnas usadas por RETURNING. La operación actual encadena `.select().single()` y solicita la representación |
| RLS | Habilitada. Se informó que existen políticas para administradores, supervisores, creadores y responsables. Revisar expresiones USING/WITH CHECK, política SELECT, composición permisiva/restrictiva y alcance efectivo por fila |
| RPC de seguimiento | `crear_seguimiento_llamada` fue reportada como SECURITY DEFINER. La reprogramación actual es un UPDATE directo. La identidad, los grants y las comprobaciones de actor de la RPC siguen por verificar |
| Historial | Triggers de creación y actualización reportados. Pendientes definiciones, permisos INSERT, RLS, dueño, restricciones y contexto real de ejecución |

Un UPDATE autorizado por columna todavía puede afectar cero filas si RLS excluye el registro. El cliente que exige una sola fila puede reportar un error de cardinalidad diferente de 42501. Una condición WITH CHECK, un permiso SELECT faltante o una escritura secundaria pueden producir otro rechazo. [RLS en PostgreSQL](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

## Triggers y metadatos pendientes

| Objeto | Inspección requerida |
|---|---|
| `trg_llamadas_actualizacion` / `actualizar_fecha_modificacion()` | Confirmar asociación exacta, orden, condición, estado habilitado y si es BEFORE por fila. Si asigna `NEW.fecha_actualizacion` y retorna NEW, no precisa que el rol cliente pueda escribir esa columna directamente. Si ejecuta otro UPDATE, revisar sus privilegios y riesgo de recursión |
| `registrar_cambios_llamada()` | Confirmar columnas observadas, tabla destino, identidad del actor y si usa SECURITY INVOKER o DEFINER. Revisar INSERT primario y efectos de otros triggers del historial |
| `registrar_creacion_llamada()` | Confirmar eventos del trigger y destino. Si solo está ligado a INSERT, queda fuera del UPDATE de reprogramación. Revisar permisos igualmente para descartar efectos indirectos |
| `public.historial_llamadas` | Verificar INSERT de tabla y columnas, RLS efectiva para identidad ejecutora, defaults/secuencias y FK, NOT NULL, CHECK y triggers dependientes |

Tras confirmar la referencia de staging y la autorización de lectura, ejecutar este inventario **sin invocar las funciones**. Revisar y redactar definiciones con valores sensibles antes de compartirlas. La [inspección E2E complementaria](sql/inspeccion-supabase-e2e.sql) cubre restricciones y más metadatos.

```sql
BEGIN TRANSACTION READ ONLY;

SELECT has_table_privilege('authenticated', 'public.llamadas', 'UPDATE') AS update_tabla,
       has_column_privilege('authenticated', 'public.llamadas',
                            'fecha_programada', 'UPDATE') AS update_agenda,
       has_column_privilege('authenticated', 'public.llamadas',
                            'fecha_actualizacion', 'UPDATE') AS update_marca,
       has_table_privilege('authenticated', 'public.llamadas', 'SELECT') AS select_tabla,
       has_table_privilege('authenticated', 'public.historial_llamadas', 'INSERT') AS insert_historial;

SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) AS propietario
FROM pg_class c
WHERE c.oid IN ('public.llamadas'::regclass, 'public.historial_llamadas'::regclass);

SELECT tablename, policyname, roles, cmd, permissive, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('llamadas', 'historial_llamadas')
ORDER BY tablename, policyname;

SELECT t.tgrelid::regclass AS tabla, t.tgname, t.tgenabled, t.tgfoid::regprocedure AS funcion,
       pg_get_triggerdef(t.oid) AS definicion
FROM pg_trigger t
WHERE NOT t.tgisinternal
  AND t.tgrelid IN ('public.llamadas'::regclass, 'public.historial_llamadas'::regclass)
ORDER BY tabla, t.tgname;

SELECT n.nspname AS esquema, p.oid::regprocedure AS firma,
       p.prosecdef, pg_get_userbyid(p.proowner) AS propietario, p.proacl,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS ejecuta_autenticado,
       pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prokind = 'f' AND (
  p.proname IN ('actualizar_fecha_modificacion', 'registrar_cambios_llamada',
                'registrar_creacion_llamada', 'crear_seguimiento_llamada')
  OR p.oid IN (SELECT t.tgfoid FROM pg_trigger t
               WHERE NOT t.tgisinternal
                 AND t.tgrelid IN ('public.llamadas'::regclass, 'public.historial_llamadas'::regclass))
)
ORDER BY esquema, firma;

ROLLBACK;
```

## SQL propuesto y reversión

**Corrección mínima del contrato de escritura, para aprobación posterior.** La sentencia autorizada debe escribir solo la fecha programada. Usar el tipo real de la columna y el ID como parámetros, manteniendo el JWT del usuario. Si el trigger confirma que deriva la marca de modificación, dejar esa derivación en PostgreSQL. Verificar el equivalente de RETURNING de la API con los grants reales. Este SQL representa la operación objetivo; no es una migración.

```sql
UPDATE public.llamadas
SET fecha_programada = $1
WHERE id = $2
RETURNING id, fecha_programada, fecha_actualizacion;
```

**Límite de esta fase.** No hay un ajuste transparente de un trigger que permita al mismo PATCH pasar la comprobación de privilegios sobre dos columnas manteniendo protegido UPDATE directo de la segunda. La corrección mínima requiere que, en una fase aprobada, el emisor deje de incluir `fecha_actualizacion`. No se propone conceder dicho permiso ni cambiar el rol de ejecución del PATCH. Como este plan no altera objetos ni permisos de base de datos, **no hay SQL de reversión para la causa confirmada**. El ajuste del emisor se puede revertir por código, con el efecto de restaurar el 403 del contrato actual.

**Solo si se confirma un segundo 42501 de historial:** la corrección debe abordar la identidad efectiva de la función que inserta. Si la función es INVOKER y el negocio exige historial exclusivamente generado por servidor, evaluar una función de trigger DEFINER con dueño revisado, referencias calificadas y `search_path` fijo, sin INSERT directo para usuarios. No usar elevación como sustituto de una política de alcance. Una función DEFINER existente puede necesitar una corrección diferente, como una política aplicable a su dueño o una dependencia autorizada. No se propone DDL ejecutable ni reversión de historial hasta recuperar la firma, ACL, definición y propietario originales. Un eventual cambio debe guardar ese DDL como reversión y restaurar exactamente atributos, ACL, propietario y trigger en una transacción. [Contexto de triggers](https://www.postgresql.org/docs/current/trigger-definition.html) · [Seguridad de funciones](https://www.postgresql.org/docs/current/sql-createfunction.html)

## Pruebas y aceptación

| Prueba | Resultado |
|---|---|
| PostgreSQL local sintético. UPDATE global false, UPDATE agenda true, UPDATE marca false | Reproducido el patrón de grants |
| UPDATE sintético con fecha programada más fecha de actualización | PostgreSQL rechazó el acceso a `llamadas` |
| UPDATE sintético solo de fecha, con trigger BEFORE que asigna NEW.fecha_actualizacion | Operación exitosa y marca automática presente |
| UPDATE sintético solo de fecha con trigger AFTER INVOKER que inserta en historial sin grant | PostgreSQL rechazó el acceso a `historial_llamadas` y conservó la fecha anterior |
| Supabase staging. Supervisor, administrador y ejecutivo autorizado sobre filas sintéticas | Pendiente. Verificar fecha solicitada, marca automática, un evento de historial coherente y conservación de otros campos |
| Supabase staging. Ejecutivo ajeno, actor no autorizado y PATCH directo al timestamp | Pendiente. Verificar rechazo o cero filas según el contrato, sin cambio persistido ni evento. Incluir la representación devuelta por la API |

Las pruebas locales reprodujeron mecanismos de PostgreSQL, no el catálogo desplegado. El riesgo residual es que el trigger real actualice la marca de otra forma, que el INSERT de historial carezca de privilegios o que la representación solicitada exceda SELECT/RLS. Para cerrar el diagnóstico se necesita el catálogo redactado y las definiciones completas de las funciones involucradas. Para la validación de escrituras se necesita autorización específica y staging aislado con datos sintéticos. No se editó Vue ni se aplicaron cambios remotos.
