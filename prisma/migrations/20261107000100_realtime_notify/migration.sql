-- Tiempo real sin Supabase: cada cambio en messages/conversations emite un
-- NOTIFY en el canal `crm_events`; /api/realtime hace LISTEN y reenvía por SSE
-- solo los eventos del workspace de la sesión. El payload lleva ids, nunca contenido.

CREATE OR REPLACE FUNCTION notify_conversation_change() RETURNS trigger AS $$
DECLARE
  ws_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    ws_id := OLD."workspaceId";
  ELSE
    ws_id := NEW."workspaceId";
  END IF;
  PERFORM pg_notify('crm_events', json_build_object('table', 'conversations', 'workspaceId', ws_id)::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_message_change() RETURNS trigger AS $$
DECLARE
  conv_id text;
  ws_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    conv_id := OLD."conversationId";
  ELSE
    conv_id := NEW."conversationId";
  END IF;
  SELECT "workspaceId" INTO ws_id FROM conversations WHERE id = conv_id;
  IF ws_id IS NOT NULL THEN
    PERFORM pg_notify('crm_events', json_build_object('table', 'messages', 'workspaceId', ws_id)::text);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversations_notify
AFTER INSERT OR UPDATE OR DELETE ON conversations
FOR EACH ROW EXECUTE FUNCTION notify_conversation_change();

CREATE TRIGGER messages_notify
AFTER INSERT OR UPDATE OR DELETE ON messages
FOR EACH ROW EXECUTE FUNCTION notify_message_change();
