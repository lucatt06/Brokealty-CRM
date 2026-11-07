# Brokealty CRM

CRM multi-tenant para el sector inmobiliario. Next.js 14 + Prisma + PostgreSQL, desplegado en Railway.

## Desarrollo local

```bash
cp .env.example .env.local   # completar DATABASE_URL y AUTH_SECRET como mínimo
npm install
npx prisma migrate deploy
npm run dev
```

## Despliegue en Railway

Servicios: **web** (este repo), **Postgres** y **Bucket**. `railway.json` define build y arranque
(`prisma migrate deploy` corre antes de iniciar). Variables: ver `.env.example`.
Los jobs programados corren dentro del servicio web (`src/instrumentation.ts`, una sola réplica).

Ver `CLAUDE.md` para arquitectura y convenciones.
