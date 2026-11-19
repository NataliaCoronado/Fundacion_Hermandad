# Validación de la entrega

Ejecución del 18 de noviembre de 2026 a las 23:28 (hora de Chile) sobre el commit funcional `c598ac8`, en macOS arm64 con Node.js v24.14.0. Se usaron datos ficticios y WhatsApp en modo simulado.

| Verificación | Resultado |
| --- | --- |
| `npm test` | 125 pruebas. 124 aprobadas, 0 fallidas y 1 omitida, correspondiente a PostgreSQL externo. |
| `node scripts/evidencias-matriz.js <carpeta>` | 39 casos ejecutados de 46. 38 aprobados, 1 fallido (CP-28) y 7 pendientes de ejecución. |
| `npm run test:postgres-embebido` | Aprobada con PGlite y el esquema SQL del proyecto. |

Los siete casos pendientes son CP-07, CP-08, CP-25, CP-30, CP-37, CP-38 y CP-43.

## Evidencias de la matriz

Los archivos se incluyen en `Evidencias_Pruebas/` de la carpeta de entrega. `_resumen.json` contiene el resultado de cada caso ejecutado.

- **CP-23 (RF23), aprobado.** El CSV coincide con los indicadores del sistema. Se generaron y abrieron las exportaciones PDF, XLSX y PNG. El PDF y el XLSX muestran por separado la encuesta de agendamiento y la posterior a la atención. En la revisión visual del PDF, el margen derecho corta el final de los títulos de las encuestas en las páginas 17 y 18. Archivos `EV-CP-23.txt`, `EV-CP-23_resumen.csv` y `EV-CP-23_reporte.{pdf,xlsx,png}`.
- **CP-28 (RF28), fallido.** Una paciente ficticia nueva reservó con consentimiento para recibir avisos. El comprobante se mostró en pantalla y se descargó como PDF sin código de reserva. La bandeja registró la solicitud de WhatsApp como «Simulado». El criterio de envío real queda pendiente de acreditar. Archivos `EV-CP-28.txt` y `EV-CP-28_comprobante.pdf`.
- **CP-36 (RF36), aprobado.** El portal ofreció una encuesta voluntaria de agendamiento tras confirmar la reserva. La respuesta quedó asociada a esa reserva, separada de la encuesta de atención. Se verificaron la respuesta única y la conservación de la cita. Archivo `EV-CP-36.txt`.
- **CP-42 (RNF06), aprobado.** Quedaron auditadas 10 de 10 operaciones. Se verificaron las huellas SHA-256 de los dos archivos del respaldo y se restauraron el estado JSON y el documento adjunto tras un incidente simulado. La restauración recuperó el estado de las citas y los archivos al momento del respaldo y generó una copia de seguridad previa. Archivos `EV-CP-42.txt` y `EV-CP-42_manifiesto.json`.

## PostgreSQL y alcance

La comprobación adicional con PGlite abarcó catálogo, credenciales, series, duración, doble reserva, accesos, lugares, especialidades, equipo multisedes y cambios y eliminación de integrantes. La ejecución contra PostgreSQL externo, el volcado real con `pg_dump` y la comprobación del despliegue Docker quedan pendientes. CP-42 cubre el modo de persistencia JSON en disco y adjuntos locales.

La suite comprobó con datos ficticios el procesamiento de respuestas y estados del webhook de WhatsApp. La validación de envíos y de estados reales de entrega requiere el entorno del proveedor. La videollamada se realiza mediante un enlace externo.

## Verificaciones previas de interfaz

La revisión anterior incluyó el portal del paciente, el ingreso por rol, el calendario y su panel flotante, reportes, pacientes, registro de llegada, cierre de sesión y la variante de Telemedicina. Se usaron resoluciones de escritorio de 1440 y 1280 píxeles.

El ZIP de código fuente incluye los archivos versionados del proyecto. Los estados de prueba, adjuntos, credenciales locales, cachés y dependencias instaladas quedan fuera del paquete.
