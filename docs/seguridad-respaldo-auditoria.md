# Seguridad, verificación, respaldo, auditoría y trazabilidad

Este documento separa cuatro conceptos que suelen mezclarse y dice, para cada uno, **qué hace el sistema** y **cómo se mide** (un criterio comprobable, no una intención). Todo lo descrito existe en el código actual; lo que falta está en la sección 6.

| Concepto | Pregunta que responde | Dónde se ve |
|---|---|---|
| **Seguridad** | ¿Quién puede ver o hacer qué, y cómo se protege el dato del paciente? | Roles, sesiones, claves, cabeceras |
| **Verificación** | ¿Es correcto y válido el dato o documento que entra? | RUT, documentos, confirmación de citas |
| **Auditoría** | ¿Qué cambió, quién lo cambió y cuál era el valor anterior? | Menú Administración → Auditoría |
| **Trazabilidad** | ¿Qué le pasó a *esta* cita o paciente de principio a fin? | Reserva → comunicaciones → asistencia → encuesta |
| **Respaldo** | ¿Se puede recuperar la información si algo falla? | `npm run respaldo` / `npm run restaurar` |

## 1. Seguridad de los datos del paciente

**Acceso por rol y por lugar.** Hay tres roles (Administración, TENS/TONS, Telemedicina). Cada ruta del personal exige sesión y el área correspondiente: Administración no entra a las pantallas de TENS/TONS y viceversa (responde 403). Un TENS/TONS solo ve los pacientes, citas y documentos de **su** lugar; si intenta abrir uno de otro lugar el sistema lo rechaza (`FUERA_DE_SEDE`).

**Claves y sesiones.** Las claves se guardan con `scrypt` y sal propia; nunca en texto plano. La sesión dura 8 horas, viaja en una cookie `HttpOnly` y `SameSite=Lax` (con `Secure` cuando se activa `COOKIE_SECURE=1`). Tras 5 intentos fallidos en 15 minutos la cuenta se bloquea temporalmente. El mensaje de error no distingue entre correo inexistente y clave incorrecta.

**Datos mínimos y ocultos.** En el portal, el paciente que reserva ve sus datos guardados **enmascarados** (por ejemplo `J*** P***`, correo `j***@dominio`). Los reportes son agregados: no incluyen nombres ni RUT. Los enlaces de telemedicina se comparan por huella SHA-256, no por su texto.

**Consentimiento.** Antes de reservar se pide aceptar el tratamiento de datos; el consentimiento queda registrado con fecha, canal y versión de la política. Las comunicaciones por WhatsApp o correo solo salen si el paciente las aceptó.

**Protección de la aplicación.** Cabeceras `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` y `Cache-Control: no-store` (las páginas con datos no quedan en caché). Límite de intentos por IP y por RUT en la consulta y reserva del portal. Límite de tamaño en formularios y adjuntos.

**Cómo se mide**

| Criterio | Cómo se comprueba |
|---|---|
| 0 pantallas de Administración accesibles para TENS/TONS y viceversa | `npm test` (prueba «roles: TENS/TONS no entra a Administración») |
| 0 datos de otro lugar visibles para un TENS/TONS | Pruebas de operación y evidencias de la matriz: abrir la ficha de un paciente de otro lugar debe ser rechazado |
| 100 % de las claves almacenadas con hash | Revisar la tabla `credencial`: ningún valor sin prefijo `scrypt$` |
| Bloqueo al 6.º intento fallido en 15 min | Hacer 6 ingresos fallidos seguidos y comprobar que el 6.º responde «demasiados intentos» (hoy es una comprobación manual; falta una prueba automática) |
| Reportes sin identificadores personales | La prueba de `agenda.json` verifica que no aparezcan nombres ni RUT |

## 2. Verificación

- **Del paciente:** el RUT se valida con dígito verificador en la aplicación y también en la base de datos (`fn_rut_valido`), de modo que no entra un RUT inválido por ninguna vía.
- **De documentos:** un documento subido (por ejemplo, una orden médica) queda en estado *pendiente de revisión* hasta que un TENS/TONS lo marca como *verificado* y queda registrado quién lo verificó. Un documento puede reemplazar a uno anterior y el anterior queda archivado, no borrado.
- **De la cita:** la confirmación del paciente (confirmada, pendiente, sin respuesta) se registra por separado de la asistencia; la asistencia solo se registra al atender.
- **De los datos que se corrigen:** si el paciente pide corregir su identidad, se crea una solicitud que revisa el TENS/TONS de su policlínico.

**Cómo se mide:** porcentaje de documentos verificados sobre los subidos (alerta «Documentos por revisar» en el Resumen de TENS/TONS) y porcentaje de citas de hoy y mañana sin confirmar (alerta en el Resumen de ambos roles).

## 3. Auditoría (qué cambió y quién)

La auditoría responde **quién, cuándo, qué y con qué valores**. Cada registro guarda: fecha y hora, usuario, lugar, acción, módulo, registro afectado y los valores **antes y después**. Se registran los inicios de sesión y las operaciones sensibles: publicar, bloquear o liberar cupos, cambios de agenda, alta y baja de profesionales, cancelaciones y reagendamientos, verificación y archivado de documentos, y descarga de reportes. La pantalla Administración → Auditoría permite filtrar por fechas, usuario, acción y lugar.

**Cómo se mide:** *cobertura de auditoría* = operaciones sensibles que dejaron registro ÷ operaciones sensibles ejecutadas. La evidencia **CP-42** ejecutó 10 operaciones y verificó que las 10 quedaron registradas (**10 de 10, 100 %**).

## 4. Trazabilidad (seguir una cita de punta a punta)

La trazabilidad no es una pantalla aparte: es que **todo hecho de la vida de una cita queda enlazado por su número de reserva**, y se puede reconstruir en orden:

1. Reserva (canal: web, presencial o teléfono; quién la creó si fue asistida).
2. Comunicaciones asociadas: recordatorios, enlace de atención, estado de entrega y errores.
3. Confirmación del paciente y contactos de seguimiento.
4. Cambios: reagendamiento, cambio de profesional, cancelación (con origen y motivo).
5. Asistencia (atendido / no asistió) y recepción.
6. Encuestas de agendamiento y de atención.

La auditoría (sección 3) aporta el «quién y cuándo» de cada paso. **Cómo se mide:** *trazabilidad completa* = citas cuyos pasos pueden reconstruirse sin huecos ÷ citas revisadas; se comprueba tomando una muestra de reservas y siguiéndolas por número de reserva en Comunicaciones y Auditoría.

## 5. Respaldo y recuperación

`npm run respaldo` crea una carpeta con el estado del sistema (estado en JSON o archivos de datos, más los documentos adjuntos) y un **manifiesto con la huella SHA-256 de cada archivo**. `npm run respaldo -- verificar <carpeta>` comprueba que ninguna huella cambió. `npm run restaurar -- respaldos/<carpeta>` recupera los datos y, **antes de sobrescribir, guarda una copia de seguridad previa**; se niega a restaurar si el servidor está encendido, para que no pise lo recuperado.

**Cómo se mide**

| Criterio | Evidencia |
|---|---|
| 100 % de los archivos del respaldo coinciden con su huella | Comando `verificar` |
| La restauración devuelve el estado de las citas y de los adjuntos al momento del respaldo | CP-42 (incidente simulado y restauración) |
| Existe copia previa antes de restaurar | Carpeta de seguridad creada por `restaurar` |

Recomendación operativa: guardar una copia **fuera del equipo** (el respaldo local se pierde con el equipo) y ensayar la restauración periódicamente.

## 6. Lo que falta o es una limitación (dicho con honestidad)

- Las sesiones viven en memoria: un reinicio cierra la sesión de todos y solo se puede usar una instancia.
- La conexión a PostgreSQL no fija cifrado (`sslmode`); en un servicio administrado hay que indicarlo y probarlo.
- La base no tiene seguridad por filas (RLS): el control de acceso por lugar está en la aplicación.
- En modo PostgreSQL, la auditoría (con su resultado), los documentos (con estado de revisión, revisor y fecha) y el historial de citas se guardan en las tablas `auditoria`, `documento` y `cita_historial`, por lo que el respaldo con `pg_dump` los incluye. Las encuestas y la bandeja de mensajes siguen en `datos/extras.json`. El respaldo de PostgreSQL con `pg_dump` y la restauración contra una base real están pendientes de ensayar (CP-42 cubre el modo de archivos).
- La auditoría vive también en ese archivo; no hay todavía bloqueo contra edición manual del archivo (por ejemplo, encadenado de huellas entre registros).
- No hay doble factor de autenticación para Administración.

Estas limitaciones están registradas junto a las decisiones de despliegue en `docs/diseno-despliegue-nube.md`.
