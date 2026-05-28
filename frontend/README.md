# QMS Platform Frontend

Aplicacion web de la plataforma QMS.

## Stack

- React 18 + TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- Vitest + Testing Library

## Que hace el frontend

1. Gestiona login y sesion JWT.
2. Muestra dashboard con resumen operativo.
3. Permite crear, listar y consultar documentos.
4. Permite ejecutar acciones de ciclo de vida del documento.
5. Muestra historial de auditoria y aprobaciones.
6. Incluye modulos admin para usuarios y flujos de aprobacion.

## Estructura relevante

- [src/main.tsx](src/main.tsx): bootstrap de la app
- [src/router/index.tsx](src/router/index.tsx): rutas protegidas y publicas
- [src/layouts/AppLayout.tsx](src/layouts/AppLayout.tsx): shell principal y menu lateral
- [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx): estado de autenticacion
- [src/lib/api.ts](src/lib/api.ts): cliente axios con JWT
- [src/api](src/api): clientes de API por dominio
- [src/pages](src/pages): pantallas por modulo

## Rutas de la aplicacion

- `/login`: autenticacion
- `/dashboard`: resumen de estado
- `/documents`: listado de documentos
- `/documents/new`: alta de documento
- `/documents/:id`: detalle y acciones
- `/admin/users`: gestion de usuarios (admin)
- `/admin/approval-workflows`: gestion de listas de aprobadores por categoria (admin)

## Modulos funcionales

### Auth

- Login contra backend (`/api/v1/auth/login`).
- Rehidratacion de sesion con `/api/v1/auth/me`.
- Redireccion a login en respuestas 401.

### Documentos

- Listado con filtro basico de busqueda.
- Creacion de documentos.
- Detalle con tabs de informacion, versiones, aprobaciones, firmas y auditoria.
- Acciones de submit, approve/reject, sign, obsolete segun estado.

### Admin usuarios

- Alta de usuario.
- Tabla de usuarios.
- Activacion/desactivacion.

### Admin flujos de aprobacion

- Carga de workflows por categoria (`GET /approval-workflows`).
- Edicion por pasos con orden secuencial y responsabilidad.
- Guardado (`PUT /approval-workflows/:category`).

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
npm test
```

## Variables y proxy

- El frontend usa rutas relativas `/api/v1`.
- En local, Vite y/o el despliegue con Docker deben enrutar esas llamadas al backend.

## Tests

Suites en [src/__tests__](src/__tests__).

Ejemplos:

- [src/__tests__/DocumentsListPage.test.tsx](src/__tests__/DocumentsListPage.test.tsx)
- [src/__tests__/DocumentDetailPage.test.tsx](src/__tests__/DocumentDetailPage.test.tsx)
- [src/__tests__/ApprovalWorkflowsPage.test.tsx](src/__tests__/ApprovalWorkflowsPage.test.tsx)
