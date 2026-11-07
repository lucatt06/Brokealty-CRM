# Autónomo — PRD General

## 1. Qué es

Autónomo es un SaaS multi-tenant de CRM vertical para dealers de vehículos en República Dominicana / LATAM. No es un CRM genérico adaptado: cada módulo (inventario, pipeline, conversaciones, agentes IA) está diseñado alrededor del flujo de trabajo real de un dealer de carros usados/nuevos.

El producto es independiente del cliente desde el día 1 — la arquitectura es multi-tenant aunque el primer (y por ahora único) cliente sea **H1G Auto Import**.

## 2. Problema que resuelve

Los dealers en RD hoy manejan leads y ventas repartidos entre WhatsApp personal, Facebook/Instagram DMs, hojas de Excel y memoria del vendedor. Esto genera:

- Leads que se pierden o se atienden tarde (el WhatsApp del vendedor se satura).
- Cero visibilidad del dueño/gerente sobre qué está pasando con cada lead o vehículo.
- Inventario que no se sincroniza con lo publicado en portales (Supercarros, CarMax RD, Encuentra24), vendiendo el mismo carro dos veces.
- Ningún seguimiento automático — el "match inverso" (avisar a un lead cuando llega el carro que buscaba) se hace de memoria o no se hace.
- Comisiones calculadas a mano, con fricción y errores.

## 3. Propuesta de valor

Un solo lugar donde:

1. **Todos los canales de conversación caen en una sola bandeja** (WhatsApp personal vía Evolution API, WhatsApp oficial/IG/FB vía Meta Business API, SMS, email) con historial completo por lead.
2. **Un agente de IA nativo** (sin Retell, sin n8n — orquestación 100% en código) puede responder, calificar, agendar citas y ejecutar acciones dentro de la conversación, con supervisión configurable (apagado / sugerido / piloto automático).
3. **El inventario es la fuente de verdad**: al vender un vehículo se dispara una cascada atómica que actualiza estado, deal, comisión, despublica en los portales conectados y reasigna leads interesados.
4. **El pipeline (Kanban) y las tareas/citas** dan visibilidad de gerencia sin pedirle reportes al vendedor.
5. **Automatizaciones configurables** (constructor visual + chat IA constructor) para reglas del tipo "si el lead lleva 3 días sin respuesta, notifica al vendedor".

## 4. Usuarios y roles

| Rol | Quién es | Alcance |
|---|---|---|
| `SUPER_ADMIN` | Lucas (dueño del producto) | Cross-workspace: ve y administra todos los tenants |
| `ADMIN_DEALER` | Dueño/gerente del dealer | Su workspace completo: inventario, leads de todos los vendedores, configuración, comisiones |
| `VENDEDOR` | Vendedor del dealer | Solo sus propios leads y sus métricas |

## 5. Primer cliente: H1G Auto Import

Dealer de referencia para validar el producto end-to-end antes de vender a otros dealers. Su WhatsApp personal (vía Evolution API / Railway) es el primer canal conectado en producción.

## 6. Módulos del producto

- **Dashboard** — KPIs del workspace (o cross-tenant si es Super Admin).
- **Inventario** — CRUD de vehículos, fotos, historial de precio, alertas por antigüedad en lote (30/45/60+ días).
- **Conversaciones** — bandeja unificada multicanal, en tiempo real (Supabase Realtime), con panel de detalle del lead.
- **Pipeline** — Kanban de negocios (deals) por etapa, con probabilidad y valor.
- **Leads** — listado y ficha de cada lead, con scoring IA y match inverso.
- **Calendarios** — citas (visita al dealer, llamada, video llamada, test drive, entrega, seguimiento).
- **Tareas** — pendientes asignadas, con prioridad y vencimiento.
- **Campañas** — broadcast/secuencia/trigger por canal, con métricas de entrega/apertura/click/respuesta.
- **Agentes IA** — creación y configuración de agentes conversacionales, con Knowledge Base, Tool Kit y modos de operación.
- **Automatizaciones** — reglas trigger → acciones, configurables sin código.
- **Integraciones** — conexión de canales (Evolution, Meta, Twilio, Resend), portales de publicación, Google Calendar.
- **Configuración** — datos del workspace, equipo, reglas de comisión.
- **Super Admin** (solo Lucas) — dashboard cross-tenant, gestión de tenants (crear/duplicar/suspender/eliminar), plan por tenant, tracking de uso de IA, auditoría.

## 7. Fuera de alcance (por ahora)

- Pagos/financiamiento integrado con bancos.
- App móvil nativa (el producto es web responsive).
- Marketplace propio de vehículos (se integra con portales existentes, no los reemplaza).

## 8. Métricas de éxito del producto

- Tiempo de primera respuesta a un lead entrante.
- % de leads que llegan a "Visitó Dealer" en el pipeline.
- Vehículos que rotan en más de 45 días (objetivo: bajar el promedio de días en lote).
- % de conversaciones resueltas por el agente IA sin intervención humana.
- Comisiones calculadas automáticamente vs. corregidas manualmente.

## 9. Stack (referencia rápida)

Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + Framer Motion · Supabase (Postgres + Auth + RLS) · Prisma · ClickHouse (analytics) · Upstash Redis (cache/colas) · Claude API nativo (agente IA) · OpenAI embeddings + Whisper · Pinecone (hybrid search) · Resend (email) · Evolution API (WhatsApp personal, self-hosted en Railway) · Meta Business API (WhatsApp oficial/IG/FB) · TikTok Business API · Twilio (SMS) · Vercel (deploy app).

Ver [02-autonomo-schema.md](02-autonomo-schema.md) para el modelo de datos completo y [03-autonomo-business-rules.md](03-autonomo-business-rules.md) para las reglas de negocio críticas.
