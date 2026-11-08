-- Mensajes ricos de WhatsApp: ubicación/encuesta (meta), reacciones, edición y borrado.
-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "meta" JSONB,
ADD COLUMN     "reactions" JSONB;

