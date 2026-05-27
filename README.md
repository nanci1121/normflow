# QMS Platform Monorepo

Este repositorio esta dividido en dos carpetas principales:

- `backend/`: API REST de QMS (Node.js + TypeScript + Fastify + Prisma + PostgreSQL)
- `frontend/`: aplicacion web (React + TypeScript + Vite + Tailwind)

## Arquitectura y sistema de programacion

- Arquitectura: cliente-servidor (frontend consume API REST del backend)
- Estilo de proyecto: monorepo simple por carpetas
- Lenguaje principal: TypeScript en backend y frontend

## Comandos utiles

Desde la raiz:

```bash
npm install
npm run up
npm run dev
npm run stop:dev
npm run down
```

Otros comandos:

```bash
npm run build
npm run migrate
npm run seed
```

Backend:

```bash
cd backend
npm install
npm run prisma:generate
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```
