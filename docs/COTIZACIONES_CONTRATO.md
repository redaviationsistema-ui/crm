# Cotizaciones — contrato de persistencia

## Estado confirmado por el usuario

- Existen `public.cotizaciones` y `public.cotizacion_conceptos`, ambas con RLS habilitado.
- `authenticated` puede leer, pero no tiene INSERT/UPDATE/DELETE directos.
- Relaciones: `cotizaciones.oportunidad_id → oportunidades.id` (RESTRICT), `cotizaciones.creado_por → perfiles.id` y `cotizacion_conceptos.cotizacion_id → cotizaciones.id` (CASCADE).
- Restricciones: PKs, folio único, monedas USD/MXN/EUR, estados `borrador`, `enviada`, `aceptada`, `rechazada`, `vencida`, `cancelada`, orden único por cotización, cantidad positiva, precio unitario no negativo y entre 1 y 100 conceptos.
- Existen `crear_cotizacion` y `actualizar_cotizacion`, `SECURITY DEFINER`, `EXECUTE` para `authenticated`, ambas `RETURNS uuid`. Aún no han sido probadas con una sesión real de staging.
- `p_conceptos` contiene `{orden, descripcion, cantidad, precio_unitario}`; PostgreSQL calcula `importe`. Las RPC no reciben un prospecto independiente ni permiten cambiar la oportunidad al editar.
- El backend verifica rol activo; administrador puede operar cualquier oportunidad y supervisor/ejecutivo solo las propias o asignadas. Esta política está descrita por el usuario y requiere confirmación con JWT reales en staging.
- No se ha confirmado auditoría completa ni control optimista de concurrencia en las funciones.

El repositorio no contiene el inventario completo de columnas y tipos. El mapeo de lectura conserva valores nulos para `titulo`, `descripcion`, `fecha_vencimiento` y fecha de creación; por eso el adaptador permanece bloqueado. Ejecuta manualmente [`sql/diagnostico-cotizaciones.sql`](./sql/diagnostico-cotizaciones.sql) en staging y comparte los metadatos sanitizados para completar el mapeo.

## Contrato de dominio

La cotización se relaciona con la oportunidad real; el prospecto se deriva de `oportunidades.prospecto_id`. El servidor debe resolver actor/fecha desde JWT y confirmar moneda, vigencia, conceptos y permisos. El frontend no acepta etiquetas de clientes como prueba de autorización y no envía subtotal, total, importe ni `cotizacion_id` en el JSON de conceptos.

Los conceptos enviados usan exactamente `{orden, descripcion, cantidad, precio_unitario}`. No se altera el nombre ni la firma de las RPC existentes.

## Estados, edición e historial

El modo real reconoce los estados confirmados de PostgreSQL. Las RPC crean y actualizan borradores; no reciben un estado, por lo que enviar/cerrar no está disponible. `preparada` se conserva solo en la demostración. La auditoría no está confirmada; requiere una decisión y verificación antes de producción.

Solo se permite editar cotizaciones borrador accesibles mediante RLS. No se habilita eliminación. No se afirma que exista concurrencia optimista: falta versión/ETag en el contrato de las RPC. El frontend comprueba `fecha_actualizacion` únicamente si el esquema confirmado la provee; esto no reemplaza un bloqueo transaccional del backend.

## PDF

Se genera con el registro confirmado reconsultado desde PostgreSQL, incluyendo prospecto/cliente y oportunidad obtenidos del catálogo real bajo la sesión, conceptos e importes persistidos. El adaptador compara el `importe` calculado en PostgreSQL con el cálculo local antes de exponer la cotización. Una diferencia bloquea la lectura y el PDF.

La fórmula local aplica redondeo comercial half-up a dos decimales por concepto. La escala y fórmula de `importe` generada por PostgreSQL todavía deben confirmarse contra metadatos/casos de staging. No se incluyen impuestos ni descuentos: no forman parte del contrato conocido.

## Mapeo pendiente antes de habilitar persistencia

| Dato | Requisito pendiente |
| --- | --- |
| Cabecera | Nombres, tipos y nullabilidad de título, descripción, vencimiento, fecha de creación y actualización |
| Conceptos | Precisión y escala de cantidad, precio e importe generado; regla exacta de redondeo |
| Folio y totales | Confirmar respuesta persistida y si existen totales almacenados en cabecera |
| Vigencia | El adaptador serializa la fecha seleccionada como fin del día UTC (`23:59:59.999Z`); confirmar esta semántica con el backend |
| Historial | No está confirmado; definir una operación de auditoría o aceptar explícitamente su ausencia en staging |
| Autorización | Confirmar RLS activa/forzada, políticas, privilegios y reglas de rol en staging |

El código falla cerrado: la URL debe apuntar a un proyecto staging independiente, usar una clave pública no privilegiada, correr en `DEV` y `MODE=staging`, contar con mapeo completo y tener cada revisión explícitamente aprobada. Producción y la demostración no activan persistencia real. El flag `VITE_COTIZACIONES_MODO` controla la interfaz solamente; no sustituye permisos del servidor.

Para una habilitación futura, prepara `.env.staging.local` con `VITE_COTIZACIONES_MODO=supabase`, `VITE_SUPABASE_URL=https://<ref-staging>.supabase.co` y la clave pública `VITE_SUPABASE_ANON_KEY`; inicia Vite con `npm run dev -- --mode staging`. Además deben completarse el `stagingProjectRef`, el mapeo de columnas y las revisiones en `src/config/cotizacionesBackend.js` únicamente después de verificar cada resultado de staging. El ejemplo distribuido mantiene el modo desactivado; no habilitarlo en `.env.production`.

No se ha definido ni ejecutado una migración adicional. Las consultas de metadatos están en [`sql/diagnostico-cotizaciones.sql`](./sql/diagnostico-cotizaciones.sql) para ejecución manual por el usuario en staging. No se ejecutó SQL remoto durante este trabajo.
