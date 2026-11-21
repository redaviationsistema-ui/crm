-- BORRADOR. Aplicar solo con aprobación posterior y catálogo de staging verificado.
-- El nombre y tipo de los objetos son requisitos por confirmar, no hechos desplegados.
-- Ejecutar como propietario interno previamente aprobado, con acceso a perfiles para FOR SHARE.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION crm_internal.validar_responsable_llamada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $funcion$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.asignado_a IS NOT DISTINCT FROM OLD.asignado_a THEN
      RETURN NULL;
    END IF;
  END IF;

  IF NEW.asignado_a IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'El responsable debe ser un ejecutivo activo.';
  END IF;

  PERFORM 1
  FROM public.perfiles AS perfil
  WHERE perfil.id = NEW.asignado_a
    AND perfil.rol = 'ejecutivo'
    AND perfil.activo IS TRUE
  FOR SHARE OF perfil;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'El responsable debe ser un ejecutivo activo.';
  END IF;

  RETURN NULL;
END;
$funcion$;

REVOKE EXECUTE ON FUNCTION crm_internal.validar_responsable_llamada()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER validar_responsable_llamada
AFTER INSERT OR UPDATE ON public.llamadas
FOR EACH ROW EXECUTE FUNCTION crm_internal.validar_responsable_llamada();

COMMIT;
