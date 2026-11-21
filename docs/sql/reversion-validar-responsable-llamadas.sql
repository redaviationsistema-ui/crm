-- BORRADOR. Requiere aprobación y comprobación previa de dueño y dependencias.
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP TRIGGER validar_responsable_llamada ON public.llamadas;
DROP FUNCTION crm_internal.validar_responsable_llamada();
COMMIT;
