# Demostración de los mensajes automáticos (datos ficticios)

Esta demostración funciona **sin autorización para usar datos reales y sin proveedor de mensajería**: todos los
pacientes, RUT, teléfonos y correos son ficticios y **no sale ningún mensaje real**. El sistema lo declara en pantalla
(«Simulado»). Con la autorización de la Fundación y las credenciales de Meta, el mismo flujo se conecta a WhatsApp real
cambiando solo la configuración (`WHATSAPP_MODO=meta`; ver README).

## Preparación

```bash
ARCHIVO_DATOS=/tmp/demo.json BOT_WHATSAPP=1 npm start
```

`ARCHIVO_DATOS` apunta a un estado temporal: la demostración parte limpia y **no toca** `datos/estado.json`.

- Portal de pacientes: http://localhost:3000
- Personal: http://localhost:3001 — `tens@ejemplo.cl` / `demo1234` (TENS/TONS, San Isidro)

## Escenario 1 — Comprobante automático por WhatsApp (RF28)

1. Portal → **Reservar hora**. Paso 1: RUT `12.345.678-5`, lugar **San Isidro**, especialidad **Medicina General**.
   Marca la casilla de consentimiento y la de **recibir comprobante y avisos** por WhatsApp o correo.
2. Elige una hora (anota la fecha). Datos: Ana Prueba, celular `+56911112222`, marca «El celular tiene WhatsApp»,
   correo vacío. Adjunta cualquier PDF ficticio si te lo pide.
3. Confirma. La pantalla dice que el envío quedó **registrado como simulado** y permite descargar el PDF.
4. Personal → **Comunicaciones**: la fila queda en **Simulado**, con el detalle «no salió ningún mensaje real».
5. Abre http://localhost:3001/tens/bot → **Bandeja simulada**: aparece el texto exacto que recibiría la paciente.

## Escenario 2 — Lo mismo por correo

Repite el escenario 1 con otro RUT ficticio válido (`13456789-9`), **sin** marcar
«El celular tiene WhatsApp» y con correo `ana.prueba@ejemplo.cl`. La bandeja muestra Canal **Correo** y ese destino.

## Escenario 3 — Recordatorios y respuesta del paciente (RF07, RF08, RF09)

Usa la cita del escenario 1 (la paciente tiene consentimiento).

1. En `/tens/bot`, en **Fecha y hora a simular** escribe el **día anterior a la cita a las 10:00**
   (ej. cita el 2026-11-24 → `2026-11-23 10:00`) y pulsa **Ejecutar bot**. Sale el recordatorio con los botones
   *Confirmar* y *Cancelar mi hora*.
2. **Simular respuesta del paciente**: elige la cita y **Confirmar** → la cita pasa a Confirmada.
   (Alternativa: *Cancelar mi hora* → la cita queda Cancelada con origen WhatsApp. *Hola (texto libre)* → solo recibe la
   ayuda: no hay conversación libre ni IA.)
3. **El silencio no cancela:** con otra cita sin responder, simula el mismo día a las `14:00` y ejecuta el bot. La cita
   queda «sin respuesta», **sigue reservada** y aparece en pendientes para que TENS/TONS llame.

## Escenario 4 — Sin consentimiento no se envía

En la ficha de un paciente (Pacientes) desmarca el consentimiento para comunicaciones y guarda. Al ejecutar el bot esa
cita se **omite** y aparece un aviso para confirmar por llamada.

## Escenario 5 (opcional) — Sin proveedor configurado

```bash
ARCHIVO_DATOS=/tmp/demo2.json BOT_WHATSAPP=1 WHATSAPP_MODO=meta npm start
```

Sin credenciales el sistema **no inventa** un envío: la comunicación queda **Pendiente** con «Intento 1 de 3 fallido:
WhatsApp no está configurado. Se reintentará» y, tras 3 intentos, **Error** con aviso para llamar.

## Qué decir (y qué no) en el video

- Sí: «modo demostración con datos ficticios», «el mensaje queda registrado como simulado», «con la autorización de la
  Fundación se conecta a la API oficial de WhatsApp de Meta».
- No: decir que el sistema «envía» mensajes reales, ni mostrar el estado como «Enviado/Entregado». Tampoco decir que
  las respuestas de los pacientes llegan solas: en la demostración se simulan con el formulario; el *webhook* real está
  pendiente.
