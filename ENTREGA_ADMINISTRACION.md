# Entrega — Administración

Esta entrega abre Administración directamente en **Agendas y cupos** y conserva
la barra lateral institucional con los cuatro módulos principales:

- Agendas y cupos
- Equipo de salud
- Policlínicos y especialidades
- Reportes

Usuarios, permisos y Auditoría se encuentran en **Configuración / perfil**.
El código forma parte del sistema integrado porque Administración y TENS/TONS
comparten autenticación, catálogos, reservas, auditoría y reglas de negocio.

### Funciones incorporadas desde la versión anterior

Desde **Agendas y cupos** también se accede a:

- **Cancelaciones**: cancelación institucional en lote (con filtros por lugar,
  especialidad, profesional y fechas), motivo obligatorio, horario bloqueado o
  liberado, aviso por WhatsApp/correo y lista de reservas pendientes de
  reprogramar con propuesta de horas de la misma especialidad.
- **Cupos por rango**: publicar, bloquear o dejar sin publicar todos los cupos
  libres de un periodo (máximo 190 días); los cupos reservados no cambian.

En **Equipo de salud**, un integrante desactivado y sin reservas ni historial
puede eliminarse.

## Acceso de demostración

- Correo: `admin@ejemplo.cl`
- Contraseña: `demo1234`

## Ejecutar

```bash
npm ci
npm start
```

Sitio del personal: `http://localhost:3001`

