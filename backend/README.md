# QMS Platform Server

Servidor base para una plataforma QMS orientada a la gestión documental, trazabilidad, aprobaciones, firmas y auditoría para ISO 9001, ISO 14001/14000 y PRL / ISO 45001.

## Qué incluye

- API REST en TypeScript con Fastify
- Gestión de documentos con versiones
- Flujos de aprobación
- Firmas electrónicas simuladas
- Registro de auditoría
- Búsqueda simple por texto
- Endpoint de salud y resumen operativo

## Requisitos

- Node.js 20 o superior

## Instalación

```bash
npm install
npm run prisma:generate
```

## Variables de entorno

Crear un archivo `.env` tomando como base `.env.example`.

Variables obligatorias:

- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_NAME`
- `ADMIN_PASSWORD`

## Desarrollo

```bash
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

## Producción

```bash
npm run build
npm start
```

## Endpoints

- `GET /health`
- `GET /api/v1/overview`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `POST /api/v1/users` (solo `admin`)
- `GET /api/v1/documents`
- `POST /api/v1/documents`
- `GET /api/v1/documents/:id`
- `POST /api/v1/documents/:id/versions`
- `POST /api/v1/documents/:id/submit`
- `POST /api/v1/documents/:id/approve`
- `POST /api/v1/documents/:id/sign`
- `POST /api/v1/documents/:id/obsolete`
- `GET /api/v1/documents/:id/audit`

## Siguiente paso recomendado

Conectar una base de datos real, autenticación SSO/JWT y control de permisos por roles.

## Usuario administrador inicial

Tras ejecutar `npm run prisma:seed`, se crea/actualiza un usuario admin.

- Email por defecto: `admin@qms.local`
- Password por defecto: `Admin123!`

Se recomienda cambiar estos valores en `.env` antes de desplegar.
