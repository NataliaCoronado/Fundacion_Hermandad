# Validación de la entrega

Actualización del 18 de noviembre de 2026 en macOS, versión funcional base `61b9bc3`. Se usaron datos ficticios y mensajería simulada.

- `npm test`: 97 aprobadas, 0 fallidas y 1 omitida (prueba contra PostgreSQL externo).
- Portal del paciente: reserva en 4 pasos (buscar por especialidad o profesional en toda la red, un policlínico o Telemedicina; calendario mensual; datos y documentos; confirmación), comprobante PDF, verificación de acceso para datos recordados y cuenta opcional (Mis horas, Mis datos, Mis documentos y Familiares).
- `node scripts/evidencias-matriz.js <carpeta>`: 37 casos aprobados y 1 fallido. CP-23 aprobó las exportaciones y CP-36 aprobó la encuesta de agendamiento. En CP-28 se generaron la pantalla y el PDF sin código. El envío por WhatsApp quedó registrado como Simulado: el transporte de demostración no emite mensajes reales. El criterio exige acreditar un envío real.
- Casos de la matriz pendientes de ejecución: CP-07, CP-08, CP-25, CP-30, CP-37, CP-38, CP-42 y CP-43.
- `npm run test:postgres-embebido`: correcto con el esquema y datos SQL originales; catálogo, credenciales, series, duración, doble reserva, usuarios, lugares, especialidades, equipo multisedes y modificación de bloques.
- Navegador: ingreso por rol, calendario y detalle flotante, reportes, pacientes, registro de llegada, cierre de sesión y Telemedicina. Resoluciones de escritorio: 1440 y 1280 píxeles.
- Exportaciones: PDF renderizado e inspeccionado; XLSX con ZIP y XML válidos; PNG con firma y tamaño comprobados por HTTP.
- El ZIP omite node_modules, estados de prueba, adjuntos de prueba, cachés, archivos de macOS y archivos temporales.

## Límites de esta validación

La comprobación del despliegue con Docker y la prueba contra PostgreSQL externo quedan pendientes. La validación con PGlite cubre el motor embebido y los repositorios de la aplicación.

La ejecución local usa WhatsApp y correo simulados. La bandeja registra simulaciones, solicitudes pendientes y errores según el caso. Para acreditar envíos reales y confirmaciones de entrega se requieren proveedores y recepción de estados. La videollamada se realiza mediante un enlace externo.

Se utiliza persistencia JSON privada para metadatos adicionales y una sola instancia de aplicación. Deben conservarse los directorios de datos junto con PostgreSQL cuando se usa ese modo. Las cuentas con varios lugares abren el principal que define Administración.
