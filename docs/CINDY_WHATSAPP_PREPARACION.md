# Cindy: preparación de soporte y WhatsApp

Fecha: 20 de septiembre de 2026. Estado: preparación; ningún número conectado.

## Respaldo y alcance

Rama `backup-pre-cindy-whatsapp-20260920`: conserva main anterior y el código
desplegado de `meteoro-cindy` v4. No incluye datos de clientes ni secretos.
El PDF local de A&S que ya estaba modificado se dejó fuera de esta entrega.

Se preservan productos, tarifas, cotizador, directorios, Kira, certificaciones,
usuarios y recuperación ADMIN. La redirección de recuperación sigue pendiente.

## Cambios implementados

- Cindy diferencia las seis categorías críticas, trata la matriz de canales como
  pendiente y unifica los identificadores internos de A&S al consultar documentos.
- Las búsquedas de exclusión ya no añaden limitación como sinónimo.
- Encontrar documentos no marca automáticamente una conclusión como verificada.
- En consultas críticas se muestran definiciones y evidencia para revisión; no se
  deduce aprobación ni rechazo a partir de una preexistencia. El modo de respaldo
  del navegador mantiene el mismo límite cuando no responde el servidor.
- El backend valida tanto acceso a Cindy como permiso de compañía.
- Las consultas que necesitan revisión se registran. Eso no equivale a haber
  notificado a Carlos; la respuesta incluye `notification_sent: false`.
- La demostración pública `tools/cindy-preview.html` usa ejemplos, reglas
  deterministas y memoria temporal. No llama a IA ni recibe datos del proyecto.
- La bandeja privada de ADMIN permite consultar borradores y asumir atención.
- El receptor valida firma HMAC sobre el cuerpo original, cuenta y número
  configurados. El límite del cuerpo es 256 KiB; no descarga adjuntos.
- La persistencia es atómica: deduplicación por identificador de mensaje,
  bloqueo de conversación y estados de atención humana/baja persistentes.
  Los borradores anteriores se retienen sin respuesta cuando hay baja o toma humana.
- Las tablas tienen RLS y carecen de permisos públicos. Sus RPC son
  SECURITY INVOKER y solo se conceden a service_role.

## Lo que todavía NO está activo

No hay remitente de mensajes, token de envío, número seleccionado, plantillas
aprobadas, campañas, citas conectadas ni generación automática de leads.
La recepción queda cerrada (HTTP 503, modo preparación) mientras no se configure.
Incluso habilitada, esta versión solo recibe y prepara borradores para revisión.
El ensayo de consentimiento no registra una autorización real para marketing.
El receptor prepara cada llegada por separado; la conversación comercial de
varios pasos se ensaya en la demostración, todavía no se ejecuta en WhatsApp.

## Activación posterior

1. Confirmar el número y prefijo de país, propiedad y posibilidad de recibir
   verificación. Los candidatos se guardan en configuración privada, no en GitHub.
2. Verificar la elegibilidad para conservar la app actual o migrar. No borrar una
   cuenta, migrar número ni prometer conservación de historial sin comprobarlo.
3. Completar acceso a Meta, alta de WhatsApp Business Platform y requisitos de
   negocio. Guardar secretos únicamente en Supabase, nunca en HTML o chat.
4. Establecer identidad de negocio, privacidad, consentimiento, quién atiende los
   casos y documentos aprobados para clientes. El contenido interno no se expone.
5. Para probar recepción se requieren `METEORO_WHATSAPP_APP_SECRET`,
   `METEORO_WHATSAPP_VERIFY_TOKEN`, `METEORO_WHATSAPP_PHONE_NUMBER_ID`,
   `METEORO_WHATSAPP_BUSINESS_ACCOUNT_ID` y habilitación explícita de
   `METEORO_WHATSAPP_RECEIVE_ENABLED`. No se configuraron en esta entrega.
6. Probar el evento real de Meta y la revisión por Carlos antes de construir y
   habilitar el envío. Implementar cola de salida, estados de entrega, límites,
   plantillas, reintentos y control contra envíos duplicados.
7. Solo después, conectar leads y agenda con confirmación real de persistencia.

El guard de envío preparado exige activación y aprobación humana, respeta bajas
y atención humana, y exige plantilla aprobada y consentimiento fuera de la
ventana de atención. No se ha conectado a un transporte de envío.

## Validación reproducible

Con Node 24: `npm ci`, `npm test`, `npm run test:login`.

Con Deno instalado: `npm run check:edge`. Las dependencias están fijadas en
package.json y package-lock.json; el backend importa Supabase 2.116.0 exacto.

La suite de HTTP ejecuta el handler real con datos aislados; no crea sesiones de
producción ni utiliza contraseñas de usuarios. La prueba transaccional de SQL
usa datos ficticios y ROLLBACK. La recepción y conversación real de WhatsApp
siguen pendientes; las pruebas simuladas no demuestran entrega real.

Al revisar Supabase se observaron 476 fragmentos activos y cero eventos
`CINDY2_QUERY`; no se afirma que la IA haya respondido con éxito en producción.
La configuración de una clave no valida modelo, facturación o calidad.

El asesor de seguridad marca RLS sin políticas como informativo: es intencional
para tablas atendidas exclusivamente por Edge Functions. La advertencia previa
de contraseñas filtradas en Supabase Auth se revisará junto con la recuperación:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Referencias técnicas consultadas

- https://supabase.com/docs/guides/functions/function-configuration
- https://github.com/fbsamples/whatsapp-api-examples/tree/main/receive-webhook-js
- https://github.com/fbsamples/whatsapp-api-examples/tree/main/signature-validation-with-webhooks-payloads
- https://whatsappbusiness.com/policy/
- https://whatsappbusiness.com/products/platform-pricing/

Las certificaciones Meteoro son soporte interno de entrenamiento. No sustituyen
certificaciones, licencias, nombramientos, autorizaciones ni capacitación oficial
de Combined u otra compañía.
