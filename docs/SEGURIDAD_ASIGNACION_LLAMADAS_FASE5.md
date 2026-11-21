# Seguridad de asignación de llamadas en PostgreSQL

## Dictamen y rutas de escritura

El repositorio permite verificar el contrato cliente. El catálogo, el cuerpo de la RPC y los permisos efectivos de staging siguen pendientes de evidencia autorizada. El código de Administración consulta `public.perfiles` y utiliza `id`, `rol` y `activo`. Para llamadas, Vue usa el nombre REST `llamadas` y la columna `asignado_a`. El esquema real de esa relación, el tipo del identificador, la nulabilidad y las dependencias requieren confirmación. Producción sigue fuera del alcance.

| Ruta | Escritura observada en código | Cobertura de la propuesta |
|---|---|---|
| Programar | INSERT a `llamadas`, payload del adaptador con `asignado_a` | Valida en el destino, también si se usa la API directamente con una sesión autorizada |
| Reasignar | UPDATE de `llamadas.asignado_a` por ID | Valida el nuevo perfil |
| Editar, reprogramar, cancelar | UPDATE a `llamadas` sin enviar responsable | Conserva el responsable previo. Si otro trigger modifica el responsable, se valida el valor final |
| Inicio/finalización | RPC `iniciar_llamada` y `finalizar_llamada` | Revisar los cuerpos. Cualquier actualización de la relación cubierta aplica la misma regla |
| Seguimiento | RPC `crear_seguimiento_llamada` con `p_llamada_padre_id` y `p_asignado_a` | Aplica si la RPC inserta o reasigna en la misma tabla. Si escribe en otra relación, ajustar el diseño antes de aprobar |
| Importación, escrituras SQL y otras RPC | Inventario efectivo pendiente | Identificar todos los destinos y comprobar que ejecutan el trigger y que conservan la autorización existente |

[Servicio CRM](../src/services/crmSupabaseService.js) · [Adaptador](../src/adapters/crmAdapters.js) · [Perfiles administrativos](../supabase/functions/_shared/adminUsuariosPostgres.js)

## Borradores y condiciones de aprobación

- [Migración propuesta](sql/propuesta-validar-responsable-llamadas.sql). Crea `crm_internal.validar_responsable_llamada()` y un trigger por fila en la tabla candidata `public.llamadas`. Lee y bloquea el perfil candidato de `public.perfiles`. La propuesta no actualiza datos históricos ni modifica las RPC existentes.
- [Reversión propuesta](sql/reversion-validar-responsable-llamadas.sql). Elimina exclusivamente los dos objetos propuestos, sin CASCADE. Si surgen dependencias, se detiene para revisión. La reversión retira la protección y conserva los datos ya registrados.
- Antes de aprobar, usar la [consulta de catálogo](sql/inspeccion-supabase-e2e.sql) en staging autorizado. Confirmar esquema de `llamadas`, tipos y FK hacia `perfiles.id`, unicidad de ese ID, posible particionado, definición de `crear_seguimiento_llamada`, demás funciones escritoras y triggers. Revisar si existen altas legítimas sin responsable. El borrador rechaza NULL en altas y cambios a NULL, y permite conservar un NULL previo en ediciones sin cambio. Si hay un flujo autorizado sin asignar, resolver esa compatibilidad antes de aplicar.
- Confirmar existencia y carácter interno de `crm_internal`, rol propietario aprobado, permisos efectivos y RLS de `perfiles` para el bloqueo. El trigger requiere un contexto capaz de comprobar el perfil aun si el actor de llamada no puede leer ese perfil directamente. La función propuesta solo consulta una fila por ID, devuelve un error uniforme y usa nombres calificados y search_path fijo. Revisar ACL efectiva y privilegios por defecto sobre el objeto nuevo para impedir acceso directo de roles cliente. No se proponen nuevos grants de tablas ni cambios en funciones administrativas.
- Comparar grants de tabla y columna, RLS, rol efectivo, propietario, bypass de RLS y checks de actor de las RPC antes/después. Un trigger garantiza elegibilidad cuando se ejecuta. La autorización para escribir la llamada sigue dependiendo de las políticas y de las funciones existentes. Limitar la capacidad de desactivar triggers a los roles operativos privilegiados previstos.

El trigger es AFTER por fila sobre INSERT/UPDATE para comprobar la asignación que queda tras otros triggers BEFORE. La excepción revierte la escritura y los efectos SQL transaccionales. Antes de aprobar, investigar disparadores o RPC que capturen errores, hagan efectos externos o escriban mediante otra ruta. [CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html) · [CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html)

## Concurrencia

`FOR SHARE` sobre la fila de perfil impide cambios de rol, estado o eliminación hasta que termine la transacción que asigna. En READ COMMITTED, si la actualización del perfil obtiene primero el bloqueo, la asignación espera y vuelve a evaluar la fila. Si la asignación confirma primero, el cambio posterior convierte esa asignación en histórica. En aislamientos más altos puede haber un error de serialización. Revisar orden de bloqueos en las RPC que modifican perfiles y llamadas, y comprobar que un timeout, deadlock o rollback no deja una asignación parcial. Las reasignaciones concurrentes con dos ejecutivos válidos mantienen la regla de elegibilidad. La política actual sobre cuál reasignación prevalece requiere revisión aparte. [Bloqueos de fila](https://www.postgresql.org/docs/current/explicit-locking.html)

## Pruebas para staging aislado

Ejecutar exclusivamente tras aprobación. Usar perfiles sintéticos autorizados y llamadas descartables. Registrar actor lógico, respuesta, fila e historial antes y después. Probar con la API de staging y el mismo rol de usuario, además del formulario.

| Caso | Operación | Resultado exigido |
|---|---|---|
| 1 | INSERT directo y RPC de seguimiento con ejecutivo activo | Asignación y vínculo de padre verificados en lectura independiente |
| 2 | INSERT, UPDATE y seguimiento con ejecutivo inactivo, supervisor, administrador, ID inexistente o NULL | Rechazo sin cambio persistido. Un ID inexistente relacionado por FK puede rechazarse antes del trigger |
| 3 | Editar motivo o fecha de una asignación histórica no elegible | Operación permitida si la política actual la admite. ID histórico intacto |
| 4 | Cambiar histórico a ejecutivo activo y luego intentar cambiarlo a supervisor | Cambio válido persiste. El segundo se rechaza y mantiene el responsable válido |
| 5 | Dos sesiones. Una desactiva o cambia rol antes de confirmar y la otra intenta asignar | La segunda espera y se rechaza tras el commit del cambio. Con rollback del cambio puede proceder |
| 6 | Orden inverso y dos asignaciones sobre la misma llamada | Asignación válida en su commit, cambio de perfil posterior permitido y consistencia por fila. Sin estados parciales |
| 7 | Ejecutivo sin permiso sobre fila ajena, supervisor dentro/fuera de ámbito y administrador según autorización | Resultado igual a RLS/grants previos. Un responsable elegible no concede privilegios de escritura |
| 8 | Reversión en entorno descartable | Se retiran solo los objetos propuestos. Datos, RPC y políticas permanecen |

**Estado actual.** No se ejecutó la migración propuesta, la reversión ni una mutación remota. El criterio de aceptación de backend sigue pendiente de verificar en staging. Los riesgos principales son un destino de seguimiento distinto, una RPC privilegiada con reglas de actor insuficientes, caminos con triggers deshabilitados y flujos legítimos sin responsable. La evidencia mínima para continuar es el catálogo redactado de staging y el cuerpo de la RPC de seguimiento y los triggers relevantes.
