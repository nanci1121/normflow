# Documentacion completa de la aplicacion QMS

Este documento resume todo lo que hace la aplicacion en su estado actual.

## 1. Objetivo del producto

La aplicacion QMS permite controlar documentos internos con trazabilidad completa:

1. Alta y versionado de documentos.
2. Flujo de revision y aprobacion.
3. Firma electronica registrada.
4. Obsolescencia controlada.
5. Auditoria de acciones con exportacion.

## 2. Arquitectura

Arquitectura cliente-servidor en monorepo:

- Frontend web en React consume API REST.
- Backend Fastify implementa reglas de negocio.
- PostgreSQL persiste entidades de negocio y auditoria.
- Prisma mapea el modelo de datos.
- Docker Compose levanta stack local completo.

## 3. Modulos funcionales

### 3.1 Autenticacion y sesion

- Login por email/password.
- JWT para autorizar llamadas protegidas.
- Endpoint para recuperar usuario autenticado.
- Logout logico en cliente.

### 3.2 Gestion de usuarios (admin)

- Crear usuarios con rol.
- Listar usuarios.
- Activar/desactivar usuarios.

Roles actuales:

- `admin`
- `owner`
- `approver`
- `reader`

### 3.3 Gestion documental

- Crear documento con metadatos y contenido inicial.
- Listar documentos.
- Ver detalle de documento.
- Crear nuevas versiones.

Campos clave:

- `code` unico
- `category`
- `status`
- `visibility` (`internal` o `restricted`)

### 3.4 Ciclo de vida del documento

Estados principales:

1. `draft`
2. `in_review`
3. `approved`
4. `obsolete`

Acciones:

- Submit: pasa de `draft` a `in_review`.
- Approve/Reject: resuelve aprobaciones en revision.
- Sign: agrega firma a documentos aprobados.
- Obsolete: marca documento obsoleto con motivo.

### 3.5 Aprobaciones y workflows

Hay dos modos para definir aprobadores al hacer submit:

1. Manual: enviando `approverIds`.
2. Por workflow de categoria: si no se envia lista manual.

Workflows:

- Se configuran por categoria.
- Incluyen pasos ordenados (`stepOrder`).
- Cada paso define aprobador y responsabilidad.

Reglas de aprobacion:

- Un aprobador no se repite dentro del mismo flujo.
- Aprobacion secuencial: no se permite aprobar fuera de orden.
- Seguridad: solo el aprobador asignado decide.
- Excepcion: `admin` puede decidir en nombre de otro aprobador.

### 3.6 Visibilidad y acceso

- Documentos `internal`: visibles segun filtros normales.
- Documentos `restricted`: acceso limitado por contexto de usuario y reglas backend.

### 3.7 Auditoria y exportacion

- Cada accion clave genera un `AuditEvent`.
- Consulta de auditoria por documento.
- Exportacion de auditoria en:
  - CSV
  - PDF

### 3.8 Notificaciones por email

Si SMTP esta configurado:

- Notificacion al enviar a revision.
- Notificacion de asignacion de aprobacion.
- Notificacion de aprobacion/rechazo.

Si SMTP no esta configurado:

- El backend no bloquea operaciones; simplemente no envia correo.

## 4. API REST disponible

Base path: `/api/v1`

### 4.1 Salud y resumen

- `GET /health`
- `GET /overview`

### 4.2 Auth

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`

### 4.3 Usuarios

- `POST /users` (admin)
- `GET /users` (admin)
- `PATCH /users/:id/toggle-active` (admin)

### 4.4 Workflows de aprobacion

- `GET /approval-workflows` (admin)
- `PUT /approval-workflows/:category` (admin)

### 4.5 Documentos

- `GET /documents`
- `POST /documents`
- `GET /documents/:id`
- `POST /documents/:id/versions`
- `POST /documents/:id/submit`
- `POST /documents/:id/approve`
- `POST /documents/:id/sign`
- `POST /documents/:id/obsolete`
- `GET /documents/:id/audit`
- `GET /documents/:id/audit/export?format=csv|pdf`

## 5. Frontend (pantallas)

Rutas actuales:

- `/login`
- `/dashboard`
- `/documents`
- `/documents/new`
- `/documents/:id`
- `/admin/users`
- `/admin/approval-workflows`

Capacidades principales por pantalla:

1. Login: acceso a sesion con JWT.
2. Dashboard: metricas generales.
3. Documents list: tabla de documentos.
4. Create document: alta de documento.
5. Document detail: tabs de info, versiones, aprobaciones, firmas y auditoria.
6. Admin users: mantenimiento de usuarios.
7. Admin workflows: listas de aprobadores por categoria con orden.

## 6. Persistencia y modelo de datos

Entidades principales en Prisma:

- `User`
- `Document`
- `DocumentVersion`
- `DocumentApproval`
- `ApprovalWorkflow`
- `ApprovalWorkflowStep`
- `AuditEvent`

Relaciones clave:

- Un documento tiene muchas versiones y aprobaciones.
- Un workflow tiene muchos pasos.
- Cada paso de workflow apunta a un usuario aprobador.

## 7. Operacion local

### 7.1 Requisitos

- Node.js 20+
- Docker Desktop o Podman

### 7.2 Instalacion

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
copy backend/.env.example backend/.env
```

### 7.3 Base de datos y seed

```bash
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate
npm --prefix backend run prisma:seed
```

### 7.4 Ejecucion local

```bash
npm run up
npm run dev
```

### 7.5 Build

```bash
npm run build
```

## 8. Testing

### Backend

- Integracion de documentos, lifecycle, workflows, auditoria y export.
- Unitarios para modulos internos (ejemplo: email).

```bash
npm --prefix backend test
```

### Frontend

- Testing Library para rutas, formularios y modulos UI.

```bash
npm --prefix frontend test
```

## 9. CI/CD

Pipelines en GitHub Actions:

- [../.github/workflows/test.yml](../.github/workflows/test.yml): tests backend + frontend.
- [../.github/workflows/deploy.yml](../.github/workflows/deploy.yml): build/push imagenes y deploy remoto.

## 10. Docker y despliegue

Stack local con [../docker-compose.yml](../docker-compose.yml):

- `postgres`
- `pgadmin`
- `backend`
- `frontend`

Scripts de ayuda:

- [../scripts/compose-up.ps1](../scripts/compose-up.ps1)
- [../scripts/compose-down.ps1](../scripts/compose-down.ps1)

## 11. Variables de entorno importantes

Backend:

- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_NAME`
- `ADMIN_PASSWORD`
- Variables SMTP opcionales (`EMAIL_*`)

## 12. Estado funcional actual

Implementado y operativo:

1. Login JWT.
2. Gestion de usuarios admin.
3. Documentos, versiones y ciclo de vida.
4. Workflows por categoria.
5. Aprobacion secuencial con seguridad por aprobador.
6. Auditoria y exportacion CSV/PDF.
7. Frontend admin para workflows.

Pendiente segun backlog:

1. Ajustes adicionales de CI/CD por entorno.
2. Documentacion operativa extra por entorno.
3. ACL mas fina para documentos `restricted`.
4. Mejoras adicionales de notificaciones y export avanzado.
