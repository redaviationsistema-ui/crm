# Integración operativa del CRM — Fase 1

## Hallazgos verificados en el código local

| Flujo | Estado local | Límite conocido |
| --- | --- | --- |
| Contactos | Lectura, alta y edición autenticadas contra `prospectos`; el formulario busca posibles duplicados entre los contactos que ya recibió. | No se verificó la política RLS ni una restricción de unicidad en PostgreSQL. La búsqueda de duplicados del formulario no garantiza deduplicación concurrente ni cubre filas ocultas por RLS. |
| Oportunidades | Existe un adaptador Supabase para leer contactos, embudos, etapas y oportunidades; usa `crear_oportunidad` y `actualizar_oportunidad`, y lee `eventos_oportunidad`. | La configuración local falla cerrada y el adaptador real no está habilitado. Sus pruebas usan dobles, no Supabase. Los nombres y etapas actuales de PostgreSQL no se verificaron durante esta tarea. |
| Cotizaciones | Adaptador Supabase, formulario, listado, edición de borradores y PDF desde el registro persistido están preparados. El adaptador usa exclusivamente `crear_cotizacion`/`actualizar_cotizacion`, relee la respuesta y relaciona oportunidad → prospecto bajo RLS. | El modo real permanece bloqueado hasta completar el mapeo de columnas, las verificaciones de contratos/RLS y las pruebas auténticas en staging. La demostración no se usa como fallback del modo real. |
| Llamadas y seguimientos | Lectura/escritura autenticada de llamadas; operaciones de inicio, cierre y creación de seguimiento usan RPC. Los seguimientos son llamadas relacionadas por `llamada_padre_id`. | La relación visible es con llamada y contacto; no se encontró una relación con `oportunidad_id`. No se verificaron las políticas RLS ni el comportamiento de deduplicación de la RPC remota. |
| Historial | Existe historial de llamadas en `historial_llamadas` y un historial separado de oportunidades en `eventos_oportunidad`. | No se encontró un historial comercial unificado por contacto ni eventos de cotización. |
| Panel y reportes | Los indicadores locales se calculan con las llamadas cargadas desde Supabase. | Son parciales respecto del conjunto completo del CRM; no representan cotizaciones u oportunidades. |
| Equipo | La ruta existe, pero el shell la presenta con la vista de módulo en preparación. | No es un módulo operativo conectado. |

El alta y la edición de contactos envían cambios al servicio Supabase; Guardar no depende de la interfaz de oportunidades. El adaptador de oportunidades relaciona una oportunidad con un `prospecto_id`, pero la escritura real requiere primero validar staging. Por lo tanto, todavía no se puede afirmar que el recorrido Contacto → Oportunidad → Cotización → Seguimiento → Historial funcione de extremo a extremo.

Se quitaron los registros de consola que imprimían payloads de llamadas y seguimientos. Esta protección no sustituye la revisión de permisos y RLS.

## Bloqueos que se conservan

- No se habilitó el modo real de oportunidades: requiere un proyecto staging independiente, destino coincidente, clave pública no privilegiada y evidencia de todas las pruebas de permisos configuradas en `src/modulos/oportunidades/esquemas/contratoOportunidadesSupabase.js`.
- No se activaron escrituras de oportunidades contra producción.
- Las cotizaciones reales permanecen bloqueadas hasta validar staging; sus propuestas de endurecimiento están separadas en [`sql/cotizaciones-mejoras-propuestas.sql`](./sql/cotizaciones-mejoras-propuestas.sql).
- No se ejecutó SQL, no se escribieron datos remotos y no se desplegó código.
- Las pruebas locales existentes verifican lógica con dobles/fixtures; no prueban persistencia en staging o producción.

## Consulta de diagnóstico manual

Ejecutar únicamente en un proyecto staging independiente después de confirmar el proyecto seleccionado en Supabase Dashboard. El archivo [`sql/diagnostico-integracion-crm.sql`](./sql/diagnostico-integracion-crm.sql) contiene consultas `SELECT` para:

1. Comparar embudos, etapas y cantidad de oportunidades asociadas con el plan maestro, sin mostrar datos de contacto.
2. Detectar oportunidades con una etapa que no corresponda al embudo, solo mediante un conteo.
3. Inspeccionar columnas, relaciones, funciones, políticas RLS y privilegios relacionados con cotizaciones y el flujo comercial.

No ejecutar ninguna consulta de escritura. Comparar manualmente las cuatro líneas de negocio esperadas —venta de aeronaves, motores, refacciones y vuelos privados— con los embudos y etapas encontrados antes de hacer cambios.

## Siguiente paso concreto

Ejecutar las pruebas de Cotizaciones con usuarios y datos sintéticos únicamente en staging: lectura RLS, creación, edición, conceptos, PDF, autorización por rol y concurrencia. No habilitar producción hasta que ese flujo esté probado y autorizado por el backend. En paralelo, la preparación concreta de Seguimientos e Historial comercial está en [`SEGUIMIENTOS_HISTORIAL_COMERCIAL_PREPARACION.md`](./SEGUIMIENTOS_HISTORIAL_COMERCIAL_PREPARACION.md).
