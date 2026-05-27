# AGENTS.md — QMS Platform Server

> Este archivo es leído automáticamente por agentes de IA (Claude Code, OpenAI Codex, etc.)
> para comprender las reglas del proyecto antes de hacer cualquier cambio.

## ¿Qué es este proyecto?

**Servidor backend de una plataforma QMS (Quality Management System)** para:
- Gestión documental con trazabilidad completa (versiones, aprobaciones, firmas electrónicas)
- Cumplimiento normativo ISO 9001, ISO 14001 e ISO 45001 (PRL)
- Auditoría inmutable de todas las acciones

**Stack**: Node.js 20+ · TypeScript strict · Fastify · Prisma ORM · PostgreSQL · Docker

**Estructura raíz**:
- `backend/` → API Fastify + Prisma
- `frontend/` → App React + Vite

---

## Archivos clave — dónde vive cada cosa

| Archivo | Propósito |
|---------|-----------|
| `backend/src/app.ts` | Rutas Fastify (delgadas, solo I/O) |
| `backend/src/store.ts` | Toda la lógica de negocio (`DocumentStore`) |
| `backend/src/types.ts` | Tipos e interfaces de dominio |
| `backend/prisma/schema.prisma` | Fuente de verdad del modelo de datos |
| `backend/src/generated/` | **NO EDITAR** — generado por `prisma generate` |

---

## Ciclo de vida de un documento — OBLIGATORIO respetar

```
draft ──submit──► in_review ──approve──► approved ──obsolete──► obsolete
                      │
                   reject
                      │
                    draft
```

| Transición | Desde | Condición extra |
|-----------|-------|----------------|
| `submit` | `draft` | — |
| `approve` | `in_review` | — |
| `reject` | `in_review` | Vuelve a `draft` |
| `obsolete` | `approved` | `obsoleteReason` obligatorio |

**Nunca** permitir saltos de estado que no estén en esta tabla.

---

## Reglas de dominio irrompibles

### AuditEvent
- Tabla **append-only**. Nunca `UPDATE` ni `DELETE` sobre `AuditEvent`.
- Cada acción sobre un documento **debe** crear un `AuditEvent`.
- El campo `details` debe incluir `{ from: <estado anterior>, to: <estado nuevo> }` en cambios de estado.

### Documentos
- `code` es inmutable tras la creación.
- `signatures` es append-only. Nunca eliminar una firma existente.
- No existe borrado físico en un QMS — solo `obsolete`.

### Versiones
- `number` es secuencial, nunca se reutiliza.
- El contenido de una versión es inmutable.

### Aprobaciones
- Un `approverId` solo puede tener **una** entrada de aprobación por documento.

---

## Convenciones de API

- Todas las rutas bajo el prefijo `/api/v1/`
- Errores: `{ "message": "descripción legible" }`
- `201` para creaciones, `200` para lecturas y transiciones, `404` si no existe
- IDs: UUIDs v4 generados por la BD
- Timestamps: ISO 8601 UTC

---

## Seguridad

- No exponer contraseñas, tokens ni datos sensibles en respuestas
- Autenticación futura: JWT firmado con RS256 o ES256
- Respetar `visibility` (`internal` / `restricted`) en listados y detalles
- Las `signatures` tienen valor legal: tratarlas como datos críticos

---

## Convenciones de código

```typescript
// ✅ CORRECTO
async function ejemplo() {
  try {
    return await store.hacerAlgo(id);
  } catch (error) {
    return reply.code(404).send({ message: (error as Error).message });
  }
}

// ❌ INCORRECTO — no usar .then() encadenados
store.hacerAlgo(id).then(result => ...).catch(err => ...)
```

- TypeScript strict — no `any` sin justificación explícita
- Nuevos tipos → `src/types.ts`
- Validaciones Fastify → inline en la ruta o en `schemas.ts`, nunca en `store.ts`
- Timestamps de auditoría → `@default(now())` en Prisma, nunca `new Date()` en código

---

## Al añadir modelos a Prisma

```bash
# 1. Editar backend/prisma/schema.prisma
# 2. Crear migración
cd backend && npx prisma migrate dev --name <nombre_descriptivo>
# 3. Regenerar cliente
cd backend && npx prisma generate
# 4. Hacer commit de schema + migración juntos
```

---

## Prohibido terminantemente

| Acción | Motivo |
|--------|--------|
| Eliminar/truncar `AuditEvent` | Viola la auditoría inmutable |
| Saltar pasos del ciclo de vida | Viola el control documental ISO |
| Endpoint de borrado físico de documentos | No existe en un QMS |
| Editar `src/generated/` | Se sobreescribe con `prisma generate` |
| Guardar contraseñas en texto plano | Vulnerabilidad de seguridad crítica |
| Timestamps manuales en auditoría | Riesgo de inconsistencia |

---

## Seguridad al publicar en GitHub

- **Nunca** hacer commit de `.env` ni archivos con credenciales reales. Solo `.env.example` con claves vacías.
- Verificar que `.gitignore` incluye `.env`, `.env.*` (excepto `.env.example`).
- No hardcodear URLs de BD, tokens ni contraseñas en código fuente; usar `process.env.X`.
- Los secretos de CI/CD van en **Settings → Secrets and variables → Actions**, nunca en el código.
- Ejecutar `npm audit` antes de cada release y corregir vulnerabilidades `high`/`critical`.
- No exponer logs de Prisma con `LOG_LEVEL=query` en entornos públicos (filtran queries con datos).

### Checklist pre-push
- [ ] `.env` no está en el diff
- [ ] No hay credenciales ni tokens reales en el código
- [ ] `npm audit` sin vulnerabilidades críticas
- [ ] `.env.example` actualizado con las nuevas variables

---

## Tests

### Estructura de directorios
```
tests/
  unit/
    store.test.ts       — lógica de DocumentStore en aislamiento
  integration/
    documents.test.ts   — endpoints de documentos contra BD de test
    lifecycle.test.ts   — transiciones de estado completas
    audit.test.ts       — append-only y contenido del AuditEvent
```

### Reglas
1. Usar una BD PostgreSQL de test separada; nunca la de desarrollo o producción.
2. Limpiar tablas **antes** de cada test (no después — los datos deben ser visibles si el test falla).
3. No usar mocks de `DocumentStore` en tests de integración; probar contra la implementación real.
4. Tipar los cuerpos de respuesta con los tipos de `src/types.ts`; no usar `any`.
5. Cada transición inválida debe tener su test que verifique HTTP 422.
6. Verificar que `AuditEvent` se crea con `action`, `entityId`, `details.from` y `details.to` correctos.

### Casos obligatorios

| Caso | Qué verificar |
|------|---------------|
| Crear documento | 201, versión inicial, `AuditEvent` generado |
| `submit` | Estado → `in_review`, aprobadores `pending` |
| `approve` | Estado → `approved`, `AuditEvent` con `from/to` |
| `reject` | Estado → `draft`, `rejectionReason` presente |
| `obsolete` sin motivo | HTTP 422 |
| Transición inválida | HTTP 422 con mensaje descriptivo |
| Aprobador duplicado | HTTP 409 |
| Documento `restricted` | HTTP 404 en listado y detalle |

---

## Roadmap (para no duplicar trabajo)

- [ ] Autenticación JWT + roles (admin, owner, approver, reader)
- [ ] Conexión BD real en producción
- [ ] Notificaciones email al entrar en revisión / aprobar
- [ ] Exportación de auditoría en PDF/CSV para auditorías ISO
- [ ] ACL por usuario para documentos `restricted`
