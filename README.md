# Hermandad de Dolores · Gestión de citas

Versión **1.1.0**. Aplicación para reservar citas y gestionar la atención administrativa de seis policlínicos y Telemedicina. Incluye un portal para pacientes y un sitio para el personal. Los datos de demostración son ficticios. El alcance del sistema es administrativo.

[Inicio rápido](#inicio-rápido) · [Funciones](#funciones) · [Verificación](#verificación) · [Datos y respaldos](#datos-y-respaldos) · [Configuración](#configuración) · [Estructura](#estructura-del-proyecto)

## Inicio rápido

`npm start` requiere npm y **Node.js 20.19 o posterior dentro de la rama 20**, o **Node.js 22.9 en adelante**. El proyecto se puede ejecutar en macOS, Linux y Windows. [Documentación de Node.js 20](https://nodejs.org/download/release/v20.19.0/docs/api/cli.html#--env-file-if-existsconfig) · [Documentación de Node.js 22](https://nodejs.org/download/release/v22.9.0/docs/api/cli.html#--env-file-if-existsconfig)

Ejecuta estos comandos desde la raíz del proyecto.

```bash
npm ci
npm start
```

| Acceso | Dirección |
| --- | --- |
| Portal de pacientes | [localhost:3000](http://localhost:3000) |
| Sitio del personal | [localhost:3001](http://localhost:3001) |
| WhatsApp y correo simulados | [localhost:3000/demo/mensajes](http://localhost:3000/demo/mensajes) |

La demostración funciona con la configuración predeterminada y guarda los datos en `datos/estado.json`. Los mensajes aparecen en la bandeja de simulación. La zona horaria es `America/Santiago`. El despliegue público en la nube está pendiente.

### Cuentas de demostración

| Perfil | Correo |
| --- | --- |
| Administración | `admin@ejemplo.cl` |
| TENS/TONS de Casa Central (San Isidro) | `tens@ejemplo.cl` |
| Telemedicina | `telemedicina.usuario@ejemplo.cl` |

Las tres cuentas usan la contraseña `demo1234` en la demostración local. Con PostgreSQL en desarrollo, define `CLAVE_DEMO=demo1234` para habilitarla. Las cuentas que crea Administración establecen su contraseña mediante un enlace de un solo uso, válido durante 30 minutos.

## Funciones

### Portal de pacientes

Permite reservar horas y responder las encuestas de agendamiento y de atención. Cada encuesta tiene sus propios resultados en **Reportes**.

| Encuesta | Cuándo se responde |
| --- | --- |
| Agendamiento (RF36) | Al confirmar una reserva en el portal. Es voluntaria y permite una respuesta por reserva mediante su token. La hora queda reservada aunque se omita la encuesta. |
| Atención (RF30) | En [la encuesta de atención](http://localhost:3000/paciente/encuesta), después de que se registre la asistencia. |

### Administración

| Módulo | Funciones |
| --- | --- |
| **Agendas y cupos** | Consulta la agenda diaria por profesional o la semanal. Filtra por fecha, lugar, especialidad, profesionales y estado. El color identifica el lugar en **Toda la red** y la especialidad dentro de una sede. Cada reserva se abre en un panel flotante. |
| **Equipo de salud** | Busca y filtra integrantes en tarjetas o tabla. Gestiona profesión, fotografía (JPG o PNG) y asignaciones vigentes a varias especialidades y lugares. Reprograma las reservas futuras afectadas antes de retirar una asignación. Los integrantes desactivados conservan su historial. |
| **Policlínicos y especialidades** | Crea y edita lugares y especialidades, con sus estados y colores. Incluye los seis policlínicos y Telemedicina. |
| **Reportes** | Filtra por período, lugar, especialidad y profesional. Consulta pacientes únicos atendidos, sexo registrado, consultas, ausencias y registros pendientes. La sección de encuestas muestra las respuestas, el promedio y la distribución de notas de 1 a 5 de cada encuesta por separado. Descarga gráficos en PDF, Excel (`.xlsx`) o PNG y el reporte completo en PDF o Excel, con el período y los filtros aplicados (RF22). |

En **Agendas y cupos** puedes crear bloques para una fecha o repetirlos cada semana. Define el rango horario, la duración por cupo y los días. Antes de guardar, revisa el número de cupos y los conflictos del profesional en toda la red. Puedes guardar un bloque como borrador o publicarlo y ajustar la disponibilidad de cada cupo.

Para gestionar ausencias, reemplazos, cambios de lugar u horario y cancelaciones institucionales, revisa primero las reservas afectadas. El sistema revalida el impacto al guardar. Puedes elegir qué citas cancelar y si los cupos quedan disponibles o bloqueados. Reprograma desde el detalle de la reserva. Los cambios generan instrucciones para la sede y un registro en la bitácora.

En **Configuración / perfil** se encuentran **Usuarios** y **Auditoría**. En Usuarios puedes vincular integrantes, asignar sedes, definir la sede de inicio, autorizar el término administrativo de una atención y consultar el último acceso. Los cambios de permisos revocan las sesiones activas. En Auditoría puedes filtrar por fecha, usuario, acción y lugar. Se conservan el historial anterior y los valores registrados en las operaciones nuevas.

### TENS/TONS y Telemedicina

Cada sesión queda limitada a la sede principal que asigna Administración, incluso cuando la cuenta tiene varias sedes autorizadas. El acceso a citas, fichas, documentos y lista de espera se controla por sede.

| Módulo | Funciones |
| --- | --- |
| **Atención del día** | Consulta atenciones y tareas de la sede por fecha, nombre o RUT. Registra llegada, sala, confirmación, término administrativo y ausencia. |
| **Agendas y reservas** | Consulta las agendas diaria y semanal, las próximas horas libres y el detalle de la cita. Crea, reprograma o cancela reservas. En las cancelaciones solicitadas por el paciente se registra el motivo y el canal, y se decide si el cupo se libera o se bloquea. |
| **Lista de espera** | Filtra por antigüedad y prioridad, y revisa los cupos compatibles con las preferencias de horario. Registra fecha, canal y resultado del contacto. El estado **No responde** mantiene activa la solicitud. |
| **Pacientes** | Busca por nombre, RUT o teléfono. Registra y edita fichas con validación del dígito verificador. La ficha reúne resumen, reservas, documentos, tutor y comunicaciones. Las fichas desactivadas conservan el historial y los datos se recuperan por RUT en futuras reservas. Para pacientes menores de 18 años se registra un adulto responsable, su relación, RUT y teléfono. |
| **Documentos** | Adjunta PDF, JPG y PNG con tipo, especialidad y vigencia. Permite revisar, visualizar, descargar, reemplazar y archivar documentos conservando los originales. El acceso a los archivos privados se limita a la sede autorizada. |
| **Confirmaciones** | Registra llamadas y sus resultados. Si falla un envío automático, **Resumen** muestra un aviso y enlaza a **Confirmaciones**. Administración revisa el estado de los mensajes en **Comunicaciones**. |

Cuando una cancelación asistida o por WhatsApp libera un cupo, el sistema busca una solicitud compatible y lo asigna por prioridad (**Alta**, **Media**, **Normal**) y luego por antigüedad. Avisa a TENS/TONS e intenta enviar el comprobante si el paciente autorizó las comunicaciones y tiene un canal habilitado. El personal puede ajustar la asignación manualmente. Si hay lista de espera y ninguna solicitud calza con el horario, el cupo queda retenido para asignarlo o liberarlo a la agenda pública.

**Telemedicina** opera como sede independiente. Usa **Reserva de Telemedicina**, un enlace HTTPS y los estados **Enlace pendiente**, **Enlace enviado**, **Confirmada**, **Conectado**, **Atendida** y **No se conectó**.

## Verificación

| Comando | Qué comprueba |
| --- | --- |
| `npm test` | Suite de pruebas automáticas. |
| `npm run humo` | Páginas y enlaces del portal y de los tres perfiles del personal. |
| `npm run test:postgres-embebido` | Repositorios SQL y flujos de integración con PGlite. |
| `PSQL_TEST_ARGS` con `npm test` | Habilita la prueba con un servidor PostgreSQL externo y crea una base de prueba dedicada. |

### Resultados de verificación

- El **23 de noviembre de 2026**, `npm test` registró 286 pruebas aprobadas y 1 omitida, que requería un servidor PostgreSQL externo. Con PGlite se verificaron catálogos, credenciales, bloques, doble reserva, asignaciones a varias sedes y la asignación automática de la lista de espera.
- La **matriz de casos** del 22 de noviembre registró 38 aprobados, 1 bloqueado y 7 pendientes de ejecución. CP-06 verifica la asignación automática y el ajuste manual de la lista de espera. CP-28 requiere un envío real por WhatsApp.
- El **18 de noviembre**, en navegador se revisaron el ingreso por rol, la agenda y el panel flotante, reportes, pacientes, el registro de llegada y Telemedicina a 1440 y 1280 píxeles. También se comprobó la estructura del Excel, la firma del PNG y la renderización del PDF.

## Datos y respaldos

| Modo | Dónde se guardan los datos |
| --- | --- |
| **JSON** (predeterminado) | `datos/estado.json` se guarda con permisos privados y se actualiza mediante reemplazo de archivo. En un primer arranque, `DATOS_DEMO=0` crea el conjunto mínimo sin historial de demostración. El estado existente se conserva. |
| **PostgreSQL** (`DATABASE_URL`) | Los catálogos, pacientes, bloques, citas, usuarios y contactos se guardan en la base. Las tablas `auditoria`, `documento` y `cita_historial` guardan el resultado de las operaciones, las revisiones de documentos y el historial de citas. Las instrucciones, comunicaciones y otros metadatos se guardan en `datos/extras.json`. |

En ambos modos, los adjuntos se guardan en `datos/documentos/` y las fotos privadas en `datos/fotos/`. Con PostgreSQL, conserva esas carpetas y `datos/extras.json` junto con la base. La auditoría, los documentos y el historial que se guardaban en `extras.json` se migran una vez. Las bases anteriores se actualizan con [la migración 04](base-de-datos/04_migracion_auditoria_documentos.sql).

### Respaldo y restauración

Para crear, listar y verificar respaldos, usa estos comandos. Reemplaza `NOMBRE_DE_LA_CARPETA` por el nombre que muestra la lista.

```bash
npm run respaldo
npm run respaldo -- listar
npm run respaldo -- verificar respaldos/NOMBRE_DE_LA_CARPETA
```

El respaldo copia `datos/` y, si está definida `DATABASE_URL`, incluye un volcado de PostgreSQL. El archivo `manifiesto.json` registra el tamaño y la huella SHA-256 de cada archivo para verificar su integridad.

Detén la aplicación y ejecuta el comando de restauración con el respaldo elegido.

```bash
npm run restaurar -- respaldos/NOMBRE_DE_LA_CARPETA
```

El script verifica el respaldo, crea una copia del estado actual con el sufijo `_antes-de-restaurar` y reemplaza por completo la carpeta `datos/`. Los respaldos contienen datos personales. Guarda una copia privada fuera del equipo. La carpeta `respaldos/` está excluida del control de versiones y de la imagen Docker.

El caso CP-42 se validó en modo JSON. El respaldo con PostgreSQL está pendiente de validación en un servidor real. Requiere `pg_dump` y `pg_restore`, que deben instalarse también en cualquier imagen Docker desde la que se ejecuten.

## Configuración

### Docker y PostgreSQL

Copia `.env.example` a `.env`, define `POSTGRES_PASSWORD` y ejecuta el siguiente comando. [Archivo de ejemplo](.env.example)

```bash
docker compose up --build
```

Docker Compose usa el modo `development` por defecto. PostgreSQL queda disponible desde el equipo en `127.0.0.1:5432`. Conserva los volúmenes `dbdata` y `adjuntos`. La imagen por sí sola usa `NODE_ENV=production`, ejecuta la aplicación con el usuario `node` y comprueba que el portal responda mediante un `HEALTHCHECK`.

Para usar un servidor PostgreSQL propio, aplica los scripts de estructura, datos de ejemplo y credenciales en ese orden. [01_estructura.sql](base-de-datos/01_estructura.sql) · [02_datos_ejemplo.sql](base-de-datos/02_datos_ejemplo.sql) · [03_credenciales.sql](base-de-datos/03_credenciales.sql)

Para una demostración con PostgreSQL, agrega estas variables a `.env` y vuelve a ejecutar `npm start`.

```dotenv
DATABASE_URL=postgres://usuario:clave@localhost:5432/hermandad
CLAVE_DEMO=demo1234
```

### Producción

- Define `NODE_ENV=production` y elimina `CLAVE_DEMO`, ya que una clave de demostración impide el arranque. Activa los datos de muestra solo si necesitas demostrar el sistema con `DATOS_DEMO=1`.
- Usa valores propios para `POSTGRES_PASSWORD` y `DATABASE_URL`. Mantén `.env` fuera del repositorio.
- En producción se habilita la cookie de sesión `Secure` y se envían las cabeceras `Strict-Transport-Security` y `Content-Security-Policy`. La variable `COOKIE_SECURE=0` desactiva el atributo de la cookie si se usa HTTP.
- Activa `TRUST_PROXY=1` únicamente cuando haya un proxy delante de la aplicación. El límite de intentos toma la última IP de `X-Forwarded-For` en ese modo.
- Ejecuta una sola instancia. Las sesiones, el límite de intentos y la cola de operaciones viven en memoria. Las sesiones caducan tras 30 minutos de inactividad o un máximo de 8 horas. Tras reiniciar hay que iniciar sesión de nuevo.

#### Primer administrador

Genera el enlace de acceso inicial con la aplicación detenida.

```bash
npm run crear-admin -- correo@dominio.cl "Nombre Apellido"
```

El comando imprime un enlace de un solo uso, válido durante 30 minutos, para elegir una contraseña de al menos 10 caracteres. Define `URL_PERSONAL` para que use el dominio del sitio del personal. Vuelve a iniciar la aplicación después de ejecutar el comando.

Si usas Docker Compose, conserva PostgreSQL en ejecución mientras detienes y vuelves a iniciar `app`.

```bash
docker compose stop app
docker compose run --rm --no-deps app npm run crear-admin -- correo@dominio.cl "Nombre Apellido"
docker compose up -d app
```

### Mensajes automáticos y WhatsApp

Cada minuto se procesa la bandeja de **Comunicaciones**, que incluye comprobantes, cambios, cancelaciones, reprogramaciones y enlaces de Telemedicina. Con `BOT_WHATSAPP=1`, el bot también envía recordatorios una semana antes y la víspera a las 10:00, con un reintento a las 14:00. `MENSAJES_AUTOMATICOS=0` detiene el procesamiento automático.

Los envíos requieren el consentimiento del paciente. El silencio mantiene el estado de la cita y la solicitud de espera. Si el proveedor falla, se realizan hasta tres intentos, con esperas de 5 y 10 minutos. Después, el mensaje queda en **Error** y se avisa al personal para que llame.

| `WHATSAPP_MODO` | Comportamiento |
| --- | --- |
| `simulado` (predeterminado) | WhatsApp y correo se registran en la bandeja interna con estado **Simulado**. |
| `meta` | Envía WhatsApp mediante la API de Meta. Requiere `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` y `WHATSAPP_PLANTILLA`. La plantilla debe estar aprobada y tener una variable en el cuerpo. El idioma predeterminado es `es` y se puede cambiar con `WHATSAPP_IDIOMA`. |

**Enviado** indica que el proveedor aceptó el mensaje. **Pendiente** indica que espera un reintento o que el canal carece de proveedor. El webhook registra **Entregado** cuando Meta confirma que el mensaje llegó o se leyó.

#### Webhook de WhatsApp

Define `WHATSAPP_APP_SECRET` y `WHATSAPP_VERIFY_TOKEN` para habilitar `/webhook/whatsapp`. Usa en Meta el mismo token de verificación y expón la ruta por HTTPS, mediante un túnel en local o un despliegue público.

- El webhook comprueba la firma `X-Hub-Signature-256` y procesa cada aviso una sola vez.
- Para confirmar o cancelar citas desde un recordatorio, la plantilla debe incluir los botones de respuesta rápida **Confirmar** y **Cancelar mi hora**. La operación queda registrada con origen WhatsApp.
- La respuesta se vincula con el mensaje original. Si falta esa referencia, el teléfono solo se usa cuando identifica una única hora consultada. Cuando hay varias, se avisa al personal.
- Si falla la entrega de un recordatorio, el personal recibe una tarea para llamar y la cita sigue vigente.

La integración con Meta se verificó con avisos firmados de prueba. La validación con una cuenta real sigue pendiente. El correo funciona únicamente en la simulación.

### Otras variables de entorno

| Variable | Uso |
| --- | --- |
| `PORT` / `PORT_PERSONAL` | Puertos del portal y del sitio del personal. Por defecto, `3000` y `3001`. |
| `URL_PORTAL` | Enlace al portal desde el sitio del personal. |
| `ARCHIVO_DATOS` | Ruta privada al archivo de estado JSON o a los metadatos adicionales. |
| `DIR_DOCUMENTOS` | Carpeta privada de adjuntos. |
| `MAX_DOCUMENTO_MB` | Máximo por documento, de 1 a 20 MB. Por defecto, 5 MB. |

## Estructura del proyecto

La aplicación usa MVC y repositorios para separar las vistas, las reglas de negocio y el almacenamiento. Los controladores de operación y reportes están en `src/controllers/`, con sus servicios en `src/services/` y las vistas operativas en `src/views/`.

| Ruta | Contenido |
| --- | --- |
| `src/server.js`, `src/rutas.js` | Servidor HTTP y tabla de rutas. |
| `src/armarAplicacion.js`, `src/tareasProgramadas.js` | Configuración de dependencias y tareas automáticas. |
| `src/controllers/`, `src/services/`, `src/views/` | Controladores, reglas de negocio y vistas HTML. |
| `src/repositories/`, `src/db/` | Repositorios en memoria y PostgreSQL, persistencia en JSON y conexión a la base. |
| `src/models/`, `src/auth/` | Datos iniciales, sedes y comunas, sesiones, contraseñas y permisos. |
| `src/mensajeria/`, `src/herramientas/` | Proveedores de WhatsApp y utilidades de RUT, fechas, respaldos y límite de intentos. |
| `base-de-datos/`, `datos/` | Scripts SQL y archivos locales generados durante el uso. |
| `scripts/`, `test/`, `pruebas-de-extremo-a-extremo/` | Comandos de mantenimiento, pruebas automáticas y pruebas de navegador. |
| `public/` | Imágenes del sitio. |
