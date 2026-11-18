# Entrega — TENS/TONS

Esta entrega incluye la operación TENS/TONS limitada al policlínico asignado y
la variante equivalente para Telemedicina. El menú contiene:

- Atención del día
- Agendas y reservas
- Lista de espera
- Pacientes
- Comunicaciones

Los pacientes se muestran sin fotografía y con RUT completo. La ficha es
administrativa, permite recordar datos personales y adjuntar órdenes de
derivación, certificados y otros respaldos; no es una ficha clínica.

El código forma parte del sistema integrado porque Administración y TENS/TONS
comparten autenticación, catálogos, reservas, auditoría y reglas de negocio.

## Accesos de demostración

- TENS/TONS: `tens@ejemplo.cl`
- Telemedicina: `telemedicina.usuario@ejemplo.cl`
- Contraseña: `demo1234`

## Ejecutar

```bash
npm ci
npm start
```

Sitio del personal: `http://localhost:3001`

