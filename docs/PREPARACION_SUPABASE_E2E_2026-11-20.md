# Preparación de Supabase para validación E2E

20 de noviembre de 2026 · Sky Group Aviation

**Decisión pendiente de aprobación:** separar desarrollo de producción y levantar una línea base de staging antes de autorizar pruebas con escrituras. Esta fase revisó archivos locales y documentación del proveedor. Los permisos efectivos, la firma desplegada y el comportamiento transaccional permanecen pendientes de evidencia de staging. Las 232 pruebas aprobadas y las tres omitidas corresponden a la validación local anterior.

## Matriz de entornos

| Entorno | Destino verificado en configuración | Riesgo y destino propuesto |
|---|---|---|
| Desarrollo | `hhlicjgpwcesytziacvc` en `src/lib/supabase.js` y `.env.development.local` | **P0.** Comparte destino con producción. Usar Supabase local con esquema revisado y datos sintéticos. Si se necesita desarrollo alojado, usar un tercer proyecto independiente |
| Staging | `cpwknzvrikuapsrsybka` en el cliente y `.env.staging.local`. Escrituras CRM bloqueadas por defecto | Referencia diferenciada. Falta acreditar origen sintético de datos, aislamiento de Auth, Storage y servicios externos, y versión de esquema |
| Producción | `hhlicjgpwcesytziacvc` esperado por el cliente en modo production. `.env` apunta al mismo destino | Reservar credenciales, datos e integraciones para uso productivo. El destino del despliegue efectivo no se inspeccionó |

El bloqueo local de staging aplica solo al proyecto específico y admite excepciones de Auth y algunas RPC. Tratarlo como control del cliente. Para una fase aprobada, definir una lista explícita de destinos por modo y hacer que Vite y el ejecutor E2E fallen antes de abrir sesión si el destino falta, se comparte o coincide con producción. Exigir coincidencia de origen HTTPS exacto en alojados y permitir loopback explícito en desarrollo local. Evitar que un archivo común de Vite suministre producción por defecto al desarrollo. Usar claves públicas distintas por proyecto en frontend y credenciales de CI separadas por ambiente. Revisar además URLs de retorno Auth, correo de prueba, webhooks, publicación Realtime y Storage. [Cliente Supabase](../src/lib/supabase.js) · [Protección staging](../src/lib/stagingWriteProtection.js) · [Guía de entornos de Supabase](https://supabase.com/docs/guides/deployment/managing-environments)

## Inventario de datos, funciones y permisos

El árbol local contiene la Edge Function `admin-usuarios` y módulos compartidos. No se encontró un directorio de migraciones activo ni un `supabase/config.toml` versionado. La ausencia local no prueba ausencia en staging. El diagnóstico previo menciona fallos de resolución de vistas de llamadas. Su estado actual y la exposición del esquema siguen pendientes.

| Objeto previsto | Evidencia local y vínculo esperado | Comprobación efectiva pendiente |
|---|---|---|
| `auth.users`, `perfiles`, `auditoria_usuarios` | Auth identifica actor. Edge verifica perfil activo, ejecutor administra perfiles y consulta auditoría | FK y cascadas, permisos del ejecutor, transacciones, triggers y grants de Auth/Edge |
| `prospectos`, `llamadas`, `historial_llamadas`, catálogos de motivos/resultados | Servicios esperan ID de contacto, creador, responsable, llamada padre y eventos de historial | PK/FK, checks, acciones de borrado, índices, permiso por fila y dependencias que escriben historial |
| Tres vistas de llamadas | Detalle, hoy y vencidas alimentan lista y reportes | Existencia, esquema publicado, definición, opciones de seguridad y visibilidad con el JWT real |
| `notificaciones`, `imagenes_llamadas` y bucket de llamadas | Lecturas por destinatario, suscripciones y operaciones de Storage en código | Grants, RLS propio/ajeno, publicación Realtime, política de objetos y visibilidad del bucket |
| Embudos, etapas, oportunidades y eventos; cotizaciones y conceptos | Adaptadores y configuraciones locales, con persistencia deshabilitada | Inventariar esquema y dependencias sin activar los módulos |

| Función o endpoint | Parámetros o contrato del cliente | Permiso por comprobar |
|---|---|---|
| `mi_contexto_crm` | Sin argumentos en Vue | EXECUTE y contexto de perfil activo |
| `iniciar_llamada` | `p_llamada_id` | Actor, asignación/alcance y estado de origen |
| `finalizar_llamada` | `p_llamada_id`, `p_contesto`, `p_resultado_id`, `p_notas` | EXECUTE, autenticación, ámbito por fila, estado y protección frente a repetición |
| `crear_seguimiento_llamada` | `p_llamada_padre_id`, `p_fecha_programada`, `p_asignado_a`, `p_prioridad`, `p_motivo_id`, `p_motivo_personalizado`, `p_descripcion` | Acceso a llamada padre y autorización de responsable destino |
| `marcar_notificacion_leida` | `p_notificacion_id` | Destinatario autorizado |
| `crear_oportunidad` / `actualizar_oportunidad` | Campos comunes más prospecto/embudo al crear o ID/fecha esperada al editar. Adaptador espera UUID | Identidad, alcance y concurrencia. Inventario exclusivamente |
| `crear_cotizacion` / `actualizar_cotizacion` | Título, descripción, moneda, vigencia, conceptos y referencia de oportunidad o cotización | Identidad, totales y ámbito del registro. Inventario exclusivamente |
| Edge `admin-usuarios` / `crm_internal.administrar_perfil` | Edge valida perfil administrador activo. El ejecutor busca firma `(uuid,uuid,text,boolean)`, retorno void, SECURITY DEFINER y search_path esperado | Configuración desplegada, actor, rol SQL servidor y permisos directos |

La [consulta de inspección](sql/inspeccion-supabase-e2e.sql) se ejecutó correctamente en un PostgreSQL local temporal, en modo monousuario, con roles y una función sintéticos. No se ejecutó en staging. Devuelve firmas por sobrecarga, privilegios SQL, columnas, políticas, FK/checks, triggers y publicación sin leer filas comerciales. Confirmar además los grants por columna, membresías y atributos de los roles SQL, definición de las tres vistas, índices y versiones de migración en el entorno autorizado. Solicitar el cuerpo redactado de `finalizar_llamada`, de las funciones que llama y de los triggers relevantes por un canal controlado. No exportar valores de configuración, secretos ni filas. Registrar referencia, versión, fecha y procedencia del catálogo. [Servicio CRM](../src/services/crmSupabaseService.js) · [Ejecutor PostgreSQL](../supabase/functions/_shared/adminUsuariosPostgres.js) · [Privilegios en PostgreSQL](https://www.postgresql.org/docs/current/functions-info.html)

## Diagnóstico de finalizar_llamada

**Confirmado en cliente:** valida duración opcional en minutos enteros no negativos, preserva cero y llama a la RPC con cuatro argumentos. El adaptador lee `duracion_segundos` y la interfaz puede mostrar minutos. El cliente distingue rechazo, confirmación, fallo de recarga y respuesta incierta. La protección de doble envío es local.

**Pendiente en staging:** esquema y firma efectiva, tipos, argumentos por defecto, retorno, propietario, EXECUTE, modo de seguridad, validación de actor y estado, campos modificados, fuente de duración, bloqueo de fila, eventos/triggers y resultado ante rollback. El cuerpo efectivo es indispensable para determinar si la duración es calculada automáticamente o si existe otra firma que admita entrada manual. Confirmar la visibilidad del estado final y del historial después de una lectura independiente.

**Decisión propuesta:** si la edición manual es un requisito aprobado y la firma actual carece de soporte, añadir una RPC versionada con entrada opcional en minutos enteros y conservar la firma anterior. Si el negocio requiere duración exclusivamente automática, conservar el contrato y acordar el tratamiento del campo visual en una tarea separada. Para la modalidad manual, validar mínimo y máximo compatible con el tipo de almacenamiento antes de convertir a segundos. Cero es explícito y null conserva el comportamiento histórico. Confirmar con negocio si la duración medida y la manual requieren trazabilidad separada antes de elegir una columna. Actualizar estado, valor y evento en una misma transacción. [Servicio](../src/services/crmSupabaseService.js) · [Adaptador de llamadas](../src/adapters/crmAdapters.js) · [CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html)

## Idempotencia y concurrencia

| Escenario | Comportamiento local observado | Comportamiento de servidor exigido |
|---|---|---|
| Segundo clic en el mismo composable | Bloqueado mientras está en curso y después de confirmación/incertidumbre | Una sola transición y un solo registro de evento |
| Dos dispositivos o pestañas independientes | Cada instancia mantiene su propio estado | Serializar por fila de llamada y validar estado al adquirir el bloqueo. Las solicitudes concurrentes con otra clave deben resolver con resultado ya finalizado o conflicto de dominio acordado |
| Timeout HTTP o respuesta perdida después de commit | Resultado incierto y lectura manual. Sin reenvío automático de la mutación desde el flujo | Con clave de operación, recuperar la misma confirmación si hubo commit. Si hubo rollback, permitir una sola ejecución válida al reintentar la misma intención |
| Reintento manual tras recargar la página | El estado en memoria se pierde. Una nueva sesión puede intentar otra solicitud | Aplicar guardia de estado aunque se pierda la clave. Mantener conciliación y acceso autorizado al resultado original |

**Diseño propuesto.** Generar un UUID por intención de finalización y reutilizarlo en reintentos de esa intención. Registrar actor, llamada, clave, huella de la petición normalizada y resultado mínimo, con unicidad de actor y clave. Verificar identidad y alcance también al devolver un resultado previo. Misma clave y misma intención devuelve la confirmación registrada. Misma clave con contenido diferente devuelve conflicto. Claves distintas sobre la misma llamada se resuelven mediante bloqueo y transición condicionada. Si el negocio admite reapertura, usar el estado y versión del ciclo correspondiente. Evitar persistir notas completas en el registro de idempotencia y definir la retención según la ventana de conciliación. Escribir registro, estado e historial atómicamente con orden de bloqueo estable. Si existen efectos externos, revisar si requieren eventos transaccionales y deduplicación propia. [Comportamiento local](../src/composables/useCrm.js) · [Bloqueos en PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html)

## Matriz RLS y autorización E2E

Los roles de aplicación salen de `perfiles.rol`; `authenticated` y `anon` son roles SQL. Los resultados de esta tabla son expectativas que debe aprobar la empresa. El menú actual y los dobles acreditan controles de interfaz y partes del contrato Edge. Todas las celdas de acceso por registro están **pendientes en staging**. Usar dos ejecutivos y fixtures propios, ajenos y sin asignar. Para supervisor, usar registros dentro y fuera del ámbito que se apruebe.

| Actor | Recurso y operación | Caso permitido propuesto | Caso denegado propuesto |
|---|---|---|---|
| Administrador activo | Perfil, auditoría, administración | Operación administrativa dentro de la capacidad asignada | Restricciones existentes de cuenta propia y último administrador. Acciones con cuenta inactiva |
| Administrador activo | Prospectos, llamadas y finalización | Filas dentro del alcance comercial expresamente otorgado | Acciones fuera del alcance otorgado, aunque la ruta aparezca |
| Supervisor activo | Prospectos y llamadas, lectura, asignación y finalización | Registros de su ámbito aprobado y asignación delegada | Registros y responsables fuera del ámbito. Acciones administrativas reservadas |
| Ejecutivo A | Prospectos, llamadas, historial y vistas | Acciones autorizadas sobre registros propios/asignados | Lectura y mutación de registros de Ejecutivo B. Reasignación sin permiso |
| Ejecutivo B | Mismos recursos | Control positivo sobre fixture B | Control inverso sobre fixture A |
| Los tres roles | Notificaciones, adjuntos y Storage | Destinatario o pertenencia autorizada por registro | Lectura, descarga o modificación de registro ajeno |
| Perfil inactivo y anónimo | Vistas, RPC, Storage y Edge | Ningún acceso comercial protegido | Lectura y mutación de fixtures protegidos |

Comprobar en navegador y servicio usando sesiones de usuario y el mismo origen de staging. Registrar códigos y conteos redactados. Para un acceso denegado, distinguir error de permiso y resultado vacío conforme al contrato. Para vistas y RPC, inspeccionar el contexto de ejecución y la identidad del actor además de RLS. Si una función usa SECURITY DEFINER, revisar dueño, search_path, nombres calificados y grants efectivos antes de conceder ejecución. [RLS de PostgreSQL](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

## Plan E2E y criterios de aceptación

**Preparación:** acreditar aislamiento, versión y datos sintéticos. Usar identidades QA ya autorizadas, dos responsables, contactos ficticios, llamadas con ID por caso y marcas de tiempo deterministas. La autorización posterior debe delimitar cada escritura y la limpieza. El ejecutor debe comprobar proyecto y modo antes de abrir sesión. Capturar estado inicial, identificador, actor lógico, acción, lectura independiente, recarga y auditoría. Mantener secretos fuera de las trazas.

| Caso | Acción | Evidencia de aceptación |
|---|---|---|
| 01 · Auth | Iniciar sesión con cada rol y comprobar acceso directo | Sesión y perfil esperados, URL admitida/denegada y cuenta inactiva rechazada |
| 02 · Contactos | Cargar contactos A/B y simular fallo de Llamadas en el cliente de prueba | Contactos sigue disponible y solo muestra filas autorizadas |
| 03 · Alta de llamada | Programar con contacto y motivo sintéticos | ID único, FK y estado inicial corroborados por lectura independiente |
| 04 · Asignación | Asignar y abrir sesión del responsable y de un tercero | Aparición para responsable, denegación según matriz y evento de auditoría si el contrato lo exige |
| 05 · Finalización | Finalizar y repetir con la misma intención desde dos sesiones de prueba | Una transición y un evento, sin sobrescritura por otro resultado |
| 06 · Duración | Probar null, 0, 47, negativo, fracción, límite y fuera de rango | Con contrato aprobado, null conserva regla histórica, 0 se conserva, 47 queda como 2820 segundos si ésa es la unidad confirmada. Rechazos sin cambio parcial |
| 07 · Recarga y respuesta incierta | Simular en el cliente de prueba una respuesta perdida tras obtener confirmación y un fallo de lectura posterior | Estado conciliado por recarga, sin duplicados, sin afirmar éxito antes de que exista evidencia |
| 08 · Permisos por rol | Ejecutar positivos y negativos de la matriz | Vista, servicio y fila persistida coinciden con la autorización aprobada |
| 09 · Fechas | Buscar cerca de medianoche, cambio de día UTC y transición estacional | Inicio inclusivo, fin exclusivo y coincidencia con el día presentado |
| 10 · Reportes | Comparar estado antes/después con el subconjunto de llamadas autorizado | Métricas concilian con su fuente, incluidas vencidas y alcance acotado. Duración solo cuenta bajo fórmula documentada |

Después de aprobar el piloto, convertir las [36 familias de la auditoría funcional](AUDITORIA_FUNCIONAL_E2E_CRM_2026-11-19.md) en un registro de casos por rol y operación. Registrar verificado, pendiente, bloqueado intencionalmente o sin implementación por separado. Mantener Oportunidades y Cotizaciones en sus modos actuales. Su caso esperado verifica el bloqueo, sin habilitación del flujo real.

## Migraciones propuestas y prioridades

| Prioridad | Propuesta para aprobación | Aceptación y reversión |
|---|---|---|
| P0 | Separación de entornos y preflight de destino antes de cualquier prueba con escritura | Tres destinos diferenciados, verificación de proyecto y aislamiento de cuentas/integraciones. Conservar los controles actuales hasta aprobar el reemplazo |
| P0 | Línea base del esquema a partir de metadatos y reconciliación del historial | Un esquema local reproducible con dependencias, restricciones, políticas y versión documentadas. Comparación con staging antes de aplicar DDL |
| P1 | Transición de finalización protegida y registro transaccional de idempotencia, si falta en la función real | Dos conexiones producen una transición y un evento. Mismo identificador devuelve el resultado registrado y un payload distinto produce conflicto. Validar rollback sin cambios parciales |
| P1 | RPC versionada con duración manual, si se confirma la necesidad | Firma v1 intacta, equivalencia para null, validación de rango y unidad, autorización de actor y campo persistido conciliado. El cliente puede volver a v1 sin borrar trazabilidad |
| P1 | Revisión y eventuales ajustes de grants/RLS, solo bajo aprobación separada si el catálogo revela diferencias | Matriz positiva/negativa comprobada para navegador y servidor, incluido registro ajeno. Reversión revisada con staging aislado |
| P2 | Automatización, trazas redactadas y cobertura de las 36 familias | Casos reproducibles por versión y destino. Fixtures y evidencias sin datos personales |

Las propuestas quedan a nivel de diseño hasta conocer firma y esquema efectivos. Se generó solo SQL de inspección y documentación. Para avanzar basta una **exportación autorizada y redactada de staging** con los resultados de la consulta, las definiciones relevantes y prueba de aislamiento. La autorización de fixtures y escrituras de prueba es un paso posterior.
