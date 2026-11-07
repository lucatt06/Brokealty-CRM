# Autónomo — Contexto y decisiones

Registro de decisiones tomadas durante la construcción, con el "por qué" detrás de cada una — para que futuras sesiones (humanas o IA) no las reabran sin motivo.

## Producto

- **Vertical, no genérico.** Se decidió construir un CRM específico para dealers de vehículos en vez de adaptar un CRM genérico, porque el flujo real (inventario ↔ leads ↔ match inverso ↔ comisión por venta) no encaja en un pipeline de ventas estándar.
- **H1G Auto Import como primer cliente**, pero con arquitectura multi-tenant desde el día 1 — no se construyó "para H1G" y luego se generalizó; cada feature se diseñó pensando en N dealers desde el inicio.
- **Sin Retell, sin n8n para el agente de IA.** Se optó por orquestación 100% en código Next.js (`lib/agent/orchestrator.ts`) en vez de herramientas low-code de terceros, para tener control total del contexto, las tools y el costo por tenant (tracking de tokens por workspace no sería trivial delegándolo a una plataforma externa).

## Infraestructura y deploy

- **Supabase Cloud (proyecto propio del usuario) + Vercel + Railway (Evolution API).** Se descartó un proyecto de Supabase creado inicialmente por Claude Code a favor del proyecto creado por el usuario directamente en su dashboard (`avzklxapoogwlgkcmanh`), para que la propiedad y facturación del proyecto quedaran claramente bajo la cuenta del usuario desde el principio.
- **Vercel Pro** en vez de reducir la frecuencia del cron de background jobs — el usuario prefirió pagar el upgrade antes que sacrificar la cadencia de los jobs (ej. recordatorios de citas, check-ins post-visita).
- **`prisma generate` explícito en `build`/`postinstall`** — Vercel cachea `node_modules` entre builds y no corre el generate implícito del que depende `next dev` localmente; sin esto, el cliente Prisma queda desactualizado en producción sin ningún error visible hasta runtime.
- Todos los errores de TypeScript reales (~20, nunca detectados en local porque `next dev` solo tipa por ruta bajo demanda) se corrigieron **antes** de publicar, por decisión explícita del usuario, en vez de diferirlos con un `ignoreBuildErrors`.

## Autenticación multi-tenant

- **Auto-provisioning en el primer login.** Se eligió que el registro/login nunca dependa de un paso manual de "crear mi workspace" — el primer login sin `User`/`Workspace` en Prisma dispara el bootstrap completo (usuario + workspace + pipeline default + membership). Motivo: un bug de página en blanco en producción se rastreó exactamente a la ausencia de este paso (login exitoso en Supabase Auth, pero sin fila correspondiente en Prisma, generando un loop de redirect entre `/login` y `/dashboard`).
- El **primer usuario del sistema completo** es automáticamente `SUPER_ADMIN` cross-workspace; esto es intencional y no debe cambiarse a una lista blanca de emails — simplifica el bootstrap inicial del producto sin depender de configuración externa.

## Tiempo real (Supabase Realtime) — historia completa

Esta fue la investigación más profunda de la construcción del producto hasta ahora, con varias causas raíz distintas encontradas en capas sucesivas:

1. **RLS inexistente para el caso de uso de Realtime.** Las políticas RLS preexistentes (`tenant_isolation`) dependían de `current_setting('app.current_workspace_id')`, una variable de sesión que la app **nunca establece** (Prisma se conecta con un rol que además bypassea RLS por completo). Realtime autentica con el JWT real del usuario (`auth.uid()`), así que se necesitaron políticas SELECT nuevas basadas en `auth.uid()`.
2. **Recursión de RLS.** La primera versión de esas políticas nuevas subconsultaba otras tablas también protegidas por RLS (`workspace_users`, `users`), y esa subconsulta se filtraba a sí misma devolviendo 0 filas — la política externa terminaba siendo siempre falsa. Se resolvió con una función `SECURITY DEFINER` (`public.user_workspace_access`) que bypassea RLS específicamente para esa verificación — el patrón recomendado por Supabase para este caso exacto.
3. **Migración "aplicada" que en realidad no lo estaba.** La migración que arregla la recursión se confirmó aplicada en un momento del desarrollo, pero **nunca llegó a producción** pese a estar committeada — solo se detectó consultando directamente `_prisma_migrations` en prod. **Lección operacional permanente: nunca dar por hecho que un `migrate deploy` anterior fue suficiente sin re-verificar contra la tabla de migraciones de producción.**
4. **La causa raíz final (la más sutil): el cliente de Supabase en el navegador nunca pasaba el JWT al socket de Realtime antes de suscribirse.** `createBrowserClient` de `@supabase/ssr` no propaga automáticamente el JWT del usuario a la conexión de Realtime — hace falta llamar explícitamente `supabase.realtime.setAuth(session.access_token)` después de `getSession()` y antes de `.subscribe()`. Esto se demostró con una prueba A/B en producción real (con y sin `setAuth`), usando un token de acceso real generado sin tocar la contraseña del usuario (magic link + OTP vía Admin API).

**Metodología de verificación desarrollada** (reutilizable para cualquier duda futura sobre RLS): simular la vista de un usuario autenticado específico directamente por SQL crudo dentro de una transacción — `SET LOCAL role authenticated; SET LOCAL request.jwt.claims = '{"sub":"<uuid>"}'; SELECT ...` — mucho más confiable que adivinar.

**Nota de entorno (no es un bug del código):** el contenedor Docker de Supabase CLI local tiene un problema de Realtime propio (su slot de replicación de Postgres Changes se conecta a la base `_supabase` interna en vez de la base `postgres` de la app) — Realtime nunca funciona de forma confiable en ese entorno local exacto sin importar qué tan correcto sea el código. Toda la verificación final de este feature se hizo contra producción, no localmente.

## Webhook de Evolution API (WhatsApp personal)

- **`messages.upsert` con `fromMe: true` no se descarta en bloque.** Inicialmente se ignoraban todos los eventos `fromMe: true` asumiendo que eran solo el eco de mensajes ya enviados por el CRM. Se detectó que también incluyen mensajes que el dealer escribe **directamente en el teléfono conectado**, fuera del CRM — esos se perdían silenciosamente. La solución fue diferenciar por dirección (registrar como `OUTBOUND` sin disparar al bot) en vez de descartar.
- **Un mismo `key.id` puede llegar más de una vez**, a veces primero sin contenido (`message` vacío, un eco de estado) y luego con el contenido real — el guard existente de "si no hay texto o teléfono, salir" ya cubría este caso correctamente por diseño, no era un bug.
- **`remoteJid` puede venir en formato "LID"** (`<id>@lid`) en vez del formato estándar `<telefono>@s.whatsapp.net` — identificado pero no manejado específicamente, porque en producción los eventos reales siempre llegaron en formato estándar hasta ahora.

## Decisiones de UI/UX

- **Framer Motion para todas las animaciones** (page transitions, modals, toasts) — preferencia global del usuario, no solo de este proyecto.
- **Estilo inspirado en Go High Level (GHL)**: sidebar blanca, área de contenido gris claro (`#F5F5F5`), azul primario `#2563EB`, 3 paneles en Conversaciones (lista/chat/detalle), Kanban compacto en Pipeline.
- **Reusar siempre el mismo componente/patrón ya diseñado** en vez de reinventar vistas por módulo — coherencia visual entre módulos es una prioridad explícita.
- El composer de mensajes debe expandirse y enfocar el cursor **en un solo click** — se resolvió con una callback ref en vez de `useEffect`+`useRef`, porque el `<textarea>` real no existe en el DOM hasta que `composerOpen` es `true` (con `AnimatePresence mode="wait"` de por medio, que retrasa el montaje del hijo nuevo hasta que termina la animación de salida del anterior) — un `useEffect` atado al click llega demasiado temprano.
- El panel de detalle del contacto en Conversaciones debe quedar fijo mientras el chat hace scroll — ya funcionaba correctamente antes de pedir el cambio explícito; se verificó en navegador en vez de asumir que hacía falta tocar código.
- El chat debe auto-scrollear al último mensaje conforme llegan o se envían mensajes nuevos (antes solo hacía scroll al cambiar de conversación).

## Seguridad operacional (aprendida en la práctica)

- **Nunca se ejecutan pagos, compras ni transferencias en nombre del usuario.**
- **Nunca se pegan ni reutilizan contraseñas del usuario** — cuando el usuario pegó una contraseña real en el chat por error, se le avisó una vez y no se usó para nada.
- **`git commit` combinado con `git add` en un solo comando con heredoc puede fallar silenciosamente** (sin error visible) — siempre se verifica con `git log`/`git status` después de cada commit.
- Login por navegador de Supabase CLI y Vercel CLI **debe ejecutarlo el propio usuario** en su terminal — no es posible completarlo de forma no interactiva.
