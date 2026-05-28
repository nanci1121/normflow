# Tareas pendientes

> Priorizado por impacto. Lo de arriba es lo más urgente.

## 1. UI de flujos de aprobación por categoría

- [x] Página admin para configurar flujos por categoría/departamento
- [x] Selección de usuarios aprobadores por paso (responsabilidad + orden)
- [x] Consumir endpoints backend: `GET/PUT /api/v1/approval-workflows`
- [x] Tests frontend de la pantalla de configuración

## 2. Seguridad de decisión de aprobación

- [x] Restringir `POST /api/v1/documents/:id/approve` para que solo decida el aprobador asignado
- [x] Permitir excepción explícita para `admin` (si se mantiene este comportamiento)
- [x] Añadir tests de autorización para evitar decisiones en nombre de otro usuario

## 3. Flujo de aprobación en listado de documentos

- [ ] Backend — incluir resumen de progreso de aprobaciones en `listDocuments` (ej: `approvedSteps/totalSteps`)
- [ ] Tipos backend/frontend — añadir campo `approvalProgress` en `DocumentSummary`
- [ ] Frontend — agregar columna `Flujo` en el listado (`DocumentsListPage`) con indicador visual (texto/barra)
- [ ] Frontend — manejar estados sin flujo configurado o sin pasos (`Sin flujo`, `0/0`, etc.)
- [ ] Tests backend — cubrir cálculo correcto de progreso por estado (`draft`, `in_review`, `approved`, `obsolete`)
- [ ] Tests frontend — validar render de columna `Flujo` y casos de borde

## 4. CI/CD

- [ ] `.github/workflows/test.yml` — ejecutar tests backend y frontend en PR
- [ ] `.github/workflows/deploy.yml` — pipeline de build/deploy por entorno

## 5. Configuración y operación

- [ ] Documentar en README cómo gestionar migraciones en BD de test y desarrollo
- [ ] Definir estrategia final de persistencia local (named volume vs bind mount) por entorno

## 6. Mejoras QMS siguientes

- [ ] ACL detallada por usuario para documentos `restricted`
- [ ] Notificaciones email por eventos clave (si se amplían plantillas y destinatarios)
- [ ] Exportación avanzada de auditoría (filtros por fecha/actor/acción)
