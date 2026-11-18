# Validación de la entrega

- `npm test`: 76 correctas, 0 fallidas, 1 omitida (servidor PostgreSQL externo no disponible).
- Portal del paciente: reserva en 4 pasos (buscar por especialidad o profesional en toda la red, un policlínico o Telemedicina; calendario mensual; datos y documentos; confirmación), comprobante PDF, verificación de acceso para datos recordados y cuenta opcional (Mis horas, Mis datos, Mis documentos y Familiares).
- `node scripts/evidencias-matriz.js <carpeta>`: 36 casos aprobados y 1 fallido (CP-28: el envío real por WhatsApp/correo requiere proveedor).
- `npm run test:postgres-embebido`: correcto con el esquema y datos SQL originales; catálogo, credenciales, series, duración, doble reserva, usuarios, lugares, especialidades, equipo multisedes y modificación de bloques.
- Navegador: ingreso por rol, calendario y detalle flotante, reportes, pacientes, registro de llegada, cierre de sesión y Telemedicina. Resoluciones de escritorio: 1440 y 1280 píxeles.
- Exportaciones: PDF renderizado e inspeccionado; XLSX con ZIP y XML válidos; PNG con firma y tamaño comprobados por HTTP.
- El ZIP omite node_modules, estados de prueba, adjuntos de prueba, cachés, archivos de macOS y archivos temporales.

## Límites de esta validación

No se pudo ejecutar Docker ni la prueba contra un servidor PostgreSQL externo: el motor Docker no estaba iniciado. PGlite usa PostgreSQL embebido y no sustituye esa comprobación de despliegue.

WhatsApp y correo no realizan envíos reales en esta entrega; la bandeja conserva solicitudes pendientes o errores por falta de consentimiento/datos. Es necesario conectar proveedores y recepción de estados de entrega. La videollamada se realiza mediante un enlace externo.

Se utiliza persistencia JSON privada para metadatos adicionales y una sola instancia de aplicación. Deben conservarse los directorios de datos junto con PostgreSQL cuando se usa ese modo. Las cuentas con varios lugares abren el principal que define Administración.
