# Tareas pendientes

> Priorizado por impacto. Lo de arriba es lo más urgente.

## 7. Tests funcionales (E2E)

- [x] Tests funcionales backend — `tests/functional/`
  - [x] Escenario: ciclo de vida completo (crear → submit → approve → obsolete)
  - [x] Escenario: flujo con rechazo y recuperación (crear → submit → reject → re-submit → approve)
  - [x] Escenario: approval workflow por categoría con aprobación secuencial
  - [x] Escenario: ACL + visibilidad (doc restricted, conceder acceso, consulta)
  - [x] Escenario: auditoría completa (crear, submit, approve, verificar eventos)
  - [x] Setup/teardown común en helper (`tests/functional/helpers.ts`)

