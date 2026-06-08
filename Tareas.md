# Ideas de mejora (próximos pasos)

> Backlog priorizado por impacto. Sin orden definido.

## Alcance de esta revisión

- Excluido por petición: 1) Conexión BD real en producción.
- Excluido por petición: 2) Firma electrónica avanzada.
- Excluido por petición previa: 5) Confirmación al salir con cambios sin guardar.
- Excluido por petición previa: 6) Error Boundaries en React.

## Estado auditado (resto de puntos)

- [ ] **Validación de schemas en todas las rutas Fastify** — no completado. Solo hay validación en una parte de rutas.
- [ ] **Debounce en búsqueda de documentos** — no encontrado en búsqueda de documentos.
- [x] **Modo oscuro** — implementado (ThemeContext, clases dark y tests de contexto).
- [ ] **Internacionalización (i18n)** — no encontrado.
- [ ] **Rate limiting con Redis** — no completado. Hay rate limit en memoria sin Redis.
- [ ] **API documentation (Swagger/OpenAPI)** — no encontrado en backend.
- [ ] **Tests E2E con Playwright** — no configurado a nivel de proyecto/app.
- [x] **CI/CD pipeline** — implementado (workflows de test y deploy en GitHub Actions).
- [ ] **Auditoría de accesibilidad (axe-core)** — no encontrado.
- [ ] **Backup automático de BD** — no encontrado en scripts del proyecto.
