# Auditoría empresarial del CRM de aviación privada

19 de noviembre de 2026 · Revisión del árbol de trabajo local, incluidos cambios pendientes del equipo.

## G. Resumen ejecutivo

1. **Qué tenemos.** Una base Vue para gestión de contactos, llamadas y seguimientos, con panel telefónico, administración de usuarios, tablero de oportunidades de demostración y generación de PDF de cotizaciones.
2. **Qué quedó validado.** Vite compiló el frontend. La suite registró 218 pruebas aprobadas, cero fallos y tres pruebas remotas omitidas. La evidencia cubre contratos, reglas locales, vistas, PDF y lógica administrativa con los dobles de la suite. La disponibilidad de flujos autenticados desplegados queda pendiente.
3. **Qué está incompleto.** Oportunidades usa datos de sesión o memoria mientras el adaptador real está deshabilitado. La ruta de Cotizaciones entrega un servicio bloqueado. El código de Llamadas invoca Supabase, pero depende de varias vistas y una carga compartida que también condiciona Contactos.
4. **Qué falta.** Un ciclo empresarial desde lead y solicitud hasta reserva, entrega y cobro, con fuentes auditables para dirección. Faltan además inventario comercial de aeronaves, expedientes legales, atribución de marketing y posventa estructurada.
5. **Riesgos.** Autorización remota por registro sin evidencia suficiente, entorno development ligado al proyecto de producción en la configuración revisada, métricas de llamadas limitadas por volumen y manejo separado de archivos y metadatos.
6. **Cobertura departamental.** Comercial telefónico e IT administrativo tienen mayor cobertura. Dirección tiene visibilidad de actividad telefónica. Operaciones, Finanzas, Legal, Marketing, Concierge y Atención al Cliente carecen de flujos departamentales completos.
7. **Permisos pendientes.** Capacidades configurables, alcance por organización/departamento/responsable, límites para asignación, aprobación, descarga, exportación y acceso a datos sensibles. El menú y el router usan tres roles genéricos.
8. **Primera inversión.** Verificar esquema y autorización desplegados, aislar development, desacoplar la carga de módulos y cerrar el tramo oportunidad–cotización–reserva.
9. **Qué reutilizar.** Mantener Vue Router, shell, formularios y adaptadores, `prospectos` como ficha base, historial de llamadas, tablero, generador PDF y Edge Function administrativa, previa revisión de sus contratos.
10. **Preparación empresarial.** Base aprovechable para evolucionar a un piloto comercial controlado. La aprobación para uso multidisciplinario depende del cierre de P0 y de la verificación autenticada de los flujos de P1.

**Alcance de evidencia.** Lectura del repositorio, pruebas locales con las tres banderas remotas desactivadas y build en una carpeta temporal. Los 404 de staging citados abajo son antecedentes de un informe previo, sin reproducción en esta revisión. El catálogo, los datos, el despliegue y los controles efectivos de Supabase no se consultaron. Los estados de ausencia se refieren al producto versionado localmente. Ninguna puntuación certifica funcionamiento remoto.

## A. Inventario real

IV = IMPLEMENTADO Y VALIDADO · IP = IMPLEMENTADO PARCIALMENTE · EE = EXISTE, PERO PRESENTA ERRORES · NI = NO IMPLEMENTADO · NV = NO VERIFICABLE CON LA EVIDENCIA DISPONIBLE · NA = NO APLICA AL MODELO DE NEGOCIO.

| Módulo | Funcionalidad | Estado | Evidencia | Problema detectado | Prioridad |
|---|---|---|---|---|---|
| Plataforma | Vue 3, Vite, Vue Router y build | IV local | [package.json](../package.json), [router](../src/router/index.js), compilación local | Chunk principal 525 kB minificado, 150 kB comprimido. Medición en navegador pendiente | P2 |
| Estado | Sesión y CRM mediante composables reactivos | IP | [useCrm](../src/composables/useCrm.js), [useAuthSession](../src/composables/useAuthSession.js) | Estado compartido y errores transversales. Sin Pinia en dependencias | P1 |
| Auth | Login, cierre, persistencia y perfil activo | IP | [Auth](../src/composables/useAuthSession.js), [cliente](../src/lib/supabase.js), [rutas](../tests/rutas.test.js) | Sesión real e invalidación ante baja pendientes de validar | P0 |
| Auth | Establecer contraseña con sesión, invitación administrativa | IP | [EstablecerAcceso](../src/views/EstablecerAccesoView.vue), [Edge](../supabase/functions/admin-usuarios/index.ts) | Recuperación autoservicio sin flujo observado. MFA y políticas Auth desplegadas NV | P0 |
| Entornos | Cliente y protección staging | EE | [supabase.js](../src/lib/supabase.js), [bloqueo](../src/lib/stagingWriteProtection.js) | Development y production esperan el mismo proyecto. La protección local depende del entorno y permite operaciones Auth y marcado de notificación | P0 |
| Contactos | Alta, edición, búsqueda, ficha y responsable | EE | [vista](../src/views/ProspectosView.vue), [servicio](../src/services/crmSupabaseService.js), [pruebas](../tests/contactosGuardado.test.js) | Error común puede impedir mostrar el módulo. El alcance de registros depende de autorización remota | P0 |
| Llamadas | Programar, iniciar, finalizar, reasignar y cancelar | IP | [servicio](../src/services/crmSupabaseService.js), [formulario](../src/components/FormularioResultado.vue) | Dependencia de vistas y RPC. Antecedente de 404 en detalle, hoy y vencidas. Listado inicial de 100 registros, sin navegación completa por páginas | P1 |
| Seguimientos | Llamada hija, próximos contactos y vencimientos | IP | [vista](../src/views/SeguimientosView.vue), RPC `crear_seguimiento_llamada` | Agenda limitada a llamadas. Atomicidad y duplicados NV | P1 |
| Historial | Eventos de llamada y contexto de contacto | IP | [historial](../src/views/HistorialView.vue), [servicio](../src/services/crmSupabaseService.js) | Sin expediente comercial completo y versión trazable de todos los cambios | P1 |
| Panel y reportes | Actividad telefónica y desempeño | IP | [métricas](../src/lib/crmMetrics.js), [reportes](../src/views/ReportesView.vue), [estado](../src/composables/useCrm.js) | Parte de los indicadores depende de una muestra de hasta 200 llamadas. Sin panel financiero y comercial integrado | P1 |
| Oportunidades | Tablero, etapas, movimiento y registro local | IV demo | [servicio](../src/modulos/oportunidades/servicios/servicioOportunidades.js), [pruebas](../tests/oportunidades.test.js) | Sin persistencia compartida por la ruta actual. Los formularios tienen reglas distintas entre demo y real | P1 |
| Oportunidades | Adaptador Supabase y RPC | IP | [adaptador](../src/modulos/oportunidades/adaptadores/adaptadorOportunidadesSupabase.js), [configuración](../src/modulos/oportunidades/esquemas/contratoOportunidadesSupabase.js) | Controles de habilitación desactivados. RLS, reglas de transición y concurrencia remotas NV | P0/P1 |
| Cotizaciones | Formulario, conceptos, vista previa y PDF | IV con datos de prueba | [vista](../src/modulos/cotizaciones/vistas/ListaCotizaciones.vue), [pruebas PDF](../tests/cotizacionPdf.test.js) | Validez mercantil, emisión y entrega al cliente dependen del flujo real | P1 |
| Cotizaciones | Operación desde la ruta normal | IP | [fábrica](../src/modulos/cotizaciones/servicios/servicioCotizaciones.js), [configuración](../src/modulos/cotizaciones/esquemas/contratoCotizacionesSupabase.js) | Servicio bloqueado por diseño. Contrato incompleto y dependencia de oportunidades reales | P1 |
| Usuarios | Gestión, invitación, diagnóstico y auditoría | IP | [vista](../src/views/UsuariosAdminView.vue), [Edge](../supabase/functions/admin-usuarios/index.ts), [pruebas](../tests/usuariosAdminExecutor.test.js) | Despliegue, grants, integridad Auth/perfil y recuperación ante fallas parciales pendientes | P0 |
| Organización | Equipo, configuración y permisos configurables | IP | [shell](../src/views/CrmShellView.vue), [navegación](../src/lib/crmNavigation.js) | Secciones de preparación. El contexto CRM no determina permisos granulares en el router | P0 |
| Storage | Adjuntos de llamadas y URL firmada | IP | [servicio](../src/services/crmSupabaseService.js) | Permisos del bucket NV. Archivo y registro se escriben o borran en operaciones independientes | P0 |
| Realtime y notificaciones | Suscripción a llamadas y notificaciones, lectura y marcado | IP | [useCrm](../src/composables/useCrm.js), [servicio](../src/services/crmSupabaseService.js) | Publicación, entrega y recuperación de conexión NV. Sin bandeja completa | P2 |
| Experiencia | Sidebar, tarjetas móviles, filtros, formularios, estados vacíos y de carga | IP | [shell](../src/views/CrmShellView.vue), [componentes](../src/components), [Kanban](../src/modulos/oportunidades/componentes/TableroOportunidades.vue) | Faltan agenda general, dashboards por área y validación de teclado, foco, contraste y pantallas reales | P2 |
| Integraciones | Supabase Auth, REST/RPC, Storage, Realtime y Edge en código | IP | [cliente](../src/lib/supabase.js), [servicios](../src/services), [Edge](../supabase/functions) | Sin integración local observada con Ads, cobros, firma, telefonía o despacho. Registro telefónico dentro del CRM | P2 |
| Departamentos | Reservas, operación, finanzas, legal, marketing, concierge y soporte como módulos autónomos | NI | [rutas](../src/router/index.js), [vistas](../src/views) | Sin flujos de extremo a extremo | P1–P3 |
| Base y operación | RLS, grants, secretos, backups, retención, restauración y función desplegada | NV | [SQL diagnóstico](sql/auditoria-centro-llamadas-staging.sql), [backend](../supabase/functions) | Falta evidencia de catálogo y configuración efectiva | P0 |
| Despacho operacional | Aeronavegabilidad, mantenimiento, despacho oficial y seguridad operacional | NA | Alcance comercial solicitado | Integrar referencias y estados autorizados desde el sistema responsable | P3 |

## B. Accesos existentes y propuestos

**Existente en Vue.** Ejecutivo, supervisor y administrador comparten Inicio, Contactos, Oportunidades, Cotizaciones, Llamadas, Seguimientos e Historial. Reportes y Equipo requieren supervisor o administrador. Administración de usuarios exige administrador. Configuración aparece en el menú administrador y su ruta solo exige autenticación, una divergencia comprobada con el marcador actual. La función administrativa verifica identidad y perfil activo de administrador en código. El listado de perfiles y los filtros de la interfaz requieren validación de alcance en servidor. Los tres roles por sí solos no acreditan propiedad ni separación por organización. [Router](../src/router/index.js) · [Menú](../src/lib/crmNavigation.js) · [Edge](../supabase/functions/admin-usuarios/index.ts)

**Propuesta.** V visualizar, C crear, E editar, X archivar, A asignar, P aprobar, R rechazar, EX exportar, DD descargar documentos, CF consultar confidencial, FI consultar finanzas, U administrar usuarios y G configurar permisos. Lo omitido se deniega por defecto. P y R corresponden a un flujo con límites, evidencia y prohibición de autoaprobar cuando aplique. Borrado definitivo es una capacidad separada con retención, dependencias y aprobación. Los tres primeros roles genéricos requieren migración explícita por persona.

| Departamento | Rol propuesto | Módulo y alcance | Permisos recomendados |
|---|---|---|---|
| Plataforma | Superadministrador | Configuración técnica y acceso de emergencia con vigencia | U, G; elevación de negocio independiente y registrada |
| Dirección | CEO | Consolidados de su organización, aprobaciones corporativas | V, FI, P/R y EX sobre informes autorizados; CF/DD por alcance explícito |
| Comercial | Director Comercial | Charter y Aircraft Sales de su organización | V,C,E,X,A,P/R,EX; FI de márgenes comerciales autorizados |
| Comercial | Gerente de Ventas | Pipelines del equipo, descuentos delegados | V,C,E,X,A,P/R dentro de límite |
| Charter | Ejecutivo Charter | Contactos y oportunidades propias o asignadas, solicitudes y cotizaciones | V,C,E; DD de documentos comerciales autorizados |
| Aircraft Sales | Ejecutivo Aircraft Sales | Leads propios, expedientes asignados e inventario publicable | V,C,E; DD/CF por expediente y fase aprobada |
| Operaciones | Flight Operations Manager | Reservas de su equipo y coordinación | V,C,E,A,P/R; CF/DD de pasajeros por vuelo |
| Operaciones | Coordinador de Operaciones | Servicios y vuelos asignados | V,C,E; CF/DD mínimo necesario por vuelo |
| Finanzas | Finanzas | Facturas, cuentas por cobrar, costos, pagos y conciliación | V,C,E,FI,DD,EX; P/R por capacidad separada |
| Legal | Legal/Compliance | Contratos y expedientes asignados | V,C,E,CF,DD,P/R; EX por autorización |
| Marketing | Marketing | Canales, campañas, consentimiento y segmentos habilitados | V,C,E,EX de agregados autorizados |
| Concierge | Concierge | Solicitudes, proveedores y servicios asignados | V,C,E; DD de confirmaciones autorizadas |
| Atención | Atención al Cliente | Clientes y casos asignados, preferencias autorizadas | V,C,E; alcance mínimo de servicio |
| IT | Administrador IT | Identidades, integraciones y diagnóstico | U y V técnico; G solo con delegación separada |
| Auditoría | Auditor solo lectura | Eventos y reportes del mandato, con plazo | V; EX/DD/CF/FI solo mediante autorización explícita |

Aplicar en Vue mediante capacidades del contexto, en PostgreSQL con RLS para fila y operación, y mediante grants, vistas o entidades separadas para campos sensibles. RPC y Edge deben repetir la autorización efectiva para acciones privilegiadas. Auditar asignación, elevación, denegaciones pertinentes, exportación y acceso a documentos. Validar cambios de responsable, cuentas inactivas, membresías revocadas y separación entre equipos incluso al llamar directamente a la API mediante pruebas defensivas autorizadas sobre fixtures.

## C. Auditoría del modelo de datos y seguridad

| Área | Evidencia de objetos usados o esperados | Relaciones esperadas por el código y comprobación pendiente |
|---|---|---|
| Identidad | `auth.users`, `perfiles`, `mi_contexto_crm`, `auditoria_usuarios`, `crm_internal.administrar_perfil`; documentación menciona departamentos, puestos, equipos y membresías | Auth–perfil por ID. Revisar FK, cascada, membresías vigentes, triggers, grants y restricciones de administración |
| Contactos | `prospectos` | Responsable → perfil; empresa como dato de ficha. Validar duplicados, estados, índices de responsable y búsqueda |
| Telefonía | `llamadas`, `historial_llamadas`, `catalogo_motivos_llamada`, `catalogo_resultados_llamada`, `vista_llamadas_detalle`, `vista_llamadas_hoy`, `vista_llamadas_vencidas` | Contacto y responsable; seguimiento relacionado con llamada padre. Revisar anulaciones, fechas, zonas, índices, FK, historial y visibilidad efectiva de vistas |
| Embudos | `oportunidades`, `embudos`, `etapas`, `eventos` y contrato de historial según [mapeo](../src/modulos/oportunidades/esquemas/contratoOportunidadesSupabase.js) | Prospecto → oportunidad, embudo → etapa y oportunidad → responsable. Exigir consistencia embudo/etapa y organización, concurrencia e historial de transición |
| Propuestas | `cotizaciones`, `cotizacion_conceptos`, `crear_cotizacion`, `actualizar_cotizacion` | Oportunidad → cotización → conceptos. Revisar folio único en su ámbito, orden de conceptos, integridad y cálculo atómico de importes en servidor |
| Notificaciones y archivos | `notificaciones`, `imagenes_llamadas`, bucket `crm-llamadas-imagenes` | Destinatario → perfil, adjunto → llamada y clave de objeto. Probar autorizaciones, caducidad de URL, validación de tipo/tamaño, borrado y compensación |
| Comercial extendido | Equivalentes por verificar para fuente de lead, historial de asignaciones, tareas/actividades, comunicaciones, inventario/listings, solicitudes charter y reservas | Reutilizar `prospectos`, llamadas, oportunidades e historial. Separar lead de cliente mediante estado/historial o entidad solo si el proceso lo exige |
| Operación, contratos y finanzas | Sin consumidores locales para `flight_operations`, documentos generales, contratos, facturas, pagos y comisiones | Reserva → servicio/operación, documentos → expediente, factura → operación, pagos → factura mediante aplicación, comisiones → evento autorizado. Revisar equivalentes reales antes de migrar |
| Control transversal | Organizaciones, departamentos, roles, permisos, user_roles, role_permissions y audit_logs | Verificar equivalentes organizacionales y auditorías de llamadas/usuarios. Mapear capacidades y ámbito antes de crear tablas |

**RLS y grants.** El informe previo de staging documenta denegación anónima sobre algunos recursos y 404 en vistas de llamadas. Esa evidencia histórica deja indeterminados las políticas efectivas, los permisos de autenticados, el esquema expuesto y la caché de recursos. Para cada tabla revisar SELECT, INSERT, UPDATE y DELETE, expresiones de fila y de nuevo registro, propietarios y roles con bypass. Para vistas revisar opciones de seguridad y grants. Para funciones revisar privilegios EXECUTE, propietario, `SECURITY DEFINER`, `search_path`, esquemas y validación de actor. Para Storage revisar buckets y políticas de objetos. Para Realtime revisar publicaciones y alcance. No hay migraciones versionadas en `supabase/migrations` en el árbol inspeccionado. Los SQL de `docs/sql` son diagnósticos/propuestas; su presencia no acredita aplicación. [Diagnóstico anterior](AUDITORIA_Y_ARQUITECTURA_CRM_AVIACION.md) · [Contrato de cotizaciones](COTIZACIONES_CONTRATO.md)

**Riesgos comprobados en código.**

- P0. La configuración de cliente vincula development al proyecto asignado a production. El bloqueo de escritura es del cliente y aplica al destino staging bajo su condición. Aislar development antes de ensayar mutaciones.
- P0. El cliente principal rechaza el prefijo secreto moderno, pero no valida el rol de una clave JWT heredada. Configuración incorrecta podría incluir una clave privilegiada en el bundle. Esto identifica una debilidad del control, sin acreditar exposición de una clave. Los archivos de entorno locales no figuran entre los rastreados actuales. `dist.zip` sí está rastreado y su contenido e historial requieren verificación controlada sin imprimir claves.
- P0. Las cargas y bajas de adjuntos pueden dejar archivos huérfanos o metadatos sin archivo ante fallo parcial. Separar metadatos confidenciales y validar propiedad antes de firmar URLs. Mantener conciliación e idempotencia.
- P0. Cotizaciones y oportunidades tienen validación de Vue, con totales de presentación y reglas de demo. La integridad efectiva de cálculos, transiciones y restricciones depende de SQL/RPC desplegados, actualmente NV. Exigir importes decimales, moneda y tipo de cambio aplicable, y versionar propuesta emitida.
- P1. El shell usa un error global para impedir el montaje de vistas de CRM compartidas. Un fallo del contexto o de llamadas puede dejar Contactos inaccesible aunque su servicio responda. [Shell](../src/views/CrmShellView.vue) · [Inicialización](../src/composables/useCrm.js)

**Secuencia de migración propuesta.** Obtener línea base reproducible de esquema y permisos, conciliar equivalentes, versionar cambios en orden y ensayar en staging aislado. Corregir contratos de vistas y fortalecer RLS/grants antes de habilitar escrituras. Incorporar claves e índices tras revisar calidad de datos y consultas. Rellenar ámbitos y relaciones sin perder registros previos, validar constraints antes de exigirlos a nuevos flujos, y verificar restauración con la política de RPO/RTO acordada. Revisar backup/PITR, retención, baja de datos, revocación de sesiones, respuesta a incidentes y protección contra exportación masiva. Los requisitos normativos quedan sujetos a jurisdicción, tipo de operación y función contractual de la empresa.

## D. Procesos empresariales, pipelines y automatización

| Área | Cobertura local y brecha empresarial |
|---|---|
| Dirección | Actividad telefónica como punto de partida. Faltan ventas por departamento, rentabilidad, embudos reales, cotizaciones pendientes, reservas, alertas, objetivos, tendencias y cartera vencida |
| Charter Sales | Contactos, responsable, llamadas, interés y presupuesto, tablero demo y PDF probado. Faltan solicitud estructurada con ruta/segmentos, fecha/zona, tipo, pasajeros, categoría y preferencias, y entrega de cierre a reserva. Revisar propiedad efectiva, negociación, pérdidas y comisiones |
| Aircraft Sales | Interés por aeronave y categoría comercial. Faltan inventario, fabricante/modelo, serie/matrícula protegidas, horas/ciclos, mantenimiento referencial, mandato/exclusividad, propietarios, compradores, oferta, NDA/LOI, inspección, due diligence, contrato y entrega |
| Flight Operations | Sin módulo de coordinación. Requiere reserva, itinerario y zonas, operador y aeronave, confirmaciones, pasajeros restringidos, FBO, catering, transporte, cambios y cierre. El CRM registra compromisos comerciales y coordinación, y enlaza al sistema responsable de despacho oficial, seguridad operacional y mantenimiento |
| Finanzas | Se prueban cálculos del PDF. Faltan aprobación, facturas, anticipos, pagos, cartera, reembolsos, notas de crédito, costos, conciliación, comisiones y rentabilidad multimoneda |
| Legal | Adjuntos técnicos de llamadas como referencia reutilizable. Faltan expedientes, privacidad operativa, versiones, vigencia, aprobaciones, firmas, contratos de charter/representación y control documental por caso |
| Marketing | Ficha comercial reutilizable. Sin captura atribuida observada de Google Ads, Meta Ads o landing pages, UTM, consentimiento, segmentos, conversiones, costos y automatización |
| Concierge | Sin proceso para villas, yates, transporte, proveedores, propuestas, confirmación, preferencias VIP, facturación e historial |
| Atención al Cliente | Historial de contacto y próximos seguimientos permiten atención informal. Sin tickets, quejas, satisfacción, posvuelo, recurrencia o registro de fidelización |
| IT | Usuarios y auditoría administrativa en código. Faltan gestión de capacidades y departamentos, inventario operativo de integraciones, monitoreo, recuperación probada y revisión de accesos privilegiados |

**Operaciones manuales o sin vínculo verificable.** La coordinación fuera del CRM es una inferencia que debe contrastarse con el equipo. El código sí muestra que contactos, llamadas y seguimiento se gestionan por un flujo distinto del tablero de demostración. El PDF puede generarse en pruebas sin un registro compartido de emisión o aceptación. Sin traspaso persistente a reserva ni conciliación, no hay trazabilidad común entre venta, prestación y cobro. Evitar duplicar ficha de contacto y agenda al incorporar departamentos.

**Pipelines.** El código demo prueba tablero, movimientos, responsables y edición con etapas predefinidas. El modelo prevé referencia de embudo y etapas. La configuración administrable, persistencia compartida, historial remoto, tareas obligatorias, aprobación y métricas por pipeline quedan pendientes. El demo exige motivo de pérdida; comprobar obligatoriedad remota. Usar valor y moneda normalizados, probabilidad, fecha estimada y fecha efectiva de cierre como requisitos medibles.

| Pipeline propuesto | Secuencia y regla de negocio |
|---|---|
| Charter | Nuevo lead → Contactado → Calificado → Solicitud recibida → Cotización enviada → Negociación → Confirmación → Ganado/Perdido. La reserva mantiene estados propios para operador, confirmación, cambio, cancelación y completado |
| Aircraft Sales | Prospecto → Calificación → Aeronave identificada → Presentación → Oferta → Negociación → Due diligence → Contrato → Cerrado. Embudo independiente con documentos y aprobaciones aplicables |
| Concierge | Solicitud → Evaluación → Propuesta → Confirmación → Servicio en proceso → Completado. Registrar proveedor, costos y aceptación del servicio |

**Automatizaciones.** Existen RPC de ciclo telefónico y seguimiento, consulta/marcado de notificaciones y suscripción Realtime. Un vencimiento que se muestra en pantalla constituye una consulta, y su aviso proactivo requiere una ejecución persistente. No se observó un scheduler, outbox, cola de reintentos ni deduplicación durable en el repositorio. Priorizar asignación/aviso de lead, seguimiento y vencidos, cotización sin respuesta y cierre esperado, aprobación de descuento, aviso de reserva a Operaciones y alerta de pago. Incorporar luego vencimiento contractual y posservicio. Registrar destinatario, evento, versión, estado y timestamp; clave única por evento, destinatario y canal, reintentos con límite y conciliación de pendientes. Probar reentrega, concurrencia y cambios de responsable.

## Indicadores calculables y faltantes

Las fórmulas describen requisitos. No se midieron resultados de negocio. Definir ventana, zona horaria, ámbito autorizado, moneda base y reglas de anulación. Usar cohortes homogéneas y reportar denominador cuando se publique una tasa.

| Área | KPI y fórmula | Disponibilidad |
|---|---|---|
| Actividad | Llamadas y resultados por responsable = conteos por estado, resultado, actor y periodo | Parcial. Uso de muestras locales; validar conjunto completo y visibilidad |
| Comercial | Leads recibidos = altas elegibles; calificados = transiciones a calificado; conversión = ganados / leads elegibles de la misma cohorte | Altas aproximables con prospectos si hay fecha y definición de lead; calificación y conversión requieren eventos persistentes |
| Comercial | Cotizaciones enviadas = versiones emitidas con timestamp de envío; ganadas/perdidas = oportunidades con cierre efectivo por resultado | Oferta y cierre demo; falta emisión y cierre verificable |
| Comercial | Valor de pipeline = suma de abiertas por moneda, o valor por probabilidad ponderado; tiempo de cierre = promedio de cierre menos alta; rendimiento = cierres, valor y conversión por responsable al cierre | Campos y reglas parciales; requiere persistencia, snapshots y FX cuando corresponda |
| Charter | Solicitudes = conteo de solicitudes; cotizaciones por ruta = conteo por segmento y versión emitida; confirmadas = reservas confirmadas; cancelaciones = reservas canceladas y tasa sobre confirmadas de la cohorte | Faltan entidades de solicitud/reserva y eventos |
| Charter | Ventas = importe confirmado neto de ajustes; margen = ingresos netos menos costos directos; recurrentes = clientes con al menos dos servicios completados | Requiere cierre, reservas, costos y cliente canónico |
| Aircraft Sales | Aeronaves comercializadas = listings activos; compradores potenciales = contactos calificados únicos; ofertas activas = ofertas vigentes; valor de inventario = suma de precios vigentes por moneda | Sin inventario, ofertas y definición de comprador persistente |
| Aircraft Sales | Ventas cerradas = operaciones al cierre efectivo; comisiones generadas = suma de devengos por cierre | Requiere operaciones y reglas de comisión |
| Finanzas | Facturación = emitido neto de créditos; pagos = cobros confirmados; saldo = facturación menos aplicación de pagos; rentabilidad = ingresos netos menos costos; comisiones = devengadas/pagadas; ingresos por departamento = agrupación de partidas reconocidas | Sin ledger, facturación y conciliación. Distinguir cobro, facturación y reconocimiento |
| Marketing | Leads por canal = leads con canal atribuido; conversión campaña = clientes ganados / leads atribuidos; CPL = gasto / leads; CAC = gasto / clientes adquiridos; retorno = (margen atribuible menos gasto) / gasto | Requiere capturas UTM, consentimiento, costos, datos de cierre y modelo de atribución auditado |

## E. Madurez estimada

Cinco dimensiones de igual peso. Cada componente vale entre 0 y 20. 0 sin evidencia local, 5 esqueleto o demo, 10 cobertura parcial, 15 cobertura amplia con pendientes, 20 completo con evidencia adecuada. Puntuación = suma, como estimación de diseño y preparación observable. Integración, seguridad y operación se limitan por falta de comprobación desplegada.

| Módulo | Cobertura | Integración | Seguridad | Pruebas | Operación | Total |
|---|---:|---:|---:|---:|---:|---:|
| Plataforma, rutas y UX | 15 | 15 | 10 | 15 | 10 | 65% |
| Auth y sesiones | 10 | 15 | 10 | 10 | 5 | 50% |
| Contactos | 15 | 10 | 5 | 15 | 5 | 50% |
| Llamadas, seguimiento e historial | 15 | 10 | 5 | 10 | 5 | 45% |
| Panel y reportes | 5 | 10 | 5 | 10 | 5 | 35% |
| Oportunidades | 10 | 5 | 5 | 15 | 0 | 35% |
| Cotizaciones y PDF | 10 | 5 | 5 | 15 | 0 | 35% |
| Usuarios e IT | 15 | 10 | 10 | 15 | 5 | 55% |
| Organización y RBAC | 5 | 5 | 5 | 5 | 0 | 20% |
| Storage, notificaciones y Realtime | 10 | 10 | 5 | 5 | 0 | 30% |
| Reservas y coordinación de vuelo | 0 | 0 | 0 | 0 | 0 | 0% |
| Inventario y operación Aircraft Sales | 5 | 0 | 0 | 0 | 0 | 5% |
| Finanzas | 0 | 0 | 0 | 0 | 0 | 0% |
| Legal y documentos empresariales | 0 | 0 | 0 | 0 | 0 | 0% |
| Marketing, Concierge y soporte autónomo | 0 | 0 | 0 | 0 | 0 | 0% |

## F. Roadmap

Complejidad relativa al repositorio y al alcance del flujo. Las tablas nuevas son nombres funcionales sujetos al inventario remoto.

| Nivel / tarea | Descripción y justificación | Archivos/módulos y tablas | Dependencias, riesgo y complejidad | Aceptación y pruebas |
|---|---|---|---|---|
| P0 · Línea base y entornos | Reproducir esquema, aislar desarrollo, revisar exposición y capacidad de restaurar | `src/lib/supabase.js`, configuración, `supabase`, todos los objetos CRM | Catálogo, inventario de despliegue y backup. Riesgo de apuntar a destino incorrecto. Media | Identidad de proyecto validada por modo, clave pública comprobada sin imprimirla, build y pruebas locales, respaldo más restauración demostrada en entorno autorizado |
| P0 · Autorización y cuentas | Capacidades y RLS, MFA privilegiada, revocación y administración segregada | Router, auth, Edge; perfiles, membresías, permisos, auditoria_usuarios | Línea base y matriz aprobada. Riesgo de cortar acceso legítimo. Alta | Actor y ámbito se validan en servidor, altas/bajas trazadas. Pruebas de permitido/denegado por capacidad, propiedad, equipo, organización y estado de cuenta |
| P0 · Llamadas y aislamiento de fallos | Restaurar contrato de vistas si se confirma el incidente, mantener Contactos operativo ante fallo independiente | `useCrm.js`, shell, servicio; llamadas, vistas, perfiles, prospectos | Metadatos de staging y versión desplegada. Riesgo de recuentos o visibilidad incorrectos. Media | Vistas devuelven datos sintéticos autorizados, fallos acotados a la sección. Pruebas de fallo parcial, sesión con cada rol y conteos de hoy/vencidas |
| P0 · Adjuntos y auditoría | Privacidad, trazabilidad y reparación de fallos entre Storage y SQL | Servicio de llamadas, bucket, imagenes_llamadas, historial y auditoría | RLS/grants y política de retención. Riesgo de datos huérfanos. Media | URL emitida solo para actor autorizado, conciliación y registro auditable. Pruebas de subida/registro fallido y expiración con fixtures |
| P1 · CRM comercial persistente | Habilitar embudo y cotización transaccional con traspaso de responsabilidad | Vistas, adaptadores, config; prospectos, oportunidades, etapas, historial, cotizaciones y conceptos | P0 y contrato SQL validado. Riesgo de mezcla demo/real y actualizaciones perdidas. Alta | E2E de alta a emisión y aprobación con dos sesiones, validación de moneda, concurrencia, folio y totales del servidor |
| P1 · Charter, reserva y coordinación | Formalizar la entrega de una cotización aceptada a operación comercial | Oportunidades/Cotizaciones, futuras vistas de reserva; solicitudes, segmentos, reservas, operación y pasajeros separados | Comercial persistente, política de pasajeros. Riesgo de exposición y errores de zona. Alta | Confirmación con operador, cambio, cancelación y cierre separados de la venta. Pruebas de ida y vuelta de zona, traspaso y acceso |
| P1 · Finanzas y expediente legal | Registrar facturas, pagos y costos, y vincular documentos aprobados | Cotizaciones/PDF, futuras áreas Legal y Finanzas; facturas, pagos, costos, documentos, contratos | Reserva, capacidades y reglas fiscales/legales aprobadas por la empresa. Riesgo de doble aplicación. Alta | Importes conciliados, versiones de contratos, auditoría de aprobación. Pruebas de pago parcial, repetición, reembolso y descarga restringida |
| P1 · Aircraft Sales | Reutilizar tablero con embudo propio, inventario y expediente de cierre | TableroOportunidades, oportunidades, módulo de inventario; aeronaves, listings, ofertas, documentos | Pipeline persistente y acceso documental. Riesgo de compartir matrícula o serie fuera del expediente. Alta | Operación trazada desde prospecto a entrega. Pruebas de visibilidad, oferta vigente y transición condicionada |
| P2 · Métricas, UX y agenda | Indicadores server-side, búsquedas y paginación completas, dashboards y agenda | Dashboard, Reportes, métricas, router, Contactos/Llamadas; vistas o agregados y actividades | Datos de P1. Riesgo de interpretar muestras como totales. Media | Conciliación con fixtures superiores a 200 registros, navegación teclado/móvil y medición de carga |
| P2 · Automatización | Entrega idempotente, alertas de negocio, recuperación y monitoreo | Realtime, notificaciones, RPC/Edge; outbox, tareas y eventos | Eventos con identificador y catálogo de responsables. Riesgo de duplicados y entrega tardía. Media/alta | Reintento, reentrega y recuperación probados con registro de resultado por destinatario |
| P2 · Marketing y Atención | Captar origen y consentimiento y registrar posventa, tickets y satisfacción | Contactos, área marketing/soporte; fuentes, campañas, consentimientos y tickets | Ficha canónica, eventos y acceso limitado. Riesgo de pérdida del origen o uso de consentimiento revocado. Media | Captura atribuida, baja efectiva y acceso restringido. Pruebas de deduplicación y ausencia de campos sensibles en exportes |
| P3 · Concierge e integraciones | Añadir proveedores, servicios, preferencias y confirmaciones; conectar canales/sistemas aprobados | Catálogos, oportunidades, reserva; proveedores, servicios, cotizaciones y eventos | Servicios y costos consolidados. Riesgo de propagación de preferencias y fallas externas. Alta | Flujo de solicitud a completado y cobro vinculados, pruebas de cancelación, fallo externo, permisos y reintentos |

## Evidencia mínima para completar la verificación remota

1. **Exportación de solo metadatos de staging**, con referencia de versión y fecha, o acceso temporal equivalente de solo lectura sin acceso a filas comerciales. Incluir esquema de objetos CRM y dependencias Auth/Storage, constraints, índices, triggers, RLS, grants, RPC, propietarios y opciones de seguridad, configuración de esquemas expuestos y publicación Realtime. Los diagnósticos [Centro de Llamadas](sql/auditoria-centro-llamadas-staging.sql), [integración CRM](sql/diagnostico-integracion-crm.sql) y [cotizaciones](sql/diagnostico-cotizaciones.sql) sirven de punto de partida. Redactar cualquier secreto que figure en definiciones o configuraciones.
2. **Evidencia de configuración y lectura autenticada en staging**, sin credenciales, tokens ni datos personales en el reporte. Incluir resultados de cuentas sintéticas existentes administrador/supervisor/ejecutivo, con dos responsables distintos, para confirmar lectura permitida y denegada de contactos, llamadas, oportunidades, cotizaciones y adjuntos cuando existan. Adjuntar versión de Edge, ajustes de Auth/MFA/recuperación, fecha del último respaldo y evidencia del último ensayo de restauración. Para extrapolar a producción se requiere comparación de metadatos y configuración de ese entorno; las pruebas con fixtures pueden quedarse en staging.

La validación efectiva de escrituras y transiciones reales requerirá una fase posterior autorizada sobre datos sintéticos descartables. En esta auditoría no se ejecutaron migraciones, consultas remotas ni mutaciones.
