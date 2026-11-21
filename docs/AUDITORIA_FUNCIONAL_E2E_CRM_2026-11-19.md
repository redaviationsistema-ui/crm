# Auditoría funcional del CRM de Sky Group Aviation

19 de noviembre de 2026

## G. Resumen ejecutivo

El CRM tiene recorridos locales comprobados para navegación, validación de contactos, agenda de seguimiento, embudo de demostración, cálculos y PDF de cotización, y administración con dobles. **La operación empresarial end-to-end queda sin certificar.** Se reprodujeron fallos que pueden impedir abrir Contactos, excluir llamadas del día seleccionado o presentar una operación de llamada aceptada como fallida.

Oportunidades opera con datos de demostración en sesión o memoria. Cotizaciones permanece bloqueada en la ruta habitual y se prueba con un servicio inyectado. Equipo y Configuración son informativos. Reservas y cobros quedan fuera de la implementación local observada.

Ninguna escritura comercial en PostgreSQL se verificó en esta ejecución. El entorno de staging configurado protege las escrituras CRM y no se aportó evidencia actual de cuentas sintéticas autorizadas ni de un conjunto de datos aislado apto para esta auditoría. La compilación, los dobles del SDK y las pruebas del ejecutor Edge acreditan solo su capa. No se consultó Supabase remoto, ni se usaron credenciales o datos personales.

**Medición.** El denominador son las 36 familias de interacción de la matriz A, agrupadas por acción y contrato de datos. Se verificó de extremo a extremo mediante navegador autenticado y PostgreSQL el **0 de 36 (0%)**. Este porcentaje mide evidencia remota obtenida en esta ejecución. En la suite local pasaron **222 de 225 casos registrados (98.7%)**, con tres omitidos y ningún fallo. Los porcentajes tienen unidades distintas. La corrección urgente es aislar el arranque de Contactos y resolver la ambigüedad de guardado de Llamadas. Antes de habilitar un piloto, completar la evidencia de entorno, persistencia, visibilidad por responsable y autorización de servidor.

## A. Matriz funcional e inventario por interacción

Estados: **V** FUNCIONA Y ESTÁ VERIFICADO en el ámbito explícito · **P** FUNCIONA PARCIALMENTE · **F** FALLA · **D** UTILIZA DATOS DE DEMOSTRACIÓN · **B** BLOQUEADO INTENCIONALMENTE · **I** NO IMPLEMENTADO · **N** NO VERIFICABLE.

| # | Ruta / componente | Acción esperada | Comportamiento observado | Servicio y recurso relacionado | Evidencia | Resultado | Prioridad |
|---|---|---|---|---|---|---|---|
| 1 | /login · LoginView | Iniciar sesión y mostrar errores | Llama a Auth y evalúa perfil activo | useAuthSession · Auth / perfiles | Código, guardas con dobles | P | P1 |
| 2 | /establecer-acceso · EstablecerAccesoView | Confirmar contraseña desde sesión válida | Verifica identidad, igualdad y mínimo local, invoca updateUser | Auth | Código, sesión real pendiente | N | P1 |
| 3 | Todas · CrmSidebar / CrmShellView | Navegar, abrir menú, perfil y salir | Menú por rol, perfil lleva a Configuración, cierre vía Auth | router, useAuthSession | rutas.test.js para guardas, código para salida | P | P2 |
| 4 | / · DashboardView | Abrir próxima llamada, iniciar, programar o ver reportes | Reutiliza acciones de llamadas y muestra indicadores cargados | useCrm · vistas de llamadas e iniciar_llamada | Cableado y crmMetrics.test.js | P | P2 |
| 5 | /contactos y /prospectos · ProspectosView | Listar y aplicar búsqueda y filtros | Filtra filas cargadas. Un fallo de llamadas impide montar la vista | obtenerProspectos · prospectos | E01 y guarda del shell | F | P1 |
| 6 | /contactos · ProspectosView | Ver ficha, pestañas de resumen, llamadas e historial | Usa contacto cargado y subconjunto del resumen telefónico | useCrm · prospectos / vista_llamadas_detalle | Código, completitud pendiente | P | P2 |
| 7 | /contactos · FormularioContacto | Alta, edición, mercado y responsable | Valida y actualiza listado con dobles. Garantía de alcance y guardado real pendiente | crearProspecto / actualizarProspecto · prospectos | contactosFormulario y contactosGuardado | P | P1 |
| 8 | /contactos · FormularioContacto | Cancelar, detectar duplicado, ver ficha o confirmar excepción | Validación local sobre registros disponibles y manejo de error de unicidad. Unicidad remota NV | contactoPayload, useCrm · prospectos | Pruebas de formulario y revisión estática | P | P2 |
| 9 | /contactos · ProspectosView | Programar desde menú de contacto | Transfiere ID al formulario de llamada | programarLlamada · prospectos → llamadas | Inspección de eventos | P | P1 |
| 10 | /llamadas · FiltrosLlamadas | Cambiar pestaña, mercado, estado, prioridad y responsable | Construye filtros REST. Pestañas predefinidas prevalecen sobre estado/responsable | obtenerLlamadas · vista_llamadas_detalle | E05, cableado | P | P2 |
| 11 | /llamadas · FiltrosLlamadas | Buscar texto y fecha | Busca en primera página. La fecha compara prefijo de timestamp | useCrm · vista_llamadas_detalle | E02 y E05 | F | P1 |
| 12 | /llamadas · TablaLlamadas | Abrir detalle, ver cliente, estado e historial | Consulta fila y luego eventos; rechazo de selección requiere manejo propio | obtenerLlamada / obtenerHistorial · vista_llamadas_detalle / historial_llamadas | Código, E07 | P | P1 |
| 13 | /llamadas · FormularioLlamada | Programar o editar contacto, motivo, prioridad, responsable y fecha | Payload y actualización conectados, escritura de staging protegida | crearLlamada / actualizarLlamada · llamadas / catálogos | Código y E02, E09 | P | P1 |
| 14 | /llamadas · Tabla / Drawer | Iniciar llamada desde fila o detalle | RPC y recarga en mismo bloque de error | iniciarLlamada · iniciar_llamada | Contrato en código, E04 | P | P1 |
| 15 | /llamadas · FormularioResultado | Guardar resultado, respuesta, duración y notas | La duración ingresada no llega al servicio | finalizarLlamada · finalizar_llamada | E03, doble de servicio | F | P1 |
| 16 | /llamadas · Detalle / Modales | Reasignar, reprogramar y cancelar; volver sin guardar | Cada acción emite y llama a actualización. Reasignar y reprogramar cierran incluso tras error capturado | reasignarLlamada / reprogramarLlamada / cancelarLlamada · llamadas | Código, E04, E08 | P | P1 |
| 17 | /llamadas y /seguimientos · FormularioResultado | Agendar seguimiento desde llamada padre | Envía ID padre, responsable y fecha. Atomicidad e idempotencia remotas pendientes | crearSeguimiento · crear_seguimiento_llamada | Código y contratos | P | P1 |
| 18 | /seguimientos · SeguimientosView | Ver Hoy, Próximos, Atrasados y Completados, cambiar categoría y abrir detalle | Render, detalle y vacío comprobados con fixture. Hoy y Completados pueden compartir una misma llamada por criterio | useCrm · resumen de llamadas / vista_llamadas_vencidas | seguimientosVista.test.js y E02 | P | P2 |
| 19 | /seguimientos · Drawer | Cambiar estado o reprogramar actividad | Reutiliza el mismo ID y los servicios de llamadas | iniciar/finalizar/reprogramar · llamadas y RPC | Cableado, sin recarga real verificada | P | P1 |
| 20 | /historial · HistorialView | Consultar llamadas realizadas, resultado, responsable y notas | Recibe resumen general y lo recorre sin filtro de finalización | useCrm · vista_llamadas_detalle | E06 | F | P2 |
| 21 | /oportunidades · Lista/Tablero | Filtrar embudo, etapa, servicio, responsable, estado, moneda, prioridad y búsqueda | Tablero y filtros de demostración | servicioOportunidades · sessionStorage/memoria | oportunidades y oportunidadesVista | D | P2 |
| 22 | /oportunidades · FormularioOportunidad | Alta, edición, cambio de etapa, monto, responsable e historial | Guarda y recarga datos de demostración. Se prueban conflictos simulados | servicioOportunidades y adaptador · oportunidades, etapas, eventos_oportunidad / RPC | oportunidades y oportunidadesSupabase | D | P1 |
| 23 | /oportunidades · Lista | Gestionar etapas, limpiar, recargar o restablecer | Administración de etapas y reset en demo, confirmación local | servicioOportunidades · sessionStorage | oportunidadesVista.test.js | D | P2 |
| 24 | /oportunidades · fábrica navegador | Seleccionar persistencia Supabase | Controles de destino y verificaciones dejan desactivado el acceso real | contratoOportunidadesSupabase | oportunidadesSupabase.test.js | B | P1 |
| 25 | /cotizaciones · Lista | Abrir ruta y operar solo con servicio habilitado | Ruta protegida accesible a perfil activo, servicio bloqueado en condiciones actuales | crearCotizacionesNavegador · adaptador condicionado | rutas y cotizacionesVista | B | P1 |
| 26 | /cotizaciones · Formulario | Seleccionar oportunidad, agregar/quitar partidas, validar, calcular y guardar | Flujo probado con servicio demo inyectado. La fábrica operativa requiere oportunidades reales | dominio / servicio · cotizaciones, cotizacion_conceptos y RPC | cotizaciones, cotizacionesVista y cotizacionesSupabaseAdapter | D | P1 |
| 27 | /cotizaciones · Lista / VistaPrevia | Buscar y filtrar, editar borrador, previsualizar, descargar PDF, recargar/restablecer según modo | Estados, PDF y presentación probados con fixtures. La ruta normal conserva el bloqueo | cotizacionPdf / servicioCotizaciones | cotizacionPdf y cotizacionesVista | D | P1 |
| 28 | /admin/usuarios y /usuarios · UsuariosAdminView | Listar, buscar por nombre/correo, filtrar rol/estado y recargar | Vista y cliente simulados. Ruta limitada a administrador | usuariosAdminService · Edge admin-usuarios / perfiles | usuariosAdminVista y rutas | P | P1 |
| 29 | /admin/usuarios/nuevo y editar/:usuarioId | Invitar, asignar rol, editar y operar contraseña cuando autorizada | Formulario, validación, generación y ejecutor simulados. Entrega e inicio Auth pendientes | admin-usuarios · Auth / perfiles | usuariosAdminPassword, executor y vistas | P | P1 |
| 30 | /admin/usuarios/estado/:usuarioId y eliminar/:usuarioId | Confirmar estado o eliminación y cuidar cuentas privilegiadas | Restricciones y confirmaciones comprobadas localmente. No se tocaron cuentas reales | admin-usuarios · Auth / perfiles / auditoría | usuariosAdminVista y executor | P | P0 |
| 31 | /admin/usuarios/historial, diagnostico y recargar | Leer auditoría, diagnosticar y refrescar | Flujos locales, diagnóstico condicionado. Despliegue y datos reales NV | admin-usuarios / usuariosAdminDiagnostico · auditoria_usuarios | usuariosAdminDiagnostico y vistas | P | P1 |
| 32 | /reportes · ReportesView | Ver indicadores y filtrar detalle por estado | KPIs del resumen de hasta 200 y consulta aparte de vencidas, con alcance visible. El filtro afecta únicamente al detalle | useCrm / crmMetrics · vistas de llamadas | crmMetrics.test.js y E05 | P | P2 |
| 33 | /reportes · ReportesView | Exportar y consultar totales del negocio | No se observó exportador ni agregados generales | — | Ruta y componente | I | P2 |
| 34 | /equipo y /configuracion · PlaceholderView | Ver productividad y editar ajustes | Marcadores informativos. Configuración por URL solo exige sesión activa | router | E10 | I | P2 |
| 35 | Shell · servicio de CRM | Recibir cambios y notificaciones, leer o marcar | Suscripción y RPC en código. Falta bandeja navegable y comprobación de publicación y fallos | Realtime · llamadas, notificaciones / marcar_notificacion_leida | Código, E07 | N | P2 |
| 36 | Sin rutas operativas · adjuntos, reservas/cobro | Descargar documentos de forma autorizada y continuar a reserva y cobro | Existe servicio de adjuntos de llamada. No se acreditó interfaz documental operativa ni módulos de reserva/cobro | Storage e imagenes_llamadas; reserva/cobro sin contrato local | Servicio y router | I | P1 |

Fuentes principales: [rutas](../src/router/index.js), [shell](../src/views/CrmShellView.vue), [composable](../src/composables/useCrm.js), [servicio CRM](../src/services/crmSupabaseService.js), [pruebas](../tests).

## B. Matriz de integración

| Flujo | Vue | Supabase | PostgreSQL | Resultado |
|---|---|---|---|---|
| Prospecto → Contacto | Alias /prospectos y ficha canónica comparten modelo | Consulta/alta/edición previstas | prospectos, integridad y unicidad pendientes | Parcial local |
| Contacto → Llamada | ID de contacto pasa a selector/formulario. Responsable y fecha se introducen | INSERT llamadas y lecturas asociadas | FK, asignación, estado inicial y visibilidad NV | Conectado por código |
| Llamada → Seguimiento | Operador selecciona llamada padre, responsable y horario | RPC crear_seguimiento_llamada | Relación padre/hijo y auditoría NV | Conectado por código |
| Seguimiento → Oportunidad | Sin traspaso persistente comprobado. Oportunidades trabaja en demo | Adaptador desactivado | Identidad, historia y relación NV | Interrumpido |
| Oportunidad → Cotización | La interfaz del módulo entrega catálogo demo a su flujo simulado. El flujo real exige catálogo real | Adaptadores probados con dobles y protegidos por configuración | FK, conceptos, guardado, concurrencia y totales NV | Demo / bloqueado |
| Cotización → Reserva → Cobro | Sin recorrido disponible | Sin contrato versionado de ese recorrido | NV | No implementado |
| Usuario → Asignación → Llamada → Resultado → Reporte | Selección de responsable, filtro por actor y proyección a KPI. Duración editable se descarta | Lecturas de perfiles, actualizaciones de llamadas y RPC | Permisos cruzados, auditoría y conciliación de métricas NV | Parcial, con fallos reproducidos |
| Administrador → Alta → Rol → Login | Flujo administrativo con dobles, guardas y validación | Edge y Auth en código | Transacción, creación de perfil, sesión posterior y auditoría NV | Parcial local |

## C. Matriz de seguridad

| Rol | Recurso | Operación | Esperado | Observado | Resultado |
|---|---|---|---|---|---|
| Anónimo o sin sesión | Rutas CRM | URL directa | Redirigir a Login | Guarda y prueba local | V en router |
| Perfil ausente o inactivo | Rutas CRM | Acceso | Rechazar sesión | Código de guarda y cierre. Revocación real NV | P |
| Ejecutivo | Equipo, Reportes, Usuarios | Navegación y URL | Denegar | Roles limitados por router; cobertura local de guardas | V en router |
| Supervisor | Equipo y Reportes / Usuarios | Permitir consulta operativa / denegar administración | Separación por rol | Guardas locales y menú | V en router |
| Administrador activo | Administración | Listar, invitar, editar, estado, auditoría | Autorizar tras verificar actor | Código Edge y dobles positivos/negativos | P |
| Supervisor/ejecutivo | Edge admin-usuarios | Invocar acciones administrativas | Denegar en servidor | Handler/ejecutor simulados. JWT reales omitidos | P |
| Administrador | Cuenta propia y último administrador | Cambiar rol, baja o eliminación | Aplicar restricciones | Pruebas locales de dominio, vistas y ejecutor | P |
| Ejecutivo A y B | Prospectos, llamadas, historial, Storage | Leer, crear, editar, asignar y descargar bajo alcance | Denegar acceso ajeno salvo delegación explícita | Filtros visuales e identificadores en consultas. RLS, permisos de vistas y RPC NV | N |
| Roles activos | Cotizaciones y oportunidades | Mutar | Respetar bloqueos y autenticación | Fábricas y adaptadores con dobles | V para bloqueo local |
| Roles activos | Configuración | Entrada directa | Confirmar regla de negocio | Menú administrador, URL disponible a perfil activo; marcador | P |
| Operaciones, Finanzas, Legal | Datos departamentales, exportación | Acceder por capacidad | Separación y mínimo privilegio | Roles específicos ausentes del router local, políticas remotas sin evidencia | N |

Para cerrar esta matriz se requiere evidencia de metadatos efectiva para SELECT/INSERT/UPDATE/DELETE, grants y ejecución de funciones, opciones de seguridad de vistas, Storage y publicación Realtime, más comprobaciones positivas y negativas con sesiones sintéticas autorizadas. Una condición Vue no acredita RLS.

## D. Registro de errores y riesgos

| ID / severidad | Reproducción y esperado | Observado, evidencia y causa | Recomendación / riesgo del cambio / regresión |
|---|---|---|---|
| E01 · P1 | Inyectar sesión y prospectos correctos y un rechazo en obtenerLlamadas. Abrir Contactos debe mostrar prospecto sintético | Reproducido en Node con useCrm real y servicio doble. La lista se pobló y la condición del shell devolvió false. Promise.all propaga el rechazo a estado.error global | Independizar carga, estado y error por sección. Riesgo medio por arranque compartido. Prueba con Contactos exitoso y Llamadas fallando, además de la combinación inversa |
| E02 · P1 | En America/Mexico_City programar 19/11/2026 23:30 y filtrar 19/11. El registro debe aparecer bajo el día mostrado | Reproducido. La fecha guardable es 20/11 05:30Z, el helper local la reconoce el 19 y el filtro por prefijo la excluye. El modal de reprogramación envía fecha sin offset a update, mientras el alta convierte a ISO | Acordar zona de negocio y usar intervalos de un día en esa zona, mismo contrato de conversión en alta/reprogramación. Riesgo alto por datos previos. Pruebas alrededor de medianoche, offsets y DST con guardado/lectura |
| E03 · P1 | Enviar 47 minutos desde el resultado. Definir y reflejar la duración editable | Reproducido con doble de finalizarLlamada. Formulario emite duración, useCrm y el RPC cliente la omiten. El servidor podría calcularla por separado | Primero confirmar contrato RPC y autoridad del valor. Riesgo medio. Prueba de campo a dato persistido o retirar el campo en fase aprobada si la duración es exclusivamente automática |
| E04 · P1 | Simular RPC exitosa y fallo durante refresco. Informar que el guardado fue aceptado y permitir solo recargar | Reproducido en finalizarLlamada. Mismo catch para RPC y recarga. Patrón presente en otras mutaciones y falta de guardia explícita en varias acciones de Llamadas | Separar confirmación y recarga. Riesgo medio. Pruebas de doble envío, fallo posterior y reintento sin duplicados |
| E05 · P2 | Buscar llamada fuera de los primeros 100 registros o usar responsable/estado en una pestaña que los fija. Conciliar detalle con KPIs de mismo alcance | Inspección de useCrm y servicio. Sin navegación de páginas, texto/fecha solo locales y precedencia de pestaña. Reportes declara alcance parcial y filtro de detalle independiente. Vencidas usa fuente separada | Paginación y búsqueda remota bajo el alcance autorizado. Mantener KPIs con fuente explícita. Riesgo medio. Fixtures con más de 200 filas y fuentes con distinto alcance |
| E06 · P2 | Entregar resumen con una llamada pendiente a Historial. Una sección anunciada como llamadas realizadas debería excluirla | El shell pasa todo el resumen y la vista itera sin filtrar. Evidencia estática de HistorialView y CrmShellView | Acordar estados elegibles y filtrar en la fuente correcta. Riesgo bajo. Prueba con pendientes, completadas y canceladas |
| E07 · P2 | Rechazar detalle o historial, emitir error/cierre de Realtime y cambiar de vista durante lectura | Inspección. SeleccionarLlamada abre drawer antes de leer y carece de catch propio. Suscripción sin manejo visible de estado, callbacks con lecturas asíncronas. Orden de respuestas durante navegación NV | Aislar errores, registrar estado del canal e impedir aplicar respuestas obsoletas. Riesgo medio. Pruebas de consulta rechazada, timeout, eventos tardíos y reconexión |
| E08 · P1 | Rechazar reasignación o reprogramación con doble. El usuario debería conservar formulario y tener feedback contextual | Código. Estado de error capturado en operación interna y cierre incondicional en confirmación externa. Fecha vacía puede terminar sin feedback en confirmación | Propagar resultado explícito y mantener abierto el formulario ante rechazo. Riesgo bajo a medio. Pruebas de rechazo, validación y confirmación |
| E09 · riesgo P0 | Comparar destino development y production sin ejecutar escrituras | src/lib/supabase.js asigna el mismo proyecto a ambas modalidades. El bloqueo específico de staging no cubre development dirigido a producción. No se observó una mutación de producción | Aislar desarrollo y validar identidad de destino antes de ejecutar pruebas remotas. Riesgo medio. Pruebas de destinos y claves públicas, sin conexión a producción |
| E10 · P2 | Comparar rol Ejecutivo en menú y URL /configuracion | Menú omite el acceso, router lo admite con sesión. La vista actual es un marcador, impacto privilegiado sin confirmar | Definir política de Configuración antes de conectar acciones. Riesgo bajo con pruebas del router por rol |

## E. Cobertura, resiliencia y fechas

- Suite local con las tres banderas remotas desactivadas: 225 casos, 222 aprobados, 0 fallidos, 3 omitidos. Las omisiones fueron JWT reales de roles, CRUD con cuenta descartable y alta/reemplazo de contraseña en staging. Vite compiló en directorio temporal y mantuvo el aviso de chunk grande.
- Las comprobaciones focalizadas en memoria usaron el composable existente con servicio doble y aserciones sobre la condición real de la vista. Confirmaron E01, E02, E03 y E04 sin cambiar archivos de aplicación ni registrar pruebas nuevas en la suite. El primer intento falló por resolver mal un import relativo del arnés. Se corrigió la resolución temporal y la ejecución posterior terminó con código cero.
- La suite cubre localmente guardas, error de permisos de contactos, duplicados de formulario, refresco posterior al guardado, envíos simultáneos de contactos, conflictos de cotización/oportunidad, respuestas RPC ambiguas y casos administrativos. Persistencia cross-session, FK, unicidad y concurrencia PostgreSQL permanecen pendientes. Quedan pendientes reconexión real, caducidad de sesión, timeout extremo a extremo y cambio de ruta durante solicitudes.
- Se ejecutó la misma entrada local 19/11/2026 23:30 con TZ UTC, Ciudad de México, Madrid y Nueva York. Resultó respectivamente 19/11 23:30Z, 20/11 05:30Z, 19/11 22:30Z y 20/11 04:30Z. Nueva York normalizó 08/03/2026 02:30, hora local inexistente por cambio estacional, a 07:30Z. Esto caracteriza el JavaScript del host. La zona del usuario depende del entorno local, la zona del aeropuerto no se elige y el tipo/zona efectiva de almacenamiento requiere catálogo y lectura posterior de PostgreSQL.
- No hubo sesión de navegador ni captura nueva. La fase de QA anterior documentó abortos de Chrome/Brave y la falta de una sesión WebKit funcional. La disponibilidad de exploración visual y automatización E2E sigue pendiente.
- En Reportes, verificar con fixtures que total y detalle coincidan solo cuando comparten fuente, filtro y periodo. Casos reales requeridos: más de 200 registros, vencidas fuera del resumen, filas de responsables distintos, resultado nulo y duración de cero.

## F. Plan de corrección para aprobación

1. **P0 · Entornos y evidencia de seguridad.** Aislar development. Obtener metadatos y resultados sintéticos de autorización en staging por recurso. Confirmar RLS/grants, vistas, RPC, Edge y Storage antes de cualquier habilitación. Si se detecta una autorización indebida o una exposición, tratarla como incidente confirmado con evidencia separada.
2. **P1 · Disponibilidad de Contactos.** Corregir E01 en shell y composable con errores acotados, carga independiente y regresión con fallos parciales.
3. **P1 · Escrituras y fechas de Llamadas.** Corregir E02, E03, E04 y E08 por cambios pequeños. Establecer formato y zona acordados, comprobar duración y distinguir confirmación, recarga y estado incierto.
4. **P2 · Consistencia de listados y resiliencia.** Resolver E05, E06, E07 y decidir E10 antes de añadir privilegios. Verificar paginación, detalle, histórico, canales y transiciones concurrentes.
5. **P3 · Ampliación de automatización.** Añadir una matriz reproducible de navegador y trazabilidad de fixtures una vez disponible el entorno. Añadir casos para flujos sin cobertura y documentar alcance de notificaciones y archivos.

**Evidencia mínima pendiente.** Staging aislado con metadatos redactados, cuentas sintéticas autorizadas administrador/supervisor y al menos dos ejecutivos, identificadores ficticios y autorización específica para escrituras descartables si se desea probar persistencia. Para cada operación registrar el estado inicial, acción, cambio persistido por consulta independiente, visibilidad tras recargar y evento de auditoría. La auditoría actual finaliza en diagnóstico. Solo se agrega este documento.
