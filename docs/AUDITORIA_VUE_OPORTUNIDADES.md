# Auditoría Vue de Oportunidades para integración con Supabase

## Diagnóstico de la fase 6A

El módulo conserva un flujo comercial de demostración y un adaptador Supabase preparado detrás de controles de entorno y verificación. La auditoría valida el comportamiento local y el contrato esperado con dobles. La firma efectiva, los datos disponibles, los permisos por registro y la persistencia requieren validación en staging. La preparación de esta fase consiste en fijar esas condiciones y proponer cambios delimitados antes de habilitar el modo real.

## Arquitectura y servicios reutilizables

| Archivo | Responsabilidad actual |
|---|---|
| `vistas/ListaOportunidades.vue` | Carga, filtros, selección, formulario, tablero y detalle de historial. Mantiene el resultado confirmado ante fallo posterior de recarga |
| `componentes/TableroOportunidades.vue` | Columnas por etapa y tarjetas por embudo. Estado vacío por columna. Abrir tarjeta delega la edición a la vista |
| `componentes/FormularioOportunidad.vue` | Catálogos, formulario reactivo, validación y conversión de fecha local de seguimiento |
| `servicios/servicioOportunidades.js` | Datos independientes de demostración, persistencia local, validación de asociaciones, historial y gestión de etapas. Fábrica de navegador y filtros |
| `adaptadores/adaptadorOportunidadesSupabase.js` | Valida destino e identidad activa, pagina lecturas, proyecta datos, invoca RPC y relee registro e historial |
| `dominio/oportunidades.js` | Validación de campos y compatibilidad de etapa, con reglas diferenciadas por modo |
| `esquemas/contratoOportunidadesSupabase.js` | Mapeos de columnas y verificación del entorno y evidencias necesarias para habilitar |
| `indice.js` | Interfaz pública de las fábricas de navegador y demostración. Consumida por Cotizaciones |

Reutilizar el encabezado compartido, tablero, formulario, dominio y adaptador. El módulo recibe el cliente autenticado desde el contenedor CRM. La autorización de rutas de Vue exige sesión y perfil activo, y no implementa capacidades comerciales por acción. [Módulo](../src/modulos/oportunidades) · [Router](../src/router/index.js)

## Disponibilidad del formulario y embudos

| Funcionalidad | Demostración | Adaptador Supabase condicionado |
|---|---|---|
| Cliente o prospecto | Catálogo local y asociación validada | Lee `prospectos` con ID real. Cliente y embudo permanecen fijos al editar |
| Empresa | Asociación del catálogo demo | Derivada de `prospectos.empresa`. El texto se usa como clave de presentación, sin entidad empresarial autónoma |
| Servicio y embudo | Venta de aeronaves, motores, refacciones y vuelos privados en fixtures | Lee embudos activos. Servicio no es una columna confirmada del embudo real |
| Etapa y estado | Etapas de cada embudo, movimiento por edición, estado asociado, gestión local de etapas | Selección por embudo y orden por posición e ID. El estado se relee de la RPC y no se manda como campo de escritura. Administración de etapas desactivada |
| Responsable, prioridad, monto y moneda | Formulario con validación y controles locales | Catálogo de perfiles activos. El alcance real de responsables elegibles queda pendiente. Importe con formato decimal y moneda validada |
| Título, descripción y motivo | Título/descripcion y motivo separado en pérdida demo | Título y descripción o motivo de cierre por el campo existente. Confirmar semántica con el backend |
| Fechas y observaciones | Próximo seguimiento y fecha de cierre registrada por evento | Próximo seguimiento y lectura de fecha efectiva de cierre. No hay contrato confirmado para fecha estimada de cierre ni observaciones separadas |
| Carga, errores e historial | Probados localmente con registros y errores simulados | Verificación de sesión por acceso. Guardado, relectura e historial probados con dobles. Guardado confirmado no se vuelve a ejecutar por una falla de recarga |

El tablero filtra oportunidades por embudo y etapa. Los filtros de texto, responsable, moneda, estado y prioridad se ejecutan sobre el catálogo cargado. El flujo de guardado actualiza por ID, no añade una segunda tarjeta para el mismo registro en el camino normal. El adaptador trae catálogos mediante páginas REST de 200 filas y límite local de 100 000. La vista carece de navegación por páginas o indicador de datos parciales. Los embudos de staging y sus etapas reales aún no están inventariados.

## Contratos requeridos y dependencias

- **Lecturas.** Confirmar `oportunidades`, `embudos`, `etapas`, `eventos_oportunidad`, `prospectos` y `perfiles` contra sus proyecciones. Verificar PK/FK, unicidad de ID, orden estable, límite REST y visibilidad de relaciones. La lectura actual agrupa solicitudes con Promise.all. Si falla un catálogo o una fila no cumple el contrato, falla la carga completa.
- **Alta.** El cliente espera `crear_oportunidad` con prospecto, embudo, etapa, responsable, título, descripción, moneda, valor, prioridad y seguimiento. Confirmar nombres, tipos, nulidad, control de actor y retorno UUID.
- **Edición.** El cliente espera `actualizar_oportunidad` con ID, campos editables y `p_fecha_esperada` para concurrencia. Confirmar transición, cambios de responsable, cierre, manejo de conflictos y auditoría atómica. El cliente conserva offset y microsegundos de la marca de concurrencia.
- **Importes y fechas.** Confirmar precisión y escala monetaria. El adaptador acepta texto decimal y valores numéricos compatibles, pero una respuesta ya redondeada en JSON no se recupera al convertirla a texto. Confirmar timestamps con zona en lectura y retrospectiva del seguimiento, incluido qué ocurre al editar un valor de mayor precisión en el formulario.
- **Contactos.** Reutilizar ID de prospecto del catálogo autenticado. La empresa derivada puede coincidir por nombre entre registros o presentar variantes. No crear entidades duplicadas ni usar ese texto como clave de escritura. Planificar el caso donde una oportunidad visible haga referencia a un cliente o responsable que el JWT no pueda listar.
- **Cotizaciones.** Consume `indice.js` y reutiliza el catálogo. Su fábrica bloquea el modo real si falla su propia habilitación o si Oportunidades no ofrece modo Supabase. El adaptador de Cotizaciones valida la relación y su contexto según el contrato vigente. Confirmar reglas de elegibilidad comercial con ambos módulos antes de activar. No se detectó dependencia de Oportunidades hacia Cotizaciones en sus imports.

[Mapeo y control de entorno](../src/modulos/oportunidades/esquemas/contratoOportunidadesSupabase.js) · [RPC y lectura](../src/modulos/oportunidades/adaptadores/adaptadorOportunidadesSupabase.js) · [Consumidor Cotizaciones](../src/modulos/cotizaciones/servicios/servicioCotizaciones.js)

## Seguridad de interfaz y propuestas de la fase 6A

| Acción | Administrador, Supervisor y Ejecutivo en la interfaz existente | Condición de aceptación real |
|---|---|---|
| Consultar | Ruta habilitada a perfiles activos. Demo ofrece el catálogo local | Lecturas autorizadas por JWT, rol y propiedad. Probar dos ejecutivos y registros propios y ajenos |
| Crear y editar | Acciones disponibles en la vista. Adaptador exige destino y perfil activo | RPC determina permiso y valida campos. Rechazar edición ajena y cambios de cliente/embudo fuera de contrato |
| Mover etapa y cerrar | Transición local en demo. Modo real usa RPC y estado devuelto | Verificar transición, cierre y motivos permitidos por rol y estado |
| Asignar responsable | Demo usa su catálogo. Modo real proyecta perfiles activos visibles | Confirmar catálogo de asignables y su alcance. El control de Llamadas queda fuera de Oportunidades |
| Administrar etapas o embudos | Edición de etapas disponible solo en demo. Sin gestión real de embudos | Cualquier gestión real requiere contrato y autorización específicos |

| Prioridad | Problema | Cambio mínimo propuesto |
|---|---|---|
| P0 | La fábrica recurre a demo cuando falla la construcción del adaptador tras habilitar la rama real | Separar modo demo explícito de modo real solicitado, bloqueado o fallido. Si un modo real autorizado falla, exponer error y evitar ofrecer registros demo. Los errores operativos posteriores del adaptador ya se muestran en la vista |
| P0 | No se acreditó matriz de lectura/escritura ni aislamiento efectivo de staging | Mantener todas las barreras. Obtener metadatos redactados, permisos, contratos y evidencia con usuarios sintéticos autorizados |
| P1 | Respuesta RPC perdida. El adaptador cubre UUID inesperado o una relectura fallida, pero una excepción de transporte en la llamada RPC puede quedar como fallo genérico | Clasificar resultado incierto, evitar reenvío y reconciliar mediante recarga de solo lectura. Documentar garantía de backend para reintentos y concurrencia |
| P1 | La carga agrupa catálogos y oportunidades. Faltan estados distintos para error de dependencia frente a ausencia de datos | Identificar la dependencia fallida, conservar datos válidos solo para la misma sesión y deshabilitar acciones que requieran catálogos incompletos |
| P1 | Catálogo de responsables limita por actividad y no por capacidad comercial | Confirmar autorización real y, si existe un contrato autorizado, reflejarlo en el selector. Mantener el permiso efectivo en RPC/RLS |
| P2 | Paginación de transporte sin recorrido visible y posibilidad de cambios concurrentes entre páginas | Acordar contrato y orden estable de paginación, distinguir total de conjunto filtrado visible, probar duplicados y datos longitudinales |
| P2 | La ausencia de embudos puede dejar vacío el contenedor general pese a los estados por columna | Mostrar un estado de catálogo vacío distinto del error de lectura y del tablero filtrado sin coincidencias |

## Línea base y plan de integración de la fase 6A

- **Suite local completa:** 244 casos, 241 aprobados, cero fallos y tres pruebas remotas omitidas. Se desactivaron las banderas remotas.
- **Conjunto focalizado:** 56 pruebas aprobadas de Oportunidades, Cotizaciones y rutas. Cubre altas y edición de demo, cambio y administración de etapas, filtros, validaciones, IDs, conflictos y doble guardado, control del destino, bloqueo y separación entre catálogo demo y persistido. Los JWT, consultas y respuestas RPC de los casos de integración local utilizan dobles.
- **Vite:** compilación aprobada en carpeta temporal. Permanece el aviso de tamaño del paquete principal.

1. Contrastar catálogo y RPC con el contrato esperado en staging de solo lectura. Confirmar los campos que el formulario puede ofrecer y excluir los que siguen sin soporte.
2. Aprobar la matriz de capacidades y probar lecturas autorizadas y denegadas con perfiles sintéticos. Revisar IDs de relaciones, embudos activos, etapas históricas y responsables disponibles.
3. Aprobar los cambios mínimos P0/P1 en una fase de implementación separada. Conservar el flujo demo y el bloqueo de Cotizaciones durante la preparación.
4. Con autorización de escrituras en staging aislado, ejecutar alta, edición, cambio de etapa, cierre, conflicto concurrente, pérdida de respuesta y relectura de historial. Aceptar solo si el evento y el ID coinciden tras recargar con una segunda sesión autorizada.
5. Validar después el consumo de una oportunidad elegible por Cotizaciones con su autorización independiente.

Todavía faltan la evidencia de catálogo y RLS, la semántica real de cierre, la precisión monetaria efectiva y la estrategia de conciliación ante pérdida de respuesta. Esta fase añadió únicamente el diagnóstico. No modificó la aplicación, Supabase, RLS, SQL ni los bloqueos.

## Implementación de la fase 6C

La evidencia aportada confirma los nombres de las tablas y los parámetros de las RPC `crear_oportunidad` y `actualizar_oportunidad`, ambas con retorno UUID. También confirma cuatro embudos con 34 etapas activas en el inventario general. El cliente usa el conjunto visible bajo la sesión, sin exigir esos conteos. La fecha de cierre es efectiva. El formulario no agrega fecha estimada, observaciones independientes ni campos de auditoría.

| Archivo modificado | Cambio |
|---|---|
| `servicios/servicioOportunidades.js` | La solicitud explícita de modo Supabase devuelve un servicio bloqueado con error cuando falla la evaluación o construcción. Demo explícita o predeterminada conserva su comportamiento |
| `adaptadores/adaptadorOportunidadesSupabase.js` | Deduplica etapas por ID, conserva su embudo y orden. Mantiene los dos payloads RPC. Distingue rechazo, respuesta incierta y UUID confirmado con lectura fallida |
| `dominio/oportunidades.js` | Limita el modo real a USD, MXN, EUR y prioridades baja, media, alta, urgente. Exige título y etapa abierta activa del embudo al crear |
| `componentes/FormularioOportunidad.vue` | Reúsa prospectos por ID, valida catálogo de alta, limita las opciones de etapa por modo y conserva el responsable histórico al editar |
| `vistas/ListaOportunidades.vue` | Presenta modo bloqueado, ausencia de embudos y resultado incierto. Permite recargar sin reenvío. Un conflicto ofrece abrir la versión actual con descarte explícito de cambios locales |
| `tests/oportunidadesSupabase.test.js` y `tests/oportunidadesVista.test.js` | Añaden cinco casos de construcción y bloqueo, timeout, validaciones, etapa/embudo y recarga con filtros |

El adaptador conserva `p_fecha_esperada` tal como se leyó al abrir el registro. El frontend preserva el borrador ante un rechazo corregible. La confirmación por UUID permanece visible si falla la relectura. Una respuesta incierta bloquea el reenvío de la creación o de la edición del mismo ID bajo el mismo actor y cliente mientras vive la instancia de la aplicación. La recarga del catálogo es de solo lectura. Una recarga completa del navegador u otra pestaña quedan fuera de esta protección en memoria. Se requiere conciliación e idempotencia probadas en servidor antes de permitir reintentos seguros en producción.

El selector real usa perfiles activos visibles y conserva un responsable histórico que no esté disponible como opción nueva. La propuesta de limitar nuevas asignaciones a ejecutivos activos queda sujeta a la autorización de backend para Oportunidades. La administración real de embudos y etapas requiere RPC específicas, autorización, control de concurrencia y resultados verificables. La interfaz demo se conserva. Cotizaciones continúa usando el mismo `indice.js` y mantiene su bloqueo.

**Verificación de 6C.** Vite aprobó en directorio temporal, con el aviso previo de tamaño del paquete. La suite completa pasó de 241 a 246 aprobadas, con cero fallos y tres pruebas remotas omitidas. La selección Oportunidades, Cotizaciones y rutas aprobó 61 pruebas. Los casos de modo real usaron dobles. No hubo escrituras remotas ni SQL.

### Condiciones de activación

- **Staging:** proyecto aislado, clave pública, metadatos revisados y firmas efectivas coincidentes. Validar con identidades sintéticas las lecturas y RPC por rol, registros propios/ajenos, asignación, estados y auditoría. Aprobar por separado la autorización de escrituras de prueba y las evidencias requeridas por el control de configuración. Mantener una prueba de regreso a demo explícita y una prueba de indisponibilidad del adaptador sin mostrar datos simulados.
- **Producción:** requiere aprobación independiente. La configuración actual rechaza producción. Antes de proponer un cambio, aislar desarrollo, completar staging autenticado, verificar precisión monetaria y semántica de fechas, confirmar idempotencia y conciliación, validar paginación y respuesta de errores bajo carga, y aprobar autorización de responsables. Mantener el bloqueo de Cotizaciones hasta su validación separada.
