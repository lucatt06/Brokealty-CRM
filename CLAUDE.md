# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Proyecto: Brokealty CRM

SaaS multi-tenant de CRM vertical para el sector **inmobiliario** (República Dominicana / LATAM). Derivado de "Autónomo" (CRM de dealers de vehículos). Arquitectura preparada para N inmobiliarias desde el día 1.

> **Estado de la migración desde Autónomo:** infraestructura ya movida a Railway (Postgres + Auth propia + Bucket + SSE) y contabilidad/facturación electrónica eliminadas. **Pendiente:** transformar el dominio `Vehicle` → `Property` (schema, inventario, match inverso, cascada de venta, textos). Hasta entonces el código todavía habla de vehículos en varios módulos y en `docs/`.

---

## Comandos

```bash
npm run dev          # desarrollo local
npm run build        # prisma generate + next build
npm run start        # servidor de producción
npm run lint         # ESLint
npx prisma migrate dev --name <nombre>   # nueva migración (desarrollo)
npx prisma migrate deploy                # aplicar migraciones (Railway lo hace al arrancar)
npx prisma studio                        # GUI de la BD
```

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, Framer Motion |
| BD | PostgreSQL en Railway + Prisma |
| Auth | Propia: bcrypt + JWT (`jose`) en cookie httpOnly (`src/lib/auth/`) |
| Archivos | Railway Bucket (S3) vía `src/lib/storage/blob.ts`, servidos por `/api/files/*` |
| Tiempo real | Triggers Postgres `pg_notify` → SSE `/api/realtime` |
| Jobs | Scheduler interno (`src/instrumentation.ts`) → `/api/jobs/*` con `CRON_SECRET` |
| IA | Anthropic Claude API (nativo) + OpenAI (embeddings / Whisper) |
| Email | Resend |
| WhatsApp | Evolution API (personal) + Meta Cloud API (oficial) |
| Deploy | Railway (app + Postgres + Bucket) |

---

## Estructura de carpetas (target)

```
src/
  app/                        # Next.js App Router
    (auth)/                   # login, register, forgot-password
    (dashboard)/              # layout con sidebar autenticado
      dashboard/
      inventario/
      conversaciones/
      pipeline/
      leads/
      calendarios/
      tareas/
      campanas/
      agentes/
      automatizaciones/
      integraciones/
      configuracion/
    api/                      # API routes y webhooks
      webhooks/               # Meta, Evolution, Twilio, TikTok
      agents/                 # orquestador de agentes IA
      jobs/                   # background jobs (cron)
  components/
    ui/                       # shadcn/ui componentes base
    layout/                   # Sidebar, Header, etc.
    [modulo]/                 # componentes por módulo
  lib/
    prisma.ts                 # singleton del cliente Prisma
    auth/                    # sesión JWT, tokens de contraseña, provisión de workspace
    agent/
      orchestrator.ts         # orquestador nativo de agentes IA
      tool-registry.ts        # registro de todas las tools
      tools/                  # una tool por archivo
    jobs/                     # lógica de background jobs
    utils.ts                  # cn(), formatters, helpers
  types/                      # tipos TypeScript globales
prisma/
  schema.prisma               # schema completo (ver doc 2)
```

---

## Reglas de arquitectura críticas

### Multi-tenancy
- **Todo dato sensible tiene `workspaceId`**. Toda query lo incluye sin excepción.
- **No hay RLS** (ya no se usa Supabase): el aislamiento depende 100% de filtrar por `workspaceId` en cada query. `/api/realtime` también filtra por workspace en el servidor.
- Un usuario del workspace A **nunca** puede ver datos del workspace B.
- El Super Admin (Lucas) es cross-workspace — `workspaceId = null` en User.

### Roles
- `SUPER_ADMIN` — Lucas, acceso a todos los workspaces
- `ADMIN_DEALER` — dueño/gerente del dealer, su workspace completo
- `VENDEDOR` — solo sus leads, sus métricas

### Agente IA (nativo)
- **Sin Retell, sin n8n.** Orquestación 100% en código Next.js.
- Flujo: mensaje entrante → verificar killswitch/pausa → cargar contexto → llamar Claude API con tools → ejecutar tools → responder.
- Cada tool es un archivo en `lib/agent/tools/[nombre].ts` con `name`, `description`, `inputSchema`, `execute()`.
- Tool Registry en `lib/agent/tool-registry.ts` — registrar aquí para que aparezca en el panel admin.

### Server-first
- Componentes Server por defecto. Client components solo cuando hay interactividad (estado, eventos, Framer Motion).
- Server Actions sobre API routes para mutaciones internas.
- Usar `@tanstack/react-query` para data fetching client-side cuando aplique.

### Cascadas críticas
Hay 3 cascadas que deben ser **transacciones atómicas**:
1. **Vehículo vendido** → 11 pasos (estado, deal, comisión, despublicación multi-canal, reasignación de leads).
2. **Match Inverso** → al crear vehículo, notificar vendedores, timeout 30 min → auto-notificar lead.
3. **Check-in post-visita** → 2h después de cita completada → WhatsApp al vendedor.

---

## Estilo visual

Inspirado en **Go High Level (GHL)**:
- Sidebar blanca (light mode), logo arriba, workspace selector, Search Ctrl+K
- Content area fondo `#F5F5F5`, cards blancas con borde `border-gray-200`
- Azul primario `#2563EB` para CTAs y badges
- 3 paneles en Conversaciones (lista / chat / detalle)
- Kanban con cards compactas en Pipeline
- **Framer Motion** para todas las animaciones (page transitions, modals, toasts)

---

## Convenciones de código

- `cn()` de `lib/utils.ts` (clsx + tailwind-merge) para clases condicionales.
- Enums Prisma en SCREAMING_SNAKE_CASE (ya definidos en schema).
- `workspaceId` es sagrado: validar en Server Action, verificar en query, asegurar con RLS.
- Strings mágicos → constantes con `as const`.
- Nunca `any` en TypeScript — usar `unknown` si no se conoce el tipo.
- Migraciones: `prisma migrate dev`. Excepción: triggers/funciones SQL (p. ej. `realtime_notify`) van como migración SQL escrita a mano.
- Background jobs: scheduler interno → API route `/api/jobs/*` (Bearer `CRON_SECRET`) → lógica en `lib/jobs/`.

---

## Módulos y orden de construcción

```
Fase 1A — Fundación:      Next.js + Prisma + Postgres (Railway) + Auth propia + multi-tenancy
Fase 1B — CRM Core:       Leads, Pipeline Kanban, Tareas, Citas
Fase 1C — Inventario:     Vehicles CRUD, fotos, alertas proactivas, price history
Fase 1D — Conversaciones: Bandeja unificada, webhooks canales, multimedia
Fase 1E — Agentes IA:     Knowledge Base, AiAgent CRUD, Tool Registry, orquestador
Fase 1F — Cascadas:       Match Inverso, despublicación, reasignación de leads
Fase 1G — WhatsApp Admin: Parser intents, confirmaciones, acciones críticas
Fase 1H — Automatizaciones: Constructor visual + Chat IA constructor
Fase 1I — Comisiones:     CommissionRule, cálculo auto, aprobación, reportes
Fase 1J — Integraciones:  Portales (Supercarros, CarMax RD, Encuentra24), Lead Ads, Google Calendar
Fase 1K — Pulido:         Audit Logs, búsqueda global, ClickHouse, tests E2E
```

---

## Estados y colores (consistencia visual)

| Color | Uso |
|---|---|
| Verde | Disponible, completado, éxito |
| Azul | Reservado, activo, en proceso |
| Naranja | Atención requerida (30+ días en lote) |
| Amarillo | Bloqueado, espera (45+ días) |
| Morado | Crítico (60+ días), comisión aprobada |
| Rojo | Vendido, vencido, crítico |
| Gris | Inactivo, cancelado |

---

## Anti-patterns a evitar

- Lógica de negocio en componentes React
- `useEffect` para fetch — usar RSC o React Query
- Polling — usar el SSE de `/api/realtime`
- Try/catch silenciosos
- Queries sin `workspaceId`
- Credenciales hardcodeadas (solo variables de entorno / `.env.local`; ver `.env.example`)
