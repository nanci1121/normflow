# Tareas pendientes

> Backlog operativo para ejecucion por agentes IA. Prioridad por impacto. Docker queda fuera por ahora.

## Estado actual

### 1) Mejoras de busqueda y navegacion

- [x] Filtros avanzados en documentos: estado, categoria, visibilidad y propietario.
- [x] Paginacion y ordenacion en listados grandes.
- [x] Mejorar estados vacios, carga y error en listas y detalle.

### 2) Dashboard y seguimiento

- [x] Tarjetas KPI en dashboard: draft, in_review, approved y obsolete.
- [x] Bloque de actividad reciente y aprobaciones pendientes.
- [x] Accesos rapidos desde dashboard a tareas pendientes.

### 3) Experiencia de aprobacion

- [x] Circuito de aprobacion mas visible en el detalle del documento.
- [x] Confirmacion antes de aprobar, rechazar o marcar obsoleto.
- [x] Historial visual de cambios de estado y comentarios.

### 4) Calidad de producto

- [x] Mejorar cobertura de tests UI en rutas criticas.
- [x] Revisar accesibilidad basica en formularios y tablas.
- [x] Añadir feedback persistente al guardar cambios.

## 7) Tests funcionales (E2E) pendientes

## Reglas de ejecucion (obligatorias)

1. No editar codigo generado en backend/src/generated.
2. Mantener TypeScript strict sin any.
3. No cambiar contratos de API existentes salvo que el test lo requiera explicitamente.
4. Cada tarea incluye test nuevo o ajuste de test existente.
5. Al finalizar cada tarea: ejecutar tests objetivo y dejar evidencia en el PR.

## Tarea 7.1 - Separar tests funcionales por dominio

### Objetivo

Reducir acoplamiento del helper global y mejorar mantenibilidad de escenarios funcionales.

### Acciones

1. Crear helpers por dominio en backend/tests/functional/helpers:
	- documents.ts
	- auth.ts
	- workflows.ts
	- audit.ts
2. Dejar backend/tests/functional/helpers.ts solo como fachada ligera o eliminarlo si deja de ser necesario.
3. Actualizar imports en:
	- backend/tests/functional/lifecycle-scenarios.test.ts
	- backend/tests/functional/approval-workflow-scenarios.test.ts
	- backend/tests/functional/acl-scenarios.test.ts
	- backend/tests/functional/audit-scenarios.test.ts
	- backend/tests/functional/password-reset-scenarios.test.ts

### Criterios de aceptacion

- [x] No hay imports rotos en tests funcionales.
- [x] Se elimina duplicacion de utilidades comunes.
- [x] Todos los tests funcionales siguen pasando.

## Tarea 7.2 - Concurrencia de aprobaciones simultaneas

### Objetivo

Validar consistencia cuando dos aprobadores intentan aprobar el mismo documento al mismo tiempo.

### Acciones

1. Crear test en backend/tests/functional/lifecycle-scenarios.test.ts o archivo nuevo concurrency-scenarios.test.ts.
2. Preparar documento en estado in_review con circuito y aprobadores.
3. Lanzar dos aprobaciones concurrentes con Promise.allSettled.
4. Verificar resultado esperado de negocio:
	- Solo transiciones validas segun estado real tras bloqueo transaccional.
	- Sin duplicados en DocumentApproval para mismo approverId/documentId.
	- AuditEvent coherente (sin transiciones imposibles).

### Criterios de aceptacion

- [x] Test falla sin proteccion de concurrencia y pasa con implementacion correcta.
- [x] No hay estado final invalido del documento.
- [x] Se mantiene integridad de auditoria.

## Tarea 7.3 - Expiracion JWT en flujo largo

### Objetivo

Comprobar comportamiento cuando el token expira entre pasos del flujo (ejemplo: submit y approve).

### Acciones

1. Añadir escenario funcional en backend/tests/functional/password-reset-scenarios.test.ts o auth-flow-scenarios.test.ts.
2. Generar token de corta duracion para usuario valido.
3. Ejecutar primer paso con token valido.
4. Simular expiracion y ejecutar segundo paso.
5. Validar respuesta 401 con mensaje legible y sin cambios de estado no autorizados.

### Criterios de aceptacion

- [x] Endpoint protegido rechaza token expirado con 401.
- [x] No se crea AuditEvent de accion no autorizada.
- [x] Documento conserva estado previo al intento fallido.

## Tarea 7.4 - Rate limiting en login y endpoints criticos

### Objetivo

Evitar abuso por fuerza bruta o flood en rutas sensibles.

### Acciones

1. Identificar endpoints criticos actuales:
	- POST /api/v1/auth/login
	- POST /api/v1/documents/:id/submit
	- POST /api/v1/documents/:id/approve
	- POST /api/v1/documents/:id/reject
2. Crear tests de integracion en backend/tests/integration/auth.test.ts y/o nuevo rate-limit.test.ts.
3. Ejecutar N peticiones seguidas desde mismo actor y validar codigo de bloqueo esperado (normalmente 429).
4. Verificar que tras ventana de enfriamiento vuelve a aceptar peticiones.

### Criterios de aceptacion

- [x] Se limita login tras umbral configurado.
- [x] Se limitan endpoints criticos definidos.
- [x] Mensaje de error es consistente con formato { message: string }.

## Tarea 7.5 - Recuperacion ante caida de BD (graceful degradation)

### Objetivo

Asegurar que la API responde de forma controlada cuando la BD no esta disponible.

### Acciones

1. Crear test de integracion en backend/tests/integration/resilience.test.ts.
2. Simular fallo temporal de prisma/document store (mock de capa db en test de proceso o desconexion controlada).
3. Probar al menos:
	- GET /api/v1/documents
	- POST /api/v1/documents
4. Validar respuesta controlada (5xx) con mensaje legible y sin filtrado de stack interno.

### Criterios de aceptacion

- [x] Sin crash del proceso Fastify.
- [x] Respuesta consistente ante fallo de BD.
- [x] Recuperacion correcta cuando vuelve la conexion.

## Comandos de verificacion

Ejecutar en backend, en este orden:

1. npm run test -- tests/functional
2. npm run test -- tests/integration
3. npm run build

## Definition of Done global

- [x] Todas las tareas 7.x tienen tests verdes en local.
- [x] Sin regresiones en tests existentes.
- [x] Cambios documentados en este archivo (estado [x] actualizado).
- [x] Listo para PR con descripcion de riesgo y evidencia de ejecucion.
