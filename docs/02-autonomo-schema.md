# Autónomo — Schema de datos

Fuente de verdad: [`prisma/schema.prisma`](../prisma/schema.prisma). Este documento es un mapa de lectura rápida del modelo de datos — para el detalle exacto de campos/tipos, siempre revisar el `.prisma` directamente (este doc puede quedar desactualizado si el schema cambia sin actualizarlo).

## Principio central: multi-tenancy

Toda tabla con datos sensibles tiene `workspaceId` (el tenant). No hay excepciones. La segunda línea de defensa es RLS en Supabase — la app nunca debe confiar solo en el filtro de Prisma.

## Mapa de modelos por dominio

### Tenant y usuarios
- **`Workspace`** — el tenant. `plan` (STARTER/PRO/ENTERPRISE), `isActive`, config regional (`currency`, `timezone`), IDs de canales (`whatsappNumber`, `facebookPageId`, `instagramHandle`).
- **`User`** — usuario global, ligado 1:1 a un `supabaseId` (Auth UID). Un usuario puede pertenecer a varios workspaces vía `WorkspaceUser`.
- **`WorkspaceUser`** — tabla puente `(workspaceId, userId)` única, con `role` (`SUPER_ADMIN` / `ADMIN_DEALER` / `VENDEDOR`) e `isActive`.

### Inventario
- **`Vehicle`** — ficha completa del vehículo: identificación (`vin` único, `sku` único), specs (`transmission`, `fuelType`, `bodyType`, `mileage`, `engineCC`), precios (`priceDOP`/`priceUSD`/`costDOP`), estado (`VehicleStatus`), tracking de lote (`lotLocation`, `daysInLot`, `arrivalDate`, `soldDate`).
- **`VehiclePhoto`** — fotos ordenables, con `isPrimary`.
- **`VehiclePriceHistory`** — snapshot de cada cambio de precio (para detectar bajadas de precio y alertas).

### Leads y CRM
- **`Lead`** — contacto + `source` (`LeadSource`), `score` (IA), `stage`/`pipelineId`, presupuesto (`budgetMin/Max`), campos de **match inverso** (`desiredMake/Model/Year/Color`) para notificar cuando llega el vehículo que el lead busca.
- **`Pipeline`** / **`PipelineStage`** — un workspace puede tener varios pipelines; cada etapa tiene `order`, `color`, `probability` y `rotDays` (umbral de alerta por inactividad).
- **`Deal`** — negocio ligado a un lead (y opcionalmente a un vehículo y una etapa), con `value`, `probability`, `status` (`DealStatus`: OPEN/WON/LOST).

### Conversaciones
- **`Conversation`** — hilo por lead + canal (`Channel`), con `isAiHandled` (si el bot está atendiendo) y `status` (`ConversationStatus`).
- **`Message`** — mensaje individual, `direction` (IN/OUT), `channel`, `externalId` (ID del proveedor, ej. WhatsApp message ID — usado para dedup y para correlacionar `messages.update`), `status` (`MessageStatus`: SENT/DELIVERED/READ/FAILED, con ticks estilo WhatsApp en UI).

### Calendario y tareas
- **`Appointment`** — cita con `type` (`AppointmentType`) y `status` (`AppointmentStatus`), usada por la cascada de check-in post-visita.
- **`Task`** — pendiente con `status`/`priority`, opcionalmente ligado a un lead.

### Campañas
- **`Campaign`** — envío masivo/secuencial/trigger por canal, con métricas agregadas (`totalSent`, `delivered`, `opened`, `clicked`, `replied`).

### Agentes de IA
- **`AIAgent`** — el agente configurado: `type` (`AgentType`), `status` (`AiAgentStatus`: OFF/SUGGESTIVE/AUTO_PILOT), `channels`, ajustes de comportamiento (tiempo de espera, si responde imágenes/notas de voz/PDFs), `model` (default `claude-sonnet-5`), `goal`/`personality`, `actions` + `actionsConfig` (Json, config por acción habilitada), `assignedToolIds`, `knowledgeBaseIds`.
- **`AgentTool`** — catálogo de tools disponibles por workspace (`ToolCategory`: PLATFORM/EXTRACTION/TRANSFER/ADD_TAG/REMOVE_TAG/CUSTOM/WORKFLOWS).
- **`KnowledgeBase`** / **`KnowledgeBaseItem`** — bases de conocimiento reutilizables entre agentes (`KnowledgeItemType`: TEXTO/PREGUNTA_FRECUENTE/ARCHIVO/URL/TABLA).

### Automatizaciones
- **`Automation`** — regla con `trigger` (`AutomationTrigger`) + `triggerConfig` (Json) y una o más `AutomationAction` ordenadas (`type` + `config` Json).

### Integraciones
- **`Integration`** — una por `(workspaceId, type)` (`IntegrationType`: canales de mensajería, portales, calendario, analytics, proveedores de IA), con `config` (Json) y estado de conexión.

### Soporte transversal
- **`Activity`** — log de eventos por lead/workspace (`ActivityType`), alimenta el timeline de cada lead.
- **`Notification`** — notificación in-app por usuario.
- **`Tag`** — etiquetas reutilizables, muchos-a-muchos con `Lead` y `Vehicle`.

### Super Admin (cross-tenant)
- **`AuditLog`** — acciones del Super Admin sobre tenants (creación, duplicación, suspensión, eliminación, cambio de plan, switch de tenant), con datos denormalizados (`actorName`, `workspaceName`) para que el log sobreviva aunque se borre el actor o el tenant.
- **`AiUsageLog`** — consumo de tokens de IA por workspace/agente, con flag `usedSharedKey` (si consumió la API key compartida de Autónomo o la propia del tenant) — base del billing por uso de IA.

## Enums clave (referencia)

| Enum | Valores |
|---|---|
| `Plan` | STARTER, PRO, ENTERPRISE |
| `Role` | SUPER_ADMIN, ADMIN_DEALER, VENDEDOR |
| `VehicleStatus` | DISPONIBLE, RESERVADO, VENDIDO, EN_PREPARACION, FUERA_DE_INVENTARIO |
| `LeadSource` | WHATSAPP, FACEBOOK, INSTAGRAM, TIKTOK, WEB, REFERIDO, MANUAL, LLAMADA, EMAIL, WALK_IN |
| `DealStatus` | OPEN, WON, LOST |
| `Channel` | WHATSAPP, WHATSAPP_PERSONAL, FACEBOOK, INSTAGRAM, SMS, EMAIL, LLAMADA, INTERNO |
| `MessageStatus` | SENT, DELIVERED, READ, FAILED |
| `AiAgentStatus` | OFF, SUGGESTIVE, AUTO_PILOT |
| `AutomationTrigger` | LEAD_CREATED, LEAD_STAGE_CHANGED, MESSAGE_RECEIVED, APPOINTMENT_CREATED, APPOINTMENT_REMINDER, VEHICLE_SOLD, TASK_DUE, INACTIVITY, CUSTOM |

## Índices relevantes (performance)

Los índices existentes están pensados para las queries más frecuentes de la app: `Vehicle` por `(workspaceId, status)` y `(workspaceId, make, model)`; `Lead` por `(workspaceId, stage)`, `(workspaceId, assignedTo)` y `phone` (lookup por número de WhatsApp entrante); `Conversation` por `(workspaceId, status)` y `(workspaceId, channel)`; `Message` por `(conversationId, sentAt)`; `Activity` por `(leadId, createdAt)` y `(workspaceId, createdAt)`.

## Migraciones

Siempre vía `npx prisma migrate dev --name <nombre>` (nunca SQL manual salvo excepción documentada — ver [04-autonomo-contexto-y-decisiones.md](04-autonomo-contexto-y-decisiones.md) para los dos casos puntuales donde se escribió SQL a mano por bloqueo de `prisma generate`). En producción, `npx prisma migrate deploy` contra el `DATABASE_URL`/`DIRECT_URL` de Supabase Cloud — **siempre verificar contra `_prisma_migrations` en prod que la migración quedó aplicada**, no asumir que un deploy anterior fue suficiente.
