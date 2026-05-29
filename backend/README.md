# QMS Platform Server

Backend API de la plataforma QMS. Implementa autenticacion, gestion documental, aprobaciones, firmas y auditoria.

## Stack

- Node.js 20+
- TypeScript (CommonJS)
- Fastify
- Prisma + PostgreSQL
- Vitest para tests

## Responsabilidades principales

1. Autenticacion JWT y contexto de usuario.
2. Gestion de usuarios (alta, listado, activacion/desactivacion).
3. Gestion de documentos, versiones y ciclo de vida.
4. Flujos de aprobacion configurables por categoria.
5. Aprobacion secuencial con autorizacion por aprobador.
6. Registro de auditoria y exportacion CSV/PDF.
7. Envio de notificaciones por email (si SMTP esta configurado).

## Estructura relevante

- [src/server.ts](src/server.ts): arranque del servidor
- [src/app.ts](src/app.ts): declaracion de rutas HTTP
- [src/store.ts](src/store.ts): reglas de negocio y persistencia
- [src/auth.ts](src/auth.ts): login, JWT y control de acceso de usuarios
- [src/schemas.ts](src/schemas.ts): schemas de validacion Fastify
- [src/email](src/email): servicio SMTP y plantillas de notificacion
- [src/export](src/export): exportacion de auditoria en CSV/PDF
- [prisma/schema.prisma](prisma/schema.prisma): modelo de datos

## Modelo de negocio

### Usuarios

- Roles: `admin`, `owner`, `approver`, `reader`.
- Los usuarios tienen `isActive` para habilitar/deshabilitar acceso.

### Documentos

- Campos principales: `code`, `title`, `description`, `category`, `status`, `visibility`.
- Visibilidad: `internal` o `restricted`.
- Estado inicial: `draft`.

### Ciclo de vida

- `draft` -> `in_review` (submit)
- `in_review` -> `approved` (si todos los pasos aprobados)
- `in_review` -> `draft` (reject)
- `approved` -> `obsolete` (con motivo obligatorio)

### Aprobaciones

- Tabla `DocumentApproval` con `stepOrder`, `responsibility`, `status`.
- Un aprobador no puede repetirse en el mismo documento.
- Validacion de secuencia: no se permite aprobar fuera de orden.
- Seguridad: solo el aprobador asignado decide; `admin` puede decidir en nombre de otro.

### Flujos por categoria

- `ApprovalWorkflow` y `ApprovalWorkflowStep` guardan listas de aprobadores por categoria.
- Si submit no recibe `approverIds`, backend usa el flujo configurado para la categoria.

### Auditoria

- Toda accion clave genera `AuditEvent`.
- Lectura por documento y exportacion a CSV/PDF.

## API

### Salud y overview

- `GET /health`
- `GET /api/v1/overview`

### Auth

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

### Usuarios

- `POST /api/v1/users` (admin)
- `GET /api/v1/users` (admin)
- `PATCH /api/v1/users/:id/toggle-active` (admin)

### Flujos de aprobacion

- `GET /api/v1/approval-workflows` (admin)
- `PUT /api/v1/approval-workflows/:category` (admin)

Body de `PUT`:

```json
{
	"steps": [
		{ "approverId": "uuid", "responsibility": "Revision tecnica" },
		{ "approverId": "uuid", "responsibility": "Aprobacion final" }
	]
}
```

### Documentos

- `GET /api/v1/documents`
- `POST /api/v1/documents`
- `GET /api/v1/documents/:id`
- `POST /api/v1/documents/:id/versions`
- `POST /api/v1/documents/:id/submit`
- `POST /api/v1/documents/:id/approve`
- `POST /api/v1/documents/:id/sign`
- `POST /api/v1/documents/:id/obsolete`
- `GET /api/v1/documents/:id/audit`
- `GET /api/v1/documents/:id/audit/export?format=csv|pdf`
- `POST /api/v1/documents/:id/access` — conceder acceso a documento `restricted` (propietario)
- `DELETE /api/v1/documents/:id/access/:userId` — revocar acceso (propietario)
- `GET /api/v1/documents/:id/access` — listar accesos concedidos (propietario)

Notas:

- `submit`: `approverIds` es opcional. Si no se envia, se resuelve por flujo de categoria.
- `approve`: el actor sale del JWT; en body solo van `approverId`, `decision`, `comment`.

## Variables de entorno

Base en [backend/.env.example](.env.example):

- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_NAME`
- `ADMIN_PASSWORD`

Email (opcional):

- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_SECURE`
- `EMAIL_USER`
- `EMAIL_PASS`
- `EMAIL_FROM`
- `EMAIL_REJECT_UNAUTHORIZED`

## Desarrollo

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

## Build y ejecucion

```bash
npm run build
npm start
```

## Tests

```bash
npm test
```

Estructura de suites:

| Suite | Directorio | Proposito |
|-------|-----------|-----------|
| Unitarios | `tests/unit/` | Modulos aislados (ej. plantillas email) |
| Integracion | `tests/integration/` | Endpoints individuales contra BD real (documentos, lifecycle, workflows, ACL, auditoria, export) |
| Funcionales (E2E) | `tests/functional/` | Escenarios completos de principio a fin (lifecycle, approval workflow, ACL, auditoria) |

Suites destacadas:

- [tests/integration/lifecycle.test.ts](tests/integration/lifecycle.test.ts)
- [tests/integration/approval-workflows.test.ts](tests/integration/approval-workflows.test.ts)
- [tests/integration/audit.test.ts](tests/integration/audit.test.ts)
- [tests/integration/export.test.ts](tests/integration/export.test.ts)
- [tests/functional/lifecycle-scenarios.test.ts](tests/functional/lifecycle-scenarios.test.ts)
- [tests/functional/approval-workflow-scenarios.test.ts](tests/functional/approval-workflow-scenarios.test.ts)
- [tests/functional/acl-scenarios.test.ts](tests/functional/acl-scenarios.test.ts)
- [tests/functional/audit-scenarios.test.ts](tests/functional/audit-scenarios.test.ts)

## Seed inicial

Al ejecutar `npm run prisma:seed` se crean:

1. Usuario admin configurable por variables de entorno.
2. Usuario admin adicional de entorno de pruebas definido en seed.
3. Usuarios aprobadores demo de calidad.

Revisar y ajustar datos de [prisma/seed.ts](prisma/seed.ts) segun entorno.
