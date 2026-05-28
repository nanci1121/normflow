# QMS Platform Monorepo

Monorepo de una plataforma QMS (Quality Management System) con backend API y frontend web.

- Backend: Node.js + TypeScript + Fastify + Prisma + PostgreSQL
- Frontend: React + TypeScript + Vite + Tailwind

## Documentacion principal

- Documentacion completa de producto y arquitectura: [docs/APLICACION.md](docs/APLICACION.md)
- Documentacion tecnica del backend: [backend/README.md](backend/README.md)
- Documentacion tecnica del frontend: [frontend/README.md](frontend/README.md)

## Estructura del repositorio

- [backend](backend): API REST, reglas de negocio, persistencia y tests de integracion
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

## Calidad y CI

- Tests backend y frontend en CI: [.github/workflows/test.yml](.github/workflows/test.yml)
- Build/push de imagenes y deploy: [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
