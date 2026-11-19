# Diseño: despliegue en la nube

**Estado:** propuesta para la etapa siguiente del curso. 
**No está implementada.** Escrita el 18 de noviembre de 2026, sobre el código del commit `1f2d86a`.
**Decisión pendiente del equipo:** el enfoque (sección 4) y las preguntas de la sección 8.

## 1. Por qué

- El curso exige desplegar en la nube en la etapa siguiente. Para la entrega del 23 de noviembre basta la demostración local.
- **El WhatsApp real depende de esto.** El webhook (`/webhook/whatsapp`) debe ser alcanzable por HTTPS desde internet para que Meta entregue las respuestas de los pacientes y los estados de entrega. Sin despliegue, los casos CP-07, CP-08, CP-25, CP-28 y CP-30 no se pueden cerrar aunque exista la cuenta de Meta.
- La evaluación pide una URL estable y un usuario de prueba.

## 2. Objetivos, no objetivos y anti-objetivos

**Objetivos**
- Portal de pacientes y sitio del personal en una URL HTTPS estable.
- Los datos sobreviven a reinicios y a nuevas versiones.
- Webhook de WhatsApp alcanzable.
- Secretos fuera del código y del repositorio.
- Respaldo comprobado (RNF06).

**No objetivos**
- Varias instancias o alta disponibilidad: hoy el sistema solo funciona con una (ver 3.3).
- Reescribir la aplicación a funciones sin servidor.
- Datos reales de pacientes: siguen siendo ficticios hasta que la Fundación lo autorice.

**Anti-objetivos** (sería un fracaso aunque la página cargue)
- Perder los datos en un redespliegue porque el disco del servicio era temporal.
- Dejar las tablas legibles desde internet a través de la API automática de Supabase.
- Operar con datos reales mientras existan las cuentas de demostración con `demo1234`.
- Servir el sitio del personal sin HTTPS o sin cookie `Secure`.

## 3. Restricciones que impone el código actual

1. **Dos puertos en un proceso.** `npm start` abre el portal en `PORT` (3000) y el personal en `PORT_PERSONAL` (3001). La mayoría de los servicios en la nube exponen un solo puerto. Con `PORT_PERSONAL=0` el sistema sirve todo en un puerto (comprobado).
2. **Estado en disco, incluso con PostgreSQL.** Sin base de datos todo vive en `datos/estado.json`. Con `DATABASE_URL`, catálogos, citas y usuarios van a PostgreSQL, pero **siguen en disco** `datos/extras.json` (documentos, comunicaciones, auditoría, encuestas, mensajes del bot, avisos ya procesados del webhook), los adjuntos en `datos/documentos/` y las fotos en `datos/fotos/`. **Se necesita un disco persistente**; si no, cada redespliegue borra la auditoría y los documentos.
3. **Sesiones en memoria.** Por eso hay una sola instancia, y un reinicio cierra la sesión de todos. Es aceptable para esta etapa.
4. **La conexión a PostgreSQL no fija cifrado.** `src/db/pool.js` usa solo `DATABASE_URL`. Los servicios administrados exigen SSL: hay que indicarlo en la URL (por ejemplo `?sslmode=require`) y **probarlo** con el proveedor elegido.
5. **El esquema no tiene RLS** (0 políticas en 37 tablas). El control de acceso está en la aplicación. Ver 5.3.
6. **La imagen Docker no incluye `scripts/`**, así que `npm run respaldo` no existe dentro del contenedor.
7. **Ya resuelto:** la zona horaria se fija en código (`America/Santiago`); `package-lock.json` trae los binarios de `resvg` para Linux (gnu y musl); el `Dockerfile` instala las fuentes para los PNG; `npm start` funciona con Node 20 o superior.

## 4. Enfoques considerados

| | A. Contenedor con disco persistente + PostgreSQL administrado | B. Servidor virtual propio con `docker compose` | C. Lo del informe de viabilidad: Cloudflare Pages + Supabase |
|---|---|---|---|
| Cambios al código | Mínimos (sección 6) | Casi ninguno: el `docker-compose.yml` ya existe | **Reescritura**: Pages no ejecuta un servidor Node; habría que pasar `extras.json` a tablas y las sesiones a la base |
| HTTPS y certificados | Los da el servicio | Hay que montarlos (proxy inverso) | Los da Cloudflare |
| Respaldo de la base | Lo da el proveedor de la base | Propio | Lo da Supabase |
| Quién mantiene el servidor | El servicio | **El equipo**: actualizaciones, seguridad, caídas | Cloudflare |
| Riesgo para la entrega | Bajo | Medio (operación) | **Alto** (el código que hoy pasa las pruebas cambia mucho) |

**Recomendación: A.** Es el único que deja correr tal cual el código ya probado (las pruebas automáticas y los casos aprobados de la matriz) y no suma la carga de administrar un servidor. B sirve si el equipo quiere control total y alguien asume operarlo. C es lo que dice el informe de viabilidad, pero se pensó para un sitio estático: con la arquitectura que finalmente se construyó implica rehacer el backend.

**Consecuencia para el informe:** si se elige A o B, hay que declarar en el informe (arquitectura y continuidad en nube) que la plataforma cambia respecto de la viabilidad y por qué. No hacerlo deja el informe contradiciendo al sistema.

## 5. Diseño propuesto (enfoque A)

### 5.1 Servicio
- Una sola instancia, construida desde el `Dockerfile` actual.
- `PORT` lo asigna el servicio y `PORT_PERSONAL=0`: portal y personal en el mismo dominio. Las rutas del personal ya exigen sesión y rol. Separarlos en dos dominios es opcional (sección 8).
- **Disco persistente montado en `/app/datos`.** Es la ruta por defecto de `ARCHIVO_DATOS`, `DIR_DOCUMENTOS` y las fotos, así que no hace falta configurar nada más.
- Comprobación de salud: `GET /` responde 200 con el portal.

### 5.2 Base de datos
- **Recomendado: modo PostgreSQL** (Supabase u otro administrado), porque la rúbrica evalúa la conexión a base de datos. El modo sin base también funcionaría con el disco persistente, como plan de respaldo.
- Crear el esquema una vez con `db/hermandad_postgresql.sql`, `db/datos_ejemplo.sql` y `db/03_credencial.sql`, en ese orden.
- `DATABASE_URL` con cifrado (restricción 4), comprobado antes de dar la URL a nadie.

### 5.3 Seguridad
- **Supabase publica automáticamente una API sobre las tablas.** La aplicación no la usa (se conecta directo a PostgreSQL), pero sin RLS las tablas podrían quedar legibles. Antes de cargar datos: **habilitar RLS en todas las tablas sin políticas, o desactivar esa API** en el panel. RLS no afecta a la aplicación si esta se conecta con el mismo rol que creó las tablas (el dueño); hay que comprobarlo con una reserva después de activarlo. Comprobarlo intentando leer una tabla con la clave pública.
- `COOKIE_SECURE=1`.
- Secretos solo como variables del servicio: `DATABASE_URL`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_PLANTILLA`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`. Nunca en el repositorio.
- `CLAVE_DEMO` solo mientras haya datos ficticios y una evaluación lo requiera. Se retira antes de cualquier dato real.

### 5.4 WhatsApp
- Webhook en `https://<dominio>/webhook/whatsapp`, registrado en el panel de Meta con el mismo `WHATSAPP_VERIFY_TOKEN`.
- La plantilla aprobada debe tener botones de respuesta rápida con las etiquetas exactas **Confirmar** y **Cancelar mi hora**.
- Primero con un número de prueba y un teléfono del equipo; luego se ejecutan CP-07, CP-08, CP-25, CP-28 y CP-30 con envíos reales.

### 5.5 Respaldo
- La base: el respaldo del proveedor, más `pg_dump` periódico.
- El disco (`/app/datos`): agregar `COPY scripts ./scripts` al `Dockerfile` para tener `npm run respaldo` dentro del contenedor, o respaldarlo desde fuera. Los respaldos se guardan **fuera** del servicio.
- Repetir CP-42 en el entorno desplegado.

## 6. Tareas para quien lo implemente, en orden

1. Elegir proveedor y crear la base; aplicar el esquema; habilitar RLS o desactivar la API (5.3) y comprobarlo.
2. Probar `DATABASE_URL` con cifrado desde un equipo del equipo.
3. Crear el servicio desde el `Dockerfile` con disco persistente en `/app/datos`, `PORT_PERSONAL=0` y `COOKIE_SECURE=1`.
4. Agregar `COPY scripts ./scripts` al `Dockerfile`.
5. Comprobar: inicio de sesión con las tres cuentas, una reserva web, un reinicio del servicio (los datos deben seguir), un redespliegue (también), descargas PDF, Excel y PNG.
6. Webhook: registrar la URL en Meta y verificar la suscripción.
7. Respaldo y restauración en el entorno desplegado (CP-42).
8. Actualizar el informe: modalidad en la nube, URL, usuario de prueba y la desviación respecto de la viabilidad.

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| El disco del servicio resulta temporal | Comprobarlo con un redespliegue antes de cargar nada (tarea 5) |
| Tablas expuestas por la API de Supabase | 5.3, comprobado con la clave pública |
| El cifrado de la conexión falla con el pool actual | Tarea 2; si falla, agregar la opción `ssl` en `pool.js` |
| Un reinicio cierra todas las sesiones | Aceptado en esta etapa; mover sesiones a la base si molesta |
| Costos | Verificar precios vigentes; el informe de viabilidad tiene el presupuesto |

## 8. Preguntas abiertas para el equipo

1. **Enfoque A, B o C.** Si es C, es un proyecto aparte que no conviene mezclar con la entrega.
2. **Proveedor concreto**, con precio vigente verificado y que ofrezca disco persistente.
3. **Un dominio o dos** (portal y personal separados). Con dos hace falta un pequeño cambio para elegir el modo por variable.
4. **Quién custodia** los secretos de Meta y los respaldos.
5. **Primera versión con o sin PostgreSQL.**
