# Contrato de perfiles y contraseñas — 14 de noviembre de 2026

Implementado localmente en main a partir del contrato escrito por el responsable. `admin-usuarios-actualizado.ts` y `admin-usuarios-diagnostico-limpio.ts` no están en este workspace: no se afirma haber fusionado sus contenidos ni haber verificado una versión desplegada. Se conservaron los cambios locales y no se ejecutó SQL, se modificaron secretos, se publicaron funciones ni se hizo push.

## Solicitudes actuales

| Acción | Cuerpo HTTP |
|---|---|
| Guardar datos del perfil | `{ "operacion":"editar", "usuarioId":"<uuid>", "cambios":{ "nombre":"...", "apellidos":"...", "correo":"...", "telefono":"...", "rol":"ejecutivo", "activo":true } }` |
| Actualizar contraseña | `{ "operacion":"cambiar_password", "usuarioId":"<uuid>", "password":"<nueva>" }` |
| Registrar con invitación | `{ "operacion":"crear", "usuario":{ "nombre":"...", "apellidos":"...", "correo":"...", "telefono":"...", "rol":"ejecutivo", "activo":true } }` |
| Registrar directamente | `{ "operacion":"crear_con_password", "usuario":{ "nombre":"...", "apellidos":"...", "correo":"...", "telefono":"...", "rol":"ejecutivo", "activo":true }, "password":"<nueva>" }` |

**El contrato anterior con seguridad en editar/crear está retirado.** El cliente del proyecto no lo genera, aunque un llamador antiguo le pase un argumento adicional. La función rechaza campos no permitidos. `confirmacion` y el consentimiento de reemplazo solo validan el frontend; no viajan al servidor. El servidor valida la contraseña de forma independiente.

## Interfaz

Editar muestra **Contraseña actual no visible**, sin leer hashes o inferir contraseña de proveedor email/metadatos. Nueva contraseña y Confirmar nueva contraseña empiezan vacíos. Incluye generación criptográfica, mostrar/ocultar y copiar por acción explícita. **Guardar datos** nunca valida, transmite ni cambia la contraseña: los campos de contraseña en edición tampoco bloquean ese submit mediante validaciones HTML. **Actualizar contraseña** es un botón type=button independiente, exige complejidad/coincidencia y la casilla de confirmación. Regenerar invalida esa confirmación.

Después de Guardar datos, el formulario de edición permanece abierto para permitir una operación separada. Los mensajes distinguen: perfil guardado, contraseña actualizada o contraseña no confirmada. Un fallo de Auth no se presenta como cambio confirmado y no revierte datos de perfil ya guardados. No hay transacción atómica entre Auth y PostgreSQL. Modificar campos del perfil después del guardado retira el mensaje de guardado anterior.

La visibilidad de **Actualizar contraseña** está apagada por defecto. La política cliente exige origen exacto autorizado, build/modo compatible, URL y clave pública Supabase, sesión vigente vinculada al perfil y administrador activo. Los flags de Vite solo controlan la interfaz: no conceden permisos y el backend vuelve a comprobar JWT, perfil activo, origen, destino y guardas de escritura.

Para desarrollo local con un backend de staging independiente, ejecutar `npm run dev -- --mode staging`. Configurar en el archivo local ignorado por Git la URL y clave pública de staging, `VITE_CRM_ADMIN_PASSWORD_LOCAL_ENABLED=true`, `VITE_CRM_ADMIN_PASSWORD_STAGING_PROJECT_REF=<referencia-staging>` y `VITE_CRM_ADMIN_PASSWORD_STAGING_VALIDATED=true`. La referencia debe coincidir exactamente con `VITE_SUPABASE_URL` y no ser la referencia productiva `hhlicjgpwcesytziacvc`.

Si el desarrollo local apunta al proyecto productivo, requiere el opt-in local `VITE_CRM_ADMIN_PASSWORD_LOCAL_ENABLED=true` y la validación explícita de ese backend con `VITE_CRM_ADMIN_PASSWORD_PRODUCTION_BACKEND_VALIDATED=true`. No requiere convertir localhost en un build `production`; se usa `npm run dev` en modo `development`. La aplicación publicada en `https://redskyg.com` requiere un build `production`, origen exacto de producción, `VITE_CRM_ADMIN_PASSWORD_PRODUCTION_ENABLED=true` y `VITE_CRM_ADMIN_PASSWORD_PRODUCTION_BACKEND_VALIDATED=true`. Ningún flag de cliente por sí solo autoriza escrituras: la función debe tener habilitadas sus guardas y autorizar el origen.

`.env.example` y `.env.staging.example` mantienen los flags apagados. No sobrescribir `.env` ni `.env.staging.local`; copiar únicamente las plantillas cuando se autorice preparar un entorno. Para producción, el control cliente es separado del local y no se debe activar hasta completar staging y autorización explícita.

## Requisitos para Supabase Dashboard (configuración manual futura)

No se deben activar ahora. Tras publicar una revisión aprobada de la Edge Function y validar un staging independiente, configurar en **Edge Functions → admin-usuarios → Secrets**, en el mismo proyecto staging:

- `CRM_ADMIN_USERS_ENABLED=true`
- `CRM_ADMIN_USERS_STAGING_VALIDATED=true`
- `CRM_ADMIN_DB_CONTRACT_VERIFIED=true`
- `CRM_ADMIN_PASSWORD_WRITES_VALIDATED=true`

La función conserva además la autenticación JWT y exige perfil `administrador` activo. Deben seguir configurados los secretos operativos existentes del mismo proyecto (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRM_ADMIN_DATABASE_URL`, `CRM_ADMIN_PROJECT_REF` y los de origen/redirección). No copiar valores entre proyectos.

En un proyecto de staging aislado, después de validar el contrato y el backend, configurar `CRM_ADMIN_ALLOWED_ORIGINS` con la lista JSON de orígenes autorizados (por ejemplo, `["http://localhost:5173"]` para staging local), `CRM_ADMIN_INVITE_REDIRECT_LOCAL=http://localhost:5173/crm/establecer-acceso` y `CRM_ADMIN_INVITE_REDIRECT_PRODUCTION=https://redskyg.com/crm/establecer-acceso`. Los cuatro Secrets de escritura enumerados arriba deben estar en ese mismo proyecto.

Para usar localhost contra el backend productivo, el proyecto productivo debe tener las cuatro guardas anteriores activas y, solo tras revisión y autorización explícita, `CRM_ADMIN_PASSWORD_PRODUCTION_AUTHORIZED=true`. Para autorizar ambos sitios, `CRM_ADMIN_ALLOWED_ORIGINS` debe contener exactamente `["http://localhost:5173","https://redskyg.com"]`; conservar las dos URLs de redirección exactas indicadas arriba. No habilitar escrituras productivas durante esta tarea ni cambiar Secrets sin aprobación. El código local de esta revisión no está desplegado, así que estos cambios no alteran Supabase ni habilitan el botón en los sitios existentes.

La petición web usa exclusivamente `POST /functions/v1/admin-usuarios` con `{operacion:"cambiar_password",usuarioId,password}`. **Guardar datos** permanece separado y no incluye contraseña. Al recibir el bloqueo 503, la vista bloquea nuevos envíos en esa instancia. Cada intento limpia la contraseña; ante resultado incierto se requiere revisar Auth y no se reenvía el valor anterior. El test `tests/usuariosAdminPassword.staging.test.js` no se ejecuta por defecto y requiere autorización explícita y fixtures de staging.

Registrar permite elegir **Invitación por correo** (por defecto) o **Crear cuenta con contraseña**. Cambiar de método borra campos sensibles. Nunca se ejecutan las dos vías para una misma alta. La contraseña inicial es requerida solo en la vía directa; la invitación conserva su flujo sin contraseña adjunta.

## Credenciales y límites

La política compartida acepta 12–128 caracteres ASCII imprimibles, mayúsculas, minúsculas, números y símbolos, sin espacios. El generador sigue produciendo 16–20 caracteres dentro del rango, con crypto.getRandomValues, selección sin sesgo de módulo y mezcla criptográfica. No usa Math.random ni fallback inseguro. La confirmación solo se compara en el cliente.

Las contraseñas no se incluyen en perfiles, comandos SQL, auditoría, URL, mensajes ni respuestas. El executor separa password antes de cualquier preflight PostgreSQL. `cambiar_password` realiza únicamente el preflight administrativo de lectura y Auth Admin updateUserById; no actualiza datos del perfil. Tras comprobar que Auth devolvió el ID esperado, la Edge Function responde `{resultado:{usuarioId,contrasenaActualizada:true}}`. El frontend valida ambos campos y normaliza la respuesta anterior `{resultado:{id,password_actualizado:true}}` solo si también identifica al usuario solicitado. HTTP 200 sin una de esas confirmaciones exactas se trata como incierto; no se reenvía automáticamente.

No se imprimen cuerpos de error remotos de operaciones de contraseña: cliente y servidor usan mensajes fijos. No hay almacenamiento local/de sesión ni telemetría del secreto. Los campos de estado y DOM se vacían al terminar un intento enviado, cancelar, navegar, cambiar de sesión, desmontar o abandonar la página. No se revela ni se copia automáticamente; el portapapeles se modifica solo por petición explícita y queda bajo control del sistema operativo.

Hay bloqueo mutuo entre Guardar datos y Actualizar contraseña, bloqueo de doble envío en la vista/servicio y un máximo de 3 intentos válidos enviados por minuto en la vista. El servidor añade 5 intentos por minuto y administrador por instancia, cuenta solicitudes inválidas y bloquea concurrencia del mismo actor en esa instancia. Guarda exclusivamente IDs de actor, contadores y tiempos, nunca secretos.

**El límite del servidor es por instancia: NO es una protección global entre réplicas/reinicios.** Antes de activar producción se necesita un límite distribuido o de gateway verificado. No se incorporó un proveedor externo ni se creó almacenamiento PostgreSQL para ello. La bandera de validación no demuestra por sí sola que esta revisión esté completada.

## Alta directa y reconciliación

`crear_con_password` usa exclusivamente Auth Admin createUser con `email_confirm:true`, contraseña y `ban_duration:'876000h'`. Esto confirma administrativamente el correo; **no envía invitación ni exige cambiar la contraseña al primer inicio**. Para exigir cambio inicial se necesita otro flujo con comprobación servidor. No se modificó la configuración global de confirmación de email.

Después se usa el contrato existente para crear/confirmar el perfil y su rol/estado. La cuenta solo se desbloquea si el perfil está confirmado y activo. La contraseña nunca se entrega al adaptador SQL. No se insertan cuentas mediante SQL en auth.users. Antes del alta se verifica que el correo no tenga una cuenta Auth existente; Auth también debe respetar su unicidad.

Si Auth confirma identidad pero PostgreSQL no finaliza el perfil, se mantiene/intenta el bloqueo, se devuelve revisión requerida y no se elimina la cuenta automáticamente. Un fallo después de activar o durante la verificación vuelve a intentar contención. No repetir altas automáticamente. Revisar manualmente en Dashboard cuenta Auth, ID/correo, perfil real y dependencias, decidir completar o retirar el alta con controles de seguridad, y documentar la reconciliación sin secretos. Un timeout puede dejar resultado incierto; no asumir que no se creó la cuenta. Tampoco se afirma contención completa si Auth falla durante ese intento.

## Flag nuevo: mantener bloqueado

Para cambiar_password y crear_con_password deben ser verdaderas TODAS estas condiciones del entrypoint:

- Configuración del mismo proyecto válida.
- CRM_ADMIN_USERS_ENABLED=true.
- CRM_ADMIN_USERS_STAGING_VALIDATED=true.
- CRM_ADMIN_DB_CONTRACT_VERIFIED=true.
- **CRM_ADMIN_PASSWORD_WRITES_VALIDATED=true**.

El flag nuevo ausente o false bloquea ambas operaciones con 503 incluso si las escrituras generales están habilitadas. No modificar ninguno de estos flags en producción para corregir un 400. No se alteraron valores remotos ni archivos .env. El responsable solo debe considerar activar capacidad tras pruebas y revisión de permisos, tasa distribuida y reconciliación. No se requiere activar el flag de contraseña para invitaciones o edición ordinaria del perfil.

## Código y publicación

Los cambios están en los módulos fuente de supabase/functions, el cliente y el formulario. El artefacto [dashboard/admin-usuarios.ts](dashboard/admin-usuarios.ts) se regenera con `node scripts/prepararAdminUsuariosDashboard.mjs`; no editarlo como única fuente ni reemplazar archivos SQL para resolver el contrato HTTP. El script solo empaqueta archivos locales: no publica.

Antes de cualquier publicación se debe revisar el artefacto y completar staging; este trabajo NO desplegó. Después, una publicación manual autorizada se hace desde Edge Functions → admin-usuarios → editor Dashboard, con el archivo completo, conservando configuración JWT/CORS y los flags bloqueados. Las instrucciones de conexión vigentes siguen en USUARIOS_ADMIN_REAL.md y ADMIN_USUARIOS_LOCAL_HOSTING.md.

## Pruebas reales pendientes

El entorno local no tiene URL de staging válida, referencia independiente ni JWT administrativo disponible, y no está autorizado el indicador de ejecución. Por tanto, no se han ejecutado escrituras ni logins contra Supabase en esta revisión.

Se preparó `tests/usuariosAdminPassword.staging.test.js`, omitido por defecto. Requiere, por canal seguro y exclusivamente de un staging independiente:

- CRM_RUN_PASSWORD_STAGING=STAGING_AUTHORIZED_PASSWORD_WRITES.
- CRM_STAGING_PROJECT_REF (distinto del proyecto predeterminado excluido).
- CRM_ADMIN_USERS_FUNCTION_URL, CRM_STAGING_ANON_KEY, CRM_ADMIN_JWT, CRM_ADMIN_TEST_ORIGIN.
- CRM_ADMIN_USERS_FIXTURES_CONFIRMED=DISPOSABLE_CRM_ADMIN_TEST_ONLY.
- CRM_ADMIN_TEST_EMAIL y CRM_ADMIN_TEST_EMAIL_CONFIRMED=CONTROLLED_TEST_MAILBOX.
- Administrador de pruebas CRM_TEST_ activo, buzón nuevo autorizado y backend de staging publicado manualmente con ensayo expresamente autorizado. El test no configura flags.

Ejecutar explícitamente `node --test tests/usuariosAdminPassword.staging.test.js` solo cuando estén esas condiciones. No activar simultáneamente otros CRUD de staging con el mismo buzón. Comprueba alta directa, perfil persistido, login real, edición de perfil sin alterar credencial, reemplazo separado, login nuevo y rechazo del anterior. No imprime tokens o contraseñas; la cuenta nueva confirmada queda desactivada al finalizar, sin borrar auditoría. Las cuentas ya existentes se excluyen antes de escribir. Si el resultado es parcial, detener y reconciliar Dashboard antes de repetir.

Las pruebas locales cubren payloads exactos, rechazo del contrato antiguo, JWT/roles/estado, flags, confirmación frontend, límites/concurrencia, limpieza, ausencia de secretos en SQL/correo/respuesta, creación de una sola vía y fallos parciales. No sustituyen los casos reales ni certifican límites distribuidos.
