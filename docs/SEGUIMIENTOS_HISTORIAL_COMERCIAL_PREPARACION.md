# Preparación: Seguimientos e Historial comercial unificado

## Punto de partida reutilizable

El CRM ya crea seguimientos mediante la RPC `crear_seguimiento_llamada`. El
seguimiento queda ligado a la llamada base mediante `llamada_padre_id`. El
historial de una llamada se lee de `public.historial_llamadas`; las oportunidades
cuentan por separado con `eventos_oportunidad`.

No se añadieron consultas, tablas ni escrituras para unificar estos orígenes:
no está confirmado el contrato que permitiría asociar una llamada o una
cotización a una oportunidad sin perder las políticas RLS existentes.

## Contrato mínimo a confirmar en staging

1. La relación persistida entre `llamadas`, `prospectos` y, si existe,
   `oportunidades`.
2. Las columnas y RLS de `historial_llamadas` y `eventos_oportunidad`.
3. El origen de los eventos de cotización: auditoría existente o una vista/RPC
   autorizada. No se deben derivar eventos ficticios desde la interfaz.
4. La regla de visibilidad por administrador, supervisor y ejecutivo para un
   historial de prospecto u oportunidad.
5. Orden estable, paginación y campos no sensibles de un evento unificado:
   identificador, tipo, fecha, actor, entidad, resumen y enlace de navegación.

## Diseño de integración propuesto

Preparar una RPC o vista de solo lectura autorizada por RLS que reciba un único
identificador de prospecto u oportunidad y entregue eventos normalizados. La
implementación debe resolver el actor a partir del JWT y no aceptar filtros de
rol enviados por Vue. Las escrituras de seguimiento permanecen en la RPC actual;
el historial unificado solo las refleja tras confirmarse desde PostgreSQL.

Antes de desarrollar esa consulta se necesitan las firmas y columnas reales.
Así se evita mezclar `historial_llamadas`, `eventos_oportunidad` y una futura
auditoría de cotizaciones con suposiciones sobre FKs o permisos.
