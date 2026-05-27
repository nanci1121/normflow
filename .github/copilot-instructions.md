# QMS Platform Server — Agent Instructions

## Propósito del proyecto

Este repositorio es el **servidor backend de una plataforma QMS (Quality Management System)** orientada a:
- **Gestión documental con trazabilidad completa** (versiones, aprobaciones, firmas electrónicas)
- **Cumplimiento normativo** de ISO 9001, ISO 14001/14000 y PRL / ISO 45001
- **Auditoría inmutable** de todas las acciones sobre documentos

El dominio es regulado. Cada decisión de diseño debe preservar la **integridad**, la **trazabilidad** y la **no repudiación** de los registros.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 20+ |
| Lenguaje | TypeScript (strict) |
| Framework HTTP | Fastify |
| ORM / Base de datos | Prisma + PostgreSQL |
| Contenedores | Docker / docker-compose |

**Nunca** sustituir Fastify por Express, ni Prisma por un ORM diferente, salvo petición explícita.

---

## Estructura del proyecto

```
backend/src/
  app.ts          — registro de rutas y plugins de Fastify
  server.ts       — arranque del proceso
  store.ts        — capa de acceso a datos (DocumentStore)
  types.ts        — tipos e interfaces de dominio
  generated/      — código generado por Prisma (NO editar manualmente)
backend/prisma/
  schema.prisma   — fuente de verdad del modelo de datos
  migrations/     — migraciones SQL inmutables
```

Frontend:

```
frontend/
  src/            — aplicación React (login, dashboard, routing)
```

- Toda la lógica de negocio va en `backend/src/store.ts`.  
- Las rutas en `backend/src/app.ts` son delgadas: sólo parsean request/response y delegan en `backend/src/store.ts`.  
- **Nunca** escribir SQL crudo; usar el cliente Prisma generado.  
- **Nunca** editar los archivos bajo `backend/src/generated/`.

---

## Modelo de datos — reglas de dominio

### Document (documento principal)

| Campo | Restricción |
|-------|------------|
| `code` | Único, inmutable tras la creación |
| `status` | Solo puede seguir el ciclo de vida definido (ver abajo) |
| `currentVersionId` | Debe apuntar siempre a una versión existente |
| `signatures` | Array append-only; nunca eliminar una firma existente |

### Ciclo de vida de un documento

```
draft ──submit──► in_review ──approve──► approved ──obsolete──► obsolete
                     │
                  reject
                     │
                  draft
```

- Un documento en estado `approved` u `obsolete` **no puede** retroceder a `draft` directamente.
- Marcar como `obsolete` requiere `obsoleteReason` obligatorio.
- La transición `reject` requiere un campo `rejectionReason` obligatorio, almacenado en el registro `DocumentApproval` e incluido en el `AuditEvent` correspondiente.
- Solo se puede hacer `submit` desde `draft`.
- Solo se puede `approve` o `reject` desde `in_review`.
- Todas las transiciones de estado deben ejecutarse dentro de una **transacción interactiva de Prisma** que relea y bloquee la fila del documento antes de escribir, para evitar corrupción por peticiones concurrentes.

### DocumentVersion

- `number` es secuencial y autoincremental; nunca reutilizar un número.
- El contenido de una versión es **inmutable** una vez creada.

### DocumentApproval

- Un aprobador (`approverId`) solo puede tener **una** entrada por documento. Si se intenta crear una segunda entrada, devolver HTTP 409 con `{ "message": "Approver already has a decision for this document" }`.
- `decidedAt` se fija en el momento de la decisión; nunca retroactivo.

### AuditEvent

- Tabla **append-only**: nunca `UPDATE` ni `DELETE` sobre ningún registro de auditoría.
- Cada acción sobre un documento DEBE generar su `AuditEvent` correspondiente.
- El campo `details` debe incluir `{ "from": "<estado anterior>", "to": "<estado nuevo>" }` en cualquier cambio de estado.
- Solo lectura desde la API; no exponer ningún endpoint de escritura o borrado sobre esta tabla.
- Los timestamps se generan mediante `@default(now())` en Prisma; nunca usar `new Date()` en código.

---

## Convenciones de API

- Prefijo: `/api/v1/`
- Respuestas de error: `{ "message": "<descripción legible>" }`
- Código 201 para creaciones, 200 para lecturas y transiciones de estado, 404 cuando la entidad no existe.
- Los IDs son UUIDs v4 generados por la base de datos.
- Los timestamps se devuelven en formato ISO 8601 UTC.
- **No exponer** IDs internos de aprobaciones ni versiones en rutas URL; usar siempre el ID del documento como recurso padre.

### Códigos de error para violaciones de negocio

| Situación | Código HTTP | Cuerpo |
|-----------|-------------|--------|
| Transición de estado inválida (e.g., `approved` → `draft`) | 422 | `{ "message": "Invalid status transition from <actual> to <solicitado>" }` |
| Aprobador duplicado en el mismo documento | 409 | `{ "message": "Approver already has a decision for this document" }` |
| Entidad no encontrada | 404 | `{ "message": "<entidad> no encontrado" }` |

---

## Seguridad y cumplimiento normativo

- **No introducir** campos o endpoints que permitan eliminar documentos físicamente de la base de datos. El borrado no existe en un QMS; solo existe `obsolete`.
- Ver reglas de `AuditEvent` en la sección **Modelo de datos**.
- Cuando se implemente autenticación, usar **JWT firmado** (RS256 o ES256). Nunca guardar contraseñas en texto plano.
- El campo `visibility` (`internal` / `restricted`): hasta que se implemente autenticación basada en roles, tratar los documentos `restricted` como inaccesibles en todos los endpoints de listado y detalle — devolver 404 como si el documento no existiera.
- Las firmas (`signatures`) representan firmas electrónicas con implicaciones legales: tratarlas como datos críticos de integridad.

---

## Normas ISO relevantes (contexto para decisiones de diseño)

| Norma | Área cubierta | Impacto en el código |
|-------|--------------|---------------------|
| ISO 9001:2015 | Gestión de calidad | Control de documentos (cláusula 7.5): versiones, aprobaciones, distribución |
| ISO 14001:2015 | Gestión ambiental | Documentación de procesos ambientales; mismas reglas de control documental |
| ISO 45001:2018 (PRL) | Seguridad y salud laboral | Registros de incidentes y procedimientos; auditoría obligatoria |

Cuando se añadan nuevas funcionalidades, verificar que no rompen los requisitos de **control de registros** de estas normas.

---

## Reglas de código

1. **TypeScript strict** activado. No usar `any` salvo en integraciones externas inevitables; en ese caso, aislar con un cast explícito y un comentario.
2. Todos los nuevos tipos de dominio van en `types.ts`.
3. Los esquemas de validación Fastify se definen **siempre** en `src/schemas.ts`; nunca inline en los handlers de ruta ni en `store.ts`.
4. Usar `async/await`; evitar callbacks y `.then()` encadenados.
5. Los errores de negocio se lanzan con `throw new Error(mensaje)` desde `store.ts` y se capturan en la ruta con `try/catch`.
6. Al añadir un modelo nuevo a Prisma, generar siempre la migración con `npx prisma migrate dev --name <nombre>` y hacer commit junto al cambio del schema.
7. No añadir librerías sin evaluar su impacto en el bundle y la licencia (preferir licencias MIT/Apache 2.0).

---

## Comandos habituales

```bash
# Desarrollo
npm run dev

# Build de producción
npm run build && npm start

# Migraciones Prisma
npx prisma migrate dev --name <nombre_migracion>
npx prisma generate

# Docker
docker-compose up -d
```

---

## Lo que NO se debe hacer

- ❌ Eliminar o truncar la tabla `AuditEvent` (ver reglas completas en **Modelo de datos → AuditEvent**)
- ❌ Permitir que `status` salte pasos del ciclo de vida
- ❌ Devolver contraseñas, tokens o datos sensibles en respuestas API
- ❌ Usar `Date.now()` o `new Date()` para timestamps de auditoría (ver **Modelo de datos → AuditEvent**)
- ❌ Modificar archivos bajo `src/generated/` (se sobreescriben con `prisma generate`)
- ❌ Hardcodear IDs de usuarios o aprobadores en tests de producción
- ❌ Añadir endpoints REST que rompan el prefijo `/api/v1/`

---

## Seguridad al publicar en GitHub

### Secretos y configuración
- **Nunca** hacer commit de ficheros `.env`, `.env.local` ni ningún archivo con credenciales reales.
- El fichero `.env.example` debe existir con todas las variables necesarias pero **sin valores reales**:
  ```
  DATABASE_URL=postgresql://user:password@localhost:5432/qms
  JWT_SECRET=
  ```
- Verificar que `.gitignore` incluye: `.env`, `.env.*`, `!.env.example`.
- No hardcodear URLs de base de datos, claves de API ni contraseñas en ningún fichero de código fuente.
- Usar variables de entorno (`process.env.X`) para toda configuración sensible; lanzar error al arrancar si faltan las obligatorias.

### GitHub Actions / CI
- Los secretos del repositorio (`DATABASE_URL`, `JWT_SECRET`, etc.) se configuran en **Settings → Secrets and variables → Actions**, nunca en el código.
- Las migraciones de base de datos no deben ejecutarse automáticamente en el pipeline de CI sin una aprobación explícita en entorno de producción.
- No exponer logs de Prisma (`LOG_LEVEL=query`) en entornos públicos; pueden filtrar queries con datos sensibles.

### Dependencias
- Ejecutar `npm audit` antes de cada release y corregir vulnerabilidades `high` o `critical`.
- No usar versiones con `*` o `latest` en `package.json`; fijar versiones exactas o rangos controlados (`^`).
- No añadir dependencias de desarrollo (`devDependencies`) al bundle de producción.

### Checklist pre-push
- [ ] `.env` no está en el diff
- [ ] No hay credenciales, tokens ni UUIDs reales en el código
- [ ] `npm audit` sin vulnerabilidades críticas
- [ ] El fichero `.env.example` está actualizado

---

## Tests

### Filosofía
- Los tests validan el comportamiento observable de la API, no los detalles internos de implementación.
- Prioridad: **ciclo de vida del documento > reglas de auditoría > casos de error > happy paths**.

### Estructura
```
tests/
  unit/
    store.test.ts       — lógica de negocio de DocumentStore en aislamiento
  integration/
    documents.test.ts   — endpoints de documentos contra BD de test
    lifecycle.test.ts   — transiciones de estado completas
    audit.test.ts       — append-only y contenido del AuditEvent
```

### Reglas de test
1. Usar una base de datos PostgreSQL de test separada; nunca la de desarrollo o producción.
2. Hacer `prisma migrate deploy` al inicio del suite de test para tener el schema actualizado.
3. Limpiar (truncar) las tablas antes de cada test, no después — así los datos quedan visibles si el test falla.
4. No usar `any` en los tests; tipar los cuerpos de respuesta con los tipos de `src/types.ts`.
5. Cada transición de estado inválida debe tener su propio test que verifique el código HTTP 422.
6. Verificar que `AuditEvent` se crea correctamente (acción, `entityId`, `details.from`, `details.to`) para cada operación que lo requiera.
7. No hacer mocks de `DocumentStore` en tests de integración; probar contra la implementación real.

### Casos obligatorios a cubrir

| Caso | Qué verificar |
|------|---------------|
| Crear documento | 201, `code` único, versión inicial creada, `AuditEvent` generado |
| `submit` desde `draft` | Estado pasa a `in_review`, aprobadores creados como `pending` |
| `approve` desde `in_review` | Estado pasa a `approved`, `AuditEvent` con `from/to` |
| `reject` desde `in_review` | Estado vuelve a `draft`, `rejectionReason` presente |
| `obsolete` desde `approved` | Requiere `obsoleteReason`; sin él → 422 |
| Transición inválida | HTTP 422 con mensaje descriptivo |
| Aprobador duplicado | HTTP 409 |
| Documento `restricted` | HTTP 404 en listado y detalle |
| `AuditEvent` append-only | No existe endpoint DELETE ni UPDATE sobre auditoría |
| `signatures` append-only | Añadir firma no borra las anteriores |

---

## Próximos pasos planificados (contexto para no duplicar trabajo)

1. Autenticación JWT con control de permisos por roles (admin, owner, approver, reader)
2. Integración con base de datos real en producción (ya modelada en Prisma)
3. Notificaciones por email cuando un documento entra en revisión o es aprobado
4. Endpoint de exportación de auditoría (PDF / CSV) para auditorías ISO
5. Soporte para `restricted` documents con ACL por usuario
