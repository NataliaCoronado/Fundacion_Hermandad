# Hermandad de Dolores — Gestión de citas, versión 1.1

Aplicación administrativa para seis policlínicos y Telemedicina. Incluye portal de pacientes, Administración y operación TENS/TONS separada por lugar. Los datos de muestra son ficticios. No es una ficha clínica.

## Iniciar

Necesita **Node.js 20 o superior** (macOS, Linux o Windows). Desde esta carpeta:

```bash
npm ci
npm start
```

- Personal: http://localhost:3001
- Portal de pacientes: http://localhost:3000

Administración entra directamente a **Agendas y cupos**. 
TENS/TONS y Gestión de Telemedicina entran a **Atención del día**. 
La aplicación usa la zona horaria `America/Santiago`.

### Cuentas de demostración

Vista Administración: admin@ejemplo.cl 
Vista TENS/TONS perteneciente a Casa Central (San Isidro): tens@ejemplo.cl 
Vista de Telemedicina: telemedicina.usuario@ejemplo.cl

Contraseña de las tres cuentas: `demo1234`. 

Las cuentas creadas desde Administración no reciben esta contraseña; se habilitan mediante el enlace seguro de un solo uso. En PostgreSQL, `CLAVE_DEMO=demo1234` habilita las claves de las tres cuentas de ejemplo.

## Modalidad de entrega: demostración local reproducible

El sistema se ejecuta **localmente**; no hay URL pública de despliegue (se desplegará en la nube en la etapa siguiente).

- **Requisitos:** Node.js 20 o superior y npm, en Windows, macOS o Linux. No necesita base de datos externa ni cuenta en ningún servicio: sin `DATABASE_URL` guarda sus datos en `datos/estado.json`.
- **Instalación:** `npm ci`
- **Configuración:** ninguna para la demostración.
- **Ejecución:** `npm start` y abrir el portal de pacientes (http://localhost:3000) o el sitio del personal (http://localhost:3001).
- **Datos:** todos los datos son **ficticios**. La mensajería funciona en modo simulado y no envía nada real; el guion está en `DEMO_MENSAJES.md`.
- **Verificación:** `npm test`.

## Administración

Los cuatro módulos principales son Agendas y cupos, Equipo de salud, Policlínicos y especialidades, y Reportes. Usuarios y Auditoría se encuentran en **Configuración / perfil**.

- **Agendas y cupos:** día por profesional y semana, Hoy, fecha, filtros de lugar, especialidad, uno/varios/todos los profesionales y estado. El color representa el lugar en Toda la red y la especialidad al elegir un lugar. Las reservas abren un panel flotante.
- **Crear bloque horario:** franja completa con fecha única o repetición semanal, duración, rango y días. La revisión calcula días, cupos y conflictos en todos los lugares del profesional. Permite guardar sin publicar o publicar. La publicación, el bloqueo y la disponibilidad pueden cambiarse por cupo.
- **Cambios de agenda:** ausencia, reemplazo, lugar, fecha/horario o cancelación institucional. Presenta situación actual, propuesta y reservas afectadas. Revalida el impacto al guardar. Permite seleccionar las citas que se cancelarán y elegir si el horario vuelve a estar disponible o queda bloqueado. La reprogramación se realiza desde el detalle de reserva; los cambios generan instrucciones para la sede y una bitácora.
- **Equipo de salud:** tarjetas o tabla, búsqueda, filtros, alta, edición, fotografía JPG/PNG, tipo de integrante, profesión, varias especialidades y varios lugares. Las asignaciones tienen fecha de vigencia. No se retiran lugares con reservas futuras afectadas; primero se reprograman. Los integrantes se desactivan y conservan su historial.
- **Policlínicos y especialidades:** pestañas, alta y edición, estado y colores. Incluye las 6 y telemedicina.
- **Reportes:** filtros por lugar, especialidad, profesional y período; cuatro secciones (la cuarta, las dos encuestas por separado), siluetas de sexo registrado, pacientes únicos atendidos, consultas, ausencias y registros pendientes separados. Cada gráfico tiene datos consultables y descargas PDF, Excel real (`.xlsx`) y PNG. PDF y Excel admiten reporte completo. Las descargas incluyen período y filtros.
- **Usuarios:** crear/editar, vincular integrante, lugares asignados, lugar principal de ingreso, permiso para finalizar atención administrativa, estado y último acceso. El cambio de permisos revoca las sesiones existentes. Los enlaces para establecer contraseña caducan a los 30 minutos y solo sirven una vez.
- **Auditoría:** usuario, fecha, acción y valores de las operaciones nuevas; filtros por fecha, usuario, acción y lugar. También se conserva la auditoría histórica original.

## TENS/TONS y Telemedicina

La sesión se limita al lugar principal asignado por Administración. Una cuenta puede tener varios lugares autorizados, pero el operador no cambia libremente de sede: Administración define cuál abre al ingresar. Se rechazan solicitudes directas para citas, fichas, documentos o espera de otros lugares.

- **Atención del día:** fecha, búsqueda por nombre/RUT, resumen compacto, tabla de atenciones y tareas de la sede. Permite registrar llegada, sala, confirmación, término administrativo y ausencia. No incluye acciones clínicas.
- **Agendas y reservas:** día y semana, próximas horas libres, detalles, nueva reserva, reprogramación y cancelación solicitada por el paciente con motivo y canal. La cancelación puede liberar o bloquear el horario.
- **Lista de espera:** filtros, antigüedad, prioridades, preferencias de mañana/tarde y cupos compatibles. Se registran fecha, canal y resultado de contactos; No responde conserva la solicitud. La asignación siempre la realiza el operador.
- **Pacientes:** lista; búsqueda por nombre, RUT o teléfono; registro y edición con validación del dígito verificador del RUT. La ficha tiene Resumen, Reservas, Documentos, Responsable o tutor y Comunicaciones. Permite desactivar sin eliminar historial. Los datos se recuperan por RUT para futuras reservas.
- **Tutor:** los menores de 18 años deben tener un adulto responsable, con relación, RUT y teléfono.
- **Documentos:** PDF, JPG y PNG, tipo, especialidad y vigencia; validación, descarga/visualización, reemplazo y archivo conservando los originales. Solo los usuarios de la sede autorizada acceden al archivo privado.
- **Comunicaciones:** bandeja por sede, canal, reserva, estado, fecha, responsable y reintentos. Las llamadas se registran en Confirmaciones. El silencio no cancela una reserva ni elimina una solicitud de espera.
- **Telemedicina:** operación separada, Reserva de Telemedicina, enlace HTTPS de atención y estados remotos (Enlace pendiente, Enlace enviado, Confirmada, Conectado, Atendida, No se conectó). Se conserva la misma restricción de sede.

## Encuestas

Son **dos encuestas distintas**, guardadas por separado para que sus promedios no se mezclen:

- **Del agendamiento (RF36):** al confirmar una reserva en el portal se ofrece responder cómo fue reservar. Es voluntaria, se responde con el token de esa reserva (no pide el RUT, así conocer un RUT no permite responder por otra persona), una sola vez por reserva, y no afecta la hora ya reservada.
- **De la atención (RF30):** en `/paciente/encuesta`, solo si hay una asistencia registrada.

En **Reportes** (Administración), la sección *Encuestas* muestra las dos por separado, nunca sumadas: respuestas, promedio y distribución de notas de 1 a 5, según el mismo período, lugar, especialidad y profesional del resto del reporte. Se descargan en PDF, Excel y PNG, solas o en el reporte completo (RF22).

## Mensajes automáticos

Cada minuto el sistema procesa la bandeja de **Comunicaciones** (comprobante de reserva, avisos de cambio, cancelación o reprogramación y enlaces de Telemedicina). Con `BOT_WHATSAPP=1` también ejecuta los recordatorios del bot: una semana antes, la víspera a las 10:00 y un reintento a las 14:00. `MENSAJES_AUTOMATICOS=0` lo apaga.

Reglas: solo se envía con el **consentimiento** de comunicaciones del paciente; el silencio nunca cancela ni confirma una cita; si el proveedor falla se reintenta hasta 3 veces (esperas de 5 y 10 minutos) y luego queda en Error, con aviso a TENS/TONS para llamar.

Estados que escribe el sistema, y solo estos: **Simulado** (modo demostración: no salió ningún mensaje real), **Enviado** (el proveedor real aceptó el mensaje), **Pendiente** (en reintento o sin proveedor para ese canal) y **Error**. *Entregado* lo escribe solo el webhook, cuando Meta confirma que el mensaje llegó al teléfono (o que se leyó).

| Modo (`WHATSAPP_MODO`) | Comportamiento |
|---|---|
| `simulado` (predeterminado) | Demostración. Los mensajes quedan en una bandeja interna rotulados como simulados. El correo solo existe en este modo. |
| `meta` | API oficial de WhatsApp Cloud (Meta). Requiere `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` y `WHATSAPP_PLANTILLA` (plantilla aprobada por Meta, con una variable de cuerpo). |

### Webhook de WhatsApp

`/webhook/whatsapp` recibe de Meta las respuestas de los pacientes y los estados de entrega. Se activa definiendo `WHATSAPP_APP_SECRET` (secreto de la app en Meta) y `WHATSAPP_VERIFY_TOKEN` (texto que eliges tú y escribes también en el panel de Meta); sin ambos, la ruta no existe.

- Solo acepta avisos con firma válida (`X-Hub-Signature-256`) y procesa cada aviso una sola vez, aunque Meta lo repita.
- Los botones del recordatorio confirman o cancelan la cita (con origen WhatsApp). Para eso, la plantilla aprobada en Meta debe tener botones de respuesta rápida con las etiquetas exactas **Confirmar** y **Cancelar mi hora**.
- La respuesta se asocia a la cita por el mensaje que el paciente respondió. Si no viene esa referencia, se usa el teléfono solo cuando hay **una única** hora consultada; con dos o más no se adivina y queda un aviso para TENS/TONS.
- Si un recordatorio no se pudo entregar, el personal recibe un aviso para llamar. La cita nunca se cancela por eso.
- El webhook debe ser accesible por HTTPS desde internet; en local se necesita un túnel o el despliegue en la nube.

**Estado real:** el envío (modo `meta`) y el webhook están implementados según la documentación oficial de Meta y probados con avisos firmados en el formato de Meta, no contra una cuenta real. No hay proveedor de correo conectado. Crea `.env` a partir de `.env.example`; nunca subas el `.env`.

## Almacenamiento

**Sin DATABASE_URL:** el estado se guarda en `datos/estado.json`, con escritura mediante reemplazo de archivo y permisos privados. No se pierde al reiniciar. `DATOS_DEMO=0` inicia con el conjunto mínimo de ejemplo si aún no existe el archivo; no borra un estado guardado.

**Con PostgreSQL:** los catálogos, pacientes, bloques, citas, usuarios y contactos usan los repositorios SQL. La auditoría (con resultado: exitoso o rechazado), los documentos (estado de revisión, revisor y fecha) y el historial de cada cita se guardan en las tablas `auditoria`, `documento` y `cita_historial`; al iniciar, lo que hubiera en `datos/extras.json` se migra una sola vez. Los metadatos adicionales, instrucciones y comunicaciones se conservan en `datos/extras.json`; las bases creadas antes de este cambio se actualizan con `db/04_migracion_auditoria_documentos.sql`; los adjuntos están en `datos/documentos/` y las fotos privadas del equipo en `datos/fotos/`.

Esta arquitectura requiere **una instancia de la aplicación** y conservar esos directorios junto con la base de datos. Los metadatos adicionales no están migrados a tablas normalizadas. Las sesiones son temporales: reiniciar solicita un nuevo inicio de sesión. La sesión caduca tras 30 minutos de inactividad y como máximo a las 8 horas.

### Respaldo y restauración

```bash
npm run respaldo                          # crea un respaldo en respaldos/
npm run respaldo -- listar                # muestra los respaldos disponibles
npm run respaldo -- verificar respaldos/<carpeta>
npm run restaurar -- respaldos/<carpeta>  # restaura (detén antes la aplicación)
```

El respaldo copia toda la carpeta `datos/` (estado, metadatos, documentos y fotos privadas) y, si `DATABASE_URL` está definida, un volcado de PostgreSQL hecho con `pg_dump`. Cada respaldo trae un `manifiesto.json` con el tamaño y la huella SHA-256 de cada archivo, y `verificar` comprueba que nada se haya dañado.

Al restaurar, el sistema primero comprueba el respaldo, luego respalda automáticamente lo que hay ahora (carpeta `..._antes-de-restaurar`, para poder deshacer) y recién entonces reemplaza `datos/` completa: lo posterior al respaldo no se mezcla. Se niega a restaurar si la aplicación está en marcha, porque la volvería a sobrescribir con lo que tiene en memoria.

- Los respaldos contienen **datos personales**: `respaldos/` está fuera del repositorio y de la imagen Docker. Guarda una copia fuera del computador; si el equipo se pierde, el respaldo se pierde con él.
- **Probado** en el modo sin base de datos (caso CP-42). El volcado de PostgreSQL necesita `pg_dump` y `pg_restore` instalados y no se ha ejecutado contra un servidor real. La imagen Docker aún no incluye el script.

### Docker / PostgreSQL

```bash
docker compose up --build
```

Conserva el volumen de datos y adjuntos. Para PostgreSQL propio, ejecuta `db/hermandad_postgresql.sql`, `db/datos_ejemplo.sql` y `db/03_credencial.sql`, en ese orden. Luego:

```bash
DATABASE_URL=postgres://usuario:clave@localhost:5432/hermandad CLAVE_DEMO=demo1234 npm start
```

La prueba nativa PostgreSQL conserva el comando original con `PSQL_TEST_ARGS`; crea una base de prueba dedicada.

### Variables opcionales

| Variable | Uso |
|---|---|
| PORT / PORT_PERSONAL | Puertos de pacientes y personal; predeterminados 3000 y 3001 |
| URL_PORTAL | Enlace al portal desde el sitio del personal |
| ARCHIVO_DATOS | Ruta privada de estado JSON o metadatos adicionales |
| DIR_DOCUMENTOS | Carpeta privada de adjuntos |
| MAX_DOCUMENTO_MB | Máximo por documento, 1–20 MB; predeterminado 5 |
| COOKIE_SECURE=1 | Cookie Secure para un despliegue con HTTPS |
| MENSAJES_AUTOMATICOS=0 | Apaga el envío automático de mensajes |
| BOT_WHATSAPP=1 | Activa el bot de recordatorios y sus pantallas |
| WHATSAPP_MODO | `simulado` (predeterminado) o `meta` |
| WHATSAPP_TOKEN / WHATSAPP_PHONE_ID / WHATSAPP_PLANTILLA / WHATSAPP_IDIOMA | Solo con `WHATSAPP_MODO=meta` |
| DATOS_DEMO=0 | No generar historial de demostración al crear un estado nuevo |

## Verificar

```bash
npm test                      # pruebas automáticas
npm run humo                  # recorre toda la página con cada rol y avisa si alguna se cae
npm run test:postgres-embebido
```

Validación local del 18 de noviembre de 2026 en macOS. **97 pruebas aprobadas, 0 fallidas y 1 omitida** (requiere servidor PostgreSQL externo). La comprobación adicional usa PostgreSQL embebido PGlite y valida los repositorios SQL, credenciales, bloques, duración, doble reserva, usuarios, lugares, especialidades, equipo multisedes y modificación de bloques. No sustituye la validación de despliegue con un servidor PostgreSQL externo.

La matriz quedó con **37 casos aprobados, 1 fallido (CP-28) y 8 pendientes de ejecución**. CP-23 aprobó las exportaciones y CP-36 aprobó la encuesta voluntaria de agendamiento.

También se revisaron en navegador el ingreso por rol, calendario y panel flotante, reportes, pacientes, registro de llegada y variante Telemedicina, en escritorio a 1440 y 1280 píxeles. Se validó la estructura de Excel, la firma PNG y la renderización de PDF.

## Despliegue en la nube

Pendiente para la etapa siguiente. El diseño propuesto, con las restricciones que impone el código y las decisiones que faltan, está en [`docs/diseno-despliegue-nube.md`](docs/diseno-despliegue-nube.md).

## Estructura y compatibilidad

Se conserva la arquitectura MVC y Repository del proyecto original, sus pruebas y el portal de pacientes. Las extensiones están en `src/controllers/operacion.js`, `src/controllers/reportes.js`, `src/services/OperacionService.js`, `src/services/ExportacionService.js` y las vistas `operacion*`. No se eliminaron rutas ni servicios anteriores; las rutas principales usan las vistas nuevas y las rutas operativas tienen control central de alcance por sede.
