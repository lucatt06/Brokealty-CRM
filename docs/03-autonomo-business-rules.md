# Autónomo — Reglas de negocio

## 1. Multi-tenancy (regla sagrada)

- **Todo dato sensible tiene `workspaceId`**. Toda query lo incluye sin excepción — no hay endpoint ni server action que devuelva datos sin filtrar por tenant.
- **RLS en Supabase es la segunda línea de defensa** — nunca se confía solo en el filtro de la app. Esto quedó demostrado en la práctica: las políticas RLS basadas en `auth.uid()` fueron necesarias para que Supabase Realtime funcionara, porque Realtime autentica con el JWT real del usuario, no con ningún mecanismo propio de la app.
- Un usuario del workspace A **nunca** puede ver datos del workspace B.
- El **Super Admin** (Lucas) es cross-workspace — `workspaceId = null` a nivel de sesión, resuelve el tenant activo vía un selector en el sidebar (con cookie de tenant seleccionado).

## 2. Roles y alcance de datos

| Rol | Alcance |
|---|---|
| `SUPER_ADMIN` | Todos los workspaces. Puede crear, duplicar, suspender, reactivar y eliminar tenants; cambiar de plan; ver dashboard cross-tenant, uso de IA y auditoría. |
| `ADMIN_DEALER` | Su workspace completo — todos los leads/vehículos/conversaciones de todos los vendedores del dealer. |
| `VENDEDOR` | Solo sus propios leads asignados y sus propias métricas. |

## 3. Auto-provisioning de tenant

El primer login de un usuario de Supabase Auth sin `User`/`Workspace` en Prisma dispara un bootstrap automático: se crea `User` + `Workspace` + `Pipeline` default con sus `PipelineStage` estándar + `WorkspaceUser`. El **primer usuario del sistema completo** se vuelve `SUPER_ADMIN` cross-workspace; todos los siguientes se vuelven `ADMIN_DEALER` de un tenant nuevo. Esto existe para que el registro nunca deje a un usuario en un estado sin workspace (causa raíz de un bug de página en blanco resuelto en producción).

## 4. Agente de IA — reglas de operación

- **Sin Retell, sin n8n.** Orquestación 100% en código Next.js (`lib/agent/orchestrator.ts`).
- Flujo por mensaje entrante: verificar killswitch/pausa → cargar contexto (lead, historial, knowledge base) → llamar Claude API con tools → ejecutar tools → responder.
- Cada agente tiene un **modo de operación** (`AiAgentStatus`): `OFF` (apagado), `SUGGESTIVE` (sugiere respuesta, no la envía), `AUTO_PILOT` (responde solo).
- El bot **solo responde a mensajes que realmente vinieron del contacto** (`direction: INBOUND`, `fromMe: false` en el webhook). Un mensaje que el dealer escribe a mano en el teléfono conectado (`fromMe: true` pero no originado por el CRM) se registra como `OUTBOUND` pero **no dispara** al bot.
- `sleepOnManualMessage` / `sleepOnWorkflowMessage`: si un humano interviene manualmente en una conversación, el bot puede pausarse automáticamente para esa conversación (Human Handover / Stop Bot).
- Cada tool vive en un archivo (`lib/agent/tools/[nombre].ts`) con `name`, `description`, `inputSchema`, `execute()`, y se registra en `lib/agent/tool-registry.ts` para aparecer en el panel admin y ser asignable por agente (`assignedToolIds`).
- Multi-tenant real: cada agente usa la API key de IA **del workspace** si el tenant configuró la suya en Integraciones; si no, consume la key compartida de Autónomo (`AiUsageLog.usedSharedKey = true`), lo cual es la base para facturar consumo de IA por tenant.

## 5. Cascadas críticas (transacciones atómicas)

Estas tres cascadas **deben** ejecutarse como transacción atómica — un fallo a mitad de camino no puede dejar datos inconsistentes:

### 5.1. Vehículo vendido (11 pasos)
Al marcar un vehículo como `VENDIDO`: actualizar estado del vehículo → cerrar/crear el `Deal` correspondiente (`WON`) → calcular comisión → despublicar el vehículo en todos los portales/canales donde estaba publicado → reasignar o notificar a los leads que tenían este vehículo como interés (`interestedVehicleId`) de que ya no está disponible, sugiriendo alternativas.

### 5.2. Match Inverso
Al crear un vehículo nuevo en inventario: buscar leads cuyo `desiredMake/Model/Year/Color` calce con el vehículo recién llegado → notificar primero a los vendedores asignados a esos leads → si no hay acción en 30 minutos, auto-notificar directamente al lead (WhatsApp) que el vehículo que buscaba ya llegó.

### 5.3. Check-in post-visita
2 horas después de que una cita (`Appointment`) de tipo `VISITA_DEALER` (u otro tipo relevante) pase a `COMPLETADA`: enviar WhatsApp automático al vendedor asignado pidiendo que registre cómo fue la visita / siguiente paso.

## 6. Conversaciones y mensajería — reglas de canal

- **Deduplicación por `externalId`**: los webhooks de proveedores (Evolution/Meta) pueden reentregar el mismo evento más de una vez; antes de crear un `Message` se verifica que ese `externalId` no exista ya para ese canal.
- **Eco de mensajes propios**: cuando el CRM envía un mensaje, el propio webhook del proveedor puede devolver ese mismo mensaje como evento entrante (`fromMe: true`) — se descarta por el dedup de `externalId`, no se duplica ni se re-dispara el bot.
- **Estado de mensaje no retrocede**: un ACK de "entregado" que llega después de "leído" (por reordenamiento de red) nunca debe pisar el estado "leído" — se compara por rango (`SENT < DELIVERED < READ`) antes de actualizar.
- **Tiempo de espera configurable** (`waitTimeValue`/`waitTimeUnit`) antes de que el bot responda, para simular un tiempo de respuesta humano o agrupar mensajes seguidos del mismo lead.
- Un lead con `isAiHandled: false` en su conversación nunca recibe respuesta automática — solo un humano puede responder.

## 7. Inventario — reglas de alerta y estado

- Alertas proactivas por antigüedad en lote (`daysInLot`): **naranja** a partir de 30 días, **amarillo** a partir de 45 días, **morado/crítico** a partir de 60 días — pensado para presionar la rotación de inventario viejo.
- Cada cambio de precio genera un registro en `VehiclePriceHistory` (nunca se sobreescribe sin dejar rastro).
- Un vehículo `VENDIDO` no puede volver a publicarse en portales sin pasar explícitamente a otro estado.

## 8. Comisiones

- Las reglas de comisión (`CommissionRule`, fase 1I — pendiente de construcción) se calculan automáticamente al cerrar un `Deal` como `WON`, con flujo de aprobación antes de quedar en firme. Objetivo: eliminar el cálculo manual y sus errores.

## 9. Automatizaciones

- Cada `Automation` tiene **un trigger** (`AutomationTrigger`) y una o más `AutomationAction` ordenadas — se ejecutan en secuencia, no en paralelo, respetando `order`.
- El constructor es de texto libre asistido por IA (chat), no un builder visual de nodos — se prioriza velocidad de configuración sobre flexibilidad tipo n8n.

## 10. Seguridad y auditoría

- Toda acción del Super Admin sobre un tenant (crear, duplicar, suspender, reactivar, eliminar, cambiar de plan, cambiar de tenant activo) queda en `AuditLog`, con datos denormalizados (`actorName`, `workspaceName`) para que el registro sobreviva aunque se borre el actor o el tenant.
- Nunca se hardcodean credenciales — solo en `.env.local` / variables de entorno de Vercel. Si una contraseña o secreto aparece pegado en el chat, se marca al usuario y no se reutiliza.
- Nunca se saltan hooks de git ni verificaciones (`--no-verify`) para forzar un commit o deploy.

## 11. Anti-patterns explícitamente prohibidos

- Lógica de negocio en componentes React (debe vivir en server actions / `lib/`).
- `useEffect` para fetch de datos — usar RSC o React Query.
- Polling para "tiempo real" — usar Supabase Realtime.
- Try/catch silenciosos que oculten errores.
- Queries sin `workspaceId`.
- Migraciones de schema vía SQL manual saltándose `prisma migrate` (excepciones puntuales solo cuando `prisma generate` está bloqueado, y siempre documentadas).
