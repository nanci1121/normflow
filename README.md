# QMS Platform Monorepo

Monorepo de una plataforma QMS (Quality Management System) con backend API y frontend web.

- Backend: Node.js + TypeScript + Fastify + Prisma + PostgreSQL
- Frontend: React + TypeScript + Vite + Tailwind

## Documentacion principal

- Documentacion completa de producto y arquitectura: [docs/APLICACION.md](docs/APLICACION.md)
- Documentacion tecnica del backend: [backend/README.md](backend/README.md)
- Documentacion tecnica del frontend: [frontend/README.md](frontend/README.md)

## Estructura del repositorio

- [backend](backend): API REST, reglas de negocio, persistencia y tests (unitarios, integracion, funcionales)
- [frontend](frontend): aplicacion web, rutas de usuario/admin y tests UI
- [docker-compose.yml](docker-compose.yml): stack local con postgres, pgAdmin, backend y frontend
- [scripts](scripts): scripts PowerShell para levantar/bajar stack
- [.github/workflows](.github/workflows): pipelines de tests y deploy

## Arranque rapido

1. Instalar dependencias:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

2. Configurar entorno backend:

```bash
copy backend/.env.example backend/.env
copy .env.example .env
```

3. Generar cliente Prisma, migrar y seed:

```bash
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate
npm --prefix backend run prisma:seed
```

4. Levantar infraestructura y modo desarrollo:

```bash
npm run up
npm run dev
```

## Scripts raiz

- `npm run up`: levanta stack con Podman Compose o Docker Compose
- `npm run down`: baja stack de contenedores
- `npm run dev`: levanta backend + frontend en local con recarga
- `npm run stop:dev`: libera puertos de desarrollo
- `npm run build`: build backend y frontend
- `npm run migrate`: ejecuta migraciones Prisma en backend
- `npm run seed`: ejecuta seed de backend

## Puertos por defecto

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`
- PostgreSQL: `localhost:5432`
- pgAdmin: `http://localhost:5050`

## Migraciones de base de datos

El proyecto usa **Prisma Migrate** para gestionar el esquema. Hay tres bases de datos involucradas:

| Base | Propósito | Estrategia |
|------|-----------|-----------|
| **Desarrollo** (`backend/.env` → `DATABASE_URL`) | Cambios en desarrollo local | `prisma migrate dev` |
| **Tests** (`backend/.env.test` → `DATABASE_URL`) | Tests de integración | `prisma migrate deploy` (se ejecuta antes de cada `vitest run`) |
| **Producción** (servidor real) | Datos reales | `prisma migrate deploy` (vía CI/CD o manual) |

### Flujo de trabajo diario

```bash
# 1. Editar prisma/schema.prisma
# 2. Crear migración y aplicarla a la BD de desarrollo
npm --prefix backend run prisma:migrate

# 3. Regenerar cliente TypeScript
npm --prefix backend run prisma:generate

# 4. Sembrar datos de prueba
npm --prefix backend run prisma:seed

# 5. Ejecutar tests (usan BD de test separada via .env.test)
npm --prefix backend test
```

> **Regla**: cada cambio en `schema.prisma` debe ir acompañado de su migración. Nunca editar `schema.prisma` sin crear la migración correspondiente.

### Tests y base de datos de test

La BD de test se configura en `backend/.env.test`. Los tests:

1. Crean tablas con `prisma migrate deploy` al iniciar la suite.
2. Limpian datos (`DELETE FROM` todas las tablas) **antes** de cada test.
3. Nunca usan la BD de desarrollo. Cada entorno tiene su propio `DATABASE_URL`.

Para ejecutar tests localmente:

```bash
# Asegurar que la BD de test existe y está migrada
npx prisma migrate deploy
# Ejecutar tests
npm test
```

### CI/CD

Los pipelines de GitHub Actions gestionan migraciones automáticamente:

- **CI** (`test.yml`): levanta PostgreSQL como servicio, ejecuta `prisma migrate deploy` y corre los tests.
- **CD** (`deploy.yml`): tras desplegar las imágenes nuevas, ejecuta `prisma migrate deploy` sobre la BD de producción via SSH.

## Persistencia de datos

### Entorno local (Docker Compose)

```yaml
volumes:
  pgdata:          # <-- named volume (recomendado para local)
  pgadmin-data:    # <-- named volume
```

Se usan **named volumes** (`pgdata`, `pgadmin-data`) porque:

| Aspecto | Named volume | Bind mount (`./data/pg`) |
|---------|-------------|--------------------------|
| Rendimiento | Nativo Docker, óptimo | Depende del SO anfitrión |
| Portabilidad | Funciona en cualquier SO | Rutas absolutas rompen en otro equipo |
| Limpieza | `docker compose down -v` | Hay que borrar carpeta a mano |
| Backup | `docker run —rm -v pgdata:/data ...` | Copia directa del directorio |

> Los bind mounts solo se recomiendan si necesitas inspeccionar los archivos de la BD directamente desde el anfitrión (debugging avanzado).

### Producción

En producción se mantiene la misma estrategia de **named volumes**. Para backups programados:

```bash
# Backup
docker run --rm -v pgdata:/data -v /backups:/backup alpine \
  tar czf /backup/pgdata-$(date +%Y%m%d).tar.gz -C /data .

# Restore
docker run --rm -v pgdata:/data -v /backups:/backup alpine \
  tar xzf /backup/pgdata-20261201.tar.gz -C /data
```

## Calidad y CI

- Tests backend y frontend en CI: [.github/workflows/test.yml](.github/workflows/test.yml)
- Build/push de imagenes y deploy: [.github/workflows/deploy.yml](.github/workflows/deploy.yml)

## Despliegue en Debian 12

Para un servidor Debian 12, la ruta mas estable es usar Docker Engine o Podman con el stack de contenedores:

1. Copiar [.env.example](.env.example) a `.env` y ajustar secretos e imagenes.
2. Publicar backend y frontend con tags inmutables, idealmente el `github.sha` del despliegue.
3. Ejecutar `docker compose pull` y `docker compose up -d --remove-orphans` en el servidor.
4. Aplicar migraciones con `docker compose exec -T backend npx prisma migrate deploy`.

Si el servidor no tiene Docker Desktop, Podman funciona bien en Debian 12 como alternativa compatible para el mismo `docker compose.yml`.
